'use client'

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { BASEMAP_STYLE_URL, DEFAULT_CENTER, DEFAULT_ZOOM, addLandOutline, recolorBasemap } from '@/lib/basemap'
import { DENSITY_BEST_M, deviceLinks, gapsToNearest, isolatedDevices, type DeviceLink, type PlannedDeployment } from '@/lib/pricing'
import type { Site } from '@/lib/apiClient'

// See ProjectMap: maplibre can't find its worker under the dev bundler without this.
if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')
}

const TEAL = '#4ecdc4'
const RED = '#ff6b6b'
const WEAK = '#ffe66d'
// Same colour ProjectMap uses for sites.
const SITE = '#f4c95d'
// Below this zoom a 200 m circle is only a few pixels across (about 10 px at zoom 13 in NZ).
const RANGE_VISIBLE_ZOOM = 13

// Styles the marker's inner dot, never the element maplibre positions (it owns that
// element's transform, which cssText would wipe).
function styleExistingMarker(el: HTMLElement, name: string) {
  el.title = `${name} (already deployed)`
  el.style.cursor = 'default'
  const dot = el.firstElementChild as HTMLElement
  dot.style.cssText = [
    'width:14px', 'height:14px', 'transform:rotate(45deg)', 'background:#0a1628',
    'border:2px solid rgba(255,255,255,0.75)',
  ].join(';')
}

function styleMarker(el: HTMLElement, index: number, selected: boolean, isolated: boolean) {
  const dot = el.firstElementChild as HTMLElement
  dot.textContent = String(index + 1)
  dot.style.cssText = [
    'width:22px', 'height:22px', 'border-radius:50%', 'display:flex', 'align-items:center',
    'justify-content:center', 'font:600 11px var(--font-inter),sans-serif', 'color:#0a1628',
    `background:${isolated ? RED : TEAL}`, 'cursor:grab',
    selected ? 'box-shadow:0 0 0 3px #0a1628,0 0 0 5px #fff' : 'box-shadow:0 0 0 2px #0a1628',
  ].join(';')
}

/** A circle of `meters` around a point, as a 64-sided polygon. Accurate enough at this scale. */
function circle(lng: number, lat: number, meters: number): GeoJSON.Polygon {
  const dLat = (meters / 6_371_000) * (180 / Math.PI)
  const dLng = dLat / Math.cos((lat * Math.PI) / 180)
  const ring: [number, number][] = []
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI
    ring.push([lng + dLng * Math.sin(a), lat + dLat * Math.cos(a)])
  }
  return { type: 'Polygon', coordinates: [ring] }
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

/**
 * Range circles and neighbour links for density work. `dragging` overrides one device's
 * position so both follow a marker mid-drag, before the page state updates.
 */
function densityData(
  deps: PlannedDeployment[],
  existing: PlannedDeployment[],
  meters: number,
  dragging?: { id: string; lng: number; lat: number },
): { ranges: GeoJSON.FeatureCollection; links: GeoJSON.FeatureCollection; gaps: GeoJSON.FeatureCollection } {
  const placed = [
    ...deps.map((d) => (dragging?.id === d.id ? { ...d, lng: dragging.lng, lat: dragging.lat } : d)),
    ...existing,
  ]
  const isolated = isolatedDevices(placed, meters)
  // Only planned devices can be isolated: existing ones are context, not part of the plan.
  const byId = new Map(placed.map((d) => [d.id, d]))
  const lines = (ls: DeviceLink[]): GeoJSON.FeatureCollection => ({
    type: 'FeatureCollection',
    features: ls.map((l) => {
      const a = byId.get(l.a)!
      const b = byId.get(l.b)!
      return {
        type: 'Feature',
        properties: { strength: l.strength },
        geometry: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
      }
    }),
  })
  return {
    ranges: {
      type: 'FeatureCollection',
      features: placed.map((d) => ({
        type: 'Feature',
        properties: { isolated: !d.existing && isolated.has(d.id), existing: !!d.existing },
        geometry: circle(d.lng, d.lat, meters),
      })),
    },
    links: lines(deviceLinks(placed, meters)),
    gaps: lines(gapsToNearest(placed, meters).filter((g) => !byId.get(g.a)?.existing)),
  }
}

/**
 * A plain map for sketching a study design: click to place a device (while `placing`),
 * drag to move, click to select. Nothing here talks to the API.
 *
 * With `rangeMeters` set (density work), each device gets a range circle, devices with no
 * neighbour in range turn red, and a hint appears when zoomed out too far to see ranges.
 */
export default function PlanMap({
  deployments,
  existing,
  sites,
  selectedId,
  placing,
  rangeMeters,
  isolatedIds,
  focus,
  onAdd,
  onMove,
  onSelect,
}: {
  deployments: PlannedDeployment[]
  /** Devices already in the project: fixed markers that count as density neighbours. */
  existing: PlannedDeployment[]
  sites: Site[]
  selectedId: string | null
  placing: boolean
  rangeMeters: number | null
  isolatedIds: Set<string>
  /** Changing this flies the map to that device. */
  focus: { id: string; at: number } | null
  onAdd: (lng: number, lat: number) => void
  onMove: (id: string, lng: number, lat: number) => void
  onSelect: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef(new Map<string, maplibregl.Marker>())
  const existingMarkersRef = useRef<maplibregl.Marker[]>([])
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(DEFAULT_ZOOM)
  // Handlers read through refs so the map's listeners, registered once, see current props.
  const cb = useRef({ placing, onAdd, onMove, onSelect })
  cb.current = { placing, onAdd, onMove, onSelect }
  const latest = useRef({ deployments, existing, rangeMeters })
  latest.current = { deployments, existing, rangeMeters }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    // A basemap tile that fails to download (a network blip, or a request cut off by a quick
    // zoom) only leaves a blank square until the next pan, so warn rather than error: without a
    // handler maplibre console.errors it, which Next's dev overlay shows as a page error.
    map.on('error', (e) => {
      const tileFailed = 'tile' in e || /Failed to fetch|AJAXError/.test(String(e.error?.message ?? e.error))
      if (tileFailed) console.warn('[PlanMap] basemap tile failed to load:', e.error?.message ?? e.error)
      else console.error('[PlanMap] maplibre error:', e.error)
    })
    map.on('load', () => {
      recolorBasemap(map)
      addLandOutline(map).catch((e) => console.error('[PlanMap] outline:', e))
      map.addSource('sites', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'sites-fill', type: 'fill', source: 'sites', filter: ['==', '$type', 'Polygon'], paint: { 'fill-color': SITE, 'fill-opacity': 0.06 } })
      map.addLayer({ id: 'sites-line', type: 'line', source: 'sites', filter: ['==', '$type', 'Polygon'], paint: { 'line-color': SITE, 'line-opacity': 0.7, 'line-width': 1.5, 'line-dasharray': [3, 2] } })
      map.addLayer({ id: 'sites-point', type: 'circle', source: 'sites', filter: ['==', '$type', 'Point'], paint: { 'circle-radius': 5, 'circle-color': SITE, 'circle-opacity': 0.5 } })
      map.addSource('ranges', { type: 'geojson', data: EMPTY })
      const color: maplibregl.ExpressionSpecification = ['case', ['get', 'isolated'], RED, ['get', 'existing'], '#ffffff', TEAL]
      map.addLayer({ id: 'ranges-fill', type: 'fill', source: 'ranges', paint: { 'fill-color': color, 'fill-opacity': 0.1 } })
      map.addLayer({ id: 'ranges-line', type: 'line', source: 'ranges', paint: { 'line-color': color, 'line-opacity': 0.6, 'line-width': 1 } })
      // Dashed grey from an out-of-range device to its nearest device; drawn under the links.
      map.addSource('gaps', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'gaps-line',
        type: 'line',
        source: 'gaps',
        paint: { 'line-color': '#ffffff', 'line-opacity': 0.3, 'line-width': 1, 'line-dasharray': [3, 3] },
      })
      map.addSource('links', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'links-line',
        type: 'line',
        source: 'links',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': ['interpolate', ['linear'], ['get', 'strength'], 0, WEAK, 1, TEAL],
          'line-width': ['interpolate', ['linear'], ['get', 'strength'], 0, 1, 1, 3.5],
          'line-opacity': ['interpolate', ['linear'], ['get', 'strength'], 0, 0.45, 1, 0.9],
        },
      })
      setReady(true)
    })
    map.on('zoomend', () => setZoom(map.getZoom()))
    map.on('click', (e) => {
      if (cb.current.placing) cb.current.onAdd(e.lngLat.lng, e.lngLat.lat)
    })
    mapRef.current = map
    const markers = markersRef.current
    return () => {
      markers.forEach((m) => m.remove())
      markers.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (map) map.getCanvas().style.cursor = placing ? 'crosshair' : ''
  }, [placing])

  function drawDensity(dragging?: { id: string; lng: number; lat: number }) {
    const map = mapRef.current
    const ranges = map?.getSource('ranges') as maplibregl.GeoJSONSource | undefined
    const links = map?.getSource('links') as maplibregl.GeoJSONSource | undefined
    const gaps = map?.getSource('gaps') as maplibregl.GeoJSONSource | undefined
    if (!ranges || !links || !gaps) return
    const { deployments: deps, existing: ex, rangeMeters: r } = latest.current
    const data = r ? densityData(deps, ex, r, dragging) : { ranges: EMPTY, links: EMPTY, gaps: EMPTY }
    ranges.setData(data.ranges)
    links.setData(data.links)
    gaps.setData(data.gaps)
  }

  // Range circles and links.
  useEffect(() => {
    if (ready) drawDensity()
  }, [ready, deployments, existing, rangeMeters]) // eslint-disable-line react-hooks/exhaustive-deps

  // Existing sites, drawn under everything else.
  useEffect(() => {
    const src = ready ? (mapRef.current?.getSource('sites') as maplibregl.GeoJSONSource | undefined) : undefined
    src?.setData({
      type: 'FeatureCollection',
      features: sites.map((s) => ({ type: 'Feature', properties: { name: s.name }, geometry: s.geometry as GeoJSON.Geometry })),
    })
  }, [ready, sites])

  // Existing devices: fixed markers, rebuilt whenever the set changes. When there is no
  // plan yet, frame them so the user starts where their project is.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    existingMarkersRef.current.forEach((m) => m.remove())
    existingMarkersRef.current = existing.map((d) => {
      const el = document.createElement('div')
      el.appendChild(document.createElement('div'))
      styleExistingMarker(el, d.name)
      return new maplibregl.Marker({ element: el }).setLngLat([d.lng, d.lat]).addTo(map)
    })
    const siteCoords = sites.flatMap((s) =>
      s.geometry.type === 'Point'
        ? [s.geometry.coordinates as [number, number]]
        : s.geometry.type === 'Polygon'
          ? (s.geometry.coordinates as [number, number][][])[0] ?? []
          : [],
    )
    const coords = [...existing.map((d) => [d.lng, d.lat] as [number, number]), ...siteCoords]
    if (latest.current.deployments.length === 0 && coords.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      coords.forEach((c) => bounds.extend(c))
      map.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 0 })
    }
  }, [existing, sites])

  useEffect(() => {
    const map = mapRef.current
    const d = focus && deployments.find((x) => x.id === focus.id)
    if (map && d) map.flyTo({ center: [d.lng, d.lat], zoom: Math.max(map.getZoom(), 15) })
  }, [focus]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers to deployments: add new, move/restyle existing, drop removed.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const markers = markersRef.current
    const seen = new Set<string>()
    deployments.forEach((d, i) => {
      seen.add(d.id)
      let m = markers.get(d.id)
      if (!m) {
        const el = document.createElement('div')
        el.appendChild(document.createElement('div'))
        el.addEventListener('click', (ev) => {
          ev.stopPropagation()
          cb.current.onSelect(d.id)
        })
        m = new maplibregl.Marker({ element: el, draggable: true }).setLngLat([d.lng, d.lat]).addTo(map)
        const marker = m
        // While dragging, move this device's range and links with it so spacing is visible live.
        m.on('drag', () => {
          const p = marker.getLngLat()
          drawDensity({ id: d.id, lng: p.lng, lat: p.lat })
        })
        m.on('dragend', () => {
          const p = marker.getLngLat()
          cb.current.onMove(d.id, p.lng, p.lat)
        })
        markers.set(d.id, m)
      } else {
        const p = m.getLngLat()
        if (p.lng !== d.lng || p.lat !== d.lat) m.setLngLat([d.lng, d.lat])
      }
      styleMarker(m.getElement(), i, d.id === selectedId, !!rangeMeters && isolatedIds.has(d.id))
    })
    markers.forEach((m, id) => {
      if (!seen.has(id)) {
        m.remove()
        markers.delete(id)
      }
    })
  }, [deployments, selectedId, rangeMeters, isolatedIds])

  function zoomToDevices() {
    const map = mapRef.current
    if (!map || deployments.length === 0) return
    const bounds = new maplibregl.LngLatBounds()
    deployments.forEach((d) => bounds.extend([d.lng, d.lat]))
    map.fitBounds(bounds, { padding: 80, maxZoom: 16 })
  }

  const showZoomHint = !!rangeMeters && zoom < RANGE_VISIBLE_ZOOM

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      {rangeMeters && (
        <div className="absolute bottom-6 left-3 rounded-lg bg-ocean-dark/95 border border-white/15 px-3 py-2 text-xs text-gray-400 w-52">
          <div className="text-gray-300 mb-1.5">Device spacing</div>
          <div className="h-1.5 rounded-full" style={{ background: `linear-gradient(to right, ${WEAK}, ${TEAL})` }} />
          <div className="flex justify-between mt-1 tabular-nums">
            <span>{rangeMeters} m, weaker</span>
            <span>{DENSITY_BEST_M} m, best</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: RED }} />
            <span>No device in range</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-2.5 border-t border-dashed border-white/50" />
            <span>Distance to nearest device</span>
          </div>
          {existing.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rotate-45 border-2 border-white/75" />
              <span>Already deployed</span>
            </div>
          )}
        </div>
      )}
      {showZoomHint && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-ocean-dark/95 border border-white/15 pl-4 pr-1.5 py-1.5 text-sm text-gray-300 shadow-lg">
          <span>Zoom in to see the {rangeMeters} m range around each device</span>
          {deployments.length > 0 && (
            <button type="button" onClick={zoomToDevices} className="rounded-full bg-white text-ocean-dark px-3 py-1 text-xs font-medium hover:bg-brand-50">
              Zoom to devices
            </button>
          )}
        </div>
      )}
    </div>
  )
}
