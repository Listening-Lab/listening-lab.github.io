'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import EstimatePanel, { EstimateSummary } from '@/components/pricing/EstimatePanel'
import StaffPanel from '@/components/pricing/StaffPanel'
import PlanMap from '@/components/pricing/PlanMap'
import { DurationSlider, Field, LevelAndSpecies, NumberInput, inputCls } from '@/components/pricing/fields'
import { useStaffView } from '@/lib/useStaffView'
import { useAuth } from '@/lib/auth/AuthProvider'
import { listDevices, listProjects, listSites, type Project, type Site } from '@/lib/apiClient'
import {
  DEFAULT_INTERNAL,
  DEFAULT_RATES,
  DENSITY_RANGE_M,
  LEVELS,
  SCHEDULES,
  deploymentDays,
  deploymentHours,
  deviceLinks,
  estimate,
  internalEstimate,
  isolatedDevices,
  linkStrength,
  nearestNeighbour,
  num,
  monthsNeeded,
  peakConcurrentDevices,
  planStorageGbMonths,
  resolveDeployment,
  steadyStorageGbMonths,
  type InternalCosts,
  type MeasurementLevel,
  type PlannedDeployment,
  type PricingInput,
  type Rates,
} from '@/lib/pricing'

const TEAL = '#4ecdc4'
const PLAN_STORAGE_KEY = 'pricing-plan-v1'
const PLAN_START_KEY = 'pricing-plan-start'

const DAYS_PER_MONTH = 30.44

const EXAMPLES: { label: string; levels: MeasurementLevel[]; species: number; devices: number; hoursPerDay: number; months: number }[] = [
  { label: 'Small project', levels: ['occupancy'], species: 3, devices: 10, hoursPerDay: 3, months: 3 },
  { label: 'Multi-year project', levels: ['occupancy'], species: 25, devices: 40, hoursPerDay: 3, months: 36 },
]

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

/** Last day of a study of `months` calendar months starting on `iso`. */
function studyEndDate(iso: string, months: number) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + months)
  d.setUTCDate(d.getUTCDate() - 1)
  return isoDate(d)
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

function loadPlan(): PlannedDeployment[] {
  try {
    const raw = localStorage.getItem(PLAN_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PlannedDeployment[]) : []
  } catch {
    return []
  }
}

function scheduleLabel(h: number) {
  return SCHEDULES.find((s) => s.hoursPerDay === h)?.label ?? `${h} h/day`
}

// Far enough apart in time to overlap any plan: existing devices count as neighbours
// for the whole study, whatever their real deployment dates.
const ALWAYS_START = '1900-01-01'
const ALWAYS_END = '2999-12-31'

function setUrlParam(key: string, value: string | null) {
  const params = new URLSearchParams(window.location.search)
  if (value) params.set(key, value)
  else params.delete(key)
  const q = params.toString()
  window.history.replaceState(null, '', q ? `?${q}` : window.location.pathname)
}

function PricingContent() {
  const searchParams = useSearchParams()
  const staff = useStaffView()
  const { user } = useAuth()

  // An existing project to show alongside the plan, e.g. arriving from its map.
  const [projectId, setProjectId] = useState<string | null>(searchParams.get('projectId'))
  const [projects, setProjects] = useState<Project[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [existing, setExisting] = useState<PlannedDeployment[]>([])
  const [mode, setMode] = useState<'simple' | 'plan'>(searchParams.get('mode') === 'plan' ? 'plan' : 'simple')

  // ?levels=richness,occupancy preselects, e.g. when arriving from a /monitoring page.
  const [levels, setLevels] = useState<MeasurementLevel[]>(() => {
    const fromUrl = (searchParams.get('levels') ?? '').split(',').filter((l): l is MeasurementLevel =>
      LEVELS.some((x) => x.id === l),
    )
    return fromUrl.length ? fromUrl : ['occupancy']
  })
  const [species, setSpecies] = useState(3)
  const [devices, setDevices] = useState(10)
  const [hoursPerDay, setHoursPerDay] = useState(3)
  const [studyMonths, setStudyMonths] = useState(12)

  const [deployments, setDeployments] = useState<PlannedDeployment[]>([])
  const [studyStart, setStudyStart] = useState(() => isoDate(new Date()))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [focus, setFocus] = useState<{ id: string; at: number } | null>(null)

  const [rates, setRates] = useState<Rates>(DEFAULT_RATES)
  const [costs, setCosts] = useState<InternalCosts>(DEFAULT_INTERNAL)

  useEffect(() => {
    setDeployments(loadPlan())
    try {
      const saved = localStorage.getItem(PLAN_START_KEY)
      if (saved) setStudyStart(saved)
    } catch {
      // Storage blocked: start from today.
    }
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(deployments))
      localStorage.setItem(PLAN_START_KEY, studyStart)
    } catch {
      // Private window or blocked storage: the plan just won't survive a reload.
    }
  }, [deployments, studyStart])

  useEffect(() => {
    if (!user || mode !== 'plan') return
    listProjects().then(setProjects).catch(() => setProjects([]))
  }, [user, mode])

  useEffect(() => {
    if (!user || !projectId) {
      setSites([])
      setExisting([])
      return
    }
    let cancelled = false
    Promise.all([listSites(projectId), listDevices(projectId)])
      .then(([s, devices]) => {
        if (cancelled) return
        setSites(s)
        setExisting(
          devices
            .filter((d) => d.lat !== null && d.lon !== null)
            .map((d) => ({
              id: `existing:${d.id}`,
              name: d.name,
              lng: d.lon as number,
              lat: d.lat as number,
              start: ALWAYS_START,
              end: ALWAYS_END,
              hoursPerDay: 0,
              ownDates: true,
              existing: true,
            })),
        )
      })
      .catch((err) => console.error('[pricing] failed to load project:', err))
    return () => { cancelled = true }
  }, [user, projectId])

  function switchMode(next: 'simple' | 'plan') {
    setMode(next)
    setPlacing(false)
    const params = new URLSearchParams(window.location.search)
    if (next === 'plan') params.set('mode', 'plan')
    else params.delete('mode')
    const q = params.toString()
    window.history.replaceState(null, '', q ? `?${q}` : window.location.pathname)
    window.scrollTo(0, 0)
  }

  // Plan mode: devices without their own dates record for the whole study, so the study
  // duration drives their audio. Devices with their own dates set the shortest study allowed.
  const planMinMonths = monthsNeeded(deployments, studyStart)
  const planMonths = Math.max(studyMonths, planMinMonths)
  const studyEnd = studyEndDate(studyStart, planMonths)
  const resolved = deployments.map((d) => resolveDeployment(d, studyStart, studyEnd))

  // Density needs neighbouring devices; only positions and dates affect which are isolated.
  const rangeMeters = levels.includes('density') ? DENSITY_RANGE_M : null
  // Existing devices count as neighbours but never as isolated, and are never priced.
  const spacing = [...resolved, ...existing]
  const spacingKey = spacing.map((d) => `${d.id}:${d.lng}:${d.lat}:${d.start}:${d.end}`).join('|')
  const isolated = useMemo(
    () => new Set([...isolatedDevices(spacing)].filter((id) => !id.startsWith('existing:'))),
    [spacingKey], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const nearest = useMemo(() => nearestNeighbour(deviceLinks(spacing)), [spacingKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const isolatedCount = rangeMeters ? isolated.size : 0
  const simpleHours = devices * hoursPerDay * studyMonths * DAYS_PER_MONTH

  const input: PricingInput =
    mode === 'plan'
      ? {
          levels,
          species,
          devices: peakConcurrentDevices(resolved),
          audioHours: resolved.reduce((s, d) => s + deploymentHours(d), 0),
          storageGbMonths: planStorageGbMonths(resolved, studyEnd, rates),
          studyMonths: planMonths,
        }
      : {
          levels,
          species,
          devices,
          audioHours: simpleHours,
          storageGbMonths: steadyStorageGbMonths(simpleHours, studyMonths, rates),
          studyMonths,
        }

  const est = useMemo(() => estimate(input, rates), [JSON.stringify(input), rates]) // eslint-disable-line react-hooks/exhaustive-deps
  const internal = staff && levels.length > 0 ? internalEstimate(input, est, rates, costs) : null

  const staffPanel = internal && (
    <StaffPanel rates={rates} costs={costs} internal={internal} total={est.total} onRates={setRates} onCosts={setCosts} />
  )

  const levelFields = (
    <LevelAndSpecies levels={levels} species={species} onLevels={setLevels} onSpecies={setSpecies} />
  )

  // --- Plan mode ---

  function addDeployment(lng: number, lat: number) {
    const last = deployments[deployments.length - 1]
    const d: PlannedDeployment = {
      id: crypto.randomUUID(),
      name: `Device ${deployments.length + 1}`,
      lng,
      lat,
      start: studyStart,
      end: studyEnd,
      hoursPerDay: last?.hoursPerDay ?? 3,
    }
    setDeployments([...deployments, d])
    setSelectedId(d.id)
  }

  function updateDeployment(id: string, patch: Partial<PlannedDeployment>) {
    setDeployments((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)))
  }

  function removeDeployment(id: string) {
    setDeployments((ds) => ds.filter((x) => x.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function applyToAll(src: PlannedDeployment) {
    setDeployments((ds) =>
      ds.map((d) => ({ ...d, start: src.start, end: src.end, ownDates: src.ownDates, hoursPerDay: src.hoursPerDay })),
    )
  }

  if (mode === 'plan') {
    // Timeline runs from the earliest start to the latest end, study included.
    const t0 = Math.min(Date.parse(studyStart), ...resolved.map((d) => Date.parse(d.start)))
    const t1 = Math.max(Date.parse(studyEnd), ...resolved.map((d) => Date.parse(d.end))) + 86_400_000
    const span = t1 - t0 || 1
    const pct = (ms: number) => ((ms - t0) / span) * 100

    return (
      <div className="h-screen pt-16 flex flex-col bg-ocean-dark">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h1 className="font-serif text-2xl text-white">Plan a study</h1>
            <p className="text-sm text-gray-500">
              {placing ? 'Click the map to place a device. Press Done when finished.' : 'Set the study period, then place devices on the map.'}
            </p>
          </div>
          <button onClick={() => switchMode('simple')} className="text-sm text-gray-400 hover:text-white transition-colors">
            Simple estimate
          </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <div className="w-full md:w-3/5 lg:w-2/3 h-1/2 md:h-full relative">
            <PlanMap
              deployments={resolved}
              existing={existing}
              sites={sites}
              selectedId={selectedId}
              placing={placing}
              rangeMeters={rangeMeters}
              isolatedIds={isolated}
              focus={focus}
              onAdd={addDeployment}
              onMove={(id, lng, lat) => updateDeployment(id, { lng, lat })}
              onSelect={(id) => setSelectedId(id)}
            />
            <button
              onClick={() => setPlacing(!placing)}
              className={`absolute top-3 left-3 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                placing ? 'bg-white text-ocean-dark' : 'bg-ocean-dark/90 text-white border border-white/20 hover:bg-ocean-mid'
              }`}
            >
              {placing ? 'Done' : '+ Add devices'}
            </button>
          </div>

          <aside id="plan-panel" className="w-full md:w-2/5 lg:w-1/3 h-1/2 md:h-full overflow-y-auto border-l border-white/10">
            <div className="sticky top-0 z-10 bg-ocean-dark/95 backdrop-blur border-b border-white/10 px-6 py-3">
              <EstimateSummary
                input={input}
                est={est}
                onBreakdown={() => document.getElementById('plan-breakdown')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              />
            </div>
            <div className="px-6 py-5 space-y-7">
            {user && projects.length > 0 && (
              <Field label="Show an existing project" hint="Its sites and devices appear on the map for reference. They are not included in the price.">
                <select
                  className={inputCls}
                  value={projectId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || null
                    setProjectId(id)
                    setUrlParam('projectId', id)
                  }}
                >
                  <option value="">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
            )}
            {projectId && (existing.length > 0 || sites.length > 0) && (
              <p className="text-xs text-gray-500 -mt-4">
                Showing {existing.length} existing {existing.length === 1 ? 'device' : 'devices'} and {sites.length}{' '}
                {sites.length === 1 ? 'site' : 'sites'}.
              </p>
            )}

            {levelFields}

            <section className="space-y-3">
              <Field label="Study starts">
                <input type="date" className={inputCls} value={studyStart} onChange={(e) => e.target.value && setStudyStart(e.target.value)} />
              </Field>
              <DurationSlider months={planMonths} min={planMinMonths} onChange={setStudyMonths} />
              <p className="text-xs text-gray-500">
                Ends {formatDate(studyEnd)}.
                {planMinMonths > 1 && ` Devices with their own dates need at least ${planMinMonths} months.`}
              </p>
            </section>

            <section>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="text-sm text-gray-300">Devices</h2>
                <span className="text-xs text-gray-500">
                  {deployments.length} placed · up to {peakConcurrentDevices(resolved)} at once
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPlacing(!placing)}
                className={`w-full mb-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  placing ? 'bg-white text-ocean-dark' : 'border border-dashed border-white/20 text-gray-300 hover:border-white/40 hover:text-white'
                }`}
              >
                {placing ? 'Done placing' : '+ Add devices on the map'}
              </button>

              {isolatedCount > 0 && (
                <p className="text-xs text-red-300 border-l-2 border-red-400/60 pl-3 mb-2 leading-relaxed">
                  {isolatedCount === 1 ? '1 device has' : `${isolatedCount} devices have`} no other device within{' '}
                  {DENSITY_RANGE_M} m recording at the same time. Density needs each call heard by several devices.
                </p>
              )}

              {deployments.length === 0 ? (
                <p className="text-sm text-gray-500 px-1 py-2">
                  {placing ? 'Click anywhere on the map to place a device.' : 'No devices yet.'}
                </p>
              ) : (
                <ul className="space-y-1">
                  {resolved.map((d, i) => {
                    const left = pct(Date.parse(d.start))
                    const width = (deploymentDays(d) * 86_400_000 / span) * 100
                    const isSel = d.id === selectedId
                    const near = nearest.get(d.id)
                    return (
                      <li key={d.id} className={`group rounded-lg transition-colors ${isSel ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                        <div className="flex items-start">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedId(isSel ? null : d.id)
                            if (!isSel) setFocus({ id: d.id, at: Date.now() })
                          }}
                          className="flex-1 min-w-0 text-left pl-3 py-2"
                        >
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-200">
                              <span className={`tabular-nums mr-2 ${rangeMeters && isolated.has(d.id) ? 'text-red-400' : 'text-gray-500'}`}>{i + 1}</span>
                              {d.name}
                            </span>
                            <span className="text-xs text-gray-500 tabular-nums">
                              {d.ownDates ? `${deploymentDays(d)} d` : 'whole study'} · {num(deploymentHours(d))} h
                            </span>
                          </div>
                          {rangeMeters && (
                            <div className="text-xs mt-0.5 tabular-nums">
                              {near === undefined ? (
                                <span className="text-red-400">No device within {rangeMeters} m</span>
                              ) : (
                                <span style={{ color: `color-mix(in srgb, ${TEAL} ${Math.round(linkStrength(near) * 100)}%, #ffe66d)` }}>
                                  Nearest device {num(near)} m
                                </span>
                              )}
                            </div>
                          )}
                          <div className="relative h-1 mt-2 rounded bg-white/5">
                            <div
                              className="absolute h-1 bg-white/10"
                              style={{ left: `${pct(Date.parse(studyStart))}%`, width: `${pct(Date.parse(studyEnd) + 86_400_000) - pct(Date.parse(studyStart))}%` }}
                            />
                            <div className="absolute h-1 rounded" style={{ left: `${left}%`, width: `${width}%`, background: TEAL, opacity: d.ownDates ? 1 : 0.6 }} />
                          </div>
                        </button>
                        <button
                          type="button"
                          aria-label={`Remove ${d.name}`}
                          title="Remove"
                          onClick={() => removeDeployment(d.id)}
                          className="shrink-0 w-8 h-8 mt-1 mr-1 rounded-md text-gray-600 hover:text-red-300 hover:bg-white/5 opacity-60 group-hover:opacity-100 transition"
                        >
                          ×
                        </button>
                        </div>

                        {isSel && (
                          <div className="px-3 pt-2 pb-4 space-y-3 border-t border-white/10 mt-1">
                            <Field label="Name">
                              <input className={inputCls} value={d.name} onChange={(e) => updateDeployment(d.id, { name: e.target.value })} />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                              <Field label="Start">
                                <input type="date" className={inputCls} value={d.start} onChange={(e) => e.target.value && updateDeployment(d.id, { start: e.target.value, end: d.end, ownDates: true })} />
                              </Field>
                              <Field label="End">
                                <input type="date" className={inputCls} value={d.end} min={d.start} onChange={(e) => e.target.value && updateDeployment(d.id, { start: d.start, end: e.target.value, ownDates: true })} />
                              </Field>
                            </div>
                            <p className="text-xs text-gray-500">
                              {d.ownDates ? (
                                <>
                                  Own dates.{' '}
                                  <button type="button" className="underline hover:text-white" onClick={() => updateDeployment(d.id, { ownDates: false })}>
                                    Record for the whole study instead
                                  </button>
                                </>
                              ) : (
                                'Records for the whole study. Change a date to give it its own.'
                              )}
                            </p>
                            <Field label="Recording schedule">
                              <select className={inputCls} value={d.hoursPerDay} onChange={(e) => updateDeployment(d.id, { hoursPerDay: parseFloat(e.target.value) })}>
                                {SCHEDULES.map((s) => (
                                  <option key={s.hoursPerDay} value={s.hoursPerDay}>{s.label}</option>
                                ))}
                              </select>
                            </Field>
                            <div className="flex justify-between text-xs">
                              <button type="button" className="text-gray-400 hover:text-white" onClick={() => applyToAll(d)}>
                                Use these dates and schedule for all
                              </button>
                              <button type="button" className="text-red-400 hover:text-red-300" onClick={() => removeDeployment(d.id)}>
                                Remove
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <div id="plan-breakdown" className="scroll-mt-24">
              <EstimatePanel input={input} est={est} pinned />
            </div>
            {staffPanel}
            </div>
          </aside>
        </div>
      </div>
    )
  }

  // --- Simple mode ---

  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-5xl mx-auto px-6 pt-28 pb-24">
        <div className="flex items-start justify-between gap-6 mb-10">
          <div>
            <p className="text-xs tracking-widest uppercase mb-3 font-medium" style={{ color: TEAL }}>
              Pricing
            </p>
            <h1 className="font-serif text-4xl text-white mb-3">Estimate a monitoring project</h1>
            <p className="text-gray-400 max-w-xl leading-relaxed">
              Most of the cost is expert validation, which depends on what you want to measure and how
              many species and devices are involved. Processing and storage depend on how much audio
              you record.
            </p>
          </div>
          <button
            onClick={() => switchMode('plan')}
            className="shrink-0 text-sm text-white border border-white/25 hover:bg-white/10 rounded-full px-4 py-2 transition-colors"
          >
            Plan on a map →
          </button>
        </div>

        <div className="grid md:grid-cols-[1fr_380px] gap-10">
          <div className="space-y-6">
            <div className="flex gap-2 text-xs">
              <span className="text-gray-500 py-1">Examples:</span>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  type="button"
                  className="text-gray-400 hover:text-white border border-white/10 rounded-full px-3 py-1"
                  onClick={() => {
                    setLevels(ex.levels)
                    setSpecies(ex.species)
                    setDevices(ex.devices)
                    setHoursPerDay(ex.hoursPerDay)
                    setStudyMonths(ex.months)
                  }}
                >
                  {ex.label}
                </button>
              ))}
            </div>

            {levelFields}

            <Field label="Devices" hint="Recording at the same time, for the whole study.">
              <NumberInput value={devices} onChange={setDevices} min={1} max={500} />
            </Field>

            <Field label="Recording schedule">
              <select className={inputCls} value={hoursPerDay} onChange={(e) => setHoursPerDay(parseFloat(e.target.value))}>
                {SCHEDULES.map((s) => (
                  <option key={s.hoursPerDay} value={s.hoursPerDay}>{s.label}</option>
                ))}
                {!SCHEDULES.some((s) => s.hoursPerDay === hoursPerDay) && (
                  <option value={hoursPerDay}>{scheduleLabel(hoursPerDay)}</option>
                )}
              </select>
            </Field>

            <DurationSlider months={studyMonths} onChange={setStudyMonths} />
          </div>

          <div className="space-y-6 md:sticky md:top-24 self-start">
            <EstimatePanel input={input} est={est} />
            {staffPanel}
          </div>
        </div>

        <div className="mt-20 grid md:grid-cols-3 gap-8 text-sm text-gray-400 leading-relaxed border-t border-white/10 pt-10">
          <div>
            <h3 className="text-white mb-2">What the fee covers</h3>
            <p>
              Processing and storage are passed through at cost. The fee is for the work that turns
              audio into ecological insight: expert validation, calibration and statistical
              estimation for each species.
            </p>
          </div>
          <div>
            <h3 className="text-white mb-2">More from your data over time</h3>
            <p>
              Recordings are kept lossless. As models improve or your questions change, the same audio
              can be analysed again for new species or measures, without going back into the field.
            </p>
          </div>
          <div>
            <h3 className="text-white mb-2">What you get</h3>
            <p>
              Calibrated results with confidence intervals. Some designs can&apos;t give a clear
              answer; we check that before you start. <Link href="/monitoring" className="underline hover:text-white">More about how we work</Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PricingPage() {
  return (
    <Suspense>
      <PricingContent />
    </Suspense>
  )
}
