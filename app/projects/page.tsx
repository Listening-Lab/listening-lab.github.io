'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import { useAuth } from '@/lib/auth/AuthProvider'
import { listProjects, createProject, type Project } from '@/lib/apiClient'
import ProjectActionsMenu from '@/components/ProjectActionsMenu'

function NewProjectForm({
  onCreated,
  onCancel,
}: {
  onCreated: (project: Project) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const project = await createProject({
        name,
        description: description.trim() ? description.trim() : undefined,
      })
      onCreated(project)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white/5 border border-white/10 rounded-lg px-5 py-4 mb-8 space-y-3"
    >
      <div>
        <label htmlFor="project-name" className="block text-sm font-medium text-gray-300 mb-2">
          Project name
        </label>
        <input
          id="project-name" type="text" required autoFocus
          value={name} onChange={(e) => setName(e.target.value)}
          className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div>
        <label htmlFor="project-description" className="block text-sm font-medium text-gray-300 mb-2">
          Description <span className="text-gray-500 font-normal">(optional)</span>
        </label>
        <input
          id="project-description" type="text"
          value={description} onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={!name.trim() || saving}
          className="bg-white text-ocean-dark px-5 py-2 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60"
        >
          {saving ? 'Creating…' : 'Create project'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="text-gray-400 hover:text-white text-sm transition-colors disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function ProjectRow({ project }: { project: Project }) {
  return (
    <li className="bg-white/5 border border-white/10 rounded-lg px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-white font-medium">{project.name}</p>
          {project.role === 'admin' && (
            <span className="text-[10px] uppercase tracking-wider font-medium text-brand-100 bg-brand-500/15 border border-brand-500/30 rounded-full px-2 py-0.5">
              Admin
            </span>
          )}
        </div>
        {project.description && (
          <p className="text-gray-400 text-sm mt-1">{project.description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <Link
          href={`/projects/map?projectId=${encodeURIComponent(project.id)}`}
          className="bg-white/10 text-white border border-white/20 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/20 transition-colors"
        >
          Map
        </Link>
        <ProjectActionsMenu project={project} />
      </div>
    </li>
  )
}

function ProjectList() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let cancelled = false
    listProjects()
      .then((data) => { if (!cancelled) setProjects(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load projects') })
    return () => { cancelled = true }
  }, [])

  function handleCreated(project: Project) {
    setProjects((prev) => [...(prev ?? []), project])
    setCreating(false)
  }

  const publicProjects = projects?.filter((p) => p.isPublic) ?? []
  const privateProjects = projects?.filter((p) => !p.isPublic) ?? []

  return (
    <div className="min-h-screen bg-ocean-dark px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="font-serif text-4xl text-white">Your Projects</h1>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="shrink-0 bg-white text-ocean-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors"
            >
              + New project
            </button>
          )}
        </div>
        <p className="text-gray-400 mb-12 text-sm">Signed in as {user?.email}</p>

        {creating && (
          <NewProjectForm onCreated={handleCreated} onCancel={() => setCreating(false)} />
        )}

        {error && (
          <p className="text-red-500 text-sm">
            Could not load projects: {error}
          </p>
        )}

        {!error && projects === null && (
          <p className="text-gray-400 text-sm">Loading projects…</p>
        )}

        {projects?.length === 0 && (
          <p className="text-gray-400 text-sm">No projects yet.</p>
        )}

        {publicProjects.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">Public</h2>
            <ul className="space-y-3">
              {publicProjects.map((project) => <ProjectRow key={project.id} project={project} />)}
            </ul>
          </div>
        )}

        {privateProjects.length > 0 && (
          <div>
            <h2 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3">Your Projects</h2>
            <ul className="space-y-3">
              {privateProjects.map((project) => <ProjectRow key={project.id} project={project} />)}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <RequireAuth>
      <ProjectList />
    </RequireAuth>
  )
}
