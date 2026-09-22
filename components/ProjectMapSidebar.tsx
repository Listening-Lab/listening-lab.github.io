'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { listAssets, listDetections, listLabels, listModels, type Asset, type Detection, type Label, type Model } from '@/lib/apiClient'
import { ASSET_POLL_INTERVAL_MS, hasUnsettledAsset } from '@/lib/assetPolling'
import { useSpeciesNames } from '@/lib/speciesNames'
import type { ProjectMapRegion } from './ProjectMap'
import TrainModelPanel from './TrainModelPanel'

interface ProjectMapSidebarProps {
  projectId: string
  regions: ProjectMapRegion[]
  isDrawing: boolean
  onStartDrawing: () => void
  onCancelDrawing: () => void
  onRemoveRegion: (id: string) => void
  onClearRegions: () => void
  onRenameRegion: (id: string, name: string) => void
}

// Ray-casting point-in-polygon on exterior rings only (no hole support) — same simplified
// approach as the homepage map's own `pip()` helper (components/Map.tsx), operating on
// real lon/lat here instead of that map's local projected space. NZ regions (Southland,
// etc.) are often MultiPolygon (offshore islands) so this checks every ring, not just one.
function pointInPolygon(lon: number, lat: number, geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): boolean {
  const rings = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((poly) => poly[0])
  return rings.some((ring) => {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  })
}

const STATUS_COLORS: Record<string, string> = {
  complete: '#4ecdc4',
  processing: '#f0b429',
  failed: '#ef4444',
  pending: '#9ca3af',
}

// Local input state (rather than fully-controlled from props) so typing doesn't fight a
// parent re-render mid-keystroke; commits on blur/Enter rather than a separate Save
// button, since renaming a region is a single, low-stakes field (unlike the asset detail
// page's multi-field form, which batches edits behind an explicit Save).
function EditableRegionName({
  value,
  onCommit,
}: {
  value: string
  onCommit: (name: string) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => setDraft(value), [value])

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() && draft !== value) onCommit(draft.trim()) }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') { setDraft(value); e.currentTarget.blur() }
      }}
      className="bg-transparent text-sm text-white font-medium border-b border-transparent hover:border-white/20 focus:border-brand-500 focus:outline-none min-w-0 flex-1"
    />
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-white font-mono">{value}</span>
    </div>
  )
}

export default function ProjectMapSidebar({
  projectId,
  regions,
  isDrawing,
  onStartDrawing,
  onCancelDrawing,
  onRemoveRegion,
  onClearRegions,
  onRenameRegion,
}: ProjectMapSidebarProps) {
  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [detections, setDetections] = useState<Detection[] | null>(null)
  const [labels, setLabels] = useState<Label[] | null>(null)
  const [models, setModels] = useState<Model[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showTrainPanel, setShowTrainPanel] = useState(false)
  const { nzBirds } = useSpeciesNames()

  // Labels/models are fetched once - nothing external changes them while this panel sits
  // idle (labeling and training both happen on their own pages/panels and already update
  // their own state locally). Assets and detections are different: a file uploaded and
  // left processing needs this panel to notice on its own once it finishes, so those two
  // keep polling for as long as anything is still pending/processing.
  useEffect(() => {
    let cancelled = false
    listLabels(projectId, { limit: 5000 })
      .then((l) => { if (!cancelled) setLabels(l) })
      .catch(() => { /* label coverage stats are supplementary too */ })
    listModels(projectId)
      .then((m) => { if (!cancelled) setModels(m) })
      .catch(() => { /* models link is supplementary */ })
    return () => { cancelled = true }
  }, [projectId])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      let latestAssets: Asset[] | null = null
      try {
        latestAssets = await listAssets(projectId, { limit: 1000 })
        if (cancelled) return
        setAssets(latestAssets)
        setError(null)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load')
      }
      listDetections(projectId, { limit: 5000 })
        .then((d) => { if (!cancelled) setDetections(d) })
        .catch(() => { /* detections are supplementary here; assets stats still render */ })

      if (!cancelled) {
        // Keep retrying even after a failed fetch (a dropped request shouldn't
        // permanently freeze this panel's status, same reasoning as useJobPolling) -
        // once assets load successfully, only keep polling while something's unsettled.
        const keepPolling = latestAssets === null || hasUnsettledAsset(latestAssets)
        if (keepPolling) timer = setTimeout(poll, ASSET_POLL_INTERVAL_MS)
      }
    }

    poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [projectId])

  const loading = assets === null

  const statusCounts = (assets ?? []).reduce<Record<string, number>>((acc, a) => {
    const key = a.latestJobStatus ?? 'pending'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const speciesCount = detections ? new Set(detections.map((d) => d.speciesCode)).size : null

  const assetById = new Map((assets ?? []).map((a) => [a.id, a]))
  const nzBirdCodes = new Set(nzBirds.map((b) => b.scientific))
  // "Labeled" counts by distinct (asset, offset) segment, not by raw label row — a
  // single segment can produce many label rows at once (one per species Perch suggested
  // there, present or auto-rejected-absent), so counting rows overstates how much
  // labeling has actually happened. "Confirmed present" only counts species with at
  // least one *present* label - species that only ever picked up incidental 'absent'
  // rejections (Perch suggested them, nobody confirmed them) aren't "covered," they're
  // just noise from segments labeled for a different species entirely.
  const labeledSegmentCount = labels
    ? new Set(labels.map((l) => `${l.assetId}:${l.offsetSeconds}`)).size
    : null
  const confirmedSpeciesCount = labels
    ? new Set(
        labels.filter((l) => l.value === 'present' && nzBirdCodes.has(l.speciesCode)).map((l) => l.speciesCode)
      ).size
    : null

  const regionDbIds = new Set(regions.map((r) => r.dbId).filter((id): id is string => !!id))
  // A model with no regions at all was trained on the whole project, so it's always "in
  // scope" no matter what's currently selected on the map.
  const relevantModels = (models ?? []).filter(
    (m) => regions.length === 0 || m.regionIds.length === 0 || m.regionIds.some((id) => regionDbIds.has(id))
  )

  return (
    <div className="h-full overflow-y-auto bg-ocean-dark border-l border-white/10 px-6 py-8">
      <h2 className="font-serif text-2xl text-white mb-6">Overview</h2>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : (
        <div className="mb-8">
          <StatRow label="Recordings" value={assets.length} />
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="flex items-center justify-between py-1 pl-3">
              <span className="text-xs text-gray-500 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: STATUS_COLORS[status] ?? '#9ca3af' }} />
                {status}
              </span>
              <span className="text-xs text-gray-400 font-mono">{count}</span>
            </div>
          ))}
          <div className="h-px bg-white/10 my-3" />
          <StatRow label="Detections" value={detections ? detections.length : '—'} />
          <StatRow label="Species (raw, uncalibrated)" value={speciesCount ?? '—'} />
          <div className="h-px bg-white/10 my-3" />
          <StatRow label="Segments labeled" value={labeledSegmentCount ?? '—'} />
          <StatRow
            label="Species confirmed present"
            value={confirmedSpeciesCount !== null && nzBirds.length > 0 ? `${confirmedSpeciesCount}/${nzBirds.length}` : '—'}
          />
        </div>
      )}

      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs uppercase tracking-wider text-gray-500 font-medium">Training Regions</h3>
          {regions.length > 0 && (
            <button onClick={onClearRegions} className="text-xs text-gray-500 hover:text-white transition-colors">
              Clear all
            </button>
          )}
        </div>

        {isDrawing ? (
          <button
            onClick={onCancelDrawing}
            className="w-full bg-white/10 text-white border border-white/20 px-4 py-2.5 rounded-full text-sm font-medium hover:bg-white/20 transition-colors mb-4"
          >
            Cancel drawing
          </button>
        ) : (
          <button
            onClick={onStartDrawing}
            className="w-full bg-white text-ocean-dark px-4 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors mb-4"
          >
            + Draw region
          </button>
        )}

        {regions.length === 0 ? (
          <p className="text-sm text-gray-500">
            Draw a polygon, or click an NZ region on the map, to scope recordings and
            detections to it — useful for carving out training/eval subsets or comparing
            sites.
          </p>
        ) : (
          <ul className="space-y-3">
            {(() => {
              let drawnCount = 0
              return regions.map((region) => {
                if (region.kind === 'drawn') drawnCount += 1
                // A drawn region's real name (set on creation, or by the user via the
                // input below) always wins — the positional "Region N" is only ever a
                // fallback for the (should-be-rare) case no name exists yet.
                const label = region.name ?? (region.kind === 'nz-region' ? 'Region' : `Region ${drawnCount}`)
                const assetsInside = (assets ?? []).filter(
                  (a) => a.lat !== null && a.lon !== null && pointInPolygon(a.lon, a.lat, region.feature.geometry)
                )
                const detectionsInside = (detections ?? []).filter(
                  (d) => d.lat !== null && d.lon !== null && pointInPolygon(d.lon, d.lat, region.feature.geometry)
                )
                const labelsInside = (labels ?? []).filter((l) => {
                  const a = assetById.get(l.assetId)
                  return a?.lat != null && a?.lon != null && pointInPolygon(a.lon, a.lat, region.feature.geometry)
                })
                const segmentsLabeledInside = new Set(labelsInside.map((l) => `${l.assetId}:${l.offsetSeconds}`)).size
                const speciesConfirmedInside = new Set(
                  labelsInside.filter((l) => l.value === 'present' && nzBirdCodes.has(l.speciesCode)).map((l) => l.speciesCode)
                ).size
                return (
                  <li key={region.id} className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ background: region.color }} />
                        {region.kind === 'drawn' ? (
                          <EditableRegionName value={label} onCommit={(name) => onRenameRegion(region.id, name)} />
                        ) : (
                          <span className="text-sm text-white font-medium flex items-center gap-2">
                            {label}
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-normal">NZ region</span>
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => onRemoveRegion(region.id)}
                        className="text-gray-500 hover:text-red-400 transition-colors text-xs shrink-0"
                        aria-label={region.kind === 'nz-region' ? 'Deselect region' : 'Delete region'}
                      >
                        {region.kind === 'nz-region' ? 'Deselect' : 'Delete'}
                      </button>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400">
                      <span>{assetsInside.length} recording{assetsInside.length === 1 ? '' : 's'}</span>
                      <span>{detectionsInside.length} detection{detectionsInside.length === 1 ? '' : 's'}</span>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-400 mt-1">
                      <span>{segmentsLabeledInside} segment{segmentsLabeledInside === 1 ? '' : 's'} labeled</span>
                      {nzBirds.length > 0 && (
                        <span>{speciesConfirmedInside}/{nzBirds.length} species confirmed</span>
                      )}
                    </div>
                  </li>
                )
              })
            })()}
          </ul>
        )}

        <button
          onClick={() => setShowTrainPanel(true)}
          className="w-full mt-4 bg-brand-500 text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          Train Model
        </button>

        {models !== null && (
          <Link
            href={`/projects/models?projectId=${encodeURIComponent(projectId)}`}
            className="block text-center text-xs text-brand-100 hover:text-white underline mt-3"
          >
            {relevantModels.length === 0
              ? 'No models trained for this scope yet'
              : `${relevantModels.length} model${relevantModels.length === 1 ? '' : 's'} available for this scope`}
          </Link>
        )}
      </div>

      <p className="text-xs text-gray-600 mt-8">
        Detection scores are Perch&apos;s raw, uncalibrated output — species/detection counts
        here are a preview, not a validated confidence measure.
      </p>

      {showTrainPanel && (
        <TrainModelPanel projectId={projectId} regions={regions} onClose={() => setShowTrainPanel(false)} />
      )}
    </div>
  )
}
