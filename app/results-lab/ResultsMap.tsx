'use client'

// THROWAWAY (results-lab): map of sites and recorders, coloured by what the panel is showing.

import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { BASEMAP_STYLE_URL, DEFAULT_CENTER, DEFAULT_ZOOM, addLandOutline, recolorBasemap } from '@/lib/basemap'
import type { Device, Site } from './data'

if (typeof window !== 'undefined') maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')

export type DeviceStatus = 'detected' | 'not-detected' | 'not-surveyed' | 'recording' | 'partial' | 'no-data'

export const STATUS_STYLE: Record<DeviceStatus, { color: string; label: string; hollow?: boolean }> = {
  recording: { color: '#4ecdc4', label: 'Recorded this season' },
  partial: { color: '#ffe66d', label: 'Partly recorded' },
  'no-data': { color: '#ff6b6b', label: 'No recordings this season', hollow: true },
  detected: { color: '#4ecdc4', label: 'Detected' },
  'not-detected': { color: '#ffffff', label: 'Surveyed, not detected', hollow: true },
  'not-surveyed': { color: '#6b7280', label: 'Not surveyed', hollow: true },
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] }

export default function ResultsMap({
  sites,
  devices,
  status,
}: {
  sites: Site[]
  devices: Device[]
  status: Record<string, DeviceStatus>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [ready, setReady] = useState(false)

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
    map.on('error', (e) => console.warn('[ResultsMap]', e.error?.message ?? e.error))
    map.on('load', () => {
      recolorBasemap(map)
      addLandOutline(map).catch(() => {})
      map.addSource('sites', { type: 'geojson', data: EMPTY })
      map.addLayer({ id: 'sites-fill', type: 'fill', source: 'sites', paint: { 'fill-color': '#f4c95d', 'fill-opacity': 0.06 } })
      map.addLayer({ id: 'sites-line', type: 'line', source: 'sites', paint: { 'line-color': '#f4c95d', 'line-opacity': 0.7, 'line-width': 1.5, 'line-dasharray': [3, 2] } })
      map.addSource('devices', { type: 'geojson', data: EMPTY })
      map.addLayer({
        id: 'devices',
        type: 'circle',
        source: 'devices',
        paint: {
          'circle-radius': 6,
          'circle-color': ['case', ['get', 'hollow'], '#0a1628', ['get', 'color']],
          'circle-stroke-color': ['get', 'color'],
          'circle-stroke-width': 2,
        },
      })
      setReady(true)
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    ;(map.getSource('sites') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: sites.map((s) => ({ type: 'Feature', properties: { name: s.name }, geometry: { type: 'Polygon', coordinates: [s.polygon] } })),
    })
    ;(map.getSource('devices') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: devices.map((d) => {
        const st = STATUS_STYLE[status[d.id] ?? 'not-surveyed']
        return { type: 'Feature', properties: { color: st.color, hollow: !!st.hollow }, geometry: { type: 'Point', coordinates: [d.lng, d.lat] } }
      }),
    })
  }, [ready, sites, devices, status])

  // Frame the project whenever the scenario changes.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const bounds = new maplibregl.LngLatBounds()
    sites.forEach((s) => s.polygon.forEach((p) => bounds.extend(p)))
    devices.forEach((d) => bounds.extend([d.lng, d.lat]))
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 })
  }, [ready, sites, devices])

  return <div ref={containerRef} className="w-full h-full" />
}
