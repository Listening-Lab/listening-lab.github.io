'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import ConfirmDialog from '@/components/ConfirmDialog'
import { useSpeciesNames } from '@/lib/speciesNames'
import {
  listModels,
  listModelVersions,
  deleteModel,
  ApiError,
  type Model,
  type ModelVersion,
} from '@/lib/apiClient'

function MetricCell({ value }: { value: number | null }) {
  return <span className="font-mono">{value === null ? '—' : value.toFixed(2)}</span>
}

function ModelVersionsTable({ version }: { version: ModelVersion }) {
  const { commonName } = useSpeciesNames()
  const species = Object.entries(version.metrics)
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1 pr-4 font-medium">Species</th>
            <th className="py-1 pr-4 font-medium">Precision</th>
            <th className="py-1 pr-4 font-medium">Recall</th>
            <th className="py-1 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {species.map(([code, m]) => (
            <tr key={code} className="border-t border-white/5">
              <td className="py-1.5 pr-4 text-gray-300">{commonName(code)}</td>
              <td className="py-1.5 pr-4 text-gray-300"><MetricCell value={m.precision} /></td>
              <td className="py-1.5 pr-4 text-gray-300"><MetricCell value={m.recall} /></td>
              <td className="py-1.5">
                {m.insufficientData ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                    insufficient data
                  </span>
                ) : m.precision === null ? (
                  // Enough positive examples to pass the readiness bar, but zero negative
                  // ones to actually evaluate against — a species someone's been
                  // confirming present without ever rejecting a suggestion for it. The
                  // head still exists (always predicts present), just with nothing to
                  // measure precision/recall against yet.
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20"
                    title="Enough present labels, but no absent labels yet to evaluate against"
                  >
                    no negative examples
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                    trained
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ModelCard({
  projectId,
  model,
  onDeleted,
}: {
  projectId: string
  model: Model
  onDeleted: (modelId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [versions, setVersions] = useState<ModelVersion[] | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function toggle() {
    setExpanded((v) => !v)
    if (!versions) {
      listModelVersions(projectId, model.id).then(setVersions).catch(() => setVersions([]))
    }
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteModel(projectId, model.id)
      onDeleted(model.id)
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Failed to delete model')
      setDeleting(false)
    }
  }

  return (
    <li className="bg-white/5 border border-white/10 rounded-lg px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={toggle} className="flex-1 flex items-center justify-between gap-2 text-left min-w-0">
          <span className="min-w-0">
            <span className="text-sm text-white font-medium">{model.name}</span>
            <span className="text-xs text-gray-500 ml-2">{model.speciesCodes.length} species</span>
          </span>
          <span className="text-xs text-gray-400 font-mono shrink-0">
            {model.latestVersionNumber ? `v${model.latestVersionNumber}` : 'training…'}
          </span>
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          className="text-gray-500 hover:text-red-400 transition-colors text-xs shrink-0"
        >
          Delete
        </button>
      </div>
      {deleteError && <p className="text-red-400 text-xs mt-1.5">{deleteError}</p>}
      {expanded && (
        versions === null ? (
          <p className="text-xs text-gray-500 mt-2">Loading versions…</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-gray-500 mt-2">No completed versions yet.</p>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="mt-3">
              <p className="text-xs text-gray-400 font-mono">v{v.versionNumber} · {new Date(v.createdAt).toLocaleString()}</p>
              <ModelVersionsTable version={v} />
            </div>
          ))
        )
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete model?"
          message={
            <>
              This permanently deletes <span className="text-white font-medium">{model.name}</span> and every
              version/training run under it. This cannot be undone.
            </>
          }
          busy={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleDelete}
        />
      )}
    </li>
  )
}

function ModelsContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [models, setModels] = useState<Model[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    listModels(projectId)
      .then((m) => { if (!cancelled) setModels(m) })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load models')
      })
    return () => { cancelled = true }
  }, [projectId])

  if (!projectId) {
    return (
      <p className="text-red-500 text-sm">
        No project selected. Go back to <Link href="/projects" className="underline">your projects</Link> and choose one.
      </p>
    )
  }

  const loading = models === null

  return (
    <div className="min-h-screen bg-ocean-dark px-6 py-24">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm text-gray-500 mb-2">
          <Link href="/projects" className="hover:text-white transition-colors">← Your Projects</Link>
        </p>
        <h1 className="font-serif text-4xl text-white mb-10">Models</h1>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        {loading ? (
          <p className="text-gray-400 text-sm">Loading…</p>
        ) : models.length === 0 ? (
          <p className="text-sm text-gray-500">
            No models trained yet — start one from the{' '}
            <Link href={`/projects/map?projectId=${encodeURIComponent(projectId)}`} className="text-brand-100 underline">
              project map
            </Link>.
          </p>
        ) : (
          <ul className="space-y-3">
            {models.map((m) => (
              <ModelCard
                key={m.id}
                projectId={projectId}
                model={m}
                onDeleted={(id) => setModels((prev) => (prev ?? []).filter((x) => x.id !== id))}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default function ModelsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <ModelsContent />
      </Suspense>
    </RequireAuth>
  )
}
