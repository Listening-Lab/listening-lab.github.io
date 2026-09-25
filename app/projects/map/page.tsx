'use client'

import { Suspense, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import ProjectMap, { type ProjectMapHandle, type ProjectMapRegion } from '@/components/ProjectMap'
import ProjectMapSidebar from '@/components/ProjectMapSidebar'
import MapUploadPanel, { type MapUploadPanelHandle } from '@/components/MapUploadPanel'
import DeviceManager from '@/components/DeviceManager'
import { createSite, updateSite, type Device, type Site } from '@/lib/apiClient'
import SelectedSiteCard from '@/components/SelectedSiteCard'

type SidebarMode = 'overview' | 'upload'

function MapPageContent() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const mapRef = useRef<ProjectMapHandle>(null)
  const uploadPanelRef = useRef<MapUploadPanelHandle>(null)
  const [regions, setRegions] = useState<ProjectMapRegion[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [editingArea, setEditingArea] = useState(false)
  // Arriving with ?drawSite=1 (from the Sites page's "Add site") starts drawing straight away.
  const autoDrawSite = searchParams.get('drawSite') === '1'
  const autoDrawStarted = useRef(false)
  // A site polygon the user just finished drawing, waiting for a name before it's saved.
  const [pendingSite, setPendingSite] = useState<GeoJSON.Polygon | null>(null)
  const [siteName, setSiteName] = useState('')
  const [savingSite, setSavingSite] = useState(false)
  const [siteError, setSiteError] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  // A device marker clicked outside the upload flow opens straight to its edit/delete
  // form via a headless DeviceManager instance (below) rather than duplicating that UI.
  const [managingDeviceId, setManagingDeviceId] = useState<string | null>(null)
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

  async function saveSite(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingSite || !siteName.trim() || !projectId) return
    setSavingSite(true)
    setSiteError(null)
    try {
      await createSite(projectId, { name: siteName.trim(), geometry: pendingSite })
      setPendingSite(null)
      setSiteName('')
      mapRef.current?.refreshSites()
    } catch (err) {
      setSiteError(err instanceof Error ? err.message : 'Failed to save site')
    } finally {
      setSavingSite(false)
    }
  }

  function cancelSite() {
    setPendingSite(null)
    setSiteName('')
    setSiteError(null)
  }

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null

  function closeSiteCard() {
    if (editingArea) {
      mapRef.current?.endSiteEdit()
      setEditingArea(false)
    }
    setSelectedSiteId(null)
  }

  async function saveSiteArea() {
    if (!selectedSite) return
    const geometry = mapRef.current?.getSiteEditGeometry()
    if (!geometry) throw new Error('Nothing to save - the area is missing')
    await updateSite(projectId as string, selectedSite.id, { geometry })
    mapRef.current?.endSiteEdit()
    setEditingArea(false)
    mapRef.current?.refreshSites()
  }

  function handleDeviceClick(device: Device) {
    if (mode === 'upload') {
      uploadPanelRef.current?.selectDevice(device)
    } else {
      setManagingDeviceId(device.id)
    }
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
            onReady={() => {
              if (autoDrawSite && !autoDrawStarted.current) {
                autoDrawStarted.current = true
                mapRef.current?.startDrawingSite()
              }
            }}
            onSitesChange={setSites}
            onSiteClick={(site) => {
              if (!editingArea) setSelectedSiteId(site.id)
            }}
            onSiteDrawn={setPendingSite}
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
              sites={sites}
              selectedSiteId={selectedSiteId}
              onSelectSite={(id) => {
                if (!editingArea) setSelectedSiteId(id)
              }}
              siteCard={
                selectedSite && (
                  <SelectedSiteCard
                    key={selectedSite.id}
                    projectId={projectId as string}
                    site={selectedSite}
                    editingArea={editingArea}
                    onEditArea={() => {
                      mapRef.current?.editSiteArea(selectedSite)
                      setEditingArea(true)
                    }}
                    onSaveArea={saveSiteArea}
                    onCancelArea={() => {
                      mapRef.current?.endSiteEdit()
                      setEditingArea(false)
                    }}
                    onClose={closeSiteCard}
                    onChanged={() => mapRef.current?.refreshSites()}
                  />
                )
              }
              isDrawing={isDrawing}
              onDrawSite={() => mapRef.current?.startDrawingSite()}
              onStartDrawing={() => mapRef.current?.startDrawingRegion()}
              onCancelDrawing={() => mapRef.current?.cancelDrawingRegion()}
              onRemoveRegion={(id) => mapRef.current?.removeRegion(id)}
              onClearRegions={() => mapRef.current?.clearRegions()}
              onRenameRegion={(id, name) => mapRef.current?.renameRegion(id, name)}
            />
          )}
        </div>
      </div>

      {pendingSite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={savingSite ? undefined : cancelSite} />
          <form
            onSubmit={saveSite}
            className="relative w-full max-w-sm bg-[#0a1628] border border-white/20 rounded-2xl shadow-2xl p-6 text-white z-10 space-y-4"
          >
            <h3 className="font-serif text-xl">Name this site</h3>
            <input
              autoFocus
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="e.g. Ōtira valley"
              className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            {siteError && <p className="text-red-500 text-sm">{siteError}</p>}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelSite}
                disabled={savingSite}
                className="flex-1 bg-white/10 text-white border border-white/20 px-4 py-2.5 rounded-full text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-60"
              >
                Discard
              </button>
              <button
                type="submit"
                disabled={savingSite || !siteName.trim()}
                className="flex-1 bg-white text-ocean-dark px-4 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60"
              >
                {savingSite ? 'Saving…' : 'Save site'}
              </button>
            </div>
          </form>
        </div>
      )}

      <DeviceManager
        hideSelect
        projectId={projectId}
        selectedDeviceId={null}
        onSelect={() => {}}
        openDeviceId={managingDeviceId}
        onOpenHandled={() => setManagingDeviceId(null)}
        onDevicesChanged={() => mapRef.current?.refreshDevices()}
      />
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
