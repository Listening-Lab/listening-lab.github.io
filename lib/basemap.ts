import * as maplibregl from 'maplibre-gl'

// Keyless, free vector basemap (CARTO) — no API key/billing account needed.
export const BASEMAP_STYLE_URL = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

// Same NZ-centered default view used by the homepage's abstract map (components/Map.tsx),
// so the two maps "feel" like the same place even though this one is a real basemap.
export const DEFAULT_CENTER: [number, number] = [172.5, -41.2]
export const DEFAULT_ZOOM = 5

// Matches this app's Tailwind `ocean` tokens (tailwind.config.ts) — the basemap gets
// recolored to these after load so the map reads as part of the page, not a boxed widget
// sitting on top of it: ocean = page background exactly, land is the lighter tone that
// "stands out" from it.
export const OCEAN_DARK = '#0a1628'
export const OCEAN_MID = '#0d2240'

// Recolor the fetched basemap style so its ocean matches the page background exactly and
// land reads as a lighter, contrasting tone from the same app palette — the goal is for
// the map to feel like part of the page rather than a boxed widget sitting on it.
export function recolorBasemap(map: maplibregl.Map) {
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

// The faint white coastline ProjectMap draws under its regions: without it, land and sea on
// the recoloured dark basemap are nearly indistinguishable, which makes placing devices hard.
export async function addLandOutline(map: maplibregl.Map) {
  const res = await fetch('/nz-regions-detailed.json')
  if (!res.ok || map.getSource('nz-land')) return
  map.addSource('nz-land', { type: 'geojson', data: await res.json() })
  map.addLayer({
    id: 'nz-land-outline',
    type: 'line',
    source: 'nz-land',
    paint: { 'line-color': '#ffffff', 'line-opacity': 0.28, 'line-width': 1 },
  })
}
