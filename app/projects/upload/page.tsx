'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

/**
 * Upload now lives inside the project map (2/3 map, 1/3 upload panel — devices can be
 * placed by clicking the map itself). This standalone route stays only so old
 * links/bookmarks to it keep working, redirecting straight into the map's upload panel.
 */
function RedirectToMapUpload() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  useEffect(() => {
    router.replace(
      projectId
        ? `/projects/map?projectId=${encodeURIComponent(projectId)}&panel=upload`
        : '/projects'
    )
  }, [router, projectId])

  return (
    <div className="min-h-screen bg-ocean-dark flex items-center justify-center">
      <p className="text-gray-400 text-sm">Redirecting…</p>
    </div>
  )
}

export default function UploadPage() {
  return (
    <Suspense fallback={null}>
      <RedirectToMapUpload />
    </Suspense>
  )
}
