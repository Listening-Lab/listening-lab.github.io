'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import ConfirmDialog from '@/components/ConfirmDialog'
import { listProjects, updateProject, deleteProject, ApiError, type Project } from '@/lib/apiClient'

function RenameForm({ project, onSaved }: { project: Project; onSaved: (project: Project) => void }) {
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const dirty = name !== project.name || description !== (project.description ?? '')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const updated = await updateProject(project.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      })
      onSaved(updated)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-lg px-5 py-4 mb-6">
      <h2 className="text-sm font-medium text-gray-300 mb-3">Project details</h2>
      <div className="flex flex-col gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Name</label>
          <input
            type="text" required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Description</label>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
            className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!name.trim() || !dirty || saving}
            className="bg-white text-ocean-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60 shrink-0"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {saved && !dirty && <span className="text-sm text-brand-500">Saved</span>}
        </div>
      </div>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </form>
  )
}

function DangerZone({ project }: { project: Project }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (project.isPublic) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg px-5 py-4">
        <h2 className="text-sm font-medium text-gray-300 mb-2">Danger zone</h2>
        <p className="text-gray-500 text-sm">The shared Public project can&apos;t be deleted.</p>
      </div>
    )
  }

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await deleteProject(project.id)
      router.push('/projects')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete project')
      setDeleting(false)
    }
  }

  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-5 py-4">
      <h2 className="text-sm font-medium text-red-400 mb-2">Danger zone</h2>
      <p className="text-gray-400 text-sm mb-4">
        Permanently deletes this project, its recordings, labels, models, and training history.
        This cannot be undone.
      </p>
      <button
        onClick={() => setConfirming(true)}
        className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
      >
        Delete project…
      </button>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

      {confirming && (
        <ConfirmDialog
          title="Delete project?"
          message={
            <>
              This permanently deletes <span className="text-white font-medium">{project.name}</span> and
              everything in it — recordings, labels, models, training runs. This cannot be undone.
            </>
          }
          busy={deleting}
          onCancel={() => setConfirming(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}

function SettingsPanel() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [project, setProject] = useState<Project | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    // No single-project GET endpoint exists yet — listing and finding by id is the same
    // request the project list page already makes, so this isn't an extra round trip
    // pattern introduced just for this page.
    listProjects()
      .then((projects) => {
        if (cancelled) return
        const found = projects.find((p) => p.id === projectId)
        if (!found) {
          setError('Project not found, or you are not a member of it.')
          return
        }
        setProject(found)
      })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load project') })
    return () => { cancelled = true }
  }, [projectId])

  if (!projectId) {
    return (
      <p className="text-red-500 text-sm">
        No project selected. Go back to{' '}
        <Link href="/projects" className="underline">your projects</Link> and choose one to manage.
      </p>
    )
  }

  if (error) return <p className="text-red-500 text-sm">{error}</p>
  if (!project) return <p className="text-gray-400 text-sm">Loading…</p>

  if (project.role !== 'admin') {
    return <p className="text-red-500 text-sm">You must be an admin of this project to manage its settings.</p>
  }

  return (
    <>
      <RenameForm project={project} onSaved={setProject} />
      <DangerZone project={project} />
    </>
  )
}

function SettingsPageContent() {
  return (
    <div className="min-h-screen bg-ocean-dark px-6 py-24">
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-gray-500 mb-2">
          <Link href="/projects" className="hover:text-white transition-colors">
            ← Your Projects
          </Link>
        </p>
        <h1 className="font-serif text-4xl text-white mb-10">Project Settings</h1>
        <SettingsPanel />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <SettingsPageContent />
      </Suspense>
    </RequireAuth>
  )
}
