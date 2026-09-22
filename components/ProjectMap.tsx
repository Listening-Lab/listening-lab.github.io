'use client'

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react'
// maplibre-gl v6 ships named exports only (no default export) — namespace-import it.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import {
  listAssets,
  listDetections,
  listRegions,
  createRegion,
  updateRegion,
  deleteRegion,
  listDevices,
  type Asset,
  type Detection,
  type Region as ApiRegion,
  type Device,
} from '@/lib/apiClient'
import { ASSET_POLL_INTERVAL_MS, hasUnsettledAsset } from '@/lib/assetPolling'

// Keyless, free vector basemap (CARTO) — no API key/billing account needed.
const BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// Same NZ-centered default view used by the homepage's abstract map (components/Map.tsx),
// so the two maps "feel" like the same place even though this one is a real basemap.
const DEFAULT_CENTER: [number, number] = [172.5, -41.2]
const DEFAULT_ZOOM = 5

const TEAL = '#4ecdc4'

// Matches this app's Tailwind `ocean` tokens (tailwind.config.ts) — the basemap gets
// recolored to these after load so the map reads as part of the page, not a boxed widget
// sitting on top of it: ocean = page background exactly, land is the lighter tone that
// "stands out" from it.
const OCEAN_DARK = '#0a1628'
const OCEAN_MID = '#0d2240'

// Must match components/Map.tsx's REGION_COLORS exactly — same palette used for the NZ
// region polygons and species/point colors on the homepage's sound map, reused here for
// the NZ-regions overlay and for user-drawn training/metrics regions.
const REGION_COLORS = [
  '#4ecdc4', '#ffe66d', '#ff6b6b', '#a8e6cf', '#c3a6ff',
  '#ff9f43', '#74b9ff', '#fd79a8', '#fdcb6e', '#00b894',
  '#e17055', '#6c5ce7', '#00cec9', '#55efc4', '#ffeaa7', '#fab1a0',
]

// Homepage map's region fill/outline opacities (components/Map.tsx's fillMat/outMat) —
// reused verbatim so drawn regions and the NZ-regions overlay read as the same visual
// language as the sound map's colored regions. The three fill values mirror that map's own
// selection states exactly (components/Map.tsx: `showAll ? 0.10 : isSelected ? 0.20 : 0.06`).
const REGION_FILL_OPACITY = 0.10
const REGION_FILL_OPACITY_SELECTED = 0.20
const REGION_FILL_OPACITY_DIMMED = 0.06
const REGION_OUTLINE_OPACITY = 0.55

// Under Turbopack's dev bundler, maplibre-gl can't auto-detect its own worker script
// location (its `import.meta.url`-based lookup needs a real http(s) URL, which Turbopack
// dev doesn't give it) — it silently falls back to `new Worker('')`, which resolves to
// the *current page* and fails instantly, so vector tiles never load (blank/black map,
// no console error). Pointing it at a static copy (kept in sync by
// `scripts/copy-maplibre-worker.mjs`, run via `postinstall`) sidesteps the detection
// entirely. Must run before the first `new maplibregl.Map(...)`.
if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')
}

type ViewMode = 'recorders' | 'heatmap'
type DrawMode = 'idle' | 'drawing'

export interface ProjectMapRegion {
  /** Prefixed (`drawn:<id>` / `nz:<id>`) so drawn and NZ-region ids can never collide. */
  id: string
  /** Real region.id in the DB — undefined only in the brief window between a
   *  freshly-drawn/selected region firing pushRegionsUpdate() and its createRegion()
   *  POST resolving. Needed anywhere a caller (e.g. training-run scope) must send the
   *  actual persisted region id rather than this UI-only prefixed one. */
  dbId?: string
  color: string
  /** Real region name for `kind: 'nz-region'`; absent for hand-drawn regions. */
  name?: string
  kind: 'drawn' | 'nz-region'
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>
}

export interface ProjectMapHandle {
  startDrawingRegion: () => void
  cancelDrawingRegion: () => void
  /** Deletes a drawn region or deselects an NZ region, depending on the id's prefix. */
  removeRegion: (id: string) => void
  clearRegions: () => void
  /** Only meaningful for `drawn:<id>` regions — NZ regions keep their real name. */
  renameRegion: (id: string, name: string) => void
  /** Arms a one-shot "click the map to place a point" mode — the next map click (that
   *  doesn't land on an existing region/recorder/device feature) resolves `onPicked` with
   *  that point's lat/lon and disarms itself. Used by the upload panel's device form so a
   *  device's location can come from clicking the map instead of typing coordinates. */
  startPickingLocation: (onPicked: (lat: number, lon: number) => void) => void
  cancelPickingLocation: () => void
  /** Refetches saved devices so a newly-created one appears on the map immediately. */
  refreshDevices: () => void
}

interface ProjectMapProps {
  projectId: string
  onRegionsChange?: (regions: ProjectMapRegion[]) => void
  onDrawModeChange?: (drawing: boolean) => void
  /** Fires when an existing saved device's marker is clicked — lets the upload panel
   *  select that device the same way picking it from the dropdown would. */
  onDeviceClick?: (device: Device) => void
  /** Fires when the "no recordings yet" empty state's upload prompt is clicked — the map
   *  page wires this to switching its sidebar into upload mode, rather than navigating
   *  away (there's no longer a standalone /projects/upload page to link to). */
  onUploadClick?: () => void
}

function assetsToGeoJSON(assets: Asset[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: assets
      .filter((a): a is Asset & { lat: number; lon: number } => a.lat !== null && a.lon !== null)
      .map((a) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [a.lon, a.lat] },
        properties: {
          id: a.id,
          filename: a.filename,
          folder: a.folder,
          recordedAt: a.recordedAt,
          status: a.latestJobStatus,
        },
      })),
  }
}

function detectionsToGeoJSON(detections: Detection[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: detections
      .filter((d): d is Detection & { lat: number; lon: number } => d.lat !== null && d.lon !== null)
      .map((d) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
        // Score weights the heatmap so higher-confidence windows contribute more density
        // than low-confidence ones, rather than every detection counting equally.
        properties: { species: d.speciesCode, score: d.score },
      })),
  }
}

function devicesToGeoJSON(devices: Device[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: devices.map((d) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [d.lon, d.lat] },
      properties: { id: d.id, name: d.name },
    })),
  }
}

function fitToFeatures(map: maplibregl.Map, fc: GeoJSON.FeatureCollection<GeoJSON.Point>) {
  if (fc.features.length === 0) return
  const bounds = new maplibregl.LngLatBounds()
  for (const f of fc.features) bounds.extend(f.geometry.coordinates as [number, number])
  map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 0 })
}

// Deterministic color per drawn region, cycling the same palette the homepage map uses
// for its NZ regions — so each hand-drawn training region reads the same visual language
// (a stable hash of the feature id, not array order, so a color survives across renders).
function colorForRegionId(id: string | number): `#${string}` {
  const s = String(id)
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return REGION_COLORS[hash % REGION_COLORS.length] as `#${string}`
}

// Recolor the fetched basemap style so its ocean matches the page background exactly and
// land reads as a lighter, contrasting tone from the same app palette — the goal is for
// the map to feel like part of the page rather than a boxed widget sitting on it.
function recolorBasemap(map: maplibregl.Map) {
  const setIfPresent = (layerId: string, prop: string, value: unknown) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (map.getLayer(layerId)) map.setPaintProperty(layerId, prop as any, value as any)
  }
  setIfPresent('background', 'background-color', OCEAN_DARK)
  setIfPresent('water', 'fill-color', OCEAN_DARK)
  setIfPresent('water_shadow', 'fill-color', OCEAN_DARK)
  for (const layerId of ['landcover', 'landuse', 'landuse_residential', 'park_national_park', 'park_nature_reserve']) {
    setIfPresent(layerId, 'fill-color', OCEAN_MID)
  }
}

// `/regions.json` (simplemaps.com) is what the homepage's abstract, non-cartographic map
// uses — plenty for that (it's not real geography, just a stylized layout) but far too
// coarse next to this map's real vector-tile coastline, which is why region edges cut
// visibly across land/coast here. `/nz-regions-detailed.json` is a separate, much
// higher-resolution file derived from geoBoundaries.org's NZL ADM1 boundaries (in turn
// sourced from Stats NZ, CC-BY 4.0) — see log/2026-09-19-project-map-feature.md for the
// exact source and how it was generated. Kept as its own file rather than replacing
// `regions.json` so the homepage map isn't stuck loading a ~1.7MB file it doesn't need.
//
// A basemap-native boundary layer (the vector tiles' own admin boundary lines, which
// would align by construction, zero dataset needed) was tried first and abandoned: this
// CARTO/OSM tile source has no NZ admin boundary data at all — confirmed via
// `map.queryRenderedFeatures` returning zero features for both country- and
// region-level boundary layers over NZ at any reasonable zoom.
async function addRegionsOverlay(map: maplibregl.Map): Promise<GeoJSON.FeatureCollection | null> {
  let geojson: GeoJSON.FeatureCollection
  try {
    const res = await fetch('/nz-regions-detailed.json')
    geojson = await res.json()
  } catch {
    return null // NZ regions overlay is a nice-to-have; don't break the map if it 404s.
  }
  if (map.getSource('nz-regions')) return null

  const colored: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: geojson.features.map((f, i) => ({
      ...f,
      properties: { ...f.properties, color: REGION_COLORS[i % REGION_COLORS.length] },
    })),
  }

  map.addSource('nz-regions', { type: 'geojson', data: colored })
  map.addLayer({
    id: 'nz-regions-fill',
    type: 'fill',
    source: 'nz-regions',
    paint: { 'fill-color': ['get', 'color'], 'fill-opacity': REGION_FILL_OPACITY },
  })
  map.addLayer({
    id: 'nz-regions-outline',
    type: 'line',
    source: 'nz-regions',
    paint: { 'line-color': ['get', 'color'], 'line-opacity': REGION_OUTLINE_OPACITY, 'line-width': 1.5 },
  })
  return colored
}

const ProjectMap = forwardRef<ProjectMapHandle, ProjectMapProps>(function ProjectMap(
  { projectId, onRegionsChange, onDrawModeChange, onDeviceClick, onUploadClick },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  // Full (untiled) NZ-region features, keyed by their `properties.id` — looked up on
  // click so metrics/point-in-polygon always run against complete geometry, never a
  // tile-clipped fragment from a MapLibre feature-query event.
  const regionsDataRef = useRef<Map<string, GeoJSON.Feature>>(new Map())
  const selectedNZRegionIdsRef = useRef<Set<string>>(new Set())
  // Mirrors `drawMode` state for the region-click handler, which is registered once
  // (inside the map-init effect) and would otherwise close over a stale 'idle' forever.
  const drawModeRef = useRef<DrawMode>('idle')
  // Maps our prefixed region id (`drawn:<terraDrawId>` / `nz:<shapeId>`) to the
  // persisted row's database id — every create/rename/delete against the API needs the
  // DB id, not terra-draw's own (ephemeral, in-memory-only) feature id.
  const regionDbIdsRef = useRef<Map<string, string>>(new Map())
  // Holds the "next click resolves this" callback while a location pick is armed - a ref
  // (not state) because the generic map click handler is registered once, in the same
  // init effect as everything else above, and would otherwise close over a stale value.
  const pickingLocationRef = useRef<((lat: number, lon: number) => void) | null>(null)
  const onDeviceClickRef = useRef(onDeviceClick)
  useEffect(() => { onDeviceClickRef.current = onDeviceClick }, [onDeviceClick])
  // The device-point click handler below is only ever registered once (the first time
  // the 'devices' source is created) - it must read devices through a ref, not the state
  // closure, or it would only ever see whatever the device list was at that first render.
  const devicesRef = useRef<Device[]>([])

  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [detections, setDetections] = useState<Detection[] | null>(null)
  const [devices, setDevices] = useState<Device[]>([])
  useEffect(() => { devicesRef.current = devices }, [devices])
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('recorders')
  const [showRegions, setShowRegions] = useState(true)
  const [drawMode, setDrawMode] = useState<DrawMode>('idle')
  const [isPickingLocation, setIsPickingLocation] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  // User-given names for drawn regions, keyed by their prefixed `drawn:<id>` — terra-draw
  // owns the geometry, but naming is a purely UI-level concern layered on top rather than
  // stored in the feature's own properties (avoids reaching into terra-draw's internal
  // store just to patch one field).
  const [drawnRegionNames, setDrawnRegionNames] = useState<Record<string, string>>({})
  // `pushRegionsUpdate` is registered once with terra-draw's 'change' event (inside the
  // map-init effect, which only ever runs on mount) — reading names through a ref rather
  // than the state closure keeps it seeing renames made after that registration.
  const drawnRegionNamesRef = useRef<Record<string, string>>({})
  useEffect(() => {
    drawnRegionNamesRef.current = drawnRegionNames
  }, [drawnRegionNames])

  useEffect(() => {
    drawModeRef.current = drawMode
    onDrawModeChange?.(drawMode === 'drawing')
  }, [drawMode, onDrawModeChange])

  // Fetch this project's recorder locations and species detections, then keep polling for
  // as long as anything is still pending/processing - a file uploaded and left to process
  // needs its marker to update color (and the heatmap to gain its detections) on its own,
  // not just once at whatever moment this component happened to mount. Self-contained data
  // fetching (rather than requiring a parent to pass props in) mirrors how the homepage's
  // AcousticMap owns its own data — drop <ProjectMap projectId="..."/> anywhere and it works.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      try {
        const [a, d] = await Promise.all([
          listAssets(projectId, { limit: 1000 }),
          listDetections(projectId, { limit: 5000 }),
        ])
        if (cancelled) return
        setAssets(a)
        setDetections(d)
        setError(null)
        if (hasUnsettledAsset(a)) timer = setTimeout(poll, ASSET_POLL_INTERVAL_MS)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load map data')
        // Keep retrying - a dropped request shouldn't permanently freeze the map's status.
        timer = setTimeout(poll, ASSET_POLL_INTERVAL_MS)
      }
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [projectId])

  const loadDevices = useCallback(() => {
    listDevices(projectId)
      .then(setDevices)
      .catch((err) => console.error('[ProjectMap] failed to load devices:', err))
  }, [projectId])

  useEffect(() => { loadDevices() }, [loadDevices])

  // Combines hand-drawn polygons and selected NZ regions into one list — the sidebar
  // treats both identically (same metrics computation, same list UI), matching drawn
  // regions and admin regions as equivalent "regions" rather than two separate concepts.
  const pushRegionsUpdate = useCallback(() => {
    const draw = drawRef.current
    const drawnRegions: ProjectMapRegion[] = draw
      ? draw
          .getSnapshot()
          .filter((f) => f.geometry.type === 'Polygon' && f.id !== undefined)
          .map((f) => {
            const id = `drawn:${f.id}`
            return {
              id,
              dbId: regionDbIdsRef.current.get(id),
              kind: 'drawn' as const,
              name: drawnRegionNamesRef.current[id],
              color: colorForRegionId(f.id as string | number),
              feature: f as unknown as GeoJSON.Feature<GeoJSON.Polygon>,
            }
          })
      : []

    const nzRegions: ProjectMapRegion[] = Array.from(selectedNZRegionIdsRef.current)
      .map((id) => regionsDataRef.current.get(id))
      .filter((f): f is GeoJSON.Feature => f !== undefined)
      .map((f) => {
        const id = `nz:${f.properties?.id}`
        return {
          id,
          dbId: regionDbIdsRef.current.get(id),
          kind: 'nz-region' as const,
          name: f.properties?.name as string | undefined,
          color: f.properties?.color as string,
          feature: f as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
        }
      })

    onRegionsChange?.([...nzRegions, ...drawnRegions])
  }, [onRegionsChange])

  // Selected NZ regions get a brighter fill, everything else dims slightly — same
  // selection treatment as the homepage map (components/Map.tsx: 0.20 selected / 0.06
  // dimmed / 0.10 with nothing selected).
  const updateNZRegionSelectionPaint = useCallback(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('nz-regions-fill')) return
    const ids = Array.from(selectedNZRegionIdsRef.current)
    map.setPaintProperty(
      'nz-regions-fill',
      'fill-opacity',
      ids.length === 0
        ? REGION_FILL_OPACITY
        : ['case', ['in', ['get', 'id'], ['literal', ids]], REGION_FILL_OPACITY_SELECTED, REGION_FILL_OPACITY_DIMMED]
    )
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      startDrawingRegion: () => {
        drawRef.current?.setMode('polygon')
        setDrawMode('drawing')
      },
      cancelDrawingRegion: () => {
        drawRef.current?.setMode('select')
        setDrawMode('idle')
      },
      removeRegion: (id) => {
        if (id.startsWith('nz:')) {
          const ref = id.slice(3)
          selectedNZRegionIdsRef.current.delete(ref)
          updateNZRegionSelectionPaint()
          const dbId = regionDbIdsRef.current.get(id)
          if (dbId) {
            regionDbIdsRef.current.delete(id)
            deleteRegion(projectId, dbId).catch((err) =>
              console.error('[ProjectMap] failed to delete region:', err)
            )
          }
          pushRegionsUpdate()
        } else if (id.startsWith('drawn:')) {
          // Deletion (and its API call) happens in the terra-draw 'change' handler
          // below, keyed off type === 'delete' — the same path a user pressing
          // Delete/Backspace on a selected polygon takes, so there's exactly one place
          // this is handled regardless of how the delete was triggered.
          const rawId = id.slice(6)
          const numericId = Number(rawId)
          drawRef.current?.removeFeatures([Number.isNaN(numericId) ? rawId : numericId])
        }
      },
      clearRegions: () => {
        drawRef.current?.clear() // triggers 'change'/'delete' for each, per feature
        for (const ref of selectedNZRegionIdsRef.current) {
          const dbId = regionDbIdsRef.current.get(`nz:${ref}`)
          if (dbId) deleteRegion(projectId, dbId).catch((err) => console.error('[ProjectMap] failed to delete region:', err))
        }
        selectedNZRegionIdsRef.current.clear()
        updateNZRegionSelectionPaint()
        pushRegionsUpdate()
      },
      renameRegion: (id, name) => {
        if (!id.startsWith('drawn:')) return // NZ regions keep their real name.
        setDrawnRegionNames((prev) => ({ ...prev, [id]: name }))
        drawnRegionNamesRef.current = { ...drawnRegionNamesRef.current, [id]: name }
        const dbId = regionDbIdsRef.current.get(id)
        if (dbId) {
          updateRegion(projectId, dbId, { name }).catch((err) =>
            console.error('[ProjectMap] failed to rename region:', err)
          )
        }
        pushRegionsUpdate()
      },
      startPickingLocation: (onPicked) => {
        pickingLocationRef.current = onPicked
        setIsPickingLocation(true)
        if (mapRef.current) mapRef.current.getCanvas().style.cursor = 'crosshair'
      },
      cancelPickingLocation: () => {
        pickingLocationRef.current = null
        setIsPickingLocation(false)
        if (mapRef.current) mapRef.current.getCanvas().style.cursor = ''
      },
      refreshDevices: loadDevices,
    }),
    [pushRegionsUpdate, updateNZRegionSelectionPaint, projectId, loadDevices]
  )

  // Map initialization — runs once per mount. In dev, React Strict Mode runs this effect,
  // its cleanup, then this effect again, all synchronously - `map.remove()` in cleanup
  // normally pre-empts 'load' from ever firing on the discarded first instance, but a
  // cached basemap style can resolve fast enough to race past that, letting a stale
  // instance's hydration logic keep running after cleanup and double-add features (e.g.
  // a drawn region appearing twice) - `cancelled` makes every step below a no-op once
  // this particular effect run has been cleaned up, regardless of what triggered it.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    map.on('error', (e) => console.error('[ProjectMap] maplibre error:', e.error))

    // Generic click, registered once — armed/disarmed via startPickingLocation /
    // cancelPickingLocation on the imperative handle. Deliberately not layer-specific (a
    // location pick should resolve wherever the user clicks, including open water or
    // anywhere with no feature underneath), unlike the region/recorder/device click
    // handlers below, which all guard against firing while a pick is in progress instead.
    map.on('click', (e) => {
      const onPicked = pickingLocationRef.current
      if (!onPicked || drawModeRef.current === 'drawing') return
      pickingLocationRef.current = null
      setIsPickingLocation(false)
      map.getCanvas().style.cursor = ''
      onPicked(e.lngLat.lat, e.lngLat.lng)
    })

    map.on('load', async () => {
      if (cancelled) return
      recolorBasemap(map)

      // User-drawn polygons for scoping model training/metrics to a region. Styled with
      // the same fill/outline opacities and color palette as the homepage's NZ regions —
      // "select" is the idle/default mode (lets clicking an existing region select it for
      // editing/deleting without capturing clicks meant for recorder markers); "polygon"
      // only turns on while actively drawing (see startDrawingRegion above).
      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  coordinates: { midpoints: true, draggable: true, deletable: true },
                },
              },
            },
          }),
          new TerraDrawPolygonMode({
            styles: {
              fillColor: (f) => colorForRegionId(f.id as string | number),
              fillOpacity: REGION_FILL_OPACITY + 0.05,
              outlineColor: (f) => colorForRegionId(f.id as string | number),
              outlineOpacity: REGION_OUTLINE_OPACITY,
              outlineWidth: 2,
              closingPointColor: TEAL,
              closingPointOutlineColor: OCEAN_DARK,
            },
          }),
        ],
      })
      draw.start()
      draw.setMode('select')
      // terra-draw represents an in-progress polygon as a real feature from the very
      // first click (so it can render as you go), under a *draft* id — then swaps in a
      // different, final id once the shape is actually finished. Persisting on 'change'
      // events during that draft phase (type 'create') creates the DB row under an id
      // that later edits/deletes (which reference the final id) can never find again —
      // confirmed by instrumented testing: the drafted geometry got POSTed, then every
      // subsequent update silently no-op'd against a dbId keyed to the wrong id, and the
      // saved region was left with a bogus single-point-repeated polygon forever. 'finish'
      // fires exactly once, with the true final id and complete geometry, so creation is
      // persisted there instead.
      draw.on('finish', (id) => {
        draw.setMode('select')
        setDrawMode('idle')

        const feature = draw.getSnapshotFeature(id)
        if (!feature || feature.geometry.type !== 'Polygon') return
        const prefixedId = `drawn:${id}`
        const name = `Region ${draw.getSnapshot().filter((f) => f.geometry.type === 'Polygon').length}`
        setDrawnRegionNames((prev) => ({ ...prev, [prefixedId]: name }))
        drawnRegionNamesRef.current = { ...drawnRegionNamesRef.current, [prefixedId]: name }
        createRegion(projectId, {
          kind: 'drawn',
          name,
          color: colorForRegionId(id),
          geometry: feature.geometry as GeoJSON.Polygon,
        })
          .then((created) => regionDbIdsRef.current.set(prefixedId, created.id))
          .catch((err) => console.error('[ProjectMap] failed to persist new region:', err))
        pushRegionsUpdate()
      })
      // Persists edits/deletes made after a region already exists — dragging a vertex or
      // pressing Delete/Backspace on a selected polygon in terra-draw's own select mode,
      // neither of which goes through our imperative handle methods, so this is the one
      // place both need to funnel through to reach the DB. Creation is deliberately not
      // handled here — see the 'finish' comment above for why.
      draw.on('change', (ids, type) => {
        if (type === 'update') {
          for (const id of ids) {
            const dbId = regionDbIdsRef.current.get(`drawn:${id}`)
            const feature = draw.getSnapshotFeature(id)
            if (!dbId || !feature || feature.geometry.type !== 'Polygon') continue
            updateRegion(projectId, dbId, { geometry: feature.geometry as GeoJSON.Polygon }).catch((err) =>
              console.error('[ProjectMap] failed to persist region edit:', err)
            )
          }
        } else if (type === 'delete') {
          for (const id of ids) {
            const prefixedId = `drawn:${id}`
            const dbId = regionDbIdsRef.current.get(prefixedId)
            if (dbId) {
              regionDbIdsRef.current.delete(prefixedId)
              deleteRegion(projectId, dbId).catch((err) =>
                console.error('[ProjectMap] failed to delete region:', err)
              )
            }
            setDrawnRegionNames((prev) => {
              const next = { ...prev }
              delete next[prefixedId]
              return next
            })
            delete drawnRegionNamesRef.current[prefixedId]
          }
        }
        pushRegionsUpdate()
      })
      drawRef.current = draw

      const fc = await addRegionsOverlay(map)
      if (cancelled) return
      if (fc) {
        for (const f of fc.features) {
          const id = f.properties?.id
          if (id) regionsDataRef.current.set(id, f)
        }
        map.on('click', 'nz-regions-fill', (e) => {
          // While actively drawing, clicks are placing polygon vertices — letting them
          // also toggle whatever NZ region happens to be underneath meant every vertex
          // click doubled as a select/deselect. Same reasoning for a location pick in
          // progress - that click is placing a device, not selecting a region.
          if (drawModeRef.current === 'drawing' || pickingLocationRef.current) return
          const id = e.features?.[0]?.properties?.id
          if (!id) return
          if (selectedNZRegionIdsRef.current.has(id)) {
            selectedNZRegionIdsRef.current.delete(id)
            const dbId = regionDbIdsRef.current.get(`nz:${id}`)
            if (dbId) {
              regionDbIdsRef.current.delete(`nz:${id}`)
              deleteRegion(projectId, dbId).catch((err) => console.error('[ProjectMap] failed to delete region:', err))
            }
          } else {
            selectedNZRegionIdsRef.current.add(id)
            const feature = regionsDataRef.current.get(id)
            createRegion(projectId, {
              kind: 'nz_admin',
              name: (feature?.properties?.name as string) ?? 'NZ Region',
              color: (feature?.properties?.color as string) ?? TEAL,
              nzRegionRef: id,
              // The API now requires geometry for nz_admin rows too (region-scoped
              // training needs real point-in-polygon filtering server-side for both
              // region kinds) - already loaded here from the static NZ-regions dataset,
              // so this is wiring existing data through, not fetching anything new.
              geometry: feature?.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon | undefined,
            })
              .then((created) => regionDbIdsRef.current.set(`nz:${id}`, created.id))
              .catch((err) => console.error('[ProjectMap] failed to persist region selection:', err))
          }
          updateNZRegionSelectionPaint()
          pushRegionsUpdate()
        })
        map.on('mouseenter', 'nz-regions-fill', () => {
          if (drawModeRef.current !== 'drawing') map.getCanvas().style.cursor = 'pointer'
        })
        map.on('mouseleave', 'nz-regions-fill', () => { map.getCanvas().style.cursor = '' })
      }

      // Hydrate previously-saved regions. Drawn polygons load into terra-draw itself
      // (draw.addFeatures) so they're immediately visible, selectable and editable, not
      // just displayed as inert shapes; NZ regions just need re-adding to the selected
      // set since their geometry already lives in the static dataset fetched above.
      try {
        const persisted = await listRegions(projectId)
        if (cancelled) return
        const persistedDrawn = persisted.filter((r) => r.kind === 'drawn' && r.geometry)
        if (persistedDrawn.length > 0) {
          draw.addFeatures(
            persistedDrawn.map((r) => ({
              type: 'Feature' as const,
              geometry: r.geometry as GeoJSON.Polygon,
              properties: { mode: 'polygon' },
            }))
          )
          // addFeatures doesn't hand back the ids it assigned - the snapshot's most
          // recently added polygons are exactly these, in the same order, since nothing
          // else has touched the store yet at this point in initialization.
          const added = draw
            .getSnapshot()
            .filter((f) => f.geometry.type === 'Polygon')
            .slice(-persistedDrawn.length)
          added.forEach((feature, i) => {
            const region = persistedDrawn[i]
            const prefixedId = `drawn:${feature.id}`
            regionDbIdsRef.current.set(prefixedId, region.id)
            drawnRegionNamesRef.current[prefixedId] = region.name
          })
          setDrawnRegionNames({ ...drawnRegionNamesRef.current })
        }

        for (const r of persisted) {
          if (r.kind === 'nz_admin' && r.nzRegionRef) {
            selectedNZRegionIdsRef.current.add(r.nzRegionRef)
            regionDbIdsRef.current.set(`nz:${r.nzRegionRef}`, r.id)
          }
        }
        updateNZRegionSelectionPaint()
        pushRegionsUpdate()
      } catch (err) {
        console.error('[ProjectMap] failed to load saved regions:', err)
      }

      if (cancelled) return
      setMapReady(true)
    })

    mapRef.current = map

    return () => {
      cancelled = true
      drawRef.current?.stop()
      drawRef.current = null
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleMarkerClick = useCallback((e: maplibregl.MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
    if (pickingLocationRef.current) return
    const feature = e.features?.[0]
    const map = mapRef.current
    if (!feature || !map || feature.geometry.type !== 'Point') return
    const coords = feature.geometry.coordinates.slice() as [number, number]
    const props = feature.properties ?? {}

    popupRef.current?.remove()
    const node = document.createElement('div')
    node.innerHTML = `
      <div style="font-family: var(--font-inter, sans-serif); min-width: 160px;">
        <p style="font-weight: 600; margin: 0 0 4px;">${props.filename ?? 'Recording'}</p>
        <p style="font-size: 12px; color: #9ca3af; margin: 0 0 2px;">${props.folder ?? ''}</p>
        <p style="font-size: 12px; color: #9ca3af; margin: 0;">${props.recordedAt ? new Date(props.recordedAt).toLocaleString() : ''}</p>
      </div>
    `
    popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 12 })
      .setLngLat(coords)
      .setDOMContent(node)
      .addTo(map)
  }, [])

  // Wire up sources/layers once the map style has loaded AND data has arrived. Re-runs
  // whenever assets/detections change so re-uploads show up without a full page reload.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !assets || !detections) return

    const assetFC = assetsToGeoJSON(assets)
    const detectionFC = detectionsToGeoJSON(detections)

    if (map.getSource('recorders')) {
      ;(map.getSource('recorders') as maplibregl.GeoJSONSource).setData(assetFC)
    } else {
      map.addSource('recorders', {
        type: 'geojson',
        data: assetFC,
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 40,
      })

      // Soft radial glow + solid core — approximates the homepage's shader-glow points
      // (soft circular falloff, ~0.9 core alpha) using layered circle-blur instead of a
      // custom WebGL shader, since these are real vector-tile markers, not a point cloud.
      map.addLayer({
        id: 'recorder-cluster-glow',
        type: 'circle',
        source: 'recorders',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 20, 10, 26, 50, 34],
          'circle-color': TEAL,
          'circle-opacity': 0.22,
          'circle-blur': 1,
        },
      })
      map.addLayer({
        id: 'recorder-cluster-core',
        type: 'circle',
        source: 'recorders',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 10, 10, 14, 50, 18],
          'circle-color': TEAL,
          'circle-opacity': 0.9,
          'circle-blur': 0.15,
        },
      })
      map.addLayer({
        id: 'recorder-cluster-count',
        type: 'symbol',
        source: 'recorders',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': OCEAN_DARK },
      })

      map.addLayer({
        id: 'recorder-point-glow',
        type: 'circle',
        source: 'recorders',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 16,
          'circle-color': TEAL,
          'circle-opacity': 0.28,
          'circle-blur': 1,
        },
      })
      map.addLayer({
        id: 'recorder-point-core',
        type: 'circle',
        source: 'recorders',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 5,
          'circle-color': [
            'match', ['get', 'status'],
            'complete', TEAL,
            'processing', '#f0b429',
            'failed', '#ef4444',
            /* pending / default */ '#9ca3af',
          ],
          'circle-opacity': 0.92,
          'circle-blur': 0.15,
        },
      })

      map.on('click', 'recorder-point-core', handleMarkerClick)
      map.on('click', 'recorder-cluster-core', (e) => {
        const feature = e.features?.[0]
        if (!feature || feature.geometry.type !== 'Point') return
        const center = feature.geometry.coordinates as [number, number]
        const clusterId = feature.properties?.cluster_id
        const source = map.getSource('recorders') as maplibregl.GeoJSONSource
        source.getClusterExpansionZoom(clusterId).then((zoom) => {
          map.easeTo({ center, zoom })
        })
      })
      for (const layer of ['recorder-point-core', 'recorder-cluster-core']) {
        map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer' })
        map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = '' })
      }

      fitToFeatures(map, assetFC)
    }

    if (map.getSource('detections')) {
      ;(map.getSource('detections') as maplibregl.GeoJSONSource).setData(detectionFC)
    } else {
      map.addSource('detections', { type: 'geojson', data: detectionFC })
      map.addLayer({
        id: 'detection-heat',
        type: 'heatmap',
        source: 'detections',
        maxzoom: 15,
        paint: {
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'score'], 0, 0, 1, 1],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(78,205,196,0)',
            0.2, 'rgba(78,205,196,0.3)',
            0.5, 'rgba(78,205,196,0.6)',
            0.8, '#4ecdc4',
            1, '#ffffff',
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 8, 15, 30],
        },
        layout: { visibility: 'none' },
      })
    }
  }, [mapReady, assets, detections, handleMarkerClick])

  // Saved devices — a small, visually distinct layer from recorder points (which mark
  // individual uploaded files' locations; a device is reusable equipment, not a
  // recording). Deliberately not clustered - the device count per project is expected to
  // stay small (a handful of physical units), unlike potentially thousands of recordings.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const deviceFC = devicesToGeoJSON(devices)

    if (map.getSource('devices')) {
      ;(map.getSource('devices') as maplibregl.GeoJSONSource).setData(deviceFC)
      return
    }
    map.addSource('devices', { type: 'geojson', data: deviceFC })
    map.addLayer({
      id: 'device-point',
      type: 'circle',
      source: 'devices',
      paint: {
        'circle-radius': 6,
        'circle-color': '#c3a6ff',
        'circle-opacity': 0.95,
        'circle-stroke-width': 2,
        'circle-stroke-color': OCEAN_DARK,
      },
    })
    map.on('click', 'device-point', (e) => {
      if (pickingLocationRef.current) return
      const feature = e.features?.[0]
      if (!feature || feature.geometry.type !== 'Point') return
      const id = feature.properties?.id as string | undefined
      const device = devicesRef.current.find((d) => d.id === id)
      const coords = feature.geometry.coordinates.slice() as [number, number]

      popupRef.current?.remove()
      const node = document.createElement('div')
      node.innerHTML = `
        <div style="font-family: var(--font-inter, sans-serif); min-width: 140px;">
          <p style="font-weight: 600; margin: 0;">${feature.properties?.name ?? 'Device'}</p>
        </div>
      `
      popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 10 }).setLngLat(coords).setDOMContent(node).addTo(map)

      if (device) onDeviceClickRef.current?.(device)
    })
    map.on('mouseenter', 'device-point', () => {
      if (!pickingLocationRef.current) map.getCanvas().style.cursor = 'pointer'
    })
    map.on('mouseleave', 'device-point', () => { map.getCanvas().style.cursor = '' })
  }, [mapReady, devices])

  // Toggle recorder-pin layers vs. heatmap layer visibility.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const recorderLayers = [
      'recorder-cluster-glow', 'recorder-cluster-core', 'recorder-cluster-count',
      'recorder-point-glow', 'recorder-point-core',
    ]
    for (const id of recorderLayers) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', viewMode === 'recorders' ? 'visible' : 'none')
    }
    if (map.getLayer('detection-heat')) {
      map.setLayoutProperty('detection-heat', 'visibility', viewMode === 'heatmap' ? 'visible' : 'none')
    }
  }, [viewMode, mapReady])

  // Toggle the NZ-regions overlay independently of the recorders/heatmap mode.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    for (const id of ['nz-regions-fill', 'nz-regions-outline']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', showRegions ? 'visible' : 'none')
    }
  }, [showRegions, mapReady])

  // Subtle "breathing" pulse on the recorder glow halo, echoing the homepage shader
  // points' size oscillation (same 1.4 rad/s rate) — approximated by animating a paint
  // property each frame rather than a literal GLSL uniform.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    let raf = 0
    const start = performance.now()
    const animate = (t: number) => {
      const breathe = 1 + 0.15 * Math.sin(((t - start) / 1000) * 1.4)
      if (map.getLayer('recorder-point-glow')) {
        map.setPaintProperty('recorder-point-glow', 'circle-radius', 16 * breathe)
      }
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [mapReady])

  const loading = assets === null || detections === null

  return (
    <div className="relative w-full h-full">
      {/*
        maplibre-gl adds its own "maplibregl-map" class straight onto this element, and
        that stylesheet sets `position: relative`, silently overriding a Tailwind
        `absolute inset-0` (same specificity, its CSS loads after Tailwind's) — leaving
        the div with no computed height and the canvas falling back to a bogus default
        size. w-full/h-full works with relative positioning, so it isn't fought.
      */}
      <div ref={containerRef} className="w-full h-full" />

      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-ocean-dark/80 backdrop-blur-sm rounded-full p-1 border border-white/10">
          <button
            onClick={() => setViewMode('recorders')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              viewMode === 'recorders' ? 'bg-white text-ocean-dark' : 'text-gray-300 hover:text-white'
            }`}
          >
            Recorders
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              viewMode === 'heatmap' ? 'bg-white text-ocean-dark' : 'text-gray-300 hover:text-white'
            }`}
          >
            Detection Heatmap
          </button>
        </div>

        <button
          onClick={() => setShowRegions((v) => !v)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors bg-ocean-dark/80 backdrop-blur-sm ${
            showRegions ? 'border-brand-500/50 text-white' : 'border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          NZ Regions
        </button>

        {drawMode === 'drawing' && (
          <span className="px-4 py-1.5 rounded-full text-sm font-medium bg-brand-500/20 border border-brand-500/40 text-brand-100">
            Click to place points, double-click to finish
          </span>
        )}

        {isPickingLocation && (
          <span className="flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium bg-[#c3a6ff]/20 border border-[#c3a6ff]/40 text-white">
            Click the map to place this device
            <button
              onClick={() => {
                pickingLocationRef.current = null
                setIsPickingLocation(false)
                if (mapRef.current) mapRef.current.getCanvas().style.cursor = ''
              }}
              className="text-white/70 hover:text-white"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {(loading || error) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-ocean-dark/70">
          {error ? (
            <p className="text-red-400 text-sm px-4 text-center">{error}</p>
          ) : (
            <p className="text-gray-400 text-sm">Loading map data…</p>
          )}
        </div>
      )}

      {!loading && !error && assets.length === 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-ocean-dark/80 backdrop-blur-sm border border-white/10 rounded-lg px-4 py-3 text-sm text-gray-300">
          No recordings with a location yet.{' '}
          <button onClick={onUploadClick} className="text-brand-100 underline">
            Upload one
          </button>{' '}
          to see it appear here.
        </div>
      )}
    </div>
  )
})

export default ProjectMap
