// Pricing model for the Nature Commons analysis service and the Listening Lab platform.
//
// Two layers, charged separately (workspace log/2026-09-29-service-model-prototype.md):
//   - Analysis: the expert validation and calibration that turns detections into
//     ecological results. Driven by species and devices, not by hours of audio.
//   - Platform: processing (per audio-hour) and storage (per GB-month), metered at
//     published rates as in docs/adr/0007-rates-and-bulk-processing.md.
//
// Every number here is a placeholder for discussion, not a confirmed rate.

/** Shown next to headline figures. Swap for the client's local currency later. */
export const CURRENCY = 'NZD'

export type MeasurementLevel = 'richness' | 'occupancy' | 'density'

export const LEVELS: { id: MeasurementLevel; question: string; name: string; summary: string }[] = [
  {
    id: 'richness',
    question: 'Which species?',
    name: 'Species richness',
    summary: 'A validated checklist of every vocalising species detected.',
  },
  {
    id: 'occupancy',
    question: 'Where and when?',
    name: 'Site occupancy',
    summary: 'Calibrated presence and absence of target species across sites and seasons.',
  },
  {
    id: 'density',
    question: 'How many?',
    name: 'Density proxy',
    summary: 'Minimum distinct individuals and spatial density from synchronised arrays.',
  },
]

export const SCHEDULES: { hoursPerDay: number; label: string }[] = [
  { hoursPerDay: 3, label: 'Dawn and dusk chorus (about 3 h/day)' },
  { hoursPerDay: 10, label: 'Dusk to dawn, nocturnal (about 10 h/day)' },
  { hoursPerDay: 2, label: 'Sparse baseline, 5 min every hour (2 h/day)' },
  { hoursPerDay: 24, label: 'Continuous (24 h/day)' },
]

/** Rates the client sees. */
export interface Rates {
  onboarding: number
  perSpecies: number
  /** Richness replaces the per-species charge with one flat checklist charge. */
  checklist: number
  includedDevices: number
  perExtraDevice: number
  /** Density work costs more to validate; applied to every analysis line. */
  densityMultiplier: number
  processingBandHours: number
  processingBandRate: number
  processingBeyondRate: number
  storagePerGbMonth: number
  minimumAnalysisFee: number
  flacMbPerHour: number
}

/** What delivering the work costs us. Staff view only. */
export interface InternalCosts {
  processingPerHour: number
  storagePerGbMonth: number
  validatorRate: number
  validationHoursPerSpecies: number
  checklistValidationHours: number
  validationHoursPerDevice: number
  onboardingHours: number
}

export const DEFAULT_RATES: Rates = {
  onboarding: 200,
  perSpecies: 260,
  checklist: 600,
  includedDevices: 10,
  perExtraDevice: 30,
  densityMultiplier: 2.5,
  processingBandHours: 5000,
  processingBandRate: 0.07,
  processingBeyondRate: 0.02,
  storagePerGbMonth: 0.01,
  minimumAnalysisFee: 500,
  flacMbPerHour: 173,
}

export const DEFAULT_INTERNAL: InternalCosts = {
  processingPerHour: 0.01,
  storagePerGbMonth: 0.006,
  validatorRate: 45,
  validationHoursPerSpecies: 4,
  checklistValidationHours: 10,
  validationHoursPerDevice: 0.25,
  onboardingHours: 3,
}

export interface PricingInput {
  /** One or more; richness can be combined with occupancy or density. */
  levels: MeasurementLevel[]
  species: number
  /** Devices recording at the same time. Drives validation effort across locations. */
  devices: number
  audioHours: number
  /** Audio held × time held, over the whole study (see the storage helpers below). */
  storageGbMonths: number
  studyMonths: number
}

export interface Line {
  key: string
  label: string
  detail: string
  amount: number
}

export interface Estimate {
  analysisLines: Line[]
  analysisSubtotal: number
  /** Analysis fee after the minimum engagement is applied. */
  analysisFee: number
  minimumApplied: boolean
  processingFee: number
  /** Audio held by the end of the study. */
  storageGb: number
  storageTotal: number
  total: number
  perMonth: number
}

export interface InternalEstimate {
  validationHours: number
  validationCost: number
  processingCost: number
  storageCost: number
  total: number
  margin: number
  marginPct: number
}

export function processingCharge(hours: number, r: Rates): number {
  return (
    Math.min(hours, r.processingBandHours) * r.processingBandRate +
    Math.max(0, hours - r.processingBandHours) * r.processingBeyondRate
  )
}

export function needsSpecies(levels: MeasurementLevel[]): boolean {
  return levels.includes('occupancy') || levels.includes('density')
}

/**
 * Density validation costs more than occupancy. When both are chosen, species are
 * validated once, at the density rate, since density work covers occupancy.
 */
function levelMultiplier(levels: MeasurementLevel[], r: Rates): number {
  return levels.includes('density') ? r.densityMultiplier : 1
}

export function estimate(input: PricingInput, r: Rates): Estimate {
  const mult = levelMultiplier(input.levels, r)
  const multNote = mult !== 1 ? ` × ${mult} for density` : ''
  const extraDevices = Math.max(0, input.devices - r.includedDevices)

  const analysisLines: Line[] = [
    { key: 'onboarding', label: 'Project setup', detail: 'Ingestion, metadata and project setup', amount: r.onboarding },
  ]
  if (input.levels.includes('richness')) {
    analysisLines.push({ key: 'checklist', label: 'Species checklist', detail: 'Every vocalising species, one validation pass', amount: r.checklist })
  }
  if (needsSpecies(input.levels)) {
    analysisLines.push({
      key: 'species',
      label: input.levels.includes('density') ? 'Species validation, density' : 'Species validation, occupancy',
      detail: `${input.species} species × ${money(r.perSpecies)}${multNote}`,
      amount: input.species * r.perSpecies * mult,
    })
  }
  analysisLines.push({
    key: 'devices',
    label: 'Device coverage',
    detail:
      extraDevices > 0
        ? `${extraDevices} beyond the ${r.includedDevices} included × ${money(r.perExtraDevice)}${multNote}`
        : `Up to ${r.includedDevices} devices included`,
    amount: extraDevices * r.perExtraDevice * mult,
  })
  const analysisSubtotal = analysisLines.reduce((s, l) => s + l.amount, 0)
  const analysisFee = Math.max(analysisSubtotal, r.minimumAnalysisFee)

  const processingFee = processingCharge(input.audioHours, r)
  const storageGb = (input.audioHours * r.flacMbPerHour) / 1000
  const storageTotal = input.storageGbMonths * r.storagePerGbMonth
  const total = analysisFee + processingFee + storageTotal

  return {
    analysisLines,
    analysisSubtotal,
    analysisFee,
    minimumApplied: analysisSubtotal < r.minimumAnalysisFee,
    processingFee,
    storageGb,
    storageTotal,
    total,
    perMonth: input.studyMonths > 0 ? total / input.studyMonths : total,
  }
}

export function internalEstimate(input: PricingInput, est: Estimate, r: Rates, c: InternalCosts): InternalEstimate {
  const mult = levelMultiplier(input.levels, r)
  const checklistHours = input.levels.includes('richness') ? c.checklistValidationHours : 0
  const speciesHours = needsSpecies(input.levels) ? input.species * c.validationHoursPerSpecies * mult : 0
  const validationHours = c.onboardingHours + checklistHours + speciesHours + input.devices * c.validationHoursPerDevice * mult
  const validationCost = validationHours * c.validatorRate
  const processingCost = input.audioHours * c.processingPerHour
  const storageCost = input.storageGbMonths * c.storagePerGbMonth
  const total = validationCost + processingCost + storageCost
  const margin = est.total - total
  return {
    validationHours,
    validationCost,
    processingCost,
    storageCost,
    total,
    margin,
    marginPct: est.total > 0 ? margin / est.total : 0,
  }
}

// --- Storage over a study ---
// Audio arrives while devices record and stays until the study ends, so storage is
// charged on GB-months held, not on the final size for the whole study.

const DAYS_PER_MONTH = 30.44

/** Devices record for the whole study: audio grows steadily, so on average half is held. */
export function steadyStorageGbMonths(audioHours: number, studyMonths: number, r: Rates): number {
  return ((audioHours * r.flacMbPerHour) / 1000) * studyMonths / 2
}

// --- Plan mode: deployments placed on a map ---

export interface PlannedDeployment {
  id: string
  name: string
  lng: number
  lat: number
  /** ISO dates (YYYY-MM-DD), end inclusive. Ignored unless ownDates is set. */
  start: string
  end: string
  /** Unset: the device records for the whole study, and follows it as the study changes. */
  ownDates?: boolean
  /** Already deployed in the project: shown and counted as a neighbour, never priced or moved. */
  existing?: boolean
  hoursPerDay: number
}

export function deploymentDays(d: PlannedDeployment): number {
  const ms = Date.parse(d.end) - Date.parse(d.start)
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000) + 1) : 0
}

export function deploymentHours(d: PlannedDeployment): number {
  return deploymentDays(d) * d.hoursPerDay
}

/** Most devices recording on any one day, which is what the device charge counts. */
export function peakConcurrentDevices(deps: PlannedDeployment[]): number {
  const events: [number, number][] = []
  for (const d of deps) {
    if (deploymentDays(d) === 0) continue
    events.push([Date.parse(d.start), 1])
    events.push([Date.parse(d.end) + 86_400_000, -1])
  }
  // Ends sort before starts on the same day, so back-to-back deployments don't overlap.
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let current = 0
  let peak = 0
  for (const [, delta] of events) {
    current += delta
    peak = Math.max(peak, current)
  }
  return peak
}

/** A deployment's own dates if it has them, otherwise the study's. */
export function resolveDeployment(d: PlannedDeployment, studyStart: string, studyEnd: string): PlannedDeployment {
  return d.ownDates ? d : { ...d, start: studyStart, end: studyEnd }
}

/** Shortest study, in whole months from its start, that covers every device with its own dates. */
export function monthsNeeded(deps: PlannedDeployment[], studyStart: string): number {
  const t0 = Date.parse(studyStart)
  let months = 1
  for (const d of deps) {
    if (!d.ownDates) continue
    const days = (Date.parse(d.end) + 86_400_000 - t0) / 86_400_000
    months = Math.max(months, Math.ceil(days / DAYS_PER_MONTH - 1e-9))
  }
  return months
}

/** Each deployment's audio builds up while it records, then is held until the study ends. */
export function planStorageGbMonths(deps: PlannedDeployment[], studyEndIso: string, r: Rates): number {
  if (deps.length === 0) return 0
  const studyEnd = Date.parse(studyEndIso) + 86_400_000
  let gbDays = 0
  for (const d of deps) {
    const days = deploymentDays(d)
    const gb = (deploymentHours(d) * r.flacMbPerHour) / 1000
    const heldAfter = Math.max(0, (studyEnd - (Date.parse(d.end) + 86_400_000)) / 86_400_000)
    gbDays += gb * (days / 2 + heldAfter)
  }
  return gbDays / DAYS_PER_MONTH
}

// --- Formatting ---

export function money(n: number): string {
  const abs = Math.abs(n)
  const s = abs.toLocaleString('en-NZ', {
    minimumFractionDigits: abs > 0 && abs < 10 ? 2 : 0,
    maximumFractionDigits: abs < 10 ? 2 : 0,
  })
  return (n < 0 ? '-$' : '$') + s
}

export function num(n: number): string {
  return Math.round(n).toLocaleString('en-NZ')
}

// --- Density arrays ---
// Density locates calls by timing differences between devices, so each device needs at
// least one other device close enough to hear the same call, recording at the same time.

/** Beyond this, two devices are unlikely to hear the same call. */
export const DENSITY_RANGE_M = 200
/** Closer than this gives no further gain in locating calls. */
export const DENSITY_BEST_M = 20

export function distanceMeters(a: { lng: number; lat: number }, b: { lng: number; lat: number }): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

function overlaps(a: PlannedDeployment, b: PlannedDeployment): boolean {
  return Date.parse(a.start) <= Date.parse(b.end) && Date.parse(b.start) <= Date.parse(a.end)
}

/** Ids of devices with no other device in range during their deployment. */
export function isolatedDevices(deps: PlannedDeployment[], rangeM = DENSITY_RANGE_M): Set<string> {
  const isolated = new Set<string>()
  for (const a of deps) {
    const hasNeighbour = deps.some((b) => b.id !== a.id && overlaps(a, b) && distanceMeters(a, b) <= rangeM)
    if (!hasNeighbour) isolated.add(a.id)
  }
  return isolated
}

/** 0 at the edge of range, rising linearly to 1 at DENSITY_BEST_M or closer. */
export function linkStrength(meters: number, rangeM = DENSITY_RANGE_M, bestM = DENSITY_BEST_M): number {
  return Math.min(1, Math.max(0, (rangeM - meters) / (rangeM - bestM)))
}

export interface DeviceLink {
  a: string
  b: string
  meters: number
  strength: number
}

/** Every pair of devices in range of each other and recording at the same time. */
export function deviceLinks(deps: PlannedDeployment[], rangeM = DENSITY_RANGE_M): DeviceLink[] {
  const links: DeviceLink[] = []
  for (let i = 0; i < deps.length; i++) {
    for (let j = i + 1; j < deps.length; j++) {
      const a = deps[i]
      const b = deps[j]
      if (!overlaps(a, b)) continue
      const meters = distanceMeters(a, b)
      if (meters <= rangeM) links.push({ a: a.id, b: b.id, meters, strength: linkStrength(meters, rangeM) })
    }
  }
  return links
}

/** Distance to each device's nearest linked neighbour; absent means isolated. */
export function nearestNeighbour(links: DeviceLink[]): Map<string, number> {
  const nearest = new Map<string, number>()
  for (const l of links) {
    for (const id of [l.a, l.b]) nearest.set(id, Math.min(nearest.get(id) ?? Infinity, l.meters))
  }
  return nearest
}

/**
 * For each device with no neighbour in range, the pair joining it to its nearest device
 * recording at the same time, so the plan shows how far it has to move. Deduplicated.
 */
export function gapsToNearest(deps: PlannedDeployment[], rangeM = DENSITY_RANGE_M): DeviceLink[] {
  const isolated = isolatedDevices(deps, rangeM)
  const seen = new Set<string>()
  const gaps: DeviceLink[] = []
  for (const a of deps) {
    if (!isolated.has(a.id)) continue
    let best: PlannedDeployment | null = null
    let bestM = Infinity
    for (const b of deps) {
      if (b.id === a.id || !overlaps(a, b)) continue
      const m = distanceMeters(a, b)
      if (m < bestM) {
        best = b
        bestM = m
      }
    }
    if (!best) continue
    const key = [a.id, best.id].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    gaps.push({ a: a.id, b: best.id, meters: bestM, strength: 0 })
  }
  return gaps
}
