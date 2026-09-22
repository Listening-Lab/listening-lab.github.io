'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import WindowAudioPlayer from '@/components/WindowAudioPlayer'
import Spectrogram from '@/components/Spectrogram'
import SpeciesMultiSelect, { type SpeciesSuggestion } from '@/components/SpeciesMultiSelect'
import { useSpeciesNames } from '@/lib/speciesNames'
import {
  listAssets,
  listDetections,
  listLabels,
  listSpecies,
  createLabel,
  getAssetDownloadUrl,
  getLabelingReadiness,
  nzModelVersion,
  type Asset,
  type Detection,
  type LabelingReadiness,
} from '@/lib/apiClient'

// "Full screen" per the request means as many columns as comfortably fit; on a wide
// enough monitor the grid below reaches 4 columns x 3 rows = 12. Batch composition is
// uniform random for now — active-learning-driven selection (embedding-space coreset
// diversification, per the training plan) is a deliberately later phase, not this one.
const BATCH_SIZE = 12

interface Segment {
  key: string
  assetId: string
  offsetSeconds: number
  windowSeconds: number
  suggestions: SpeciesSuggestion[]
}

function segmentKey(assetId: string, offsetSeconds: number) {
  return `${assetId}:${offsetSeconds}`
}

function shuffle<T>(items: T[]): T[] {
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Readiness gating Rule 2 (Manager/log/2026-09-20-regions-and-training-plan.md §2.4):
// segments that could produce a label for a still-under-threshold species are surfaced
// first (randomly ordered within that group), so labeling effort naturally closes the
// gap for whichever species need it rather than staying purely random. This is the
// lightweight "close the gap" nudge the plan calls for — full coreset-diversified active
// learning is a later, separate phase.
function prioritizeSegments(segments: Segment[], insufficientSpecies: Set<string>): Segment[] {
  if (insufficientSpecies.size === 0) return shuffle(segments)
  const gap: Segment[] = []
  const rest: Segment[] = []
  for (const s of segments) {
    ;(s.suggestions.some((sug) => insufficientSpecies.has(sug.code)) ? gap : rest).push(s)
  }
  return [...shuffle(gap), ...shuffle(rest)]
}

/** Groups Perch's per-window detections into one labeling candidate per (asset, offset). */
function buildSegmentPool(detections: Detection[], labeledKeys: Set<string>): Segment[] {
  const byKey = new Map<string, Detection[]>()
  for (const d of detections) {
    const key = segmentKey(d.assetId, d.offsetSeconds)
    if (labeledKeys.has(key)) continue
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(d)
  }
  return Array.from(byKey.entries()).map(([key, ds]) => ({
    key,
    assetId: ds[0].assetId,
    offsetSeconds: ds[0].offsetSeconds,
    windowSeconds: ds[0].windowSeconds,
    suggestions: ds
      .slice()
      .sort((a, b) => b.score - a.score)
      .map((d) => ({ code: d.speciesCode, score: d.score })),
  }))
}

function SegmentCard({
  projectId,
  segment,
  asset,
  fallbackAudioBuffer,
  downloadUrl,
  allSpecies,
  onSaved,
}: {
  projectId: string
  segment: Segment
  asset: Asset | undefined
  fallbackAudioBuffer: AudioBuffer | null
  downloadUrl: string | null
  allSpecies: string[]
  onSaved: (segment: Segment, presentSpecies: string[]) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(code: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const present = Array.from(selected)
      // Suggestions Perch offered but the user didn't select are an implicit rejection
      // — worth recording as 'absent' rather than silently dropped, since "Perch guessed
      // this and a human looked and said no" is exactly the ground truth training needs.
      const rejected = segment.suggestions.map((s) => s.code).filter((code) => !selected.has(code))
      await Promise.all([
        ...present.map((code) =>
          createLabel(projectId, {
            assetId: segment.assetId,
            offsetSeconds: segment.offsetSeconds,
            windowSeconds: segment.windowSeconds,
            speciesCode: code,
            value: 'present',
          })
        ),
        ...rejected.map((code) =>
          createLabel(projectId, {
            assetId: segment.assetId,
            offsetSeconds: segment.offsetSeconds,
            windowSeconds: segment.windowSeconds,
            speciesCode: code,
            value: 'absent',
          })
        ),
      ])
      onSaved(segment, present)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm text-white font-medium truncate">{asset?.filename ?? 'Recording'}</p>
        {asset?.folder && <p className="text-[11px] text-gray-500 truncate">{asset.folder}</p>}
      </div>

      <Spectrogram
        downloadUrl={downloadUrl}
        contentType={asset?.contentType}
        offsetSeconds={segment.offsetSeconds}
        windowSeconds={segment.windowSeconds}
        fallbackAudioBuffer={fallbackAudioBuffer}
      />

      <WindowAudioPlayer
        url={downloadUrl}
        contentType={asset?.contentType}
        offsetSeconds={segment.offsetSeconds}
        windowSeconds={segment.windowSeconds}
      />

      <SpeciesMultiSelect
        suggestions={segment.suggestions}
        allSpecies={allSpecies}
        selected={selected}
        onToggle={toggle}
      />

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <button
        onClick={save}
        disabled={saving}
        className="mt-auto bg-white text-ocean-dark px-4 py-2 rounded-full text-xs font-medium hover:bg-brand-50 transition-colors disabled:opacity-60"
      >
        {saving ? 'Saving…' : selected.size > 0 ? `Save (${selected.size} present)` : 'Save (none present)'}
      </button>
    </div>
  )
}

function LabelingContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const { commonName } = useSpeciesNames()

  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [detections, setDetections] = useState<Detection[] | null>(null)
  const [allSpecies, setAllSpecies] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pool, setPool] = useState<Segment[] | null>(null)
  const [batch, setBatch] = useState<Segment[]>([])
  const [sessionLabeled, setSessionLabeled] = useState(0)
  const [readiness, setReadiness] = useState<LabelingReadiness | null>(null)
  // Suggestion pool defaults to the NZ-restricted top-5 (worker.py's NZ-scoped preview
  // set) — most labeling here is on NZ field recordings, so this keeps candidates
  // relevant; toggling shows the full global top-5 pool instead.
  const [showAllSpecies, setShowAllSpecies] = useState(false)
  const [downloadUrls, setDownloadUrls] = useState<Record<string, string>>({})
  const [audioVersion, setAudioVersion] = useState(0) // bump to force a re-render once a buffer decodes

  const audioContextRef = useRef<AudioContext | null>(null)
  const audioBuffersRef = useRef<Record<string, AudioBuffer>>({})
  const decodingRef = useRef<Set<string>>(new Set())

  // useMemo must run unconditionally on every render (Rules of Hooks), and is read by the
  // decode-fallback effect below, so it's declared ahead of that rather than near the
  // early return further down.
  const assetById = useMemo(() => new Map((assets ?? []).map((a) => [a.id, a])), [assets])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    Promise.all([
      listAssets(projectId, { limit: 1000 }),
      listDetections(projectId, { limit: 2000, modelVersion: showAllSpecies ? undefined : nzModelVersion() }),
      listLabels(projectId, { limit: 5000 }),
      listSpecies(projectId).catch(() => []),
      getLabelingReadiness(projectId).catch(() => null),
    ])
      .then(([a, d, l, species, r]) => {
        if (cancelled) return
        const labeledKeys = new Set(l.map((lbl) => segmentKey(lbl.assetId, lbl.offsetSeconds)))
        const segments = buildSegmentPool(d, labeledKeys)
        const insufficientSpecies = new Set(
          (r?.species ?? []).filter((s) => !s.sufficient).map((s) => s.speciesCode)
        )
        setAssets(a)
        setDetections(d)
        setAllSpecies(species)
        setReadiness(r)
        setPool(segments)
        setBatch(prioritizeSegments(segments, insufficientSpecies).slice(0, BATCH_SIZE))
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load labeling data')
      })
    return () => { cancelled = true }
  }, [projectId, showAllSpecies])

  // Signed URLs and decoded buffers are cached per-asset — a batch commonly has several
  // segments from the same recording, and decoding is not free.
  useEffect(() => {
    if (!projectId) return
    const assetIds = new Set(batch.map((s) => s.assetId))
    for (const assetId of assetIds) {
      if (downloadUrls[assetId]) continue
      getAssetDownloadUrl(projectId, assetId)
        .then(({ downloadUrl }) => setDownloadUrls((prev) => ({ ...prev, [assetId]: downloadUrl })))
        .catch(() => { /* that asset's cards just show "no spectrogram" / disabled playback */ })
    }
  }, [projectId, batch, downloadUrls])

  // Full-file decode is now only a fallback for formats Spectrogram can't Range-slice
  // (e.g. mp3) — WAV assets get their spectrogram window straight from a couple of HTTP
  // Range requests (see lib/wavRangeFetch.ts) and never need the whole file fetched here.
  useEffect(() => {
    for (const assetId of Object.keys(downloadUrls)) {
      if (audioBuffersRef.current[assetId] || decodingRef.current.has(assetId)) continue
      const contentType = assetById.get(assetId)?.contentType
      if (contentType === 'audio/wav' || contentType === 'audio/x-wav') continue
      decodingRef.current.add(assetId)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
      }
      fetch(downloadUrls[assetId])
        .then((r) => r.arrayBuffer())
        .then((buf) => audioContextRef.current!.decodeAudioData(buf))
        .then((decoded) => {
          audioBuffersRef.current[assetId] = decoded
          setAudioVersion((v) => v + 1)
        })
        .catch(() => { /* Spectrogram/player degrade gracefully with no buffer */ })
        .finally(() => decodingRef.current.delete(assetId))
    }
  }, [downloadUrls, assetById])

  const handleSaved = useCallback((segment: Segment, _present: string[]) => {
    setSessionLabeled((n) => n + 1)
    setPool((prev) => (prev ? prev.filter((s) => s.key !== segment.key) : prev))
    const insufficientSpecies = new Set(
      (readiness?.species ?? []).filter((s) => !s.sufficient).map((s) => s.speciesCode)
    )
    setBatch((prev) => {
      const remaining = prev.filter((s) => s.key !== segment.key)
      const inBatch = new Set(remaining.map((s) => s.key))
      const candidates = (pool ?? []).filter((s) => s.key !== segment.key && !inBatch.has(s.key))
      const nextCandidate = prioritizeSegments(candidates, insufficientSpecies)[0]
      return nextCandidate ? [...remaining, nextCandidate] : remaining
    })
    // New labels just landed — refresh coverage so the gap-closing bias above and the
    // readiness badges below both reflect the latest counts, not the page-load snapshot.
    if (projectId) {
      getLabelingReadiness(projectId).then(setReadiness).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, readiness, projectId])

  if (!projectId) {
    return (
      <p className="text-red-500 text-sm">
        No project selected. Go back to <Link href="/projects" className="underline">your projects</Link> and choose one.
      </p>
    )
  }

  const loading = assets === null || detections === null || pool === null

  return (
    <div className="min-h-screen bg-ocean-dark px-6 py-24">
      <div className="max-w-7xl mx-auto">
        <p className="text-sm text-gray-500 mb-2">
          <Link href="/projects" className="hover:text-white transition-colors">← Your Projects</Link>
        </p>
        <div className="flex items-center justify-between gap-4 mb-2">
          <h1 className="font-serif text-4xl text-white">Label Recordings</h1>
          <div className="flex items-center gap-4 shrink-0">
            <button
              onClick={() => setShowAllSpecies((v) => !v)}
              className="text-xs text-gray-400 hover:text-white underline"
            >
              {showAllSpecies ? 'Show NZ species only' : 'Show all species'}
            </button>
            <span className="text-sm text-gray-400 font-mono">
              {sessionLabeled} labeled this session · {pool?.length ?? 0} left in pool
            </span>
          </div>
        </div>
        <p className="text-gray-400 mb-4 text-sm max-w-3xl">
          Select every species actually present in each segment — suggestions are Perch&apos;s
          own top guesses (highest score first, shown as a hint only, uncalibrated), search
          covers anything else. Segments Perch suggested but you don&apos;t select are recorded
          as confirmed absent. Segments most likely to help an under-labeled species are
          shown first; the rest is random for now.
        </p>

        {readiness && readiness.species.some((s) => !s.sufficient) && (
          <div className="mb-8 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-gray-500 uppercase tracking-wide">Needs more labels</span>
            {readiness.species
              .filter((s) => !s.sufficient)
              .map((s) => (
                <span
                  key={s.speciesCode}
                  title={`${s.positiveCount}/${readiness.minLabelCount} present · ${s.negativeCount}/${readiness.minLabelCount} absent`}
                  className="text-[11px] px-2 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20"
                >
                  {commonName(s.speciesCode)}
                </span>
              ))}
          </div>
        )}

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading candidates…</p>
        ) : batch.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-lg px-5 py-4 text-sm text-gray-300">
            No unlabeled candidates right now. Either nothing&apos;s been uploaded/processed
            yet, or everything Perch flagged has already been labeled — nice work.{' '}
            <Link href={`/projects/map?projectId=${encodeURIComponent(projectId)}&panel=upload`} className="text-brand-100 underline">
              Upload a recording
            </Link>{' '}
            to get more candidates.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {batch.map((segment) => (
              <SegmentCard
                key={segment.key}
                projectId={projectId}
                segment={segment}
                asset={assetById.get(segment.assetId)}
                fallbackAudioBuffer={audioBuffersRef.current[segment.assetId] ?? null}
                downloadUrl={downloadUrls[segment.assetId] ?? null}
                allSpecies={allSpecies}
                onSaved={handleSaved}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function LabelingPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <LabelingContent />
      </Suspense>
    </RequireAuth>
  )
}
