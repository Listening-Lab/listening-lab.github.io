'use client'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// ─── config ──────────────────────────────────────────────────────────────────

// Map (left panel) points
const MAP_POINT_SIZE_MIN      = 0.55  // minimum base size per point
const MAP_POINT_SIZE_RANGE    = 0.65  // random size added on top of min (so max = min + range)
const MAP_POINT_SELECTED_SCALE = 0.3  // size multiplier applied to all points when a region is selected

// UMAP (right panel) points
const UMAP_POINT_HOVER_SCALE    = 2.0  // size multiplier when a point is hovered
const UMAP_RAYCASTER_THRESHOLD  = 0.5  // world-unit hit radius for point picking
const UMAP_CAM_Z                = 6.16 // initial camera distance from origin
const UMAP_CAM_MIN_DIST         = 3    // minimum orbit zoom distance
const UMAP_CAM_MAX_DIST         = 30   // maximum orbit zoom distance
const UMAP_AUTO_ROTATE_SPEED    = 0.05  // auto-rotation speed (degrees/frame scaled by Three.js)

// UMAP ambient drift — must stay in sync between UMAP_VERT shader and the JS
// raycasting drift-correction in animateRight (search "replicate UMAP_VERT drift")
const DRIFT_PHASE_X  = 1.73;  const DRIFT_PHASE_Y  = 0.91;  const DRIFT_PHASE_Z  = 1.37
const DRIFT_AMP_XY   = 0.09;  const DRIFT_AMP_Z    = 0.07
const DRIFT_FREQ_X   = 0.32;  const DRIFT_FREQ_Y   = 0.27;  const DRIFT_FREQ_Z   = 0.38

// Audio fade  (AUDIO_FADE_STEPS × AUDIO_FADE_INTERVAL_MS = total fade duration in ms)
const AUDIO_FADE_STEPS       = 80   // number of volume steps in a fade
const AUDIO_FADE_INTERVAL_MS = 50   // ms between each step  → 20 × 50 ms = 1 s

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
interface Recording {
  idx: number; id: number
  genus: string; species: string; englishName: string
  lat: number; lon: number
  regionIdx: number
  umapX: number; umapY: number; umapZ: number
  speciesIdx: number
  file: string
}

interface NZRegion {
  id: string; name: string; color: string
  worldPolygons: [number, number][][][]
  bbox: { minX: number; maxX: number; minY: number; maxY: number }
}

interface AppData {
  regions: NZRegion[]
  recordings: Recording[]
  speciesColors: string[]
  speciesKeys: string[]
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

  // regions
  // Wrap longitudes west of -170° (Chatham Islands cross the antimeridian)
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

  // recordings
  const lines = csvText.trim().split('\n').slice(1)
  const recs: Recording[] = []
  for (const line of lines) {
    const p = parseCSVLine(line)
    const lat = parseFloat(p[5]), lon = wrapLon(parseFloat(p[6]))
    const umapX = parseFloat(p[13]), umapY = parseFloat(p[14]), umapZ = parseFloat(p[15])
    if (!isNaN(lat) && !isNaN(lon) && !isNaN(umapX) && !isNaN(umapY) && !isNaN(umapZ))
      recs.push({ idx: recs.length, id: parseInt(p[0]), genus: p[1], species: p[2], englishName: p[3], lat, lon, regionIdx: -1, umapX, umapY, umapZ, speciesIdx: 0, file: p[12] })
  }

  // assign region via pip
  const rings: { ri: number; ring: [number, number][] }[] = []
  regions.forEach((reg, ri) => reg.worldPolygons.forEach(poly => rings.push({ ri, ring: poly[0] })))
  recs.forEach(rec => {
    const [wx, wy] = ll2w(rec.lon, rec.lat)
    for (const { ri, ring } of rings) if (pip(wx, wy, ring)) { rec.regionIdx = ri; break }
  })

  // centre UMAP coords around origin
  let uxMin = Infinity, uxMax = -Infinity, uyMin = Infinity, uyMax = -Infinity, uzMin = Infinity, uzMax = -Infinity
  recs.forEach(r => {
    if (r.umapX < uxMin) uxMin = r.umapX; if (r.umapX > uxMax) uxMax = r.umapX
    if (r.umapY < uyMin) uyMin = r.umapY; if (r.umapY > uyMax) uyMax = r.umapY
    if (r.umapZ < uzMin) uzMin = r.umapZ; if (r.umapZ > uzMax) uzMax = r.umapZ
  })
  const uxMid = (uxMin + uxMax) / 2, uyMid = (uyMin + uyMax) / 2, uzMid = (uzMin + uzMax) / 2
  recs.forEach(r => { r.umapX -= uxMid; r.umapY -= uyMid; r.umapZ -= uzMid })

  // species index + colors
  const speciesKeys = Array.from(new Set(recs.map(r => `${r.genus}_${r.species}`)))
  const nSp = speciesKeys.length
  recs.forEach(rec => { rec.speciesIdx = speciesKeys.indexOf(`${rec.genus}_${rec.species}`) })

  // species colors — HSL wheel
  const speciesColors = speciesKeys.map((_, i) =>
    '#' + new THREE.Color().setHSL(i / nSp, 0.75, 0.65).getHexString()
  )

  return { regions, recordings: recs, speciesColors, speciesKeys }
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
  uniform float uSelectedRegion; // -1 = none
  uniform float uUseSpecies;     // 0 = region color, 1 = species color for selected
  void main() {
    bool noSel   = uSelectedRegion < -0.5;
    bool isSel   = abs(aRegionIdx - uSelectedRegion) < 0.5;
    bool unassigned = aRegionIdx < -0.5;
    vec3 baseCol = (uUseSpecies > 0.5 && isSel) ? aSpeciesColor : aRegionColor;
    vColor = baseCol;
    if (noSel || unassigned) vAlpha = 0.85;
    else vAlpha = isSel ? 1.0 : 0.06;
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

// UMAP panel vertex shader — same colouring logic + 3-D ambient drift
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
    else vAlpha = isSel ? 1.0 : 0.06;

    // Ambient drift — each point gets a unique phase from its rest position
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

// Ripple — full-quad SDF shader; soft ring avoids hard geometric edges,
// additive blending means overlapping ripples add brightness rather than
// compounding opacity (the source of the aliasing seam).
const RIPPLE_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`
const RIPPLE_FRAG = /* glsl */`
  varying vec2 vUv;
  uniform vec3  uColor;
  uniform float uAge;   // 0 → 1 over the ripple lifetime
  void main() {
    float d         = length(vUv - 0.5) * 2.0;   // 0 = centre, 1 = quad edge
    float radius    = 0.08 + uAge * 0.82;          // ring expands outward
    float thickness = mix(0.18, 0.04, uAge);       // thins as it grows
    float ring      = max(0.0, 1.0 - abs(d - radius) / thickness);
    ring            = ring * ring;                  // smooth falloff
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
    onSelectRegion: (idx: number) => void
    getSelected: () => number
    getMuted: () => boolean
    onContextLost: () => void
  }
): () => void {

  const { regions, recordings, speciesColors } = data
  const n = recordings.length
  const PR = Math.min(devicePixelRatio, 2)

  // ── build colour arrays ──────────────────────────────────────────────────
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

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  LEFT PANEL — NZ MAP                                                ║
  // ╚══════════════════════════════════════════════════════════════════════╝

  const leftRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  leftRenderer.setPixelRatio(PR)
  leftRenderer.setSize(leftEl.clientWidth, leftEl.clientHeight)
  leftRenderer.setClearColor(0x000000, 0)
  leftEl.appendChild(leftRenderer.domElement)

  const leftScene = new THREE.Scene()
  const leftCam = new THREE.PerspectiveCamera(52, leftEl.clientWidth / leftEl.clientHeight, 0.01, 50)
  leftCam.position.set(0, 0, 4.5)

  // Camera state
  const cam = { baseX: 0, baseY: 0, baseZ: 4.5, curX: 0, curY: 0, curZ: 4.5, lookX: 0, lookY: 0 }
  const leftMouse = { nx: 0, ny: 0 }

  // ── GeoJSON region fills + outlines ──────────────────────────────────
  type RegionGroup = { fillMats: THREE.MeshBasicMaterial[]; outlineMats: THREE.LineBasicMaterial[] }
  const regionGroups = new Map<number, RegionGroup>()

  regions.forEach((reg, ri) => {
    const col = new THREE.Color(reg.color)
    const group: RegionGroup = { fillMats: [], outlineMats: [] }

    reg.worldPolygons.forEach(worldPoly => {
      // fill
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
      } catch { /* skip bad geometry */ }

      // outline
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

  // ── Map points ───────────────────────────────────────────────────────
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

  // ── Region hover detection via fill meshes ────────────────────────────
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

  // ── Ripple pool (for right-panel hover pulse) ─────────────────────────
  const ripples: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; born: number; life: number }[] = []
  let lastRippleTime = -99
  let lastRippleIdx = -1
  const RIPPLE_SIZE = 0.7   // world-unit quad side — sets max ripple radius
  const RIPPLE_LIFE = 1.0   // seconds

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

  // ── Left raycaster ────────────────────────────────────────────────────
  const leftRaycaster = new THREE.Raycaster()
  const leftMouse2D = new THREE.Vector2()
  let leftHoveredRi = -1

  // ── Pan state ─────────────────────────────────────────────────────────
  let panX = 0, panY = 0
  const PAN_LIMIT_X = 3.5   // world units (enough to reach Chatham Islands)
  const PAN_LIMIT_Y = 2.0   // world units (enough to reach subantarctic islands)
  let isDragging = false
  let dragLast = { x: 0, y: 0 }
  let dragDist = 0           // total drag distance in px — suppresses click if > 4

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
    if (dragDist > 4) return   // suppress click after a drag
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

  // ── Left panel touch support ──────────────────────────────────────────
  const onLeftTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    isDragging = true; dragDist = 0
    dragLast = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    // Update mouse position immediately so animateLeft's hover detection can
    // run at least one frame before touchend fires, setting leftHoveredRi.
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
    // Mirror the desktop click handler: use the hovered region that animateLeft
    // has already computed from the touchstart position. Fall back to a direct
    // raycast for very fast taps where no animation frame has run yet.
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
    panX = 0; panY = 0   // reset pan on any selection change
    const sel = ri >= 0 ? ri : -1
    leftMat.uniforms.uSelectedRegion.value = sel
    leftMat.uniforms.uUseSpecies.value = sel >= 0 ? 1 : 0
    rightMat.uniforms.uSelectedRegion.value = sel
    rightMat.uniforms.uUseSpecies.value = sel >= 0 ? 1 : 0

    // region fill opacity
    regionGroups.forEach((group, groupRi) => {
      const isSelected = groupRi === sel
      const showAll = sel < 0
      group.fillMats.forEach(m => { m.opacity = showAll ? 0.10 : isSelected ? 0.20 : 0.04 })
      group.outlineMats.forEach(m => { m.opacity = showAll ? 0.55 : isSelected ? 0.85 : 0.20 })
    })

    // camera zoom
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

    // Region hover
    leftRaycaster.setFromCamera(leftMouse2D, leftCam)
    const hits = leftRaycaster.intersectObjects(regionHitMeshes.map(r => r.mesh))
    const newHov = hits.length > 0 ? regionHitMeshes.find(r => r.mesh === hits[0].object)?.ri ?? -1 : -1
    if (newHov !== leftHoveredRi) {
      leftHoveredRi = newHov
      cb.onHoverRegion(newHov >= 0 ? regions[newHov].name : null)
      // highlight hovered region fills briefly
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

    // Parallax — gentle tilt toward cursor
    const px = leftMouse.nx * 0.45, py = -leftMouse.ny * 0.30
    cam.curX += (cam.baseX + panX + px - cam.curX) * 0.06
    cam.curY += (cam.baseY + panY + py - cam.curY) * 0.06
    cam.curZ += (cam.baseZ             - cam.curZ) * 0.06
    leftCam.position.set(cam.curX, cam.curY, cam.curZ)
    leftCam.lookAt(cam.lookX + panX, cam.lookY + panY, 0)

    // Ripples
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i]
      const age = Math.min(1, (t - rp.born) / rp.life)
      rp.mat.uniforms.uAge.value = age
      if (age >= 1) { leftScene.remove(rp.mesh); rp.mat.dispose(); ripples.splice(i, 1) }
    }

    leftRenderer.render(leftScene, leftCam)
  }
  animateLeft()

  // ╔══════════════════════════════════════════════════════════════════════╗
  // ║  RIGHT PANEL — UMAP                                                 ║
  // ╚══════════════════════════════════════════════════════════════════════╝

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

  // UMAP points — 3D positions
  const umapXs = new Float32Array(n), umapYs = new Float32Array(n), umapZs = new Float32Array(n)
  recordings.forEach((rec, i) => { umapXs[i]=rec.umapX; umapYs[i]=rec.umapY; umapZs[i]=rec.umapZ })
  const rightGeo = makePointsGeom(umapXs, umapYs, umapZs)
  const rightMat = new THREE.ShaderMaterial({
    uniforms: makeSharedUniforms(),
    vertexShader: UMAP_VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: false,
  })
  rightScene.add(new THREE.Points(rightGeo, rightMat))

  // Hover raycaster on UMAP
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

  // ── Right panel touch support — single tap triggers point hover/audio ──
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
    // Only treat as tap if minimal movement and short duration
    if (Math.sqrt(dx * dx + dy * dy) > 12 || Date.now() - rightTouchStart.time > 400) return
    const rect = rightEl.getBoundingClientRect()
    rightMouse2D.x =  ((touch.clientX - rect.left) / rect.width)  * 2 - 1
    rightMouse2D.y = -((touch.clientY - rect.top)  / rect.height) * 2 + 1
    // Auto-clear selection after 3 s so the user can scroll away cleanly
    if (rightTouchHoldTimer) clearTimeout(rightTouchHoldTimer)
    rightTouchHoldTimer = setTimeout(() => { rightMouse2D.set(-9999, -9999) }, 3000)
  }

  rightEl.addEventListener('touchstart', onRightTouchStart, { passive: true })
  rightEl.addEventListener('touchend',   onRightTouchEnd,   { passive: true })

  // ── Right panel click → play audio ───────────────────────────────────
  // Audio is intentional (click/tap), not incidental (hover sweep).
  let clickedAudioIdx = -1

  const onRightClick = () => {
    if (lastHoveredIdx < 0) {
      // clicked empty space — stop whatever is playing
      if (clickedAudioIdx >= 0) { stopAudio(clickedAudioIdx); clickedAudioIdx = -1 }
    } else {
      if (clickedAudioIdx >= 0) stopAudio(clickedAudioIdx)
      clickedAudioIdx = lastHoveredIdx
      playAudio(clickedAudioIdx, recordings[clickedAudioIdx].file)
    }
  }
  rightEl.addEventListener('click', onRightClick)

  // ── Audio playback ────────────────────────────────────────────────────
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

    // Point hover — use screen-space proximity so the visually nearest point
    // wins, not just the closest along the ray (which ignores cursor offset).
    // Also replicate the shader drift so projected positions match what renders.
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
        // replicate UMAP_VERT drift
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
        // Pulse at lat/lon on left panel — only for active (non-greyed) points
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

    rightControls.update()
    rightRenderer.render(rightScene, rightCam)
  }
  animateRight()

  // ── Resize ────────────────────────────────────────────────────────────
  const onResize = () => {
    leftCam.aspect = leftEl.clientWidth / leftEl.clientHeight
    leftCam.updateProjectionMatrix()
    leftRenderer.setSize(leftEl.clientWidth, leftEl.clientHeight)

    rightCam.aspect = rightEl.clientWidth / rightEl.clientHeight
    rightCam.updateProjectionMatrix()
    rightRenderer.setSize(rightEl.clientWidth, rightEl.clientHeight)
  }
  // Use ResizeObserver instead of window 'resize' so we also catch layout-driven
  // size changes (e.g. the panel going from w-1/2 to full-width on mobile),
  // which don't fire a window resize event.
  const resizeObserver = new ResizeObserver(onResize)
  resizeObserver.observe(leftEl)
  resizeObserver.observe(rightEl)

  // expose updateSelection, setMuted so React can call them
  ;(leftEl as any).__updateSelection = updateSelection
  ;(rightEl as any).__setMuted = (m: boolean) => {
    activeAudio.forEach(entry => { entry.el.muted = m })
  }

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

// ─── Component ───────────────────────────────────────────────────────────────
export default function AcousticMap() {
  const leftRef     = useRef<HTMLDivElement>(null)
  const rightRef    = useRef<HTMLDivElement>(null)
  const selectedRef = useRef(-1)

  const [mountKey, setMountKey] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [hoveredPoint, setHoveredPoint] = useState<{ name: string; region: string } | null>(null)
  const [dataRef, setDataRef] = useState<AppData | null>(null)
  const mutedRef = useRef(true)
  const [muted, setMuted] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [activePanel, setActivePanel] = useState<'map' | 'umap'>('map')
  const [mapEngaged, setMapEngaged] = useState(false)
  const [umapEngaged, setUmapEngaged] = useState(false)

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
    <section key={mountKey} className="relative w-full bg-ocean-dark text-white overflow-hidden" style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="relative z-10 pt-24 pb-4 text-center px-4">
        <p className="text-brand-100 text-xs tracking-widest uppercase mb-2">Interactive</p>
        <h2 className="font-serif text-4xl md:text-5xl mb-3">Acoustic Map of Aotearoa</h2>
        <p className="text-gray-200 max-w-xl pb-4 mx-auto text-sm">We are building a map of the sounds of nature.</p>
        <p className="text-gray-400 max-w-xl mx-auto text-sm">
          {selectedRegion
            ? <>Showing <span className="text-white">{selectedRegion.name}</span> — click elsewhere on the map to return</>
            : 'Click a region on the map to explore its acoustic space. Hover UMAP points to locate them geographically.'}
        </p>
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
        <div className="flex text-xs tracking-widest uppercase text-white/30 px-6 mb-2">
          <div className="w-1/2 text-center">Geographic — Aotearoa NZ</div>
          <div className="w-1/2 text-center">
            {selectedRegion ? `${selectedRegion.name} · PERCH v2 Embedding` : 'PERCH v2 Embedding Space'}
          </div>
        </div>
      )}

      {/* Panels */}
      <div className={`relative ${isMobile ? '' : 'flex'}`} style={{ height: '76vh' }}>
        {/* Left / Map panel — always in DOM so Three.js has a valid size */}
        <div
          ref={leftRef}
          className={`cursor-crosshair ${isMobile ? 'absolute inset-0' : 'w-1/2 h-full'} transition-opacity duration-200${isMobile && activePanel !== 'map' ? ' opacity-0 pointer-events-none' : ''}`}
        />

        {/* Map engagement overlay (mobile only) */}
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

        {/* Vertical divider (desktop only) */}
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

        {/* Right / UMAP panel — always in DOM so Three.js has a valid size */}
        <div
          ref={rightRef}
          className={`${isMobile ? 'absolute inset-0' : 'w-1/2 h-full'} transition-opacity duration-200${isMobile && activePanel !== 'umap' ? ' opacity-0 pointer-events-none' : ''}`}
        />

        {/* UMAP engagement overlay (mobile only) */}
        {isMobile && activePanel === 'umap' && !umapEngaged && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center"
            style={{ background: 'rgba(10,22,40,0.65)', backdropFilter: 'blur(6px)' }}
            onClick={() => setUmapEngaged(true)}
          >
            <div className="border border-white/20 rounded-2xl px-8 py-5 text-center bg-black/20">
              <p className="text-white text-sm font-medium mb-1">Tap to explore sounds</p>
              <p className="text-white/50 text-xs">Tap a point to play · drag to orbit</p>
            </div>
          </div>
        )}

        {/* Mute / unmute button — visible on UMAP panel */}
        {(!isMobile || activePanel === 'umap') && (
          <button
            onClick={toggleMute}
            className="absolute top-3 left-[calc(50%-1.125em)] z-20 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors"
            title={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-white/60">
                <path d="M11 5 6 9H3v6h3l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4 text-white">
                <path d="M11 5 6 9H3v6h3l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
              </svg>
            )}
          </button>
        )}

        {/* Contribute button — at divider on desktop, below panels on mobile */}
        {!isMobile && (
          <div className="absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none" style={{ bottom: '33%' }}>
            <a
              href="/contact"
              className="pointer-events-auto bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-8 py-3 text-sm font-medium text-white hover:bg-white/20 transition-colors whitespace-nowrap"
            >
              Contribute to the Map
            </a>
          </div>
        )}
      </div>

      {/* Contribute button — mobile, below panels */}
      {isMobile && (
        <div className="flex justify-center py-4">
          <a
            href="/contact"
            className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-8 py-3 text-sm font-medium text-white hover:bg-white/20 transition-colors"
          >
            Contribute to the Map
          </a>
        </div>
      )}

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

      {/* Hover label — region (left panel) */}
      {hoveredRegion && !selectedRegion && (
        <div className="absolute bottom-1/3 left-6 pointer-events-none z-20">
          <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3">
            <p className="text-white text-sm font-medium">{hoveredRegion}</p>
            <p className="text-white/40 text-xs mt-0.5">Click to explore</p>
          </div>
        </div>
      )}

      {/* Hover label — point (right panel) */}
      {hoveredPoint && (
        <div className="absolute bottom-1/3 right-6 pointer-events-none z-20">
          <div className="bg-black/50 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 max-w-[200px]">
            <p className="text-white text-sm font-medium leading-tight">{hoveredPoint.name}</p>
            <p className="text-white/40 text-xs mt-1">{hoveredPoint.region}</p>
          </div>
        </div>
      )}

      {/* Selected region chip */}
      {selectedRegion && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
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

      {/* Legend */}
      {loaded && !selectedRegion && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-wrap justify-center gap-x-4 gap-y-1 max-w-2xl px-4">
          {dataRef?.regions.map((r, i) => (
            <span key={i} className="flex items-center gap-1 text-xs text-gray-400">
              <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              {r.name}
            </span>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 60%, #0a162866 100%)' }} />

    </section>
  )
}
