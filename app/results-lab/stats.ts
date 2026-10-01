// THROWAWAY (results-lab): the statistics behind the results panel. Everything shown is
// computed here from raw counts; nothing is typed in as a result.

export interface Interval {
  est: number
  lo: number
  hi: number
}

/** Wilson score interval for k successes out of n (95%). */
export function wilson(k: number, n: number): Interval | null {
  if (n === 0) return null
  const z = 1.96
  const p = k / n
  const denom = 1 + (z * z) / n
  const centre = (p + (z * z) / (2 * n)) / denom
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom
  return { est: p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) }
}

/** One recorder's survey in one season: K occasions, detected on d of them. */
export interface History {
  K: number
  d: number
}

// Minimums before an occupancy estimate is reported at all. Below these the model is
// either not identifiable or its interval is so wide it says nothing.
export const MIN_UNITS = 10
export const MIN_DETECTED_UNITS = 3
export const MIN_MEAN_OCCASIONS = 3
/** An interval wider than this is reported, but flagged as too uncertain to act on. */
export const WIDE_CI = 0.5

export type OccupancyResult =
  | { ok: true; psi: Interval; p: number; units: number; detectedUnits: number; wide: boolean }
  | { ok: false; units: number; detectedUnits: number; missing: string[] }

/**
 * Single-season occupancy model (MacKenzie et al. 2002), constant psi and p, fitted by
 * grid-search maximum likelihood, with a 95% profile-likelihood interval for psi.
 * Assumes no false positives at the detection threshold used.
 */
export function occupancy(histories: History[]): OccupancyResult {
  const units = histories.filter((h) => h.K > 0)
  const detectedUnits = units.filter((h) => h.d > 0).length
  const meanK = units.length ? units.reduce((s, h) => s + h.K, 0) / units.length : 0

  const missing: string[] = []
  if (units.length < MIN_UNITS) missing.push(`${MIN_UNITS} recorders surveyed (have ${units.length})`)
  if (detectedUnits < MIN_DETECTED_UNITS) missing.push(`detections at ${MIN_DETECTED_UNITS} or more recorders (have ${detectedUnits})`)
  if (units.length && meanK < MIN_MEAN_OCCASIONS) missing.push(`${MIN_MEAN_OCCASIONS} or more repeat weeks per recorder (have ${meanK.toFixed(1)})`)
  if (missing.length) return { ok: false, units: units.length, detectedUnits, missing }

  const STEPS = 99
  const grid = Array.from({ length: STEPS }, (_, i) => (i + 1) / (STEPS + 1))
  const profile: number[] = [] // max over p of logL, for each psi
  let best = -Infinity
  let bestPsi = 0
  let bestP = 0
  for (const psi of grid) {
    let rowBest = -Infinity
    let rowP = 0
    for (const p of grid) {
      let ll = 0
      for (const h of units) {
        const seen = Math.pow(p, h.d) * Math.pow(1 - p, h.K - h.d)
        ll += Math.log(h.d > 0 ? psi * seen : psi * Math.pow(1 - p, h.K) + (1 - psi))
      }
      if (ll > rowBest) {
        rowBest = ll
        rowP = p
      }
    }
    profile.push(rowBest)
    if (rowBest > best) {
      best = rowBest
      bestPsi = psi
      bestP = rowP
    }
  }
  const inside = grid.filter((_, i) => profile[i] >= best - 1.92)
  const psi = { est: bestPsi, lo: Math.min(...inside), hi: Math.max(...inside) }
  return { ok: true, psi, p: bestP, units: units.length, detectedUnits, wide: psi.hi - psi.lo > WIDE_CI }
}

export const MIN_VALIDATED = 20

export function overlaps(a: Interval, b: Interval): boolean {
  return a.lo <= b.hi && b.lo <= a.hi
}
