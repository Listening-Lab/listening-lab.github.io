'use client'

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import {
  getAsset,
  updateAsset,
  deleteAsset,
  listFolders,
  listDetections,
  nzModelVersion,
  type Asset,
  type AssetUpdatePayload,
  type Detection,
} from '@/lib/apiClient'
import AssetStatusBadge from '@/components/AssetStatusBadge'

function isoToLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDuration(sec: number | null) {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function DeleteConfirmDialog({
  filename,
  busy,
  onCancel,
  onConfirm,
}: {
  filename: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-sm bg-[#0a1628] border border-white/20 rounded-2xl shadow-2xl p-6 text-white z-10">
        <h3 className="font-serif text-xl mb-2">Delete recording?</h3>
        <p className="text-gray-400 text-sm mb-6">
          This permanently deletes <span className="text-white font-medium">{filename}</span> and its
          uploaded file. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 bg-white/10 text-white border border-white/20 px-4 py-2.5 rounded-full text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 bg-red-500 text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-red-400 transition-colors disabled:opacity-60"
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

function PredictionsPanel({ projectId, assetId }: { projectId: string; assetId: string }) {
  const [detections, setDetections] = useState<Detection[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // NZ-restricted top-5 is the default everywhere predictions are shown (worker.py
  // computes it alongside the unfiltered top-5) — most uploads are NZ field recordings,
  // so this is the relevant view by default, with a toggle back to the full global list.
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDetections(null)
    listDetections(projectId, { assetId, modelVersion: showAll ? undefined : nzModelVersion() })
      .then((data) => { if (!cancelled) setDetections(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load predictions') })
    return () => { cancelled = true }
  }, [projectId, assetId, showAll])

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-serif text-xl text-white">Detected Species</h2>
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-gray-400 hover:text-white underline shrink-0"
        >
          {showAll ? 'Show NZ species only' : 'Show all species'}
        </button>
      </div>
      <p className="text-gray-400 text-xs mb-5 leading-relaxed">
        Score is a raw model output, not a calibrated confidence — it's the top match per 5-second
        window, not a percentage certainty.
        {!showAll && ' Restricted to species plausible in New Zealand.'}
      </p>

      {error && <p className="text-red-500 text-sm">Could not load predictions: {error}</p>}
      {!error && detections === null && <p className="text-gray-400 text-sm">Loading predictions…</p>}
      {detections && detections.length === 0 && (
        <p className="text-gray-400 text-sm">No detections for this file yet.</p>
      )}

      {detections && detections.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="pb-2 pr-4 font-medium">Offset</th>
                <th className="pb-2 pr-4 font-medium">Window</th>
                <th className="pb-2 pr-4 font-medium">Top match</th>
                <th className="pb-2 pr-4 font-medium">Score</th>
                {showAll && <th className="pb-2 pr-4 font-medium">Model</th>}
              </tr>
            </thead>
            <tbody>
              {detections.map((d) => (
                <tr key={d.id} className="border-b border-white/5">
                  <td className="py-2 pr-4 text-gray-300 font-mono">{d.offsetSeconds}s</td>
                  <td className="py-2 pr-4 text-gray-300 font-mono">{d.windowSeconds}s</td>
                  <td className="py-2 pr-4 text-white italic">{d.speciesCode}</td>
                  <td className="py-2 pr-4 text-gray-300 font-mono">{d.score.toFixed(3)}</td>
                  {showAll && <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{d.modelVersion}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function FileDetail() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const assetId = searchParams.get('assetId')

  const [asset, setAsset] = useState<Asset | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [filename, setFilename] = useState('')
  const [folder, setFolder] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [recordedAt, setRecordedAt] = useState('')

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || !assetId) return
    let cancelled = false
    getAsset(projectId, assetId)
      .then((data) => {
        if (cancelled) return
        setAsset(data)
        setFilename(data.filename)
        setFolder(data.folder ?? '')
        setLat(data.lat !== null ? String(data.lat) : '')
        setLon(data.lon !== null ? String(data.lon) : '')
        setRecordedAt(isoToLocalInput(data.recordedAt))
      })
      .catch((err) => { if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load file') })
    return () => { cancelled = true }
  }, [projectId, assetId])

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    listFolders(projectId)
      .then((data) => { if (!cancelled) setFolders(data) })
      .catch(() => { /* folder list is a nice-to-have; ignore failures */ })
    return () => { cancelled = true }
  }, [projectId])

  const dirtyPatch = useMemo((): AssetUpdatePayload | null => {
    if (!asset) return null
    const patch: AssetUpdatePayload = {}
    if (filename !== asset.filename) patch.filename = filename
    const normalizedFolder = folder.trim() === '' ? null : folder.trim()
    if (normalizedFolder !== (asset.folder ?? null)) patch.folder = normalizedFolder
    if (lat !== '' && !Number.isNaN(parseFloat(lat)) && parseFloat(lat) !== asset.lat) patch.lat = parseFloat(lat)
    if (lon !== '' && !Number.isNaN(parseFloat(lon)) && parseFloat(lon) !== asset.lon) patch.lon = parseFloat(lon)
    if (recordedAt !== '' && new Date(recordedAt).toISOString() !== asset.recordedAt) {
      patch.recordedAt = new Date(recordedAt).toISOString()
    }
    return Object.keys(patch).length > 0 ? patch : null
  }, [asset, filename, folder, lat, lon, recordedAt])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !assetId || !dirtyPatch) return
    setSaving(true)
    setSaveError(null)
    setSaved(false)
    try {
      const updated = await updateAsset(projectId, assetId, dirtyPatch)
      setAsset(updated)
      setFilename(updated.filename)
      setFolder(updated.folder ?? '')
      setLat(updated.lat !== null ? String(updated.lat) : '')
      setLon(updated.lon !== null ? String(updated.lon) : '')
      setRecordedAt(isoToLocalInput(updated.recordedAt))
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!projectId || !assetId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteAsset(projectId, assetId)
      router.push(`/projects/files?projectId=${encodeURIComponent(projectId)}`)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete file')
      setDeleting(false)
    }
  }

  if (!projectId || !assetId) {
    return (
      <p className="text-red-500 text-sm">
        Missing project or file reference. Go back to{' '}
        <Link href="/projects" className="underline">your projects</Link>.
      </p>
    )
  }

  if (loadError) {
    return <p className="text-red-500 text-sm">Could not load file: {loadError}</p>
  }

  if (!asset) {
    return <p className="text-gray-400 text-sm">Loading file…</p>
  }

  return (
    <>
      <div className="flex items-center gap-3 mb-8">
        <h1 className="font-serif text-3xl text-white break-all">{asset.filename}</h1>
        <AssetStatusBadge status={asset.latestJobStatus} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <form onSubmit={handleSave} className="bg-white/5 border border-white/10 rounded-lg p-6 space-y-4">
          <h2 className="font-serif text-xl text-white mb-2">Details</h2>

          <div>
            <label htmlFor="filename" className="block text-sm font-medium text-gray-300 mb-2">Filename</label>
            <input
              id="filename" type="text" required
              value={filename} onChange={(e) => setFilename(e.target.value)}
              className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label htmlFor="folder" className="block text-sm font-medium text-gray-300 mb-2">Folder</label>
            <input
              id="folder" type="text" list="folder-options"
              value={folder} onChange={(e) => setFolder(e.target.value)}
              placeholder="Leave blank for root"
              className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <datalist id="folder-options">
              {folders.map((f) => <option key={f} value={f} />)}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="lat" className="block text-sm font-medium text-gray-300 mb-2">Latitude</label>
              <input
                id="lat" type="number" step="any"
                value={lat} onChange={(e) => setLat(e.target.value)}
                className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="lon" className="block text-sm font-medium text-gray-300 mb-2">Longitude</label>
              <input
                id="lon" type="number" step="any"
                value={lon} onChange={(e) => setLon(e.target.value)}
                className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="recordedAt" className="block text-sm font-medium text-gray-300 mb-2">Recording time</label>
            <input
              id="recordedAt" type="datetime-local"
              value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <p className="text-gray-500 text-xs">
            Duration: <span className="font-mono">{formatDuration(asset.durationSeconds)}</span>
            {' · '}Uploaded {new Date(asset.createdAt).toLocaleString()}
          </p>

          {saveError && <p className="text-red-500 text-sm">{saveError}</p>}
          {saved && !saveError && <p className="text-emerald-400 text-sm">Saved.</p>}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={!dirtyPatch || saving}
              className="bg-white text-ocean-dark px-6 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
            >
              Delete recording
            </button>
          </div>
          {deleteError && <p className="text-red-500 text-sm">{deleteError}</p>}
        </form>

        <PredictionsPanel projectId={projectId} assetId={assetId} />
      </div>

      {confirmingDelete && (
        <DeleteConfirmDialog
          filename={asset.filename}
          busy={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </>
  )
}

function FileDetailContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  return (
    <div className="min-h-screen bg-ocean-dark px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 mb-8">
          <Link
            href={projectId ? `/projects/files?projectId=${encodeURIComponent(projectId)}` : '/projects'}
            className="hover:text-white transition-colors"
          >
            ← Files
          </Link>
        </p>
        <FileDetail />
      </div>
    </div>
  )
}

export default function FileDetailPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <FileDetailContent />
      </Suspense>
    </RequireAuth>
  )
}
