'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import SiteManager from '@/components/SiteManager'
import { listProjects } from '@/lib/apiClient'

function SitesPanel() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    listProjects()
      .then((projects) => {
        if (!cancelled) setIsAdmin(projects.find((p) => p.id === projectId)?.role === 'admin')
      })
      .catch(() => {
        // Without the role, just hide the admin-only delete buttons - the API still enforces it.
      })
    return () => { cancelled = true }
  }, [projectId])

  if (!projectId) {
    return (
      <p className="text-red-500 text-sm">
        No project selected. Go back to{' '}
        <Link href="/projects" className="underline">your projects</Link> and choose one.
      </p>
    )
  }

  return <SiteManager projectId={projectId} isAdmin={isAdmin} />
}

export default function SitesPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <div className="min-h-screen bg-ocean-dark px-6 py-24">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm text-gray-500 mb-2">
              <Link href="/projects" className="hover:text-white transition-colors">
                ← Your Projects
              </Link>
            </p>
            <h1 className="font-serif text-4xl text-white mb-8">Sites &amp; deployments</h1>
            <SitesPanel />
          </div>
        </div>
      </Suspense>
    </RequireAuth>
  )
}
