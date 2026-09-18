'use client'

import { useEffect, useState } from 'react'
import RequireAuth from '@/lib/auth/RequireAuth'
import { useAuth } from '@/lib/auth/AuthProvider'
import { listProjects, type Project } from '@/lib/apiClient'

function ProjectList() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listProjects()
      .then((data) => { if (!cancelled) setProjects(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load projects') })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-ocean-dark px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-4xl text-white mb-2">Your Projects</h1>
        <p className="text-gray-400 mb-12 text-sm">Signed in as {user?.email}</p>

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

        {projects && projects.length > 0 && (
          <ul className="space-y-3">
            {projects.map((project) => (
              <li
                key={project.id}
                className="bg-white/5 border border-white/10 rounded-lg px-5 py-4"
              >
                <p className="text-white font-medium">{project.name}</p>
                {project.description && (
                  <p className="text-gray-400 text-sm mt-1">{project.description}</p>
                )}
              </li>
            ))}
          </ul>
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
