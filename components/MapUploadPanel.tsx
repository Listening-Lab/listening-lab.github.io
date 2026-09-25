'use client'

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import DeviceManager from '@/components/DeviceManager'
import FileDropZone from '@/components/FileDropZone'
import { parseFilename } from '@/lib/filenameParsing'
import { useJobPolling } from '@/lib/useJobPolling'
import { useSpeciesNames } from '@/lib/speciesNames'
import {
  uploadRecording,
  listModels,
  listDetections,
  nzModelVersion,
  type Device,
  type Model,
  type Detection,
} from '@/lib/apiClient'
import type { ProjectMapHandle } from '@/components/ProjectMap'

// 'submitted' covers the entire pending/processing/complete/failed job lifecycle once a
// jobId exists - useJobPolling (inside StatusCell) is the sole source of truth for job
// progress from that point on, not this field. 'failed' here means the initial upload
// request itself failed, before any job existed to poll.
type RowStatus = 'idle' | 'uploading' | 'submitted' | 'failed'

interface StagingRow {
  key: string
  file: File
  recordedAt: string // datetime-local value
  recordedAtAuto: boolean
  lat: string
  lon: string
  latLonAuto: boolean
  folder: string
  status: RowStatus
  jobId: string | null
  error: string | null
}

function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function webkitRelativePath(file: File): string {
  return (file as unknown as { webkitRelativePath?: string }).webkitRelativePath ?? ''
}

function buildRow(file: File, preferredFilenameFormat?: string | null): StagingRow {
  const relPath = webkitRelativePath(file)
  const folder = relPath ? relPath.split('/').slice(0, -1).join('/') : ''
  // A handful of conventions (Frontier Labs, ISO-6709-style names) carry GPS coordinates
  // right in the filename - per-file, so more precise than a device's one fixed location
  // when both are available. Device-location fill only ever touches rows still empty
  // after this (see applyDeviceFillToRows), so a filename hit always wins.
  const match = parseFilename(file.name, preferredFilenameFormat)
  return {
    key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    recordedAt: match.recordedAt ? toDatetimeLocal(match.recordedAt) : '',
    recordedAtAuto: match.recordedAt !== null,
    lat: match.lat !== null ? String(match.lat) : '',
    lon: match.lon !== null ? String(match.lon) : '',
    latLonAuto: match.lat !== null,
    folder,
    status: 'idle',
    jobId: null,
    error: null,
  }
}

function isRowReady(row: StagingRow): boolean {
  return (
    row.recordedAt !== '' &&
    row.lat !== '' &&
    row.lon !== '' &&
    !Number.isNaN(parseFloat(row.lat)) &&
    !Number.isNaN(parseFloat(row.lon))
  )
}

const AUDIO_FILENAME_RE = /\.(wav|mp3|flac|ogg|m4a|aac)$/i

function isAudioFile(file: File): boolean {
  return file.type.startsWith('audio/') || AUDIO_FILENAME_RE.test(file.name)
}

/** Small fixed-size worker pool — uploads run a few at a time rather than all at once
 *  (avoids hammering the API/storage with dozens of simultaneous signed-URL requests for
 *  a big folder) or strictly one at a time (which would make a large batch feel stalled). */
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0
  async function next(): Promise<void> {
    const i = index++
    if (i >= items.length) return
    await worker(items[i])
    return next()
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()))
}

function topSpecies(detections: Detection[], n: number): Detection[] {
  const bestBySpecies = new Map<string, Detection>()
  for (const d of detections) {
    const existing = bestBySpecies.get(d.speciesCode)
    if (!existing || d.score > existing.score) bestBySpecies.set(d.speciesCode, d)
  }
  return Array.from(bestBySpecies.values()).sort((a, b) => b.score - a.score).slice(0, n)
}

function RowPredictions({ projectId, assetId }: { projectId: string; assetId: string }) {
  const [detections, setDetections] = useState<Detection[] | null>(null)
  const { commonName } = useSpeciesNames()

  useEffect(() => {
    let cancelled = false
    listDetections(projectId, { assetId, modelVersion: nzModelVersion(), limit: 200 })
      .then((data) => { if (!cancelled) setDetections(data) })
      .catch(() => { if (!cancelled) setDetections([]) })
    return () => { cancelled = true }
  }, [projectId, assetId])

  if (detections === null) return <span className="text-gray-500 text-xs">Loading predictions…</span>

  const top = topSpecies(detections, 5)
  if (top.length === 0) return <span className="text-gray-500 text-xs">No NZ species detected</span>

  return (
    <div className="flex flex-wrap gap-1.5">
      {top.map((d) => (
        <span
          key={d.speciesCode}
          title={`${d.speciesCode} · score ${d.score.toFixed(2)}`}
          className="px-2 py-0.5 rounded-full text-[11px] bg-white/10 text-gray-200 border border-white/15"
        >
          {commonName(d.speciesCode)}
        </span>
      ))}
    </div>
  )
}

function StatusLine({ row, projectId }: { row: StagingRow; projectId: string }) {
  const { job, error: pollError } = useJobPolling(row.status === 'submitted' ? row.jobId : null)

  if (row.status === 'idle') {
    return isRowReady(row)
      ? <span className="text-gray-500 text-xs">Ready</span>
      : <span className="text-amber-400 text-xs">Needs recording time and/or location</span>
  }
  if (row.status === 'uploading') {
    return <span className="text-gray-300 text-xs">Uploading…</span>
  }
  if (row.status === 'failed') {
    return <span className="text-red-400 text-xs">{row.error ?? 'Failed'}</span>
  }
  // 'submitted' - a job exists, useJobPolling tracks it from here.
  if (pollError) return <span className="text-red-400 text-xs">{pollError}</span>
  if (job?.status === 'complete' && job.mediaId) {
    return <RowPredictions projectId={projectId} assetId={job.mediaId} />
  }
  if (job?.status === 'failed') {
    return <span className="text-red-400 text-xs">{job.error ?? 'Processing failed'}</span>
  }
  return <span className="text-gray-400 text-xs">{job?.status ?? 'pending'}…</span>
}

function StagingCard({
  row,
  projectId,
  onChange,
  onRemove,
}: {
  row: StagingRow
  projectId: string
  onChange: (patch: Partial<StagingRow>) => void
  onRemove: () => void
}) {
  const editable = row.status === 'idle'
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-white font-medium truncate" title={row.file.name}>{row.file.name}</span>
        {row.status === 'idle' && (
          <button onClick={onRemove} className="text-gray-500 hover:text-red-400 text-xs shrink-0">✕</button>
        )}
        {row.status === 'failed' && (
          <button
            onClick={() => onChange({ status: 'idle', error: null, jobId: null })}
            className="text-gray-500 hover:text-white text-xs shrink-0"
          >
            Retry
          </button>
        )}
      </div>

      <div>
        <input
          type="datetime-local"
          value={row.recordedAt}
          disabled={!editable}
          onChange={(e) => onChange({ recordedAt: e.target.value, recordedAtAuto: false })}
          className={`w-full bg-white/5 border rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 ${
            row.recordedAt === '' ? 'border-amber-500/50' : 'border-white/15'
          }`}
        />
        {row.recordedAtAuto && row.recordedAt !== '' && (
          <p className="text-[10px] text-emerald-400 mt-0.5">from filename</p>
        )}
      </div>

      <div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number" step="any" value={row.lat} disabled={!editable}
            placeholder="Latitude"
            onChange={(e) => onChange({ lat: e.target.value, latLonAuto: false })}
            className={`w-full bg-white/5 border rounded-lg px-2 py-1.5 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 ${
              row.lat === '' ? 'border-amber-500/50' : 'border-white/15'
            }`}
          />
          <input
            type="number" step="any" value={row.lon} disabled={!editable}
            placeholder="Longitude"
            onChange={(e) => onChange({ lon: e.target.value, latLonAuto: false })}
            className={`w-full bg-white/5 border rounded-lg px-2 py-1.5 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 ${
              row.lon === '' ? 'border-amber-500/50' : 'border-white/15'
            }`}
          />
        </div>
        {row.latLonAuto && row.lat !== '' && (
          <p className="text-[10px] text-emerald-400 mt-0.5">from filename</p>
        )}
      </div>

      <input
        type="text" value={row.folder} disabled={!editable} placeholder="Folder (optional)"
        onChange={(e) => onChange({ folder: e.target.value })}
        className="w-full bg-white/5 border border-white/15 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
      />

      <StatusLine row={row} projectId={projectId} />
    </div>
  )
}

export interface MapUploadPanelHandle {
  /** Called when a saved device's marker is clicked on the map while this panel is open —
   *  selects it exactly as picking it from the dropdown would. */
  selectDevice: (device: Device) => void
}

interface MapUploadPanelProps {
  projectId: string
  /** The map's imperative handle — used to arm/disarm "click the map to place this
   *  device" and to refresh its device markers after a new one is saved. */
  mapHandle: React.RefObject<ProjectMapHandle | null>
  onClose: () => void
}

/**
 * The map page's upload sidebar — same staging workflow as the old standalone
 * /projects/upload page, restyled into a single narrow column of cards (that page's wide
 * table doesn't fit a 1/3-width sidebar) and wired into the map for device-location
 * picking, since the map is right there.
 */
const MapUploadPanel = forwardRef<MapUploadPanelHandle, MapUploadPanelProps>(function MapUploadPanel(
  { projectId, mapHandle, onClose },
  ref
) {
  const [rows, setRows] = useState<StagingRow[]>([])
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null)
  const [models, setModels] = useState<Model[]>([])
  const [modelVersionId, setModelVersionId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    listModels(projectId).then(setModels).catch(() => { /* model picker is a nice-to-have */ })
  }, [projectId])

  // Leaving this panel (switching back to Overview) while a device-location pick is still
  // armed would otherwise leave the map in picking mode forever - the click has nowhere
  // left to land once the device form that requested it is gone.
  useEffect(() => () => { mapHandle.current?.cancelPickingLocation() }, [mapHandle])

  function updateRow(key: string, patch: Partial<StagingRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key))
  }

  function handleFilesSelected(files: File[]) {
    const newRows = files.filter(isAudioFile).map((f) => buildRow(f, selectedDevice?.filenameFormat))
    if (newRows.length > 0) setRows((prev) => [...prev, ...newRows])
  }

  function applyDeviceFillToRows(device: Device) {
    // Auto-fill rows that don't have location/time set yet - doesn't touch rows the
    // uploader (or the filename itself, via buildRow) already filled in.
    setRows((prev) =>
      prev.map((r) => {
        const patch: Partial<StagingRow> = {}
        if (r.lat === '' && r.lon === '') {
          patch.lat = device.lat != null ? String(device.lat) : ''
          patch.lon = device.lon != null ? String(device.lon) : ''
          patch.latLonAuto = false // from the device's fixed location, not this file's own name
        }
        if (r.recordedAt === '' && device.filenameFormat) {
          const inferred = parseFilename(r.file.name, device.filenameFormat).recordedAt
          if (inferred) {
            patch.recordedAt = toDatetimeLocal(inferred)
            patch.recordedAtAuto = true
          }
        }
        return Object.keys(patch).length > 0 ? { ...r, ...patch } : r
      })
    )
  }

  function handleDeviceSelect(device: Device | null) {
    setSelectedDevice(device)
    mapHandle.current?.refreshDevices() // picks up a just-created device's marker
    if (device) applyDeviceFillToRows(device)
  }

  useImperativeHandle(ref, () => ({
    selectDevice: (device) => handleDeviceSelect(device),
  }))

  function applyDeviceToAllRows() {
    if (!selectedDevice) return
    setRows((prev) => prev.map((r) => ({ ...r, lat: selectedDevice.lat != null ? String(selectedDevice.lat) : '', lon: selectedDevice.lon != null ? String(selectedDevice.lon) : '' })))
  }

  async function uploadOneRow(row: StagingRow) {
    updateRow(row.key, { status: 'uploading', error: null })
    try {
      const jobId = await uploadRecording(projectId, row.file, {
        lat: parseFloat(row.lat),
        lon: parseFloat(row.lon),
        recordedAt: new Date(row.recordedAt).toISOString(),
        folder: row.folder || undefined,
        deviceId: selectedDevice?.id,
        modelVersionId: modelVersionId || undefined,
      })
      updateRow(row.key, { status: 'submitted', jobId })
    } catch (err) {
      updateRow(row.key, { status: 'failed', error: err instanceof Error ? err.message : 'Upload failed' })
    }
  }

  async function handleSubmit() {
    const readyRows = rows.filter((r) => r.status === 'idle' && isRowReady(r))
    if (readyRows.length === 0) return
    setSubmitting(true)
    await runWithConcurrency(readyRows, 3, uploadOneRow)
    setSubmitting(false)
  }

  const readyCount = rows.filter((r) => r.status === 'idle' && isRowReady(r)).length
  const needsInfoCount = rows.filter((r) => r.status === 'idle' && !isRowReady(r)).length
  const busy = submitting
  const trainedModels = models.filter((m) => m.latestVersionId)

  return (
    <div className="h-full overflow-y-auto bg-ocean-dark border-l border-white/10 px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-serif text-2xl text-white">Upload Recordings</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Overview
        </button>
      </div>

      <div className="space-y-5">
        <FileDropZone onFiles={handleFilesSelected} disabled={busy} />

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Recording device</label>
          <DeviceManager
            projectId={projectId}
            selectedDeviceId={selectedDevice?.id ?? null}
            onSelect={handleDeviceSelect}
            onRequestMapPick={(onPicked) => mapHandle.current?.startPickingLocation(onPicked)}
            onDevicesChanged={() => mapHandle.current?.refreshDevices()}
          />
          {selectedDevice && rows.length > 0 && (
            <button
              onClick={applyDeviceToAllRows}
              className="text-xs text-gray-400 hover:text-white underline mt-1.5"
            >
              Apply this device's location to every file below
            </button>
          )}
        </div>

        {rows.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
            <select
              value={modelVersionId}
              onChange={(e) => setModelVersionId(e.target.value)}
              style={{ colorScheme: 'dark' }}
              className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="" style={{ backgroundColor: '#0a1628', color: 'white' }}>Perch (default)</option>
              {trainedModels.map((m) => (
                <option key={m.id} value={m.latestVersionId as string} style={{ backgroundColor: '#0a1628', color: 'white' }}>
                  {m.name} (v{m.latestVersionNumber})
                </option>
              ))}
            </select>
            <p className="text-gray-500 text-xs mt-1.5">
              Perch always runs. Picking a trained model also runs its species detector on these files.
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">
                {rows.length} file{rows.length === 1 ? '' : 's'}
              </span>
              <button onClick={() => setRows([])} disabled={busy} className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-60">
                Clear all
              </button>
            </div>

            <div className="space-y-3">
              {rows.map((row) => (
                <StagingCard
                  key={row.key}
                  row={row}
                  projectId={projectId}
                  onChange={(patch) => updateRow(row.key, patch)}
                  onRemove={() => removeRow(row.key)}
                />
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={readyCount === 0 || busy}
              className="w-full bg-white text-ocean-dark px-4 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Uploading…' : `Upload ${readyCount} file${readyCount === 1 ? '' : 's'}`}
            </button>
            {needsInfoCount > 0 && (
              <p className="text-amber-400 text-xs">
                {needsInfoCount} file{needsInfoCount === 1 ? '' : 's'} still need{needsInfoCount === 1 ? 's' : ''} recording time and/or location.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
})

export default MapUploadPanel
