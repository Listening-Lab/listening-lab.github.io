'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import { listAssets, listFolders, type Asset } from '@/lib/apiClient'
import { ASSET_POLL_INTERVAL_MS, hasUnsettledAsset } from '@/lib/assetPolling'
import AssetStatusBadge from '@/components/AssetStatusBadge'

function childFolders(folders: string[], current: string | null): string[] {
  const depth = current ? current.split('/').length : 0
  const prefix = current ? `${current}/` : ''
  const children = new Set<string>()
  for (const folder of folders) {
    if (current && !folder.startsWith(prefix)) continue
    const parts = folder.split('/')
    if (parts.length > depth) {
      children.add(parts.slice(0, depth + 1).join('/'))
    }
  }
  return Array.from(children).sort()
}

function formatDuration(sec: number | null) {
  if (sec === null) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function FileBrowser() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const folder = searchParams.get('folder')

  const [assets, setAssets] = useState<Asset[] | null>(null)
  const [folders, setFolders] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const navigateToFolder = useCallback(
    (target: string | null) => {
      const params = new URLSearchParams()
      params.set('projectId', projectId as string)
      if (target) params.set('folder', target)
      router.push(`/projects/files?${params.toString()}`)
    },
    [projectId, router]
  )

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    listFolders(projectId)
      .then((data) => { if (!cancelled) setFolders(data) })
      .catch(() => { /* folder list is a nice-to-have; ignore failures */ })
    return () => { cancelled = true }
  }, [projectId])

  // Polls while anything's still pending/processing, so a file left to process updates
  // its status badge on its own instead of needing a manual refresh - same reasoning and
  // interval as the map page's Overview panel and marker colors (lib/assetPolling.ts).
  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    setAssets(null)
    setError(null)

    async function poll() {
      try {
        const data = await listAssets(projectId as string, { folder: folder ?? undefined })
        if (cancelled) return
        setAssets(data)
        setError(null)
        if (hasUnsettledAsset(data)) timer = setTimeout(poll, ASSET_POLL_INTERVAL_MS)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load files')
        timer = setTimeout(poll, ASSET_POLL_INTERVAL_MS)
      }
    }

    poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [projectId, folder])

  const crumbs = useMemo(() => {
    if (!folder) return []
    const parts = folder.split('/')
    return parts.map((_, i) => parts.slice(0, i + 1).join('/'))
  }, [folder])

  const subfolders = useMemo(() => childFolders(folders, folder), [folders, folder])

  if (!projectId) {
    return (
      <p className="text-red-500 text-sm">
        No project selected. Go back to{' '}
        <Link href="/projects" className="underline">your projects</Link> and choose one to browse.
      </p>
    )
  }

  return (
    <>
      {/* Breadcrumb */}
      <div className="flex items-center flex-wrap gap-1 text-sm text-gray-400 mb-6">
        <button onClick={() => navigateToFolder(null)} className="hover:text-white transition-colors">
          All files
        </button>
        {crumbs.map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-1">
            <span className="text-gray-600">/</span>
            <button
              onClick={() => navigateToFolder(crumb)}
              className={i === crumbs.length - 1 ? 'text-white' : 'hover:text-white transition-colors'}
            >
              {crumb.split('/')[i]}
            </button>
          </span>
        ))}
      </div>

      {subfolders.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {subfolders.map((sub) => (
            <button
              key={sub}
              onClick={() => navigateToFolder(sub)}
              className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              {sub.split('/').pop()}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-red-500 text-sm">Could not load files: {error}</p>}

      {!error && assets === null && <p className="text-gray-400 text-sm">Loading files…</p>}

      {assets && assets.length === 0 && (
        <p className="text-gray-400 text-sm">No files in this folder.</p>
      )}

      {assets && assets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="pb-3 pr-4 font-medium">Filename</th>
                <th className="pb-3 pr-4 font-medium">Folder</th>
                <th className="pb-3 pr-4 font-medium">Recorded</th>
                <th className="pb-3 pr-4 font-medium">Duration</th>
                <th className="pb-3 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr key={asset.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/projects/files/detail?projectId=${encodeURIComponent(projectId)}&assetId=${encodeURIComponent(asset.id)}`}
                      className="text-white hover:underline font-medium"
                    >
                      {asset.filename}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-gray-400">{asset.folder ?? '—'}</td>
                  <td className="py-3 pr-4 text-gray-400">
                    {asset.recordedAt ? new Date(asset.recordedAt).toLocaleString() : '—'}
                  </td>
                  <td className="py-3 pr-4 text-gray-400 font-mono">{formatDuration(asset.durationSeconds)}</td>
                  <td className="py-3 pr-4">
                    <AssetStatusBadge status={asset.latestJobStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function FilesPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  return (
    <div className="min-h-screen bg-ocean-dark px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 mb-2">
          <Link href="/projects" className="hover:text-white transition-colors">← Your Projects</Link>
        </p>
        <div className="flex items-center justify-between gap-4 mb-10">
          <h1 className="font-serif text-4xl text-white">Files</h1>
          {projectId && (
            <Link
              href={`/projects/map?projectId=${encodeURIComponent(projectId)}&panel=upload`}
              className="shrink-0 bg-white/10 text-white border border-white/20 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Upload
            </Link>
          )}
        </div>
        <FileBrowser />
      </div>
    </div>
  )
}

export default function FilesPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <FilesPageContent />
      </Suspense>
    </RequireAuth>
  )
}
