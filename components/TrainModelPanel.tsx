'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  createTrainingRun,
  getLabelingReadiness,
  listSpecies,
  ApiError,
  type LabelingReadiness,
} from '@/lib/apiClient'
import { useTrainingRunPolling } from '@/lib/useTrainingRunPolling'
import { useSpeciesNames } from '@/lib/speciesNames'
import SpeciesMultiSelect, { type SpeciesSuggestion } from './SpeciesMultiSelect'
import TrainingRunStatusBadge from './TrainingRunStatusBadge'
import type { ProjectMapRegion } from './ProjectMap'

interface TrainModelPanelProps {
  projectId: string
  regions: ProjectMapRegion[]
  onClose: () => void
}

/**
 * Kicks off a training run (Manager/log/2026-09-20-regions-and-training-plan.md's build
 * order step 3). v1 scope cut: only creates a brand-new model — the API already supports
 * adding a version to an existing one (modelId), but a UI for that mode needs the
 * species/region pickers locked to that model's fixed scope, which isn't needed to prove
 * the pipeline end to end. Fast-follow, not blocking.
 */
export default function TrainModelPanel({ projectId, regions, onClose }: TrainModelPanelProps) {
  const { commonName, nzBirds } = useSpeciesNames()
  const [allSpecies, setAllSpecies] = useState<string[]>([])
  const [readiness, setReadiness] = useState<LabelingReadiness | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trainingRunId, setTrainingRunId] = useState<string | null>(null)

  const regionIds = useMemo(() => regions.map((r) => r.dbId).filter((id): id is string => !!id), [regions])
  const regionIdsKey = regionIds.join(',')

  // Defaults the name to the current map scope (e.g. "Canterbury", or "Otago, Southland"
  // for a multi-region selection) so the common case needs no typing — stops tracking
  // scope changes the moment the user edits the field themselves.
  const suggestedName = regions.length === 0 ? 'Whole Project' : regions.map((r) => r.name ?? 'Region').join(', ')
  useEffect(() => {
    if (!nameTouched) setName(suggestedName)
  }, [suggestedName, nameTouched])

  useEffect(() => {
    let cancelled = false
    listSpecies(projectId).then((s) => { if (!cancelled) setAllSpecies(s) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Re-checks readiness whenever the map scope changes, so "not enough data" reflects
  // the region(s) actually selected right now, not a project-wide snapshot from when the
  // panel opened.
  useEffect(() => {
    let cancelled = false
    getLabelingReadiness(projectId, { regionIds }).then((r) => { if (!cancelled) setReadiness(r) }).catch(() => {})
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, regionIdsKey])

  const { run, error: pollError } = useTrainingRunPolling(projectId, trainingRunId)

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const pendingRegions = regions.filter((r) => !r.dbId)

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await createTrainingRun(projectId, {
        name: name.trim(),
        speciesCodes: Array.from(selected),
        regionIds,
        hyperparameters: {},
      })
      setTrainingRunId(result.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start training run')
    } finally {
      setSubmitting(false)
    }
  }

  // Suggestions are species with at least one *confirmed-present* label in this scope —
  // NOT "any label at all," which would include every species Perch merely suggested and
  // got rejected on (auto-recorded as 'absent' per segment - one recording easily racks
  // up 50+ distinct species that way, nearly all noise, most not even in the NZ
  // whitelist). Sorted sufficient-first so the ones most likely to train something useful
  // lead; "no candidates yet" is normal early on - search or "select all" cover the rest.
  const readinessByCode = new Map((readiness?.species ?? []).map((s) => [s.speciesCode, s]))
  const suggestions: SpeciesSuggestion[] = (readiness?.species ?? [])
    .filter((s) => s.positiveCount > 0)
    .slice()
    .sort((a, b) => Number(b.sufficient) - Number(a.sufficient))
    .map((s) => ({ code: s.speciesCode, score: s.sufficient ? 1 : 0.5 }))

  // A selected species with no readiness row at all has zero labels in this scope —
  // just as insufficient as one that's merely below MIN_LABEL_COUNT positive examples.
  const insufficientSelected = Array.from(selected).filter((code) => !readinessByCode.get(code)?.sufficient)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className="relative bg-ocean-dark border border-white/10 rounded-lg w-full max-w-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl text-white">Train Model</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-sm">
            Close
          </button>
        </div>

        {run ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TrainingRunStatusBadge status={run.status} />
              <span className="text-sm text-gray-300">{name || 'Training run'}</span>
            </div>
            {pollError && <p className="text-red-400 text-xs">{pollError}</p>}
            {run.status === 'failed' && run.error && <p className="text-red-400 text-xs">{run.error}</p>}
            {run.status === 'complete' && (
              <Link
                href={`/projects/models?projectId=${encodeURIComponent(projectId)}`}
                className="inline-block bg-white text-ocean-dark px-4 py-2 rounded-full text-xs font-medium hover:bg-brand-50 transition-colors"
              >
                View models
              </Link>
            )}
            {(run.status === 'pending' || run.status === 'running') && (
              <p className="text-xs text-gray-500">
                Training runs in the background — you can close this and check back on the{' '}
                <Link href={`/projects/models?projectId=${encodeURIComponent(projectId)}`} className="text-brand-100 underline">
                  models page
                </Link>{' '}
                any time.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1.5">Model name</label>
              <input
                value={name}
                onChange={(e) => { setName(e.target.value); setNameTouched(true) }}
                placeholder="e.g. NZ-wide"
                className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs uppercase tracking-wider text-gray-500">Target species</label>
                <button
                  onClick={() => setSelected(new Set(nzBirds.map((b) => b.scientific)))}
                  disabled={nzBirds.length === 0}
                  className="text-xs text-brand-100 hover:text-white underline disabled:opacity-50 disabled:no-underline"
                >
                  Select all NZ birds ({nzBirds.length})
                </button>
              </div>
              <SpeciesMultiSelect
                suggestions={suggestions}
                allSpecies={allSpecies}
                selected={selected}
                onToggle={toggle}
              />
              {readiness && !readiness.hasAnyLabels && (
                <p className="text-xs text-amber-300 mt-2">
                  No labels yet in this scope — label some recordings first.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1.5">Scope</label>
              {regions.length === 0 ? (
                <p className="text-sm text-gray-400">Whole project (no regions selected on the map).</p>
              ) : (
                <ul className="space-y-1">
                  {regions.map((r) => (
                    <li key={r.id} className="text-sm text-gray-300 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ background: r.color }} />
                      {r.name ?? 'Region'}
                      {!r.dbId && <span className="text-xs text-gray-500">(still saving…)</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {selected.size > 0 && (
              insufficientSelected.length === 0 ? (
                <p className="text-xs text-emerald-300">
                  All {selected.size} selected species have enough labeled data in this scope.
                </p>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-amber-300">
                    {insufficientSelected.length} of {selected.size} selected species don&apos;t have enough
                    present labels yet (need {readiness?.minLabelCount ?? '—'}+). They&apos;ll still train, but
                    their results will be marked low-confidence.
                  </p>
                  {/* Capped + scrollable — "select all" can leave 100+ species here
                      (only Tui has positive labels in this scope, say), which would
                      otherwise push the submit button off-screen just like the pill
                      picker did before it got the same treatment. */}
                  <ul className="mt-2 space-y-0.5 max-h-40 overflow-y-auto pr-1 hide-scrollbar">
                    {insufficientSelected.map((code) => {
                      const r = readinessByCode.get(code)
                      return (
                        <li key={code} className="text-[11px] text-amber-200 flex items-center justify-between gap-2">
                          <span>{commonName(code)}</span>
                          <span className="font-mono text-amber-300/80 shrink-0">
                            {r?.positiveCount ?? 0} present
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            )}

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              onClick={submit}
              disabled={submitting || !name.trim() || selected.size === 0 || pendingRegions.length > 0}
              className="w-full bg-white text-ocean-dark px-4 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-50"
            >
              {submitting
                ? 'Starting…'
                : pendingRegions.length > 0
                  ? 'Still saving regions…'
                  : 'Start training'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
