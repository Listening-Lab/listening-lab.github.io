'use client'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

// ─── config ───────────────────────────────────────────────────────────────────
const MAP_POINT_SIZE_MIN      = 0.55
const MAP_POINT_SIZE_RANGE    = 0.65
const MAP_POINT_SELECTED_SCALE = 0.3

// ─── coordinate system (must match AcousticMap exactly) ───────────────────────
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

// ─── types ────────────────────────────────────────────────────────────────────
interface NZRegion {
  id: string; name: string; color: string
  worldPolygons: [number, number][][][]
  bbox: { minX: number; maxX: number; minY: number; maxY: number }
}
interface Recording {
  lat: number; lon: number
  regionIdx: number
  speciesIdx: number
}
interface AppData {
  regions: NZRegion[]
  recordings: Recording[]
  speciesColors: string[]
}

// ─── palette (must match AcousticMap) ────────────────────────────────────────
const REGION_COLORS = [
  '#4ecdc4','#ffe66d','#ff6b6b','#a8e6cf','#c3a6ff',
  '#ff9f43','#74b9ff','#fd79a8','#fdcb6e','#00b894',
  '#e17055','#6c5ce7','#00cec9','#55efc4','#ffeaa7','#fab1a0',
]

// ─── helpers ──────────────────────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 0xffffffff }
}

function parseCSVLine(line: string): string[] {
  const out: string[] = []; let cur = '', q = false
  for (const c of line) {
    if (c === '"') q = !q
    else if (c === ',' && !q) { out.push(cur); cur = '' }
    else cur += c
  }
  return [...out, cur]
}

// ─── data loader ──────────────────────────────────────────────────────────────
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
    return {
      id: f.properties.id,
      name: f.properties.name,
      color: REGION_COLORS[i % REGION_COLORS.length],
      worldPolygons,
      bbox: { minX, maxX, minY, maxY },
    }
  })

  const lines = csvText.trim().split('\n').slice(1)
  const recs: Recording[] = []
  for (const line of lines) {
    const p = parseCSVLine(line)
    const lat = parseFloat(p[5]), lon = wrapLon(parseFloat(p[6]))
    if (!isNaN(lat) && !isNaN(lon))
      recs.push({ lat, lon, regionIdx: -1, speciesIdx: 0 })
  }

  // assign region via pip
  const rings: { ri: number; ring: [number, number][] }[] = []
  regions.forEach((reg, ri) => reg.worldPolygons.forEach(poly => rings.push({ ri, ring: poly[0] })))
  recs.forEach(rec => {
    const [wx, wy] = ll2w(rec.lon, rec.lat)
    for (const { ri, ring } of rings) if (pip(wx, wy, ring)) { rec.regionIdx = ri; break }
  })

  // species index from CSV col 1+2 (genus_species)
  const speciesKeys = Array.from(new Set(
    csvText.trim().split('\n').slice(1).map(l => {
      const p = parseCSVLine(l); return `${p[1]}_${p[2]}`
    })
  ))
  const nSp = speciesKeys.length
  csvText.trim().split('\n').slice(1).forEach((l, idx) => {
    if (idx >= recs.length) return
    const p = parseCSVLine(l)
    recs[idx].speciesIdx = speciesKeys.indexOf(`${p[1]}_${p[2]}`)
  })

  const speciesColors = speciesKeys.map((_, i) =>
    '#' + new THREE.Color().setHSL(i / nSp, 0.75, 0.65).getHexString()
  )

  return { regions, recordings: recs, speciesColors }
}

// ─── shaders (identical to AcousticMap left panel) ────────────────────────────
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
    bool noSel    = uSelectedRegion < -0.5;
    bool isSel    = abs(aRegionIdx - uSelectedRegion) < 0.5;
    bool unassigned = aRegionIdx < -0.5;
    vec3 baseCol  = (uUseSpecies > 0.5 && isSel) ? aSpeciesColor : aRegionColor;
    vColor = baseCol;
    if (noSel || unassigned) vAlpha = 0.85;
    else vAlpha = isSel ? 1.0 : 0.06;
    float breathe  = 1.0 + 0.08 * sin(uTime * 1.4 + position.x * 4.0 + position.y * 3.0);
    float sizeScale = noSel ? 1.0 : ${MAP_POINT_SELECTED_SCALE.toFixed(1)};
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

// ─── Three.js initialiser ────────────────────────────────────────────────────
function initThree(
  el: HTMLDivElement,
  data: AppData,
  initialRegionName: string | null,
  isStatic: boolean
): { cleanup: () => void; selectByName: (name: string | null) => void } {
  const { regions, recordings, speciesColors } = data
  const n = recordings.length
  const PR = Math.min(devicePixelRatio, 2)

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(PR)
  renderer.setSize(el.clientWidth, el.clientHeight)
  renderer.setClearColor(0x000000, 0)
  el.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const cam = new THREE.PerspectiveCamera(52, el.clientWidth / el.clientHeight, 0.01, 50)
  cam.position.set(0, 0, 4.5)

  const camState = { baseX: 0, baseY: 0, baseZ: 4.5, curX: 0, curY: 0, curZ: 4.5, lookX: 0, lookY: 0 }

  // ── build attribute arrays ────────────────────────────────────────────
  const regionColArr  = new Float32Array(n * 3)
  const speciesColArr = new Float32Array(n * 3)
  const regionIdxAttr = new Float32Array(n)
  const sizeAttr      = new Float32Array(n)
  const rng = seededRng(7)
  const rc = new THREE.Color(), sc = new THREE.Color()

  recordings.forEach((rec, i) => {
    rc.set(rec.regionIdx >= 0 ? regions[rec.regionIdx].color : '#e6e6e6')
    sc.set(speciesColors[rec.speciesIdx] ?? '#ffffff')
    regionColArr[i*3]=rc.r; regionColArr[i*3+1]=rc.g; regionColArr[i*3+2]=rc.b
    speciesColArr[i*3]=sc.r; speciesColArr[i*3+1]=sc.g; speciesColArr[i*3+2]=sc.b
    regionIdxAttr[i] = rec.regionIdx
    sizeAttr[i] = MAP_POINT_SIZE_MIN + rng() * MAP_POINT_SIZE_RANGE
  })

  // ── region fills + outlines ───────────────────────────────────────────
  type RegionGroup = { fillMats: THREE.MeshBasicMaterial[]; outlineMats: THREE.LineBasicMaterial[] }
  const regionGroups = new globalThis.Map<number, RegionGroup>()

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
        scene.add(mesh)
      } catch { /* skip bad geometry */ }

      const verts: number[] = []
      outer.forEach(([x, y]) => verts.push(x, y, 0))
      verts.push(outer[0][0], outer[0][1], 0)
      const outGeo = new THREE.BufferGeometry()
      outGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
      const outMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })
      group.outlineMats.push(outMat)
      scene.add(new THREE.Line(outGeo, outMat))
    })

    regionGroups.set(ri, group)
  })

  // ── map recording dots ────────────────────────────────────────────────
  const mapXs = new Float32Array(n), mapYs = new Float32Array(n)
  recordings.forEach((rec, i) => { const [x, y] = ll2w(rec.lon, rec.lat); mapXs[i]=x; mapYs[i]=y })

  const pos = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { pos[i*3]=mapXs[i]; pos[i*3+1]=mapYs[i]; pos[i*3+2]=0 }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position',     new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aRegionIdx',   new THREE.BufferAttribute(regionIdxAttr, 1))
  geo.setAttribute('aRegionColor', new THREE.BufferAttribute(regionColArr, 3))
  geo.setAttribute('aSpeciesColor',new THREE.BufferAttribute(speciesColArr, 3))
  geo.setAttribute('aSize',        new THREE.BufferAttribute(sizeAttr, 1))
  geo.setAttribute('aIdx',         new THREE.BufferAttribute(new Float32Array(n).map((_,i)=>i), 1))

  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uPixelRatio: { value: PR },
      uSelectedRegion: { value: -1 }, uUseSpecies: { value: 0 }, uHoveredIdx: { value: -1 },
    },
    vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })
  scene.add(new THREE.Points(geo, mat))

  // ── selection + camera zoom ───────────────────────────────────────────
  function updateSelection(ri: number) {
    const sel = ri >= 0 ? ri : -1
    mat.uniforms.uSelectedRegion.value = sel
    mat.uniforms.uUseSpecies.value = sel >= 0 ? 1 : 0

    regionGroups.forEach((group: RegionGroup, groupRi: number) => {
      const isSelected = groupRi === sel
      const showAll = sel < 0
      group.fillMats.forEach((m: THREE.MeshBasicMaterial)   => { m.opacity = showAll ? 0.10 : isSelected ? 0.20 : 0.04 })
      group.outlineMats.forEach((m: THREE.LineBasicMaterial) => { m.opacity = showAll ? 0.55 : isSelected ? 0.85 : 0.20 })
    })

    if (sel >= 0) {
      const bbox = regions[sel].bbox
      const cx = (bbox.minX + bbox.maxX) / 2
      const cy = (bbox.minY + bbox.maxY) / 2
      const size = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 1.4
      const fovR = cam.fov * Math.PI / 180
      const dist = (size / 2) / Math.tan(fovR / 2) / Math.min(1, cam.aspect)
      camState.baseX = cx; camState.baseY = cy; camState.baseZ = Math.min(dist, 6)
      camState.lookX = cx; camState.lookY = cy
    } else {
      camState.baseX = 0; camState.baseY = 0; camState.baseZ = 4.5
      camState.lookX = 0; camState.lookY = 0
    }
  }

  function selectByName(name: string | null) {
    if (!name) { updateSelection(-1); return }
    const ri = regions.findIndex(r => r.name === name)
    updateSelection(ri)
  }

  // Apply initial region immediately (no camera lerp delay)
  if (initialRegionName) {
    const ri = regions.findIndex(r => r.name === initialRegionName)
    if (ri >= 0) {
      updateSelection(ri)
      // Snap camera directly — skip lerp for the initial frame
      const bbox = regions[ri].bbox
      const cx = (bbox.minX + bbox.maxX) / 2
      const cy = (bbox.minY + bbox.maxY) / 2
      const size = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 1.4
      const fovR = cam.fov * Math.PI / 180
      const dist = (size / 2) / Math.tan(fovR / 2) / Math.min(1, cam.aspect)
      const z = Math.min(dist, 6)
      camState.curX = cx; camState.curY = cy; camState.curZ = z
      cam.position.set(cx, cy, z)
      cam.lookAt(cx, cy, 0)
    }
  }

  // ── mouse tilt — listen on window so pointer-events-none on the
  //    container doesn't block it, and other panels are unaffected ──────
  const mouseNorm = { nx: 0, ny: 0 }
  const onMouseMove = (e: MouseEvent) => {
    const rect = el.getBoundingClientRect()
    // Only apply tilt when the cursor is within the element's bounds
    if (
      e.clientX >= rect.left && e.clientX <= rect.right &&
      e.clientY >= rect.top  && e.clientY <= rect.bottom
    ) {
      mouseNorm.nx = (e.clientX - rect.left) / rect.width  - 0.5
      mouseNorm.ny = (e.clientY - rect.top)  / rect.height - 0.5
    } else {
      mouseNorm.nx = 0; mouseNorm.ny = 0
    }
  }
  const onMouseLeave = () => { mouseNorm.nx = 0; mouseNorm.ny = 0 }
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseleave', onMouseLeave)

  // ── animation loop ────────────────────────────────────────────────────
  const clock = new THREE.Clock()
  let animId = 0

  const animate = () => {
    animId = requestAnimationFrame(animate)
    mat.uniforms.uTime.value = isStatic ? 0 : clock.getElapsedTime()
    // Smooth camera lerp — same tilt formula as AcousticMap left panel
    const px = isStatic ? 0 : mouseNorm.nx * 0.45
    const py = isStatic ? 0 : -mouseNorm.ny * 0.30
    camState.curX += (camState.baseX + px - camState.curX) * 0.06
    camState.curY += (camState.baseY + py - camState.curY) * 0.06
    camState.curZ += (camState.baseZ      - camState.curZ) * 0.06
    cam.position.set(camState.curX, camState.curY, camState.curZ)
    cam.lookAt(camState.lookX, camState.lookY, 0)
    renderer.render(scene, cam)
  }
  animate()

  // ── resize ────────────────────────────────────────────────────────────
  const onResize = () => {
    cam.aspect = el.clientWidth / el.clientHeight
    cam.updateProjectionMatrix()
    renderer.setSize(el.clientWidth, el.clientHeight)
  }
  window.addEventListener('resize', onResize)

  const cleanup = () => {
    cancelAnimationFrame(animId)
    window.removeEventListener('resize', onResize)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseleave', onMouseLeave)
    renderer.dispose()
    if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
  }

  return { cleanup, selectByName }
}

// ─── Component ────────────────────────────────────────────────────────────────
interface MapProps {
  selectedRegion?: string | null
  className?: string
  static?: boolean
}

export default function Map({ selectedRegion = null, className = '', static: isStatic = false }: MapProps) {
  const elRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<{ cleanup: () => void; selectByName: (n: string | null) => void } | null>(null)

  // Initial mount — load data and init Three.js
  useEffect(() => {
    if (!elRef.current) return
    let unmounted = false
    const el = elRef.current

    loadData().then(data => {
      if (unmounted || !el) return
      const api = initThree(el, data, selectedRegion, isStatic)
      apiRef.current = api
    }).catch(console.error)

    return () => {
      unmounted = true
      apiRef.current?.cleanup()
      apiRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally only run once — selectedRegion changes handled below

  // Respond to selectedRegion prop changes after mount
  useEffect(() => {
    apiRef.current?.selectByName(selectedRegion)
  }, [selectedRegion])

  return <div ref={elRef} className={`w-full h-full ${className}`} />
}
