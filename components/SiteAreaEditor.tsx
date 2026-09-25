'use client'

import { useEffect, useRef, useState } from 'react'
// maplibre-gl v6 ships named exports only (no default export) — namespace-import it.
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'

// Same keyless CARTO basemap, NZ default view and ocean recolouring as components/ProjectMap.tsx,
// so drawing a site here looks like the project map.
const BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
const DEFAULT_CENTER: [number, number] = [172.5, -41.2]
const DEFAULT_ZOOM = 5
const TEAL = '#4ecdc4'
const OCEAN_DARK = '#0a1628'
const OCEAN_MID = '#0d2240'

// See ProjectMap.tsx: under Turbopack maplibre can't locate its own worker, so point it at the
// static copy kept in public/ by scripts/copy-maplibre-worker.mjs. Idempotent.
if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')
}

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

export interface AreaPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

function boundsOf(polygon: AreaPolygon): maplibregl.LngLatBounds {
  const b = new maplibregl.LngLatBounds()
  for (const [lon, lat] of polygon.coordinates[0]) b.extend([lon, lat])
  return b
}

/**
 * Draw a site's area on a map: click to add corners, double-click (or click the first corner) to
 * finish, drag corners afterwards to adjust. One polygon at a time - drawing again replaces it.
 * `otherAreas` are shown as faint outlines for context (other sites in the project).
 */
export default function SiteAreaEditor({
  value,
  onChange,
  otherAreas = [],
  deploymentPoints = [],
}: {
  value: AreaPolygon | null
  onChange: (polygon: AreaPolygon | null) => void
  otherAreas?: AreaPolygon[]
  /** Where existing deployments are, shown as dots so the area can be drawn around them. */
  deploymentPoints?: { lat: number; lon: number }[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const drawRef = useRef<TerraDraw | null>(null)
  const onChangeRef = useRef(onChange)
  const [drawing, setDrawing] = useState(false)
  const [hasShape, setHasShape] = useState(value !== null)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')

    map.on('load', () => {
      if (cancelled) return
      recolorBasemap(map)

      // Faint white coastline/boundaries (same NZ dataset as the project map) so land and sea are
      // distinguishable on the dark basemap.
      fetch('/nz-regions-detailed.json')
        .then((res) => res.json())
        .then((geojson) => {
          if (cancelled || map.getSource('nz-outline')) return
          const before = map.getLayer('td-polygon') ? 'td-polygon' : undefined
          map.addSource('nz-outline', { type: 'geojson', data: geojson })
          map.addLayer({ id: 'nz-outline-line', type: 'line', source: 'nz-outline', paint: { 'line-color': '#ffffff', 'line-opacity': 0.28, 'line-width': 1 } }, before)
        })
        .catch(() => {
          // A nice-to-have; the basemap still works without it.
        })

      if (otherAreas.length > 0) {
        map.addSource('other-sites', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: otherAreas.map((g) => ({ type: 'Feature', properties: {}, geometry: g })),
          },
        })
        map.addLayer({ id: 'other-sites-fill', type: 'fill', source: 'other-sites', paint: { 'fill-color': '#94a3b8', 'fill-opacity': 0.08 } })
        map.addLayer({ id: 'other-sites-line', type: 'line', source: 'other-sites', paint: { 'line-color': '#94a3b8', 'line-opacity': 0.5, 'line-width': 1.5, 'line-dasharray': [2, 2] } })
      }

      if (deploymentPoints.length > 0) {
        map.addSource('deployment-points', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: deploymentPoints.map((p) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [p.lon, p.lat] } })),
          },
        })
        map.addLayer({
          id: 'deployment-points-dot',
          type: 'circle',
          source: 'deployment-points',
          paint: { 'circle-radius': 5, 'circle-color': '#c3a6ff', 'circle-stroke-color': '#0a1628', 'circle-stroke-width': 1.5 },
        })
      }

      const draw = new TerraDraw({
        adapter: new TerraDrawMapLibreGLAdapter({ map }),
        modes: [
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } },
              },
            },
          }),
          new TerraDrawPolygonMode({
            styles: {
              fillColor: TEAL,
              fillOpacity: 0.18,
              outlineColor: TEAL,
              outlineOpacity: 0.8,
              outlineWidth: 2,
              closingPointColor: TEAL,
              closingPointOutlineColor: OCEAN_DARK,
            },
          }),
        ],
      })
      draw.start()
      drawRef.current = draw

      // terra-draw's 'finish' fires when a polygon is completed AND after every edit/drag of an
      // existing one - in all cases the current polygon is what should be reported.
      draw.on('finish', () => {
        const polygons = draw.getSnapshot().filter((f) => f.geometry.type === 'Polygon')
        if (polygons.length > 1) {
          // Drawing again replaces the previous area rather than adding a second.
          const keep = polygons[polygons.length - 1]
          draw.removeFeatures(polygons.filter((f) => f.id !== keep.id).map((f) => f.id as string))
        }
        const current = polygons[polygons.length - 1]
        draw.setMode('select')
        setDrawing(false)
        if (current) {
          setHasShape(true)
          onChangeRef.current(current.geometry as AreaPolygon)
        }
      })

      if (value) {
        draw.addFeatures([{ type: 'Feature', properties: { mode: 'polygon' }, geometry: value }])
        map.fitBounds(boundsOf(value), { padding: 60, duration: 0, maxZoom: 16 })
      } else if (otherAreas.length > 0) {
        const b = new maplibregl.LngLatBounds()
        for (const g of otherAreas) for (const [lon, lat] of g.coordinates[0]) b.extend([lon, lat])
        map.fitBounds(b, { padding: 60, duration: 0, maxZoom: 12 })
      }
      draw.setMode('select')
    })

    return () => {
      cancelled = true
      try {
        drawRef.current?.stop()
      } catch {
        // already torn down with the map
      }
      drawRef.current = null
      map.remove()
    }
    // The map is created once; `value` and `otherAreas` only seed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startDrawing() {
    const draw = drawRef.current
    if (!draw) return
    draw.clear()
    setHasShape(false)
    onChangeRef.current(null)
    draw.setMode('polygon')
    setDrawing(true)
  }

  function clearShape() {
    drawRef.current?.clear()
    drawRef.current?.setMode('select')
    setDrawing(false)
    setHasShape(false)
    onChangeRef.current(null)
  }

  return (
    <div>
      <div ref={containerRef} className="h-[55vh] min-h-[320px] w-full rounded-lg overflow-hidden border border-white/15" />
      <div className="flex items-center justify-between gap-3 mt-2">
        <p className="text-[11px] text-gray-500">
          {drawing
            ? 'Click to add corners, then double-click to finish.'
            : hasShape
              ? 'Drag a corner to adjust it, or redraw the area.'
              : 'Draw the area this site covers.'}
        </p>
        <div className="flex gap-3 shrink-0">
          <button type="button" onClick={startDrawing} className="text-xs font-medium text-brand-100 hover:text-white transition-colors">
            {hasShape ? 'Redraw' : 'Draw area'}
          </button>
          {hasShape && (
            <button type="button" onClick={clearShape} className="text-xs font-medium text-gray-400 hover:text-white transition-colors">
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
