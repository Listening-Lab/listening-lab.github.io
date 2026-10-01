'use client'

// THROWAWAY: exploring how project results could be shown. Made-up data (data.ts), real
// statistics (stats.ts). Delete app/results-lab when done.

import { useMemo, useState } from 'react'
import ResultsMap, { STATUS_STYLE, type DeviceStatus } from './ResultsMap'
import { SCENARIOS, type Scenario, type SpeciesData } from './data'
import {
  MIN_DETECTED_UNITS,
  MIN_MEAN_OCCASIONS,
  MIN_UNITS,
  MIN_VALIDATED,
  occupancy,
  overlaps,
  wilson,
  type Interval,
  type OccupancyResult,
} from './stats'

const TEAL = '#4ecdc4'
const pct = (x: number) => `${Math.round(x * 100)}%`
const range = (i: Interval) => `${pct(i.est)} (${pct(i.lo)}–${pct(i.hi)})`

function histories(s: Scenario, sp: SpeciesData, seasonId: string) {
  return s.devices.map((d) => ({ K: s.effort[d.id]?.[seasonId] ?? 0, d: sp.detections[d.id]?.[seasonId] ?? 0 }))
}

/** A 0–100% track with the interval as a bar and the estimate as a dot. */
function IntervalBar({ i, muted }: { i: Interval; muted?: boolean }) {
  return (
    <div className="relative h-3 w-full">
      <div className="absolute top-1/2 inset-x-0 h-px bg-white/15" />
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full"
        style={{ left: pct(i.lo), width: pct(i.hi - i.lo), background: TEAL, opacity: muted ? 0.35 : 0.6 }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2"
        style={{ left: pct(i.est), borderColor: TEAL, background: muted ? '#0a1628' : TEAL }}
      />
    </div>
  )
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="py-5 border-b border-white/10">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-sm text-white font-medium">{title}</h2>
        {aside && <span className="text-xs text-gray-500">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

function TrendChart({ s, results }: { s: Scenario; results: OccupancyResult[] }) {
  const W = 300
  const H = 130
  const x = (i: number) => 24 + (i * (W - 36)) / Math.max(1, s.seasons.length - 1)
  const y = (v: number) => 10 + (1 - v) * (H - 34)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Occupancy by season with 95% intervals">
      {[0, 0.5, 1].map((v) => (
        <g key={v}>
          <line x1="20" x2={W - 6} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.08)" />
          <text x="16" y={y(v) + 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.4)">{pct(v)}</text>
        </g>
      ))}
      {s.seasons.map((season, i) => {
        const r = results[i]
        return (
          <g key={season.id}>
            {r.ok ? (
              <>
                <line x1={x(i)} x2={x(i)} y1={y(r.psi.lo)} y2={y(r.psi.hi)} stroke={TEAL} strokeWidth="2" strokeOpacity={r.wide ? 0.35 : 0.8} />
                <circle cx={x(i)} cy={y(r.psi.est)} r="3.5" fill={r.wide ? '#0a1628' : TEAL} stroke={TEAL} strokeWidth="1.5" />
              </>
            ) : (
              <text x={x(i)} y={y(0.5)} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.35)">not enough data</text>
            )}
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="8" fill="rgba(255,255,255,0.5)">
              {season.label.replace(' 20', " '")}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Compare the latest season with the same kind of season in the earliest year that has an estimate. */
function trendStatement(s: Scenario, results: OccupancyResult[]): string {
  if (s.seasons.length < 2) return 'Trends need the same season recorded in at least two years.'
  const last = s.seasons.length - 1
  const lastRes = results[last]
  const kind = s.seasons[last].kind
  const earlier = s.seasons.findIndex((x, i) => i < last && x.kind === kind && results[i].ok)
  if (!lastRes.ok || earlier < 0) {
    return `Trends compare the same season across years. There aren't yet two ${kind} seasons with enough data.`
  }
  const a = results[earlier] as Extract<OccupancyResult, { ok: true }>
  const b = lastRes
  const from = s.seasons[earlier].label
  const to = s.seasons[last].label
  if (overlaps(a.psi, b.psi)) {
    return `No clear change between ${from} and ${to}: the intervals overlap (${range(a.psi)} vs ${range(b.psi)}).`
  }
  const dir = b.psi.est > a.psi.est ? 'Higher' : 'Lower'
  return `${dir} in ${to} than ${from}: ${range(b.psi)} vs ${range(a.psi)}, and the intervals don't overlap. Two years is still a short record.`
}

export default function ResultsLab() {
  const [scenarioId, setScenarioId] = useState<Scenario['id']>('established')
  const s = SCENARIOS.find((x) => x.id === scenarioId)!
  const [seasonIdx, setSeasonIdx] = useState<number | null>(null)
  const [speciesId, setSpeciesId] = useState<string | null>(null)

  const si = seasonIdx ?? s.seasons.length - 1
  const season = s.seasons[si]

  // Occupancy for every species and season, computed once per scenario.
  const occ = useMemo(() => {
    const out: Record<string, OccupancyResult[]> = {}
    for (const sp of s.species) out[sp.id] = s.seasons.map((se) => occupancy(histories(s, sp, se.id)))
    return out
  }, [s])

  const selected = s.species.find((x) => x.id === speciesId) ?? null

  const status: Record<string, DeviceStatus> = {}
  for (const d of s.devices) {
    const K = season ? s.effort[d.id]?.[season.id] ?? 0 : 0
    if (selected && season) {
      const det = selected.detections[d.id]?.[season.id] ?? 0
      status[d.id] = K === 0 ? 'not-surveyed' : det > 0 ? 'detected' : 'not-detected'
    } else {
      status[d.id] = K === 0 ? 'no-data' : K < MIN_MEAN_OCCASIONS ? 'partial' : 'recording'
    }
  }
  const legend = (selected ? ['detected', 'not-detected', 'not-surveyed'] : ['recording', 'partial', 'no-data']) as DeviceStatus[]

  const totalWeeks = s.devices.reduce((sum, d) => sum + s.seasons.reduce((a, se) => a + (s.effort[d.id]?.[se.id] ?? 0), 0), 0)
  const audioHours = totalWeeks * s.hoursPerWeek

  // Gaps worth calling out, in plain language.
  const gaps: string[] = []
  if (season) {
    const silent = s.devices.filter((d) => (s.effort[d.id]?.[season.id] ?? 0) === 0)
    if (silent.length) gaps.push(`${silent.length} ${silent.length === 1 ? 'recorder has' : 'recorders have'} no recordings for ${season.label}: ${silent.map((d) => d.name).join(', ')}.`)
    const surveyed = s.devices.length - silent.length
    if (surveyed < MIN_UNITS) gaps.push(`Only ${surveyed} recorders surveyed in ${season.label}. Occupancy needs at least ${MIN_UNITS}.`)
    for (const site of s.sites) {
      const devs = s.devices.filter((d) => d.siteId === site.id)
      if (devs.length === 0) gaps.push(`${site.name} has no recorders.`)
      else if (s.seasons.some((se) => devs.every((d) => (s.effort[d.id]?.[se.id] ?? 0) === 0))) {
        const missed = s.seasons.filter((se) => devs.every((d) => (s.effort[d.id]?.[se.id] ?? 0) === 0)).map((se) => se.label)
        gaps.push(`${site.name} has no recordings for ${missed.join(', ')}, so it can't be compared across those seasons.`)
      }
    }
  }

  // Next steps, most useful first.
  const actions: string[] = []
  for (const sp of s.species) {
    if (sp.validated < MIN_VALIDATED) actions.push(`Check ${MIN_VALIDATED - sp.validated} more ${sp.name} detections to estimate how often the model is right.`)
  }
  if (season) {
    for (const sp of s.species) {
      const r = occ[sp.id][si]
      if (!r.ok && r.detectedUnits < MIN_DETECTED_UNITS && r.units >= MIN_UNITS) {
        actions.push(`${sp.name} was detected at only ${r.detectedUnits} recorders. More recorders in likely habitat, or longer deployments, would be needed to estimate occupancy.`)
      }
    }
  }

  const speciesRows = [...s.species].sort((a, b) => {
    const ra = occ[a.id][si]
    const rb = occ[b.id][si]
    return (rb?.ok ? rb.psi.est : -1) - (ra?.ok ? ra.psi.est : -1)
  })

  return (
    <div className="h-screen pt-16 flex flex-col bg-ocean-dark">
      <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-white/10 shrink-0">
        <div>
          <h1 className="font-serif text-2xl text-white">Example project</h1>
          <p className="text-xs text-amber-300/80">Made-up data for exploring layouts. Statistics are computed from it.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/15 p-1 text-xs">
          {SCENARIOS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => {
                setScenarioId(x.id)
                setSeasonIdx(null)
                setSpeciesId(null)
              }}
              className={`px-3 py-1.5 rounded-md ${x.id === s.id ? 'bg-white text-ocean-dark' : 'text-gray-300 hover:bg-white/10'}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div className="w-full md:w-2/3 h-1/2 md:h-full relative">
          <ResultsMap sites={s.sites} devices={s.devices} status={status} />
          {s.devices.length > 0 && (
            <div className="absolute bottom-6 left-3 rounded-lg bg-ocean-dark/95 border border-white/15 px-3 py-2 text-xs text-gray-300 space-y-1">
              <div className="text-gray-400 mb-1">{selected ? `${selected.name}, ${season?.label}` : `Recording, ${season?.label}`}</div>
              {legend.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full border-2"
                    style={{ borderColor: STATUS_STYLE[k].color, background: STATUS_STYLE[k].hollow ? 'transparent' : STATUS_STYLE[k].color }}
                  />
                  {STATUS_STYLE[k].label}
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="w-full md:w-1/3 h-1/2 md:h-full overflow-y-auto border-l border-white/10 px-6">
          {s.id === 'empty' ? (
            <>
              <Section title="No recordings yet">
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span style={{ color: TEAL }}>✓</span>
                    <span className="text-gray-300">{s.sites.length} sites drawn</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-gray-500">2</span>
                    <span className="text-gray-300">Place recorders. At least {MIN_UNITS} locations, recording for {MIN_MEAN_OCCASIONS}+ weeks, are needed for occupancy.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-gray-500">3</span>
                    <span className="text-gray-300">Upload recordings. Species detections appear once they are processed.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-gray-500">4</span>
                    <span className="text-gray-300">Check detections. {MIN_VALIDATED} checks per species are needed to measure accuracy.</span>
                  </li>
                </ol>
              </Section>
              <Section title="What you'll see, and when">
                <dl className="text-sm space-y-3">
                  {[
                    ['Species detected', 'after the first upload is processed'],
                    ['Detection accuracy', `after ${MIN_VALIDATED} checked detections per species`],
                    ['Occupancy with uncertainty', `with ${MIN_UNITS}+ recorders, ${MIN_MEAN_OCCASIONS}+ weeks each, and detections at ${MIN_DETECTED_UNITS}+ of them`],
                    ['Change over time', 'once the same season is recorded in two years'],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-gray-200">{k}</dt>
                      <dd className="text-gray-500">{v}</dd>
                    </div>
                  ))}
                </dl>
              </Section>
            </>
          ) : (
            <>
              <Section title="Coverage" aside={`${s.devices.length} recorders · ${s.sites.length} sites · ${audioHours.toLocaleString('en-NZ')} audio-hours`}>
                {s.seasons.length > 1 && (
                  <div className="flex gap-1 flex-wrap mb-3">
                    {s.seasons.map((se, i) => (
                      <button
                        key={se.id}
                        type="button"
                        onClick={() => setSeasonIdx(i)}
                        className={`text-xs px-2.5 py-1 rounded-full border ${i === si ? 'border-white/60 text-white' : 'border-white/10 text-gray-400 hover:text-white'}`}
                      >
                        {se.label}
                      </button>
                    ))}
                  </div>
                )}
                {/* Recorders × seasons: filled by weeks recorded, empty where there is nothing. */}
                <div className="space-y-2">
                  {s.sites.map((site) => {
                    const devs = s.devices.filter((d) => d.siteId === site.id)
                    return (
                      <div key={site.id} className="grid grid-cols-[7rem_1fr] gap-2 items-start">
                        <span className="text-xs text-gray-400 truncate pt-0.5">{site.name}</span>
                        {devs.length === 0 ? (
                          <span className="text-xs text-red-300/80">no recorders</span>
                        ) : (
                          <div className="space-y-0.5">
                            {devs.map((d) => (
                              <div key={d.id} className="flex gap-0.5">
                                {s.seasons.map((se, i) => {
                                  const w = s.effort[d.id]?.[se.id] ?? 0
                                  return (
                                    <span
                                      key={se.id}
                                      title={`${d.name}, ${se.label}: ${w} weeks`}
                                      className={`h-2 flex-1 rounded-[2px] ${i === si ? 'ring-1 ring-white/40' : ''}`}
                                      style={w === 0 ? { border: '1px dashed rgba(255,107,107,0.6)' } : { background: TEAL, opacity: 0.25 + (w / 8) * 0.75 }}
                                    />
                                  )
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
                <p className="text-[11px] text-gray-500 mt-2">Each bar is one recorder; darker means more weeks recorded, dashed means none.</p>
                {gaps.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-xs text-amber-200/90">
                    {gaps.map((g) => <li key={g} className="pl-3 border-l-2 border-amber-300/50">{g}</li>)}
                  </ul>
                )}
              </Section>

              <Section title="Species" aside={season ? `Occupancy, ${season.label} · 95% intervals` : undefined}>
                <ul className="space-y-1">
                  {speciesRows.map((sp) => {
                    const r = occ[sp.id][si]
                    const prec = sp.validated >= MIN_VALIDATED ? wilson(sp.validatedCorrect, sp.validated) : null
                    const open = sp.id === speciesId
                    return (
                      <li key={sp.id} className={`rounded-lg ${open ? 'bg-white/[0.06]' : ''}`}>
                        <button type="button" onClick={() => setSpeciesId(open ? null : sp.id)} className="w-full text-left px-3 py-2.5 hover:bg-white/[0.04] rounded-lg">
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-gray-100">
                              {sp.name} <span className="text-gray-500 text-xs">{sp.english}</span>
                            </span>
                            <span className="text-xs text-gray-400 tabular-nums">{r.ok ? range(r.psi) : ''}</span>
                          </div>
                          <div className="mt-1.5">
                            {r.ok ? (
                              <IntervalBar i={r.psi} muted={r.wide} />
                            ) : (
                              <p className="text-xs text-gray-500">Not enough data for occupancy</p>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1 tabular-nums">
                            {sp.rawDetections.toLocaleString('en-NZ')} detections ·{' '}
                            {prec ? `${pct(prec.est)} correct (${pct(prec.lo)}–${pct(prec.hi)}) of ${sp.validated} checked` : `${sp.validated} of ${MIN_VALIDATED} checks needed for accuracy`}
                          </p>
                        </button>

                        {open && (
                          <div className="px-3 pb-4 space-y-3 text-xs text-gray-300 leading-relaxed">
                            {s.seasons.length > 1 && <TrendChart s={s} results={occ[sp.id]} />}
                            <p className="text-gray-200">{trendStatement(s, occ[sp.id])}</p>
                            {r.ok ? (
                              <>
                                <p>
                                  Detected at {r.detectedUnits} of {r.units} recorders in {season?.label}. Allowing for weeks it
                                  was present but not picked up, it is estimated to use {range(r.psi)} of recorder locations.
                                </p>
                                <p>When present, the chance of detecting it in a given week is about {pct(r.p)}.</p>
                                {r.wide && <p className="text-amber-200/90">The interval is wide: treat this as a rough indication only.</p>}
                              </>
                            ) : (
                              <div>
                                <p>Occupancy isn&apos;t reported for {season?.label} because it needs:</p>
                                <ul className="list-disc pl-4 mt-1 text-gray-400">
                                  {r.missing.map((m) => <li key={m}>{m}</li>)}
                                </ul>
                                <p className="mt-1 text-gray-400">Detected at {r.detectedUnits} of {r.units} recorders so far.</p>
                              </div>
                            )}
                            <p className="text-gray-500">
                              Assumes detections above the threshold are correct
                              {prec ? `; ${pct(1 - prec.est)} of checked ones were not` : ''}. Occupancy here is the share of
                              recorder locations used by the species, not the number of birds.
                            </p>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </Section>

              {actions.length > 0 && (
                <Section title="What would help most">
                  <ul className="space-y-2 text-sm text-gray-300">
                    {actions.slice(0, 5).map((a) => <li key={a} className="pl-3 border-l-2 border-white/20">{a}</li>)}
                  </ul>
                </Section>
              )}
            </>
          )}
          <div className="h-6" />
        </aside>
      </div>
    </div>
  )
}
