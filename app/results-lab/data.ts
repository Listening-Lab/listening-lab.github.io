// THROWAWAY (results-lab): made-up raw data for three scenarios. Only raw material is
// simulated here (where recorders are, which weeks they recorded, on which weeks a species
// was detected, how validation went). Every result is computed from it in stats.ts.

export interface Site {
  id: string
  name: string
  polygon: [number, number][]
}

export interface Device {
  id: string
  name: string
  siteId: string
  lng: number
  lat: number
}

export interface Season {
  id: string
  label: string
  /** 'spring' | 'autumn': only like seasons are compared for trends. */
  kind: 'spring' | 'autumn'
  year: number
}

export interface SpeciesData {
  id: string
  name: string
  english: string
  /** weeks[deviceId][seasonId] = weeks with a detection; K comes from effort. */
  detections: Record<string, Record<string, number>>
  rawDetections: number
  validated: number
  validatedCorrect: number
}

export interface Scenario {
  id: 'empty' | 'early' | 'established'
  label: string
  sites: Site[]
  devices: Device[]
  seasons: Season[]
  /** effort[deviceId][seasonId] = weeks recorded (0 = no recordings that season). */
  effort: Record<string, Record<string, number>>
  hoursPerWeek: number
  species: SpeciesData[]
}

function rng(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CENTRE: [number, number] = [172.98, -43.79]

const SITE_DEFS = [
  { id: 'a', name: 'Upper gully', dx: -0.045, dy: 0.02 },
  { id: 'b', name: 'Ridge track', dx: 0.0, dy: 0.03 },
  { id: 'c', name: 'Stream flats', dx: 0.04, dy: 0.012 },
  { id: 'd', name: 'Regenerating block', dx: -0.02, dy: -0.022 },
  { id: 'e', name: 'Coastal scrub', dx: 0.035, dy: -0.03 },
]

function sitePolygon(dx: number, dy: number, r: () => number): [number, number][] {
  const [cx, cy] = [CENTRE[0] + dx, CENTRE[1] + dy]
  const pts: [number, number][] = []
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * 2 * Math.PI
    const rad = 0.011 + r() * 0.005
    pts.push([cx + Math.cos(a) * rad * 1.35, cy + Math.sin(a) * rad])
  }
  pts.push(pts[0])
  return pts
}

// Species with made-up "true" occupancy per season and weekly detection probability,
// used only to simulate detection histories.
const SPECIES_DEFS = [
  { id: 'tui', name: 'Tūī', english: 'Tui', psi: [0.8, 0.82, 0.8, 0.83, 0.81], p: 0.6, prec: 0.96 },
  { id: 'korimako', name: 'Korimako', english: 'Bellbird', psi: [0.62, 0.66, 0.72, 0.76, 0.84], p: 0.5, prec: 0.93 },
  { id: 'piwakawaka', name: 'Pīwakawaka', english: 'Fantail', psi: [0.6, 0.55, 0.62, 0.58, 0.6], p: 0.35, prec: 0.9 },
  { id: 'riroriro', name: 'Riroriro', english: 'Grey warbler', psi: [0.75, 0.7, 0.78, 0.72, 0.76], p: 0.45, prec: 0.88 },
  { id: 'kereru', name: 'Kererū', english: 'Wood pigeon', psi: [0.3, 0.32, 0.38, 0.42, 0.5], p: 0.22, prec: 0.8 },
  { id: 'ruru', name: 'Ruru', english: 'Morepork', psi: [0.35, 0.3, 0.33, 0.36, 0.34], p: 0.3, prec: 0.92 },
  { id: 'kaka', name: 'Kākā', english: 'Kākā', psi: [0.04, 0.05, 0.06, 0.05, 0.07], p: 0.15, prec: 0.6 },
]

const SEASONS: Season[] = [
  { id: 's1', label: 'Spring 2024', kind: 'spring', year: 2024 },
  { id: 's2', label: 'Autumn 2025', kind: 'autumn', year: 2025 },
  { id: 's3', label: 'Spring 2025', kind: 'spring', year: 2025 },
  { id: 's4', label: 'Autumn 2026', kind: 'autumn', year: 2026 },
  { id: 's5', label: 'Spring 2026', kind: 'spring', year: 2026 },
]

function build(id: Scenario['id'], label: string, seed: number): Scenario {
  const r = rng(seed)
  const sites = SITE_DEFS.map((s) => ({ id: s.id, name: s.name, polygon: sitePolygon(s.dx, s.dy, r) }))

  if (id === 'empty') {
    return { id, label, sites: sites.slice(0, 3), devices: [], seasons: [], effort: {}, hoursPerWeek: 21, species: [] }
  }

  const early = id === 'early'
  const usedSites = early ? sites.slice(0, 1) : sites
  const seasons = early ? [{ ...SEASONS[4] }] : SEASONS
  const perSite = early ? 4 : 6

  const devices: Device[] = []
  usedSites.forEach((s, si) => {
    const def = SITE_DEFS.find((d) => d.id === s.id)!
    for (let i = 0; i < perSite; i++) {
      devices.push({
        id: `${s.id}${i + 1}`,
        name: `${s.name} ${i + 1}`,
        siteId: s.id,
        lng: CENTRE[0] + def.dx + (r() - 0.5) * 0.022,
        lat: CENTRE[1] + def.dy + (r() - 0.5) * 0.014,
      })
    }
    void si
  })

  // Effort: weeks recorded per device per season, with realistic gaps: a site added late,
  // occasional flat batteries, one recorder lost.
  const effort: Scenario['effort'] = {}
  for (const d of devices) {
    effort[d.id] = {}
    seasons.forEach((s, si) => {
      let weeks = early ? 3 : 5 + Math.floor(r() * 4)
      if (!early && d.siteId === 'e' && si < 2) weeks = 0 // site added in the second year
      if (!early && r() < 0.08) weeks = 0 // flat battery or card failure
      if (!early && r() < 0.1) weeks = Math.min(weeks, 2) // partial season
      if (!early && d.id === 'c4' && si >= 3) weeks = 0 // recorder lost
      effort[d.id][s.id] = weeks
    })
  }

  const species: SpeciesData[] = SPECIES_DEFS.map((sp) => {
    const detections: SpeciesData['detections'] = {}
    let raw = 0
    for (const d of devices) {
      detections[d.id] = {}
      seasons.forEach((s) => {
        const si = SEASONS.findIndex((x) => x.id === s.id)
        const K = effort[d.id][s.id]
        const occupied = r() < sp.psi[si]
        let weeks = 0
        for (let k = 0; k < K; k++) if (occupied && r() < sp.p) weeks++
        detections[d.id][s.id] = weeks
        raw += weeks * (3 + Math.floor(r() * 25))
      })
    }
    // Validation effort: plenty for common species, little for rare ones and early on.
    const validated = early ? Math.min(raw, Math.floor(4 + r() * 12)) : Math.min(raw, Math.floor(sp.id === 'kaka' ? 9 : 40 + r() * 80))
    let correct = 0
    for (let i = 0; i < validated; i++) if (r() < sp.prec) correct++
    return { id: sp.id, name: sp.name, english: sp.english, detections, rawDetections: raw, validated, validatedCorrect: correct }
  })

  return {
    id,
    label,
    sites: early ? sites.slice(0, 3) : sites,
    devices,
    seasons,
    effort,
    hoursPerWeek: 21,
    species,
  }
}

export const SCENARIOS: Scenario[] = [
  build('empty', 'No data yet', 1),
  build('early', 'First uploads', 2),
  build('established', 'Two years', 3),
]
