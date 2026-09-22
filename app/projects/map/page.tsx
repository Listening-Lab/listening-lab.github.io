'use client'

import { Suspense, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import ProjectMap, { type ProjectMapHandle, type ProjectMapRegion } from '@/components/ProjectMap'
import ProjectMapSidebar from '@/components/ProjectMapSidebar'
import MapUploadPanel, { type MapUploadPanelHandle } from '@/components/MapUploadPanel'
import type { Device } from '@/lib/apiClient'

type SidebarMode = 'overview' | 'upload'

function MapPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const mapRef = useRef<ProjectMapHandle>(null)
  const uploadPanelRef = useRef<MapUploadPanelHandle>(null)
  const [regions, setRegions] = useState<ProjectMapRegion[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  // Deep-linkable ("?panel=upload") so the other pages that used to link to the
  // standalone /projects/upload page can land straight in upload mode here instead.
  const [mode, setMode] = useState<SidebarMode>(searchParams.get('panel') === 'upload' ? 'upload' : 'overview')

  if (!projectId) {
    return (
      <div className="min-h-screen bg-ocean-dark px-6 py-24">
        <div className="max-w-3xl mx-auto">
          <p className="text-red-500 text-sm">
            No project selected. Go back to{' '}
            <Link href="/projects" className="underline">your projects</Link> and choose one.
          </p>
        </div>
      </div>
    )
  }

  function handleDeviceClick(device: Device) {
    if (mode === 'upload') uploadPanelRef.current?.selectDevice(device)
  }

  return (
    // pt-16 clears the site's fixed/overlaid Navbar (h-16) — it doesn't take flow space
    // itself, so without this the map's own header row would render underneath it.
    <div className="h-screen pt-16 flex flex-col bg-ocean-dark">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-white/10 shrink-0">
        <div>
          <p className="text-sm text-gray-500 mb-1">
            <Link href="/projects" className="hover:text-white transition-colors">← Your Projects</Link>
          </p>
          <h1 className="font-serif text-2xl text-white">Project Map</h1>
        </div>
        {mode === 'overview' && (
          <button
            onClick={() => setMode('upload')}
            className="shrink-0 bg-white text-ocean-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors"
          >
            + Upload recording
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <div className="w-full md:w-2/3 h-1/2 md:h-full">
          <ProjectMap
            ref={mapRef}
            projectId={projectId}
            onRegionsChange={setRegions}
            onDrawModeChange={setIsDrawing}
            onDeviceClick={handleDeviceClick}
            onUploadClick={() => setMode('upload')}
          />
        </div>
        <div className="w-full md:w-1/3 h-1/2 md:h-full">
          {mode === 'upload' ? (
            <MapUploadPanel
              ref={uploadPanelRef}
              projectId={projectId}
              mapHandle={mapRef}
              onClose={() => setMode('overview')}
            />
          ) : (
            <ProjectMapSidebar
              projectId={projectId}
              regions={regions}
              isDrawing={isDrawing}
              onStartDrawing={() => mapRef.current?.startDrawingRegion()}
              onCancelDrawing={() => mapRef.current?.cancelDrawingRegion()}
              onRemoveRegion={(id) => mapRef.current?.removeRegion(id)}
              onClearRegions={() => mapRef.current?.clearRegions()}
              onRenameRegion={(id, name) => mapRef.current?.renameRegion(id, name)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default function MapPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <MapPageContent />
      </Suspense>
    </RequireAuth>
  )
}
