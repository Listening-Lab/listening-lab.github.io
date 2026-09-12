'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import AudioUploadModal from './AudioUploadModal'
import { ClassificationResult } from '@/lib/perchClient'

// ─── config ──────────────────────────────────────────────────────────────────

// Map (left panel) points
const MAP_POINT_SIZE_MIN       = 0.55  // minimum base size per point
const MAP_POINT_SIZE_RANGE     = 0.65  // random size added on top of min
const MAP_POINT_SELECTED_SCALE = 0.3   // size multiplier applied when a region is selected

// UMAP (right panel) points
const UMAP_POINT_HOVER_SCALE   = 2.0   // size multiplier when a point is hovered
const UMAP_RAYCASTER_THRESHOLD = 0.5   // world-unit hit radius for point picking
const UMAP_CAM_Z               = 6.16  // initial camera distance from origin
const UMAP_CAM_MIN_DIST        = 3     // minimum orbit zoom distance
const UMAP_CAM_MAX_DIST        = 30    // maximum orbit zoom distance
const UMAP_AUTO_ROTATE_SPEED   = 0.05  // auto-rotation speed

// UMAP ambient drift
const DRIFT_PHASE_X  = 1.73;  const DRIFT_PHASE_Y  = 0.91;  const DRIFT_PHASE_Z  = 1.37
const DRIFT_AMP_XY   = 0.09;  const DRIFT_AMP_Z    = 0.07
const DRIFT_FREQ_X   = 0.32;  const DRIFT_FREQ_Y   = 0.27;  const DRIFT_FREQ_Z   = 0.38

// Audio fade
const AUDIO_FADE_STEPS       = 80
const AUDIO_FADE_INTERVAL_MS = 50

// ─── coordinate system ───────────────────────────────────────────────────────
const MID_LON = 172.5, MID_LAT = -41.2, DEG_SCALE = 4 / 13

function ll2w(lon: number, lat: number): [number, number] {
  return [(lon - MID_LON) * DEG_SCALE, (lat - MID_LAT) * DEG_SCALE]
}

function pip(px: number, py: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside
  }
  return inside
}

// ─── types ───────────────────────────────────────────────────────────────────
export interface Recording {
  idx: number; id: number
  genus: string; species: string; englishName: string
  lat: number; lon: number
  regionIdx: number
  umapX: number; umapY: number; umapZ: number
  speciesIdx: number
  file: string
}

export interface NZRegion {
  id: string; name: string; color: string
  worldPolygons: [number, number][][][]
  bbox: { minX: number; maxX: number; minY: number; maxY: number }
}

export interface AppData {
  regions: NZRegion[]
  recordings: Recording[]
  speciesColors: string[]
  speciesKeys: string[]
  referenceCentroids?: Map<string, [number, number, number]>
  uxMid?: number
  uyMid?: number
  uzMid?: number
}

export interface SpeciesDetails {
  commonName: string
  scientificName: string
  description: string
  extract: string
  photoUrl: string
  photoAttribution: string
  conservationStatus: string
  rank: string
  order: string
  family: string
  genus: string
  class?: string
  observationsCount: string
  wikiUrl: string
  inatUrl: string
  ottUrl?: string
  audioUrl: string
}

// ─── palettes ────────────────────────────────────────────────────────────────
const REGION_COLORS = [
  '#4ecdc4','#ffe66d','#ff6b6b','#a8e6cf','#c3a6ff',
  '#ff9f43','#74b9ff','#fd79a8','#fdcb6e','#00b894',
  '#e17055','#6c5ce7','#00cec9','#55efc4','#ffeaa7','#fab1a0',
]

// ─── csv parser ──────────────────────────────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const out: string[] = []; let cur = '', q = false
  for (const c of line) {
    if (c === '"') q = !q
    else if (c === ',' && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  return [...out, cur]
}

function seededRng(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

// ─── data loader ─────────────────────────────────────────────────────────────
async function loadData(): Promise<AppData> {
  const [geoResp, csvResp] = await Promise.all([
    fetch('/regions.json'),
    fetch('/metadata_umap.csv'),
  ])
  const geoJSON = await geoResp.json()
  const csvText = await csvResp.text()

  const wrapLon = (lon: number) => lon < -170 ? lon + 360 : lon

  const regions: NZRegion[] = geoJSON.features.map((f: any, i: number) => {
    const raw: number[][][][] = f.geometry.type === 'MultiPolygon'
      ? f.geometry.coordinates : [f.geometry.coordinates]
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    const worldPolygons = raw.map(poly =>
      poly.map(ring => ring.map(([lon, lat]) => {
        const [x, y] = ll2w(wrapLon(lon), lat)
        if (x < minX) minX = x; if (x > maxX) maxX = x
        if (y < minY) minY = y; if (y > maxY) maxY = y
        return [x, y] as [number, number]
      }))
    )
    return { id: f.properties.id, name: f.properties.name, color: REGION_COLORS[i % REGION_COLORS.length], worldPolygons, bbox: { minX, maxX, minY, maxY } }
  })

  const lines = csvText.trim().split('\n').slice(1)
  const recs: Recording[] = []
  for (const line of lines) {
    const p = parseCSVLine(line)
    const lat = parseFloat(p[5]), lon = wrapLon(parseFloat(p[6]))
    const umapX = parseFloat(p[13]), umapY = parseFloat(p[14]), umapZ = parseFloat(p[15])
    if (!isNaN(lat) && !isNaN(lon) && !isNaN(umapX) && !isNaN(umapY) && !isNaN(umapZ))
      recs.push({ idx: recs.length, id: parseInt(p[0]), genus: p[1], species: p[2], englishName: p[3], lat, lon, regionIdx: -1, umapX, umapY, umapZ, speciesIdx: 0, file: p[12] })
  }

  const rings: { ri: number; ring: [number, number][] }[] = []
  regions.forEach((reg, ri) => reg.worldPolygons.forEach(poly => rings.push({ ri, ring: poly[0] })))
  recs.forEach(rec => {
    const [wx, wy] = ll2w(rec.lon, rec.lat)
    for (const { ri, ring } of rings) if (pip(wx, wy, ring)) { rec.regionIdx = ri; break }
  })

  let uxMin = Infinity, uxMax = -Infinity, uyMin = Infinity, uyMax = -Infinity, uzMin = Infinity, uzMax = -Infinity
  recs.forEach(r => {
    if (r.umapX < uxMin) uxMin = r.umapX; if (r.umapX > uxMax) uxMax = r.umapX
    if (r.umapY < uyMin) uyMin = r.umapY; if (r.umapY > uyMax) uyMax = r.umapY
    if (r.umapZ < uzMin) uzMin = r.umapZ; if (r.umapZ > uzMax) uzMax = r.umapZ
  })
  const uxMid = (uxMin + uxMax) / 2, uyMid = (uyMin + uyMax) / 2, uzMid = (uzMin + uzMax) / 2
  recs.forEach(r => { r.umapX -= uxMid; r.umapY -= uyMid; r.umapZ -= uzMid })

  const speciesKeys = Array.from(new Set(recs.map(r => `${r.genus}_${r.species}`)))
  const nSp = speciesKeys.length
  recs.forEach(rec => { rec.speciesIdx = speciesKeys.indexOf(`${rec.genus}_${rec.species}`) })

  const speciesColors = speciesKeys.map((_, i) =>
    '#' + new THREE.Color().setHSL(i / nSp, 0.75, 0.65).getHexString()
  )

  const referenceCentroids = new Map<string, [number, number, number]>()
  const speciesCounts = new Map<string, number>()
  recs.forEach(r => {
    const k = `${r.genus.toLowerCase()}_${r.species.toLowerCase()}`
    const existing = referenceCentroids.get(k) || [0, 0, 0]
    referenceCentroids.set(k, [existing[0] + r.umapX, existing[1] + r.umapY, existing[2] + r.umapZ])
    speciesCounts.set(k, (speciesCounts.get(k) || 0) + 1)
  })
  referenceCentroids.forEach((coords, k) => {
    const count = speciesCounts.get(k) || 1
    referenceCentroids.set(k, [coords[0] / count, coords[1] / count, coords[2] / count])
  })

  return { regions, recordings: recs, speciesColors, speciesKeys, referenceCentroids, uxMid, uyMid, uzMid }
}

// ─── shared shaders ──────────────────────────────────────────────────────────
const VERT = /* glsl */`
  attribute float aRegionIdx;
  attribute vec3  aRegionColor;
  attribute vec3  aSpeciesColor;
  attribute float aSize;
  varying vec3  vColor;
  varying float vAlpha;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSelectedRegion;
  uniform float uUseSpecies;
  void main() {
    bool noSel   = uSelectedRegion < -0.5;
    bool isSel   = abs(aRegionIdx - uSelectedRegion) < 0.5;
    bool unassigned = aRegionIdx < -0.5;
    vec3 baseCol = (uUseSpecies > 0.5 && isSel) ? aSpeciesColor : aRegionColor;
    vColor = baseCol;
    if (noSel || unassigned) vAlpha = 0.85;
    else vAlpha = isSel ? 1.0 : 0.25;
    float breathe = 1.0 + 0.08 * sin(uTime * 1.4 + position.x * 4.0 + position.y * 3.0);
    float sizeScale = noSel ? 1.0 : ${MAP_POINT_SELECTED_SCALE};
    float sz = aSize * breathe * sizeScale * uPixelRatio;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = sz * (32.0 / -mv.z);
    gl_Position  = projectionMatrix * mv;
  }
`
const FRAG = /* glsl */`
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    if (length(uv) > 0.5) discard;
    float a = (1.0 - smoothstep(0.32, 0.5, length(uv))) * vAlpha;
    gl_FragColor = vec4(vColor, a * 0.92);
  }
`

const UMAP_VERT = /* glsl */`
  attribute float aRegionIdx;
  attribute vec3  aRegionColor;
  attribute vec3  aSpeciesColor;
  attribute float aSize;
  attribute float aIdx;
  varying vec3  vColor;
  varying float vAlpha;
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSelectedRegion;
  uniform float uUseSpecies;
  uniform float uHoveredIdx;
  void main() {
    bool noSel     = uSelectedRegion < -0.5;
    bool isSel     = abs(aRegionIdx - uSelectedRegion) < 0.5;
    bool unassigned = aRegionIdx < -0.5;
    vec3 baseCol   = (uUseSpecies > 0.5 && isSel) ? aSpeciesColor : aRegionColor;
    vColor = baseCol;
    if (noSel || unassigned) vAlpha = 0.85;
    else vAlpha = isSel ? 1.0 : 0.25;

    float phase = position.x * ${DRIFT_PHASE_X} + position.y * ${DRIFT_PHASE_Y} + position.z * ${DRIFT_PHASE_Z};
    vec3 pos = position;
    pos.x += ${DRIFT_AMP_XY} * sin(uTime * ${DRIFT_FREQ_X} + phase);
    pos.y += ${DRIFT_AMP_XY} * cos(uTime * ${DRIFT_FREQ_Y} + phase * 1.3);
    pos.z += ${DRIFT_AMP_Z}  * sin(uTime * ${DRIFT_FREQ_Z} + phase * 0.8);

    bool isActive  = noSel || isSel;
    bool isHovered = isActive && (uHoveredIdx > -0.5) && abs(aIdx - uHoveredIdx) < 0.5;
    float breathe  = isHovered ? 1.0 : (1.0 + 0.10 * sin(uTime * 1.1 + phase));
    float hoverScale = isHovered ? float(${UMAP_POINT_HOVER_SCALE}) : 1.0;
    float sz = aSize * breathe * hoverScale * uPixelRatio;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = sz * (32.0 / -mv.z);
    gl_Position  = projectionMatrix * mv;
  }
`

const RIPPLE_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const RIPPLE_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform vec3  uColor;
  uniform float uAge;
  void main() {
    float d         = length(vUv - 0.5) * 2.0;
    float radius    = 0.08 + uAge * 0.82;
    float thickness = mix(0.18, 0.04, uAge);
    float ring      = max(0.0, 1.0 - abs(d - radius) / thickness);
    ring            = ring * ring;
    gl_FragColor    = vec4(uColor, ring * (1.0 - uAge) * 0.65);
  }
`

// ─── Three.js initialiser ────────────────────────────────────────────────────
function initThree(
  data: AppData,
  leftEl: HTMLDivElement,
  rightEl: HTMLDivElement,
  cb: {
    onHoverRegion: (name: string | null) => void
    onHoverPoint: (rec: Recording | null) => void
    onSelectPoint: (rec: Recording | null, pos?: { x: number; y: number } | null) => void
    onSelectRegion: (idx: number) => void
    getSelected: () => number
    getMuted: () => boolean
    onContextLost: () => void
  }
): () => void {

  const { regions, recordings, speciesColors } = data
  const n = recordings.length
  const PR = Math.min(devicePixelRatio, 2)

  const regionColArr = new Float32Array(n * 3)
  const speciesColArr = new Float32Array(n * 3)
  const regionIdxAttr = new Float32Array(n)
  const sizeAttr = new Float32Array(n)
  const rng2 = seededRng(7)

  const rc = new THREE.Color(), sc = new THREE.Color()
  recordings.forEach((rec, i) => {
    rc.set(rec.regionIdx >= 0 ? regions[rec.regionIdx].color : '#888888')
    sc.set(speciesColors[rec.speciesIdx] ?? '#ffffff')
    regionColArr[i*3]=rc.r; regionColArr[i*3+1]=rc.g; regionColArr[i*3+2]=rc.b
    speciesColArr[i*3]=sc.r; speciesColArr[i*3+1]=sc.g; speciesColArr[i*3+2]=sc.b
    regionIdxAttr[i] = rec.regionIdx
    sizeAttr[i] = MAP_POINT_SIZE_MIN + rng2() * MAP_POINT_SIZE_RANGE
  })

  function makeSharedUniforms(extra: Record<string, { value: unknown }> = {}) {
    return {
      uTime: { value: 0 },
      uPixelRatio: { value: PR },
      uSelectedRegion: { value: -1 },
      uUseSpecies: { value: 0 },
      uHoveredIdx: { value: -1 },
      ...extra,
    }
  }

  const idxAttr = new Float32Array(n)
  for (let i = 0; i < n; i++) idxAttr[i] = i

  function makePointsGeom(xs: Float32Array, ys: Float32Array, zs?: Float32Array) {
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      pos[i*3] = xs[i]; pos[i*3+1] = ys[i]; pos[i*3+2] = zs ? zs[i] : 0
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position',    new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aRegionIdx',  new THREE.BufferAttribute(regionIdxAttr, 1))
    g.setAttribute('aRegionColor',new THREE.BufferAttribute(regionColArr, 3))
    g.setAttribute('aSpeciesColor',new THREE.BufferAttribute(speciesColArr, 3))
    g.setAttribute('aSize',       new THREE.BufferAttribute(sizeAttr, 1))
    g.setAttribute('aIdx',        new THREE.BufferAttribute(idxAttr, 1))
    return g
  }

  // ── LEFT PANEL ──────────────────────────────────────────────────────────
  const leftRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  leftRenderer.setPixelRatio(PR)
  leftRenderer.setSize(leftEl.clientWidth, leftEl.clientHeight)
  leftRenderer.setClearColor(0x000000, 0)
  leftEl.appendChild(leftRenderer.domElement)

  const leftScene = new THREE.Scene()
  const leftCam = new THREE.PerspectiveCamera(52, leftEl.clientWidth / leftEl.clientHeight, 0.01, 50)
  leftCam.position.set(0, 0, 4.5)

  const cam = { baseX: 0, baseY: 0, baseZ: 4.5, curX: 0, curY: 0, curZ: 4.5, lookX: 0, lookY: 0 }
  const leftMouse = { nx: 0, ny: 0 }

  type RegionGroup = { fillMats: THREE.MeshBasicMaterial[]; outlineMats: THREE.LineBasicMaterial[] }
  const regionGroups = new Map<number, RegionGroup>()

  regions.forEach((reg, ri) => {
    const col = new THREE.Color(reg.color)
    const group: RegionGroup = { fillMats: [], outlineMats: [] }

    reg.worldPolygons.forEach(worldPoly => {
      const shape = new THREE.Shape()
      const outer = worldPoly[0]
      shape.moveTo(outer[0][0], outer[0][1])
      for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1])
      shape.closePath()
      for (let h = 1; h < worldPoly.length; h++) {
        const hole = new THREE.Path()
        hole.moveTo(worldPoly[h][0][0], worldPoly[h][0][1])
        for (let i = 1; i < worldPoly[h].length; i++) hole.lineTo(worldPoly[h][i][0], worldPoly[h][i][1])
        hole.closePath()
        shape.holes.push(hole)
      }
      try {
        const fillMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.10, side: THREE.DoubleSide, depthWrite: false })
        group.fillMats.push(fillMat)
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), fillMat)
        mesh.position.z = -0.15
        leftScene.add(mesh)
      } catch { /* skip */ }

      const verts: number[] = []
      outer.forEach(([x, y]) => verts.push(x, y, 0))
      verts.push(outer[0][0], outer[0][1], 0)
      const outGeo = new THREE.BufferGeometry()
      outGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
      const outMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
      group.outlineMats.push(outMat)
      leftScene.add(new THREE.Line(outGeo, outMat))
    })

    regionGroups.set(ri, group)
  })

  const mapXs = new Float32Array(n), mapYs = new Float32Array(n)
  recordings.forEach((rec, i) => { const [x, y] = ll2w(rec.lon, rec.lat); mapXs[i]=x; mapYs[i]=y })
  const leftGeo = makePointsGeom(mapXs, mapYs)
  const leftMat = new THREE.ShaderMaterial({
    uniforms: makeSharedUniforms(),
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: false,
  })
  const leftPoints = new THREE.Points(leftGeo, leftMat)
  leftScene.add(leftPoints)

  const regionHitMeshes: { mesh: THREE.Mesh; ri: number }[] = []
  regions.forEach((reg, ri) => {
    reg.worldPolygons.forEach(worldPoly => {
      const shape = new THREE.Shape()
      const outer = worldPoly[0]
      shape.moveTo(outer[0][0], outer[0][1])
      for (let i = 1; i < outer.length; i++) shape.lineTo(outer[i][0], outer[i][1])
      shape.closePath()
      try {
        const hitMesh = new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
        )
        hitMesh.position.z = -0.1
        leftScene.add(hitMesh)
        regionHitMeshes.push({ mesh: hitMesh, ri })
      } catch { /* skip */ }
    })
  })

  const ripples: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; born: number; life: number }[] = []
  let lastRippleTime = -99
  let lastRippleIdx = -1
  const RIPPLE_SIZE = 0.7
  const RIPPLE_LIFE = 1.0

  function spawnRipple(wx: number, wy: number, color: string, pointIdx: number) {
    const now = leftClock.getElapsedTime()
    const samePoint = pointIdx === lastRippleIdx
    const minGap = samePoint ? 1.0 : 0.25
    if (now - lastRippleTime < minGap) return
    lastRippleTime = now
    lastRippleIdx = pointIdx

    const mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uAge: { value: 0 } },
      vertexShader: RIPPLE_VERT, fragmentShader: RIPPLE_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(RIPPLE_SIZE, RIPPLE_SIZE), mat)
    mesh.position.set(wx, wy, 0.05)
    leftScene.add(mesh)
    ripples.push({ mesh, mat, born: now, life: RIPPLE_LIFE })
  }

  const leftRaycaster = new THREE.Raycaster()
  const leftMouse2D = new THREE.Vector2()
  let leftHoveredRi = -1

  let panX = 0, panY = 0
  const PAN_LIMIT_X = 3.5
  const PAN_LIMIT_Y = 2.0
  let isDragging = false
  let dragLast = { x: 0, y: 0 }
  let dragDist = 0

  const onLeftMouseDown = (e: MouseEvent) => {
    isDragging = true; dragDist = 0
    dragLast = { x: e.clientX, y: e.clientY }
  }
  const onLeftMouseUp = () => { isDragging = false }

  const onLeftMouseMove = (e: MouseEvent) => {
    const rect = leftEl.getBoundingClientRect()
    leftMouse.nx = (e.clientX - rect.left) / rect.width - 0.5
    leftMouse.ny = (e.clientY - rect.top)  / rect.height - 0.5
    leftMouse2D.x = leftMouse.nx * 2
    leftMouse2D.y = -leftMouse.ny * 2

    if (isDragging) {
      const dx = e.clientX - dragLast.x, dy = e.clientY - dragLast.y
      dragDist += Math.abs(dx) + Math.abs(dy)
      const visH = 2 * cam.curZ * Math.tan(leftCam.fov * Math.PI / 360)
      const visW = visH * leftCam.aspect
      panX = Math.max(-PAN_LIMIT_X, Math.min(PAN_LIMIT_X, panX - dx / rect.width  * visW))
      panY = Math.max(-PAN_LIMIT_Y, Math.min(PAN_LIMIT_Y, panY + dy / rect.height * visH))
      dragLast = { x: e.clientX, y: e.clientY }
    }
  }

  const onLeftClick = () => {
    if (dragDist > 4) return
    if (leftHoveredRi >= 0) {
      const cur = cb.getSelected()
      const next = leftHoveredRi === cur ? -1 : leftHoveredRi
      cb.onSelectRegion(next)
      updateSelection(next)
    }
  }

  leftEl.addEventListener('mousedown', onLeftMouseDown)
  leftEl.addEventListener('mousemove', onLeftMouseMove)
  leftEl.addEventListener('click', onLeftClick)
  window.addEventListener('mouseup', onLeftMouseUp)

  const onLeftTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    isDragging = true; dragDist = 0
    dragLast = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    const touch = e.touches[0]
    const rect = leftEl.getBoundingClientRect()
    leftMouse.nx = (touch.clientX - rect.left) / rect.width - 0.5
    leftMouse.ny = (touch.clientY - rect.top)  / rect.height - 0.5
    leftMouse2D.x = leftMouse.nx * 2
    leftMouse2D.y = -leftMouse.ny * 2
  }

  const onLeftTouchMove = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    e.preventDefault()
    const touch = e.touches[0]
    const rect = leftEl.getBoundingClientRect()
    leftMouse.nx = (touch.clientX - rect.left) / rect.width - 0.5
    leftMouse.ny = (touch.clientY - rect.top)  / rect.height - 0.5
    leftMouse2D.x = leftMouse.nx * 2
    leftMouse2D.y = -leftMouse.ny * 2
    const dx = touch.clientX - dragLast.x, dy = touch.clientY - dragLast.y
    dragDist += Math.abs(dx) + Math.abs(dy)
    const visH = 2 * cam.curZ * Math.tan(leftCam.fov * Math.PI / 360)
    const visW = visH * leftCam.aspect
    panX = Math.max(-PAN_LIMIT_X, Math.min(PAN_LIMIT_X, panX - dx / rect.width  * visW))
    panY = Math.max(-PAN_LIMIT_Y, Math.min(PAN_LIMIT_Y, panY + dy / rect.height * visH))
    dragLast = { x: touch.clientX, y: touch.clientY }
  }

  const onLeftTouchEnd = (e: TouchEvent) => {
    isDragging = false
    if (dragDist > 8 || e.changedTouches.length !== 1) return
    let targetRi = leftHoveredRi
    if (targetRi < 0) {
      const touch = e.changedTouches[0]
      const rect = leftEl.getBoundingClientRect()
      leftMouse2D.x =  ((touch.clientX - rect.left) / rect.width)  * 2 - 1
      leftMouse2D.y = -((touch.clientY - rect.top)  / rect.height) * 2 + 1
      leftRaycaster.setFromCamera(leftMouse2D, leftCam)
      const hits = leftRaycaster.intersectObjects(regionHitMeshes.map(r => r.mesh))
      targetRi = hits.length > 0 ? (regionHitMeshes.find(r => r.mesh === hits[0].object)?.ri ?? -1) : -1
    }
    if (targetRi >= 0) {
      const cur = cb.getSelected()
      const next = targetRi === cur ? -1 : targetRi
      cb.onSelectRegion(next)
      updateSelection(next)
    }
  }

  leftEl.addEventListener('touchstart', onLeftTouchStart, { passive: true })
  leftEl.addEventListener('touchmove',  onLeftTouchMove,  { passive: false })
  leftEl.addEventListener('touchend',   onLeftTouchEnd,   { passive: true })

  function updateSelection(ri: number) {
    panX = 0; panY = 0
    const sel = ri >= 0 ? ri : -1
    leftMat.uniforms.uSelectedRegion.value = sel
    leftMat.uniforms.uUseSpecies.value = sel >= 0 ? 1 : 0
    rightMat.uniforms.uSelectedRegion.value = sel
    rightMat.uniforms.uUseSpecies.value = sel >= 0 ? 1 : 0

    regionGroups.forEach((group, groupRi) => {
      const isSelected = groupRi === sel
      const showAll = sel < 0
      group.fillMats.forEach(m => { m.opacity = showAll ? 0.10 : isSelected ? 0.20 : 0.06 })
      group.outlineMats.forEach(m => { m.opacity = showAll ? 0.55 : isSelected ? 0.85 : 0.35 })
    })

    if (sel >= 0) {
      const bbox = regions[sel].bbox
      const cx = (bbox.minX + bbox.maxX) / 2
      const cy = (bbox.minY + bbox.maxY) / 2
      const size = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 1.4
      const fovR = leftCam.fov * Math.PI / 180
      const dist = (size / 2) / Math.tan(fovR / 2) / Math.min(1, leftCam.aspect)
      cam.baseX = cx; cam.baseY = cy; cam.baseZ = Math.min(dist, 6)
      cam.lookX = cx; cam.lookY = cy
    } else {
      cam.baseX = 0; cam.baseY = 0; cam.baseZ = 4.5
      cam.lookX = 0; cam.lookY = 0
    }
  }

  const leftClock = new THREE.Clock()
  let leftAnimId = 0

  const animateLeft = () => {
    leftAnimId = requestAnimationFrame(animateLeft)
    const t = leftClock.getElapsedTime()
    leftMat.uniforms.uTime.value = t

    leftRaycaster.setFromCamera(leftMouse2D, leftCam)
    const hits = leftRaycaster.intersectObjects(regionHitMeshes.map(r => r.mesh))
    const newHov = hits.length > 0 ? regionHitMeshes.find(r => r.mesh === hits[0].object)?.ri ?? -1 : -1
    if (newHov !== leftHoveredRi) {
      leftHoveredRi = newHov
      cb.onHoverRegion(newHov >= 0 ? regions[newHov].name : null)
      regionGroups.forEach((group, ri) => {
        if (ri === newHov && cb.getSelected() < 0) {
          group.fillMats.forEach(m => m.opacity = 0.22)
          group.outlineMats.forEach(m => m.opacity = 0.9)
        } else if (cb.getSelected() < 0) {
          group.fillMats.forEach(m => m.opacity = 0.10)
          group.outlineMats.forEach(m => m.opacity = 0.55)
        }
      })
    }

    const px = leftMouse.nx * 0.45, py = -leftMouse.ny * 0.30
    cam.curX += (cam.baseX + panX + px - cam.curX) * 0.06
    cam.curY += (cam.baseY + panY + py - cam.curY) * 0.06
    cam.curZ += (cam.baseZ             - cam.curZ) * 0.06
    leftCam.position.set(cam.curX, cam.curY, cam.curZ)
    leftCam.lookAt(cam.lookX + panX, cam.lookY + panY, 0)

    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]
      const age = Math.min(1, (t - rp.born) / rp.life)
      rp.mat.uniforms.uAge.value = age
      if (age >= 1) { leftScene.remove(rp.mesh); rp.mat.dispose(); ripples.splice(i, 1) }
    }

    leftRenderer.render(leftScene, leftCam)
  }
  animateLeft()

  // ── RIGHT PANEL (UMAP) ──────────────────────────────────────────────────
  const rightRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  rightRenderer.setPixelRatio(PR)
  rightRenderer.setSize(rightEl.clientWidth, rightEl.clientHeight)
  rightRenderer.setClearColor(0x000000, 0)
  rightEl.appendChild(rightRenderer.domElement)

  leftRenderer.domElement.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    cb.onContextLost()
  }, false)

  const rightScene = new THREE.Scene()
  const rightCam = new THREE.PerspectiveCamera(58, rightEl.clientWidth / rightEl.clientHeight, 0.1, 100)
  rightCam.position.set(0, 0, UMAP_CAM_Z)

  const rightControls = new OrbitControls(rightCam, rightRenderer.domElement)
  rightControls.enableDamping = true
  rightControls.dampingFactor = 0.06
  rightControls.zoomSpeed = 0.8
  rightControls.autoRotate = true
  rightControls.autoRotateSpeed = UMAP_AUTO_ROTATE_SPEED
  rightControls.minDistance = UMAP_CAM_MIN_DIST
  rightControls.maxDistance = UMAP_CAM_MAX_DIST

  const umapXs = new Float32Array(n), umapYs = new Float32Array(n), umapZs = new Float32Array(n)
  recordings.forEach((rec, i) => { umapXs[i]=rec.umapX; umapYs[i]=rec.umapY; umapZs[i]=rec.umapZ })
  const rightGeo = makePointsGeom(umapXs, umapYs, umapZs)
  const rightMat = new THREE.ShaderMaterial({
    uniforms: makeSharedUniforms(),
    vertexShader: UMAP_VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: false,
  })
  rightScene.add(new THREE.Points(rightGeo, rightMat))

  // User uploaded points group
  const userGroup = new THREE.Group()
  rightScene.add(userGroup)
  const userMeshes: THREE.Mesh[] = []

  const rightRaycaster = new THREE.Raycaster()
  rightRaycaster.params.Points = { threshold: UMAP_RAYCASTER_THRESHOLD }
  const rightMouse2D = new THREE.Vector2(-9999, -9999)
  let rightAnimId = 0
  const rightClock = new THREE.Clock()

  const onRightMouseMove = (e: MouseEvent) => {
    const rect = rightEl.getBoundingClientRect()
    rightMouse2D.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
    rightMouse2D.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
  }
  const onRightMouseLeave = () => { rightMouse2D.set(-9999, -9999) }
  rightEl.addEventListener('mousemove', onRightMouseMove)
  rightEl.addEventListener('mouseleave', onRightMouseLeave)

  let rightTouchStart = { x: 0, y: 0, time: 0 }
  let rightTouchHoldTimer: ReturnType<typeof setTimeout> | null = null

  const onRightTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    rightTouchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() }
  }

  const onRightTouchEnd = (e: TouchEvent) => {
    if (e.changedTouches.length !== 1) return
    const touch = e.changedTouches[0]
    const dx = touch.clientX - rightTouchStart.x
    const dy = touch.clientY - rightTouchStart.y
    if (Math.sqrt(dx * dx + dy * dy) > 12 || Date.now() - rightTouchStart.time > 400) return
    const rect = rightEl.getBoundingClientRect()
    rightMouse2D.x =  ((touch.clientX - rect.left) / rect.width)  * 2 - 1
    rightMouse2D.y = -((touch.clientY - rect.top)  / rect.height) * 2 + 1
    
    // Trigger tap selection if point hovered
    if (lastHoveredIdx >= 0) {
      if (clickedAudioIdx >= 0) stopAudio(clickedAudioIdx)
      clickedAudioIdx = lastHoveredIdx
      const rec = recordings[clickedAudioIdx]
      playAudio(clickedAudioIdx, rec.file)
      const parentRect = rightEl.parentElement?.getBoundingClientRect() || rect
      cb.onSelectPoint(rec, { x: touch.clientX - parentRect.left, y: touch.clientY - parentRect.top })
    }

    if (rightTouchHoldTimer) clearTimeout(rightTouchHoldTimer)
    rightTouchHoldTimer = setTimeout(() => { rightMouse2D.set(-9999, -9999) }, 3000)
  }

  rightEl.addEventListener('touchstart', onRightTouchStart, { passive: true })
  rightEl.addEventListener('touchend',   onRightTouchEnd,   { passive: true })

  // Right panel click → play audio & select point for species popup
  let clickedAudioIdx = -1

  const onRightClick = (e: MouseEvent) => {
    if (lastHoveredIdx < 0) {
      if (clickedAudioIdx >= 0) { stopAudio(clickedAudioIdx); clickedAudioIdx = -1 }
      cb.onSelectPoint(null)
    } else {
      if (clickedAudioIdx >= 0) stopAudio(clickedAudioIdx)
      clickedAudioIdx = lastHoveredIdx
      const rec = recordings[clickedAudioIdx]
      playAudio(clickedAudioIdx, rec.file)
      const parentRect = rightEl.parentElement?.getBoundingClientRect() || rightEl.getBoundingClientRect()
      cb.onSelectPoint(rec, { x: e.clientX - parentRect.left, y: e.clientY - parentRect.top })
    }
  }
  rightEl.addEventListener('click', onRightClick)

  // Audio playback
  type AudioEntry = { el: HTMLAudioElement; fadeTimer: ReturnType<typeof setInterval> | null }
  const activeAudio = new Map<number, AudioEntry>()

  function playAudio(idx: number, url: string) {
    if (activeAudio.has(idx)) return
    const el = new Audio(url)
    el.muted = cb.getMuted()
    el.volume = 0
    el.play().catch(() => {})
    let vol = 0
    const fadeStep = 1 / AUDIO_FADE_STEPS
    const fadeIn = setInterval(() => {
      vol = Math.min(1, vol + fadeStep)
      el.volume = vol
      if (vol >= 1) clearInterval(fadeIn)
    }, AUDIO_FADE_INTERVAL_MS)
    activeAudio.set(idx, { el, fadeTimer: null })
  }

  function stopAudio(idx: number) {
    const entry = activeAudio.get(idx)
    if (!entry) return
    if (entry.fadeTimer) clearInterval(entry.fadeTimer)
    let vol = entry.el.volume
    const fadeStep = 1 / AUDIO_FADE_STEPS
    entry.fadeTimer = setInterval(() => {
      vol = Math.max(0, vol - fadeStep)
      entry.el.volume = vol
      if (vol <= 0) {
        clearInterval(entry.fadeTimer!)
        entry.el.pause()
        entry.el.src = ''
        activeAudio.delete(idx)
      }
    }, AUDIO_FADE_INTERVAL_MS)
  }

  function stopAllAudio() {
    activeAudio.forEach((_, idx) => stopAudio(idx))
  }

  let lastHoveredIdx = -1
  const _proj = new THREE.Vector3()
  const rightPointsObj = rightScene.children[0] as THREE.Points

  const animateRight = () => {
    rightAnimId = requestAnimationFrame(animateRight)
    const t = rightClock.getElapsedTime()
    rightMat.uniforms.uTime.value = t

    rightRaycaster.setFromCamera(rightMouse2D, rightCam)
    const hits = rightRaycaster.intersectObject(rightPointsObj)
    let hitIdx = -1
    if (hits.length > 0) {
      const posAttr = rightPointsObj.geometry.getAttribute('position')
      let bestScreenDist = Infinity
      for (const hit of hits) {
        if (hit.index == null) continue
        const bx = posAttr.getX(hit.index)
        const by = posAttr.getY(hit.index)
        const bz = posAttr.getZ(hit.index)
        const phase = bx * DRIFT_PHASE_X + by * DRIFT_PHASE_Y + bz * DRIFT_PHASE_Z
        _proj.set(
          bx + DRIFT_AMP_XY * Math.sin(t * DRIFT_FREQ_X + phase),
          by + DRIFT_AMP_XY * Math.cos(t * DRIFT_FREQ_Y + phase * 1.3),
          bz + DRIFT_AMP_Z  * Math.sin(t * DRIFT_FREQ_Z + phase * 0.8),
        )
        _proj.project(rightCam)
        const dx = _proj.x - rightMouse2D.x
        const dy = _proj.y - rightMouse2D.y
        const screenDist = dx * dx + dy * dy
        if (screenDist < bestScreenDist) { bestScreenDist = screenDist; hitIdx = hit.index }
      }
    }

    if (hitIdx !== lastHoveredIdx) {
      lastHoveredIdx = hitIdx
      rightMat.uniforms.uHoveredIdx.value = hitIdx
      if (hitIdx >= 0) {
        const rec = recordings[hitIdx]
        cb.onHoverPoint(rec)
        const sel = cb.getSelected()
        const isActive = sel < 0 || rec.regionIdx === sel
        if (isActive) {
          const [wx, wy] = ll2w(rec.lon, rec.lat)
          spawnRipple(wx, wy, rec.regionIdx >= 0 ? regions[rec.regionIdx].color : '#ffffff', hitIdx)
        }
      } else {
        cb.onHoverPoint(null)
      }
    }

    // Animate user rings (billboard & pulse)
    userGroup.children.forEach((child, i) => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.RingGeometry) {
        const pulse = 1.0 + 0.22 * Math.sin(t * 3.5 + i)
        child.scale.set(pulse, pulse, pulse)
        child.lookAt(rightCam.position)
      }
    })

    rightControls.update()
    rightRenderer.render(rightScene, rightCam)
  }
  animateRight()

  const onResize = () => {
    leftCam.aspect = leftEl.clientWidth / leftEl.clientHeight
    leftCam.updateProjectionMatrix()
    leftRenderer.setSize(leftEl.clientWidth, leftEl.clientHeight)

    rightCam.aspect = rightEl.clientWidth / rightEl.clientHeight
    rightCam.updateProjectionMatrix()
    rightRenderer.setSize(rightEl.clientWidth, rightEl.clientHeight)
  }
  const resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(leftEl)
  resizeObserver.observe(rightEl)
  const addUserPoint = (rec: ClassificationResult) => {
    // 1. Glowing marker sphere
    const sphereGeom = new THREE.SphereGeometry(0.16, 24, 24)
    const sphereMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#4ecdc4'),
    })
    const sphere = new THREE.Mesh(sphereGeom, sphereMat)
    sphere.position.set(rec.umapCoords[0], rec.umapCoords[1], rec.umapCoords[2])
    sphere.userData = { userRec: rec }
    userGroup.add(sphere)
    userMeshes.push(sphere)

    // 2. Pulsing outer halo ring
    const ringGeom = new THREE.RingGeometry(0.24, 0.36, 32)
    const ringMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffe66d'),
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    })
    const ring = new THREE.Mesh(ringGeom, ringMat)
    ring.position.copy(sphere.position)
    userGroup.add(ring)

    // 3. Smoothly animate camera target to focus on new point
    const startTarget = rightControls.target.clone()
    const endTarget = sphere.position.clone()
    let lerpProgress = 0
    const lerpTimer = setInterval(() => {
      lerpProgress += 0.05
      rightControls.target.lerpVectors(startTarget, endTarget, lerpProgress)
      if (lerpProgress >= 1) clearInterval(lerpTimer)
    }, 16)

    // 4. Spawn ripple on map
    if (typeof rec.lat === 'number' && typeof rec.lon === 'number') {
      const [wx, wy] = ll2w(rec.lon, rec.lat)
      spawnRipple(wx, wy, '#4ecdc4', -999)
      setTimeout(() => spawnRipple(wx, wy, '#ffe66d', -999), 350)
    }
  }

  // expose updateSelection, setMuted, addUserPoint so React can call them
  ;(leftEl as any).__updateSelection = updateSelection
  ;(rightEl as any).__setMuted = (m: boolean) => {
    activeAudio.forEach(entry => { entry.el.muted = m })
  }
  ;(rightEl as any).__addUserPoint = addUserPoint

  return () => {
    cancelAnimationFrame(leftAnimId)
    cancelAnimationFrame(rightAnimId)
    stopAllAudio()
    resizeObserver.disconnect()
    leftEl.removeEventListener('mousedown', onLeftMouseDown)
    leftEl.removeEventListener('mousemove', onLeftMouseMove)
    leftEl.removeEventListener('click', onLeftClick)
    window.removeEventListener('mouseup', onLeftMouseUp)
    rightEl.removeEventListener('mousemove', onRightMouseMove)
    rightEl.removeEventListener('mouseleave', onRightMouseLeave)
    rightEl.removeEventListener('click', onRightClick)
    leftEl.removeEventListener('touchstart', onLeftTouchStart)
    leftEl.removeEventListener('touchmove',  onLeftTouchMove)
    leftEl.removeEventListener('touchend',   onLeftTouchEnd)
    rightEl.removeEventListener('touchstart', onRightTouchStart)
    rightEl.removeEventListener('touchend',   onRightTouchEnd)
    if (rightTouchHoldTimer) clearTimeout(rightTouchHoldTimer)
    leftRenderer.dispose(); rightRenderer.dispose()
    if (leftEl.contains(leftRenderer.domElement)) leftEl.removeChild(leftRenderer.domElement)
    if (rightEl.contains(rightRenderer.domElement)) rightEl.removeChild(rightRenderer.domElement)
  }
}

function normalizeText(text?: string | null): string {
  if (!text) return ''
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

// ─── Open Tree of Life (OTT 3.7) API helper ──────────────────────────────────
interface OpenTreeTaxon {
  ottId?: number
  rank?: string
  order?: string
  family?: string
  genus?: string
  className?: string
  phylum?: string
  kingdom?: string
}

async function fetchOpenTreeTaxon(rec: Recording): Promise<OpenTreeTaxon | null> {
  const queryNames = [
    `${rec.genus} ${rec.species}`.trim(),
    rec.genus.trim(),
  ].filter(Boolean)

  try {
    const matchRes = await fetch('https://api.opentreeoflife.org/v3/tnrs/match_names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names: queryNames }),
    })
    if (!matchRes.ok) return null
    const matchJson = await matchRes.json()
    const firstResult = matchJson.results?.find((r: any) => r.matches && r.matches.length > 0)
    const match = firstResult?.matches?.[0]
    if (!match?.taxon?.ott_id) return null

    const ottId: number = match.taxon.ott_id
    const infoRes = await fetch('https://api.opentreeoflife.org/v3/taxonomy/taxon_info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ott_id: ottId, include_lineage: true }),
    })
    if (!infoRes.ok) return { ottId, rank: match.taxon.rank }
    const infoJson = await infoRes.json()
    const lineage: any[] = infoJson.lineage || []

    const genus = lineage.find(l => l.rank === 'genus')?.name || rec.genus
    const family = lineage.find(l => l.rank === 'family')?.name
    const order = lineage.find(l => l.rank === 'order')?.name
    const className = lineage.find(l => l.rank === 'class')?.name
    const phylum = lineage.find(l => l.rank === 'phylum')?.name
    const kingdom = lineage.find(l => l.rank === 'kingdom')?.name

    return {
      ottId,
      rank: match.taxon.rank || infoJson.rank,
      order,
      family,
      genus,
      className,
      phylum,
      kingdom,
    }
  } catch (e) {
    console.warn('Open Tree of Life query error:', e)
    return null
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function AcousticMapDemo() {
  const leftRef     = useRef<HTMLDivElement>(null)
  const rightRef    = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const popupRef    = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(-1)

  const [mountKey, setMountKey] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [hoveredPoint, setHoveredPoint] = useState<{ name: string; region: string } | null>(null)
  const [dataRef, setDataRef] = useState<AppData | null>(null)
  const mutedRef = useRef(false)
  const [muted, setMuted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [activePanel, setActivePanel] = useState<'map' | 'umap'>('map')
  const [mapEngaged, setMapEngaged] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [userRecordings, setUserRecordings] = useState<ClassificationResult[]>([])

  const handleClassifiedAudio = (result: ClassificationResult) => {
    setUserRecordings(prev => [...prev, result])
    if ((rightRef.current as any)?.__addUserPoint) {
      ;(rightRef.current as any).__addUserPoint(result)
    }
  }

  // Species popup & pointer preview state
  const [selectedPoint, setSelectedPoint] = useState<Recording | null>(null)
  const [speciesInfo, setSpeciesInfo] = useState<SpeciesDetails | null>(null)
  const [speciesLoading, setSpeciesLoading] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [pointerBadge, setPointerBadge] = useState<{
    x: number
    y: number
    recId: number
    commonName: string
    scientificName: string
    photoUrl?: string
    loadingPhoto: boolean
  } | null>(null)
  const speciesPhotoCache = useRef<Map<string, { photoUrl: string; photoAttribution: string }>>(new Map())

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const toggleMute = () => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    ;(rightRef.current as any)?.__setMuted(next)
  }

  // Fetch species info when selectedPoint changes
  useEffect(() => {
    if (!selectedPoint) {
      setSpeciesInfo(null)
      return
    }

    let active = true
    setSpeciesLoading(true)

    async function fetchBirdInfo(rec: Recording) {
      const searchNames = [
        rec.englishName,
        `${rec.genus} ${rec.species}`,
        rec.genus,
      ].filter(Boolean)

      let wikiData: any = null
      let inatData: any = null
      let ottData: OpenTreeTaxon | null = null

      // Kick off Open Tree of Life fetch
      const ottPromise = fetchOpenTreeTaxon(rec).catch(() => null)

      // Try Wikipedia
      for (const name of searchNames) {
        try {
          const sumRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`)
          if (sumRes.ok) {
            const json = await sumRes.json()
            if (json.extract && json.type !== 'disambiguation') {
              wikiData = json
              break
            }
          }
          const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + ' bird')}&format=json&origin=*`)
          if (searchRes.ok) {
            const sJson = await searchRes.json()
            const hits = sJson.query?.search
            if (hits && hits.length > 0) {
              const dRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hits[0].title)}`)
              if (dRes.ok) {
                const dJson = await dRes.json()
                if (dJson.extract) { wikiData = dJson; break }
              }
            }
          }
        } catch (e) {
          console.warn('Wikipedia query error', e)
        }
      }

      // Try iNaturalist
      const normEnglish = normalizeText(rec.englishName)
      const normSci = normalizeText(`${rec.genus} ${rec.species}`)
      for (const name of searchNames) {
        try {
          let res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&taxon_id=3&per_page=10`)
          let data = res.ok ? await res.json() : null
          // Fallback without taxon_id=3 for non-bird wildlife (e.g. bats)
          if (!data?.results?.length) {
            res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(name)}&per_page=10`)
            data = res.ok ? await res.json() : null
          }
          if (data?.results && data.results.length > 0) {
            const exact = data.results.find((r: any) => {
              const c = normalizeText(r.preferred_common_name)
              const s = normalizeText(r.name)
              return c === normEnglish || s === normSci || c.includes(normEnglish)
            })
            inatData = exact || data.results.find((r: any) => r.rank === 'species' || r.rank === 'subspecies') || data.results[0]
            if (inatData) break
          }
        } catch (e) {
          console.warn('iNaturalist query error', e)
        }
      }

      ottData = await ottPromise

      if (!active) return

      const common = inatData?.preferred_common_name || rec.englishName || wikiData?.title || `${rec.genus} ${rec.species}`
      const scientific = inatData?.name || `${rec.genus} ${rec.species}`
      const photo = wikiData?.originalimage?.source || wikiData?.thumbnail?.source || inatData?.default_photo?.medium_url || ''
      const photoAttribution = wikiData?.originalimage?.source ? 'Wikimedia Commons' : (inatData?.default_photo?.attribution || 'iNaturalist')
      
      const status = inatData?.conservation_status?.status_name ||
        (wikiData?.extract?.toLowerCase().includes('critically endangered') ? 'Critically Endangered' :
        (wikiData?.extract?.toLowerCase().includes('endangered') ? 'Endangered' :
        (wikiData?.extract?.toLowerCase().includes('vulnerable') ? 'Vulnerable' : 'Identified')))

      // Resolve taxonomy: combine iNaturalist and Open Tree of Life (OTT 3.7.3)
      const inatOrder = inatData?.ancestors?.find((a: any) => a.rank === 'order')?.name
      const order = inatOrder || ottData?.order || '-'

      const inatFamily = inatData?.ancestors?.find((a: any) => a.rank === 'family')?.name
      const family = inatFamily || ottData?.family || '-'

      const inatGenus = inatData?.ancestors?.find((a: any) => a.rank === 'genus')?.name
      const genus = inatGenus || ottData?.genus || rec.genus || '-'

      const inatClass = inatData?.ancestors?.find((a: any) => a.rank === 'class')?.name
      const className = ottData?.className || inatClass || (rec.genus === 'Chalinolobus' ? 'Mammalia' : 'Aves')

      const ottUrl = ottData?.ottId ? `https://tree.opentreeoflife.org/taxonomy/browse?id=${ottData.ottId}` : undefined

      setSpeciesInfo({
        commonName: common,
        scientificName: scientific,
        description: wikiData?.description || (inatData?.rank ? `${inatData.rank.toUpperCase()} in Class ${className}` : `Native or introduced wildlife of New Zealand (${className})`),
        extract: wikiData?.extract || 'Observation recorded and archived within the Listening Lab acoustic PAM dataset.',
        photoUrl: photo,
        photoAttribution,
        conservationStatus: status,
        rank: inatData?.rank || ottData?.rank || 'species',
        order,
        family,
        genus,
        class: className,
        observationsCount: inatData?.observations_count ? inatData.observations_count.toLocaleString() : '1,000+',
        wikiUrl: wikiData?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(common)}`,
        inatUrl: inatData?.id ? `https://www.inaturalist.org/taxa/${inatData.id}` : `https://www.inaturalist.org/search?q=${encodeURIComponent(common)}`,
        ottUrl,
        audioUrl: rec.file || `https://xeno-canto.org/explore?query=${encodeURIComponent(scientific)}`,
      })
      setSpeciesLoading(false)

      // Cache the photo for instantaneous display on subsequent clicks
      if (photo) {
        speciesPhotoCache.current.set(`${rec.genus}_${rec.species}`, { photoUrl: photo, photoAttribution })
      }

      // Update pointer badge with resolved photo and details
      setPointerBadge(prev => {
        if (!prev) return null
        if (prev.recId === rec.id) {
          return {
            ...prev,
            commonName: common,
            scientificName: scientific,
            photoUrl: photo || prev.photoUrl,
            loadingPhoto: false,
          }
        }
        return prev
      })
    }

    fetchBirdInfo(selectedPoint)

    return () => { active = false }
  }, [selectedPoint])

  useEffect(() => {
    if (!leftRef.current || !rightRef.current) return
    let unmounted = false
    let cleanup: (() => void) | null = null

    const tryInit = (data: AppData) => {
      const left = leftRef.current, right = rightRef.current
      if (!left || !right) return
      const callbacks = {
        onHoverRegion: (name: string | null) => setHoveredRegion(name),
        onHoverPoint: (rec: Recording | null) => {
          if (!rec) { setHoveredPoint(null); return }
          setHoveredPoint({
            name: rec.englishName || `${rec.genus} ${rec.species}`,
            region: rec.regionIdx >= 0 ? data.regions[rec.regionIdx].name : 'Unassigned',
          })
        },
        onSelectPoint: (rec: Recording | null, pos?: { x: number; y: number } | null) => {
          setSelectedPoint(rec)
          if (!rec || !pos) {
            setPointerBadge(null)
            return
          }
          const key = `${rec.genus}_${rec.species}`
          const cached = speciesPhotoCache.current.get(key)
          setPointerBadge({
            x: pos.x,
            y: pos.y,
            recId: rec.id,
            commonName: rec.englishName || `${rec.genus} ${rec.species}`,
            scientificName: `${rec.genus} ${rec.species}`,
            photoUrl: cached?.photoUrl,
            loadingPhoto: !cached,
          })
        },
        onSelectRegion: (idx: number) => {
          selectedRef.current = idx
          setSelectedIdx(idx)
        },
        getSelected: () => selectedRef.current,
        getMuted: () => mutedRef.current,
        onContextLost: () => setMountKey(k => k + 1),
      }
      if (left.clientWidth === 0 || left.clientHeight === 0) {
        const ro = new ResizeObserver(() => {
          if (left.clientWidth > 0 && left.clientHeight > 0) {
            ro.disconnect()
            if (!unmounted) { cleanup = initThree(data, left, right, callbacks); setLoaded(true) }
          }
        })
        ro.observe(left)
        return
      }
      cleanup = initThree(data, left, right, callbacks)
      setLoaded(true)
    }

    loadData()
      .then(data => {
        if (unmounted || !leftRef.current || !rightRef.current) return
        setDataRef(data)
        tryInit(data)
      })
      .catch(err => setError(err.message))

    return () => { unmounted = true; cleanup?.() }
  }, [])

  const selectedRegion = dataRef && selectedIdx >= 0 ? dataRef.regions[selectedIdx] : null

  return (
    <section id="acoustic-map-demo" key={mountKey} className="relative w-full bg-ocean-dark text-white overflow-hidden pb-16">
      
      {/* Header */}
      <div className="relative z-10 pt-20 pb-6 text-center px-4 flex justify-center pointer-events-none">
        <div className="max-w-3xl w-full pointer-events-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4ecdc4]/10 border border-[#4ecdc4]/20 text-[#4ecdc4] text-xs uppercase tracking-widest font-semibold mb-3">
            <span>✨ Interactive Species Demo</span>
          </div>
          <h1 className="font-serif text-4xl md:text-5xl mb-3">Acoustic Map of Aotearoa</h1>
          <p className="text-gray-200 max-w-xl pb-2 mx-auto text-sm">
            Click any point in the Point Map to listen to its vocalisation and inspect species photographs and biology below.
          </p>
          <p className="text-gray-400 max-w-xl mx-auto text-xs">
            {selectedRegion
              ? <>Filtered to <span className="text-white">{selectedRegion.name}</span> — click elsewhere on the map to return</>
              : 'Drag to orbit the 3D embedding space. Click any point to select species.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="bg-[#4ecdc4]/20 hover:bg-[#4ecdc4]/35 backdrop-blur-md border border-[#4ecdc4]/60 rounded-full px-5 py-2 text-xs font-semibold text-white transition-all shadow-lg shadow-[#4ecdc4]/20 flex items-center gap-2 cursor-pointer"
              title="Upload audio to classify with Perch v2 and add to 3D map"
            >
              <svg className="w-4 h-4 text-[#4ecdc4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 100-6 3 3 0 000 6z" />
              </svg>
              <span>Upload Audio &amp; Classify</span>
            </button>
          </div>
        </div>
      </div>

      {/* Panel labels / mobile tabs */}
      {isMobile ? (
        <div className="flex justify-center gap-2 px-4 mb-3">
          <button
            onClick={() => setActivePanel('map')}
            className={`text-xs tracking-widest uppercase rounded-full px-5 py-1.5 transition-colors ${activePanel === 'map' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40'}`}
          >Map</button>
          <button
            onClick={() => setActivePanel('umap')}
            className={`text-xs tracking-widest uppercase rounded-full px-5 py-1.5 transition-colors ${activePanel === 'umap' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/40'}`}
          >Point Map</button>
        </div>
      ) : (
        <div className="flex text-xs tracking-widest uppercase text-white/40 px-6 mb-2">
          <div className="w-1/2 text-center">Geographic Map — Aotearoa NZ</div>
          <div className="w-1/2 text-center flex items-center justify-center gap-1.5">
            <span>Point Map — PERCH v2 Embedding Space</span>
            <span className="text-[10px] bg-[#4ecdc4]/20 text-[#4ecdc4] px-1.5 py-0.5 rounded font-normal">Clickable</span>
          </div>
        </div>
      )}

      {/* Interactive Panels */}
      <div ref={containerRef} className={`relative ${isMobile ? '' : 'flex'}`} style={{ height: '70vh' }}>
        {/* Left / Map panel */}
        <div
          ref={leftRef}
          className={`cursor-crosshair ${isMobile ? 'absolute inset-0' : 'w-1/2 h-full'} transition-opacity duration-200${isMobile && activePanel !== 'map' ? ' opacity-0 pointer-events-none' : ''}`}
        />

        {/* Map engagement overlay (mobile) */}
        {isMobile && activePanel === 'map' && !mapEngaged && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: 'rgba(10,22,40,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={() => setMapEngaged(true)}
          >
            <div className="border border-white/20 rounded-2xl px-8 py-5 text-center bg-black/20">
              <p className="text-white text-sm font-medium mb-1">Tap to explore the map</p>
              <p className="text-white/50 text-xs">Drag to pan · tap a region to select</p>
            </div>
          </div>
        )}

        {/* Vertical divider (desktop) */}
        {!isMobile && (
          <>
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/10 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 flex items-center pointer-events-none z-10">
              <div className="w-6 h-6 rounded-full bg-ocean-dark border border-white/20 flex items-center justify-center">
                <div className="w-1.5 h-1.5 rounded-full bg-white/40" />
              </div>
            </div>
          </>
        )}

        {/* Right / UMAP panel */}
        <div
          ref={rightRef}
          className={`${isMobile ? 'absolute inset-0' : 'w-1/2 h-full'} transition-opacity duration-200${isMobile && activePanel !== 'umap' ? ' opacity-0 pointer-events-none' : ''}`}
        />

        {/* UMAP engagement overlay (mobile) */}
        {isMobile && activePanel === 'umap' && !umapEngaged && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: 'rgba(10,22,40,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={() => setUmapEngaged(true)}
          >
            <div className="border border-white/20 rounded-2xl px-8 py-5 text-center bg-black/20">
              <p className="text-white text-sm font-medium mb-1">Tap to explore sounds</p>
              <p className="text-white/50 text-xs">Tap a point to play audio and view bird info</p>
            </div>
          </div>
        )}

        {/* Mute button */}
        {(!isMobile || activePanel === 'umap') && (
          <button
            onClick={toggleMute}
            className="absolute top-3 left-[calc(50%-1.125em)] z-20 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
            title={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-white/60">
                <path d="M11 5 6 9H3v6h3l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-[#4ecdc4]">
                <path d="M11 5 6 9H3v6h3l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>
        )}

        {/* Floating Pointer Badge on point click */}
        {pointerBadge && (
          <div
            className="absolute z-30 transition-all duration-150 ease-out pointer-events-auto"
            style={{
              left: `${Math.min(Math.max(pointerBadge.x + 18, 12), (containerRef.current?.clientWidth || 800) - 270)}px`,
              top: `${Math.min(Math.max(pointerBadge.y - 36, 12), (containerRef.current?.clientHeight || 500) - 86)}px`,
            }}
          >
            <div className="bg-ocean-card/95 backdrop-blur-md border border-[#4ecdc4]/40 shadow-2xl rounded-2xl p-2.5 flex items-center gap-3 animate-fadeIn">
              {/* Bird thumbnail or skeleton */}
              <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-black/60 border border-white/15 shrink-0 flex items-center justify-center">
                {pointerBadge.photoUrl ? (
                  <img
                    src={pointerBadge.photoUrl}
                    alt={pointerBadge.commonName}
                    className="w-full h-full object-cover object-center"
                  />
                ) : pointerBadge.loadingPhoto ? (
                  <div className="w-full h-full flex items-center justify-center bg-white/10 animate-pulse text-lg">
                    🐦
                  </div>
                ) : (
                  <span className="text-xl">🐦</span>
                )}
              </div>

              {/* Bird names & sound status */}
              <div className="min-w-0 pr-1">
                <p className="text-xs font-bold text-white truncate max-w-[130px] sm:max-w-[160px] leading-tight">
                  {pointerBadge.commonName}
                </p>
                <p className="text-[10px] text-[#4ecdc4] italic truncate max-w-[130px] sm:max-w-[160px]">
                  {pointerBadge.scientificName}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ecdc4] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4ecdc4]"></span>
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-[#4ecdc4] font-mono font-medium">
                    Vocalising
                  </span>
                </div>
              </div>

              {/* Dismiss button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setPointerBadge(null)
                }}
                className="w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center justify-center text-[10px] ml-0.5 shrink-0 transition-colors"
                title="Dismiss badge"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Loading / error */}
      {!loaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <p className="text-white/40 text-sm tracking-widest animate-pulse">Loading recordings…</p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
          <p className="text-red-400 text-sm">Failed to load data: {error}</p>
        </div>
      )}

      {/* Hover tooltip — region (left panel) */}
      {hoveredRegion && !selectedRegion && (
        <div className="absolute bottom-[35%] left-6 pointer-events-none z-20">
          <div className="bg-black/60 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3">
            <p className="text-white text-sm font-medium">{hoveredRegion}</p>
            <p className="text-white/40 text-xs mt-0.5">Click to filter</p>
          </div>
        </div>
      )}

      {/* Hover tooltip — point (right panel) */}
      {hoveredPoint && (
        <div className="absolute bottom-[35%] right-6 pointer-events-none z-20">
          <div className="bg-black/60 backdrop-blur-md border border-[#4ecdc4]/30 rounded-xl px-4 py-3 max-w-[220px]">
            <p className="text-[#4ecdc4] text-sm font-medium leading-tight">{hoveredPoint.name}</p>
            <p className="text-white/50 text-xs mt-1">{hoveredPoint.region}</p>
            <p className="text-white/40 text-[10px] mt-1">Click to play & view info</p>
          </div>
        </div>
      )}

      {/* Selected region pill */}
      {selectedRegion && (
        <div className="mt-4 flex justify-center z-20">
          <button
            onClick={() => {
              selectedRef.current = -1
              setSelectedIdx(-1)
              ;(leftRef.current as any)?.__updateSelection(-1)
            }}
            className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-6 py-2 text-sm hover:bg-white/20 transition-colors"
            style={{ borderColor: selectedRegion.color + '60' }}
          >
            <span className="mr-2 inline-block w-2 h-2 rounded-full" style={{ background: selectedRegion.color }} />
            {selectedRegion.name} ← Return to full map
          </button>
        </div>
      )}

      {/* ─── BELOW-MAP BIRD INFORMATION POPUP / CARD ──────────────────────────── */}
      <div ref={popupRef} className="max-w-5xl mx-auto px-6 mt-8 z-30 relative">
        
        {/* State A: Selected Recording & Species Details */}
        {selectedPoint && (
          <div className="bg-ocean-card/90 backdrop-blur-xl border border-[#4ecdc4]/30 rounded-2xl shadow-2xl overflow-hidden animate-fadeIn transition-all">
            
            {/* Top Bar with dismiss button */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-black/40 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4ecdc4] animate-pulse"></span>
                <span className="text-xs uppercase tracking-widest font-semibold text-[#4ecdc4]">
                  Selected Recording #{selectedPoint.id}
                </span>
                <span className="text-xs text-gray-400 hidden sm:inline">
                  • {selectedPoint.regionIdx >= 0 && dataRef ? dataRef.regions[selectedPoint.regionIdx].name : 'New Zealand'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {selectedPoint.file && (
                  <a
                    href={selectedPoint.file}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <span>Sound File</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                )}
                <button
                  onClick={() => setSelectedPoint(null)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-xs transition-colors"
                  title="Close popup"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content Area */}
            {speciesLoading ? (
              <div className="p-8 grid md:grid-cols-12 gap-6 animate-pulse">
                <div className="md:col-span-4 aspect-[4/3] md:aspect-auto md:h-72 bg-white/10 rounded-xl"></div>
                <div className="md:col-span-8 space-y-4">
                  <div className="h-6 w-28 bg-white/10 rounded"></div>
                  <div className="h-8 w-2/3 bg-white/10 rounded"></div>
                  <div className="h-4 w-1/3 bg-white/10 rounded"></div>
                  <div className="h-20 w-full bg-white/10 rounded"></div>
                </div>
              </div>
            ) : speciesInfo ? (
              <div className="grid md:grid-cols-12">
                
                {/* Photo Column */}
                <div className="md:col-span-4 relative bg-black/60 flex flex-col items-center justify-center min-h-[260px] md:min-h-[340px] group overflow-hidden border-b md:border-b-0 md:border-r border-white/10">
                  {speciesInfo.photoUrl ? (
                    <>
                      <img
                        src={speciesInfo.photoUrl}
                        alt={speciesInfo.commonName}
                        onClick={() => setLightboxOpen(true)}
                        className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                      />
                      <div
                        onClick={() => setLightboxOpen(true)}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      >
                        <span className="bg-black/75 text-white text-xs px-3 py-1.5 rounded-full border border-white/20 flex items-center gap-1.5">
                          🔍 Click to expand
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-500 text-xs p-6 text-center">
                      No photo directly available for this taxon
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-3 text-[11px] text-gray-400 truncate">
                    {speciesInfo.photoAttribution}
                  </div>
                </div>

                {/* Info Column */}
                <div className="md:col-span-8 p-6 sm:p-7 flex flex-col justify-between">
                  <div>
                    {/* Status & Badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-[#4ecdc4]/20 text-[#4ecdc4] border border-[#4ecdc4]/30">
                        {speciesInfo.conservationStatus}
                      </span>
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-white/10 text-gray-300 font-medium capitalize">
                        {speciesInfo.rank}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">
                        Lat: {selectedPoint.lat.toFixed(2)}°, Lon: {selectedPoint.lon.toFixed(2)}°
                      </span>
                    </div>

                    {/* Names */}
                    <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white leading-tight">
                      {speciesInfo.commonName}
                    </h2>
                    <p className="text-[#4ecdc4] italic font-serif text-base mt-0.5 mb-3">
                      {speciesInfo.scientificName}
                    </p>

                    {/* Short Description */}
                    <p className="text-xs text-gray-400 mb-3 border-b border-white/10 pb-2">
                      {speciesInfo.description}
                    </p>

                    {/* Encyclopedic Summary */}
                    <p className="text-sm text-gray-300 leading-relaxed mb-5 max-h-32 overflow-y-auto pr-2">
                      {speciesInfo.extract}
                    </p>

                    {/* Taxonomy Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs bg-black/25 p-3 rounded-xl border border-white/5 mb-4">
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase">Class</span>
                        <span className="text-white font-medium truncate block">{speciesInfo.class || 'Aves'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase">Order</span>
                        <span className="text-white font-medium truncate block">{speciesInfo.order}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase">Family</span>
                        <span className="text-white font-medium truncate block">{speciesInfo.family}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase">Genus</span>
                        <span className="text-white font-medium truncate block">{speciesInfo.genus}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 block text-[10px] uppercase">Sightings</span>
                        <span className="text-white font-medium truncate block">{speciesInfo.observationsCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* External Links */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
                    <a
                      href={speciesInfo.wikiUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white transition-colors"
                    >
                      Wikipedia ↗
                    </a>
                    <a
                      href={speciesInfo.inatUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white transition-colors"
                    >
                      iNaturalist ↗
                    </a>
                    {speciesInfo.ottUrl && (
                      <a
                        href={speciesInfo.ottUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-1.5 rounded-lg bg-[#4ecdc4]/10 hover:bg-[#4ecdc4]/20 text-xs text-[#4ecdc4] border border-[#4ecdc4]/30 transition-colors"
                        title="View taxon on Open Tree of Life (OTT 3.7.3)"
                      >
                        Open Tree of Life ↗
                      </a>
                    )}
                    <a
                      href={`https://xeno-canto.org/explore?query=${encodeURIComponent(speciesInfo.scientificName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-[#4ecdc4]/20 hover:bg-[#4ecdc4]/30 text-[#4ecdc4] border border-[#4ecdc4]/30 text-xs transition-colors"
                    >
                      🔊 Recordings on Xeno-Canto ↗
                    </a>
                  </div>

                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* State B: Prompt / Guidance Banner when no point is selected */}
        {!selectedPoint && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center text-gray-400">
            <div className="text-2xl mb-2">💡</div>
            <p className="text-sm text-gray-300 font-medium">
              Click any point in the <span className="text-[#4ecdc4]">Point Map</span> above to listen to its audio and see its photo and biological details.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              You can also drag to rotate the 3D embedding space or click a region on the left map to filter the points.
            </p>
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && speciesInfo?.photoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 text-white p-2 rounded-full bg-white/10 hover:bg-white/20"
          >
            ✕
          </button>
          <img
            src={speciesInfo.photoUrl}
            alt={speciesInfo.commonName}
            className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
          <p className="text-gray-300 text-xs mt-3 font-light">
            {speciesInfo.commonName} ({speciesInfo.scientificName}) — {speciesInfo.photoAttribution}
          </p>
        </div>
      )}

      {/* Audio Upload & Classification Modal */}
      <AudioUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        defaultLat={-41.2}
        defaultLon={172.5}
        referenceCentroids={dataRef?.referenceCentroids}
        onClassified={handleClassifiedAudio}
      />

    </section>
  )
}
