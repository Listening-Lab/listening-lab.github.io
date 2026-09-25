'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listSites,
  createSite,
  updateSite,
  deleteSite,
  listDeployments,
  createDeployment,
  updateDeployment,
  endDeployment,
  deleteDeployment,
  listDevices,
  type Site,
  type Deployment,
  type DeploymentStatus,
  type DevicePlatform,
  type Device,
} from '@/lib/apiClient'
import ConfirmDialog from '@/components/ConfirmDialog'
import SiteAreaEditor, { type AreaPolygon } from '@/components/SiteAreaEditor'

const inputCls =
  'w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60'
const selectCls =
  'w-full bg-[#0d1e35] border border-white/15 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60'
const primaryBtn =
  'bg-white text-ocean-dark px-5 py-2 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60'
const ghostBtn =
  'bg-white/10 text-white border border-white/20 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-60'
const linkBtn = 'text-xs font-medium text-brand-100 hover:text-white transition-colors disabled:opacity-60'

const PLATFORMS: { value: DevicePlatform; label: string }[] = [
  { value: 'vegetation', label: 'Vegetation (tree, shrub)' },
  { value: 'structure', label: 'Structure (post, pole)' },
  { value: 'building', label: 'Building' },
  { value: 'buoy', label: 'Buoy' },
  { value: 'unattached', label: 'Unattached (on the ground)' },
]

const STATUS_STYLES: Record<DeploymentStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  ended: 'bg-gray-500/15 text-gray-300 border-gray-400/30',
  retrieved: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
}

function pointOf(site: Site): { lat: number; lon: number } | null {
  const c = site.geometry.coordinates
  if (site.geometry.type === 'Point' && Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
    return { lon: c[0], lat: c[1] }
  }
  return null
}

function toLocalInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

function Modal({ title, onClose, busy, wide, children }: { title: string; onClose: () => void; busy?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className={`relative w-full ${wide ? "max-w-4xl" : "max-w-md"} max-h-[90vh] overflow-y-auto bg-[#0a1628] border border-white/20 rounded-2xl shadow-2xl p-6 text-white z-10`}>
        <h3 className="font-serif text-xl mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-gray-400 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-500 mt-1">{hint}</span>}
    </label>
  )
}

// ---------------------------------------------------------------------------- site form

function polygonOf(site: Site | null): AreaPolygon | null {
  return site?.geometry.type === 'Polygon' ? (site.geometry as unknown as AreaPolygon) : null
}

function SiteFormModal({
  projectId,
  site,
  otherSites,
  deploymentPoints,
  onClose,
  onSaved,
}: {
  projectId: string
  site: Site | null
  otherSites: Site[]
  deploymentPoints: { lat: number; lon: number }[]
  onClose: () => void
  onSaved: () => void
}) {
  const existingPoint = site ? pointOf(site) : null
  // A multi-part area (only possible via the API) can't be redrawn here - name/description only.
  const locked = site !== null && !existingPoint && site.geometry.type !== 'Polygon'
  // A new site made here is a single point (areas are drawn on the project map); editing keeps the site's own shape.
  const [shape, setShape] = useState<'area' | 'point'>(site ? (existingPoint ? 'point' : 'area') : 'point')
  const [polygon, setPolygon] = useState<AreaPolygon | null>(polygonOf(site))
  const [name, setName] = useState(site?.name ?? '')
  const [lat, setLat] = useState(existingPoint ? String(existingPoint.lat) : '')
  const [lon, setLon] = useState(existingPoint ? String(existingPoint.lon) : '')
  const [description, setDescription] = useState(site?.description ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latNum = parseFloat(lat)
  const lonNum = parseFloat(lon)
  const pointOk = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90 && Number.isFinite(lonNum) && lonNum >= -180 && lonNum <= 180
  const geometryOk = locked || (shape === 'area' ? polygon !== null : pointOk)

  const otherAreas = useMemo(
    () => otherSites.filter((o) => o.id !== site?.id).map(polygonOf).filter((g): g is AreaPolygon => g !== null),
    [otherSites, site]
  )

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const geometry = shape === 'area' ? polygon : { type: 'Point', coordinates: [lonNum, latNum] }
      if (site) {
        await updateSite(projectId, site.id, {
          name: name.trim(),
          description: description.trim() || null,
          ...(locked || !geometry ? {} : { geometry }),
        })
      } else if (geometry) {
        await createSite(projectId, { name: name.trim(), geometry, description: description.trim() || null })
      }
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Failed to save site'))
      setSaving(false)
    }
  }

  return (
    <Modal title={site ? 'Edit site' : 'Add site'} onClose={onClose} busy={saving} wide>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Ōtira valley" />
        </Field>
        {locked ? (
          <p className="text-xs text-gray-400">This site&apos;s outline has several parts, so it can&apos;t be redrawn here.</p>
        ) : (
          <>
            <div className="flex gap-2 text-xs">
              {(['area', 'point'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setShape(option)}
                  className={`px-3 py-1.5 rounded-full border transition-colors ${shape === option ? 'bg-white text-ocean-dark border-white' : 'bg-white/5 text-gray-300 border-white/15 hover:bg-white/10'}`}
                >
                  {option === 'area' ? 'Area (draw on map)' : 'Single point'}
                </button>
              ))}
            </div>
            {shape === 'area' ? (
              <SiteAreaEditor value={polygon} onChange={setPolygon} otherAreas={otherAreas} deploymentPoints={deploymentPoints} />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude">
                  <input className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="-42.88" />
                </Field>
                <Field label="Longitude">
                  <input className={inputCls} value={lon} onChange={(e) => setLon(e.target.value)} inputMode="decimal" placeholder="171.57" />
                </Field>
              </div>
            )}
          </>
        )}
        <Field label="Description (optional)">
          <textarea className={inputCls} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className={`${ghostBtn} flex-1`}>Cancel</button>
          <button type="submit" disabled={saving || !name.trim() || !geometryOk} className={`${primaryBtn} flex-1`}>
            {saving ? 'Saving…' : site ? 'Save' : 'Add site'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------- deployment form

const MODALITIES = [
  { value: 'audio', label: 'Audio recording' },
  { value: 'image', label: 'Images' },
  { value: 'manual', label: 'Manual survey' },
]

function DeploymentFormModal({
  projectId,
  site,
  sites,
  deployment,
  devices,
  onClose,
  onSaved,
}: {
  projectId: string
  /** The site this was opened from, if any (pre-selects it and seeds the location). */
  site: Site | null
  sites: Site[]
  deployment: Deployment | null
  devices: Device[]
  onClose: () => void
  onSaved: () => void
}) {
  const sitePoint = site ? pointOf(site) : null
  const [siteId, setSiteId] = useState(deployment ? deployment.siteId ?? '' : site?.id ?? '')
  const [deviceId, setDeviceId] = useState(deployment?.deviceId ?? '')
  const [modality, setModality] = useState(deployment?.modality ?? 'audio')
  const [start, setStart] = useState(toLocalInput(deployment?.deploymentStart))
  const [lat, setLat] = useState(String(deployment?.lat ?? sitePoint?.lat ?? ''))
  const [lon, setLon] = useState(String(deployment?.lon ?? sitePoint?.lon ?? ''))
  const [platform, setPlatform] = useState<DevicePlatform | ''>(deployment?.devicePlatform ?? '')
  const [height, setHeight] = useState(deployment?.deviceHeightM != null ? String(deployment.deviceHeightM) : '')
  const [schedule, setSchedule] = useState(deployment?.recordingSchedule ?? '')
  const [locationType, setLocationType] = useState(deployment?.locationType ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const latNum = parseFloat(lat)
  const lonNum = parseFloat(lon)
  const coordsOk = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90 && Number.isFinite(lonNum) && lonNum >= -180 && lonNum <= 180
  const heightNum = height.trim() === '' ? null : parseFloat(height)
  const heightOk = heightNum === null || Number.isFinite(heightNum)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const shared = {
      lat: latNum,
      lon: lonNum,
      deploymentStart: new Date(start).toISOString(),
      devicePlatform: platform || null,
      deviceHeightM: heightNum,
      recordingSchedule: schedule.trim() || null,
      locationType: locationType.trim() || null,
    }
    try {
      if (deployment) {
        await updateDeployment(projectId, deployment.id, { ...shared, siteId: siteId || null })
      } else {
        await createDeployment(projectId, {
          siteId: siteId || undefined,
          deviceId: deviceId || null,
          ...(deviceId ? {} : { modality }),
          ...shared,
        })
      }
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Failed to save deployment'))
      setSaving(false)
    }
  }

  const deviceName = devices.find((d) => d.id === deployment?.deviceId)?.name

  return (
    <Modal title={deployment ? 'Edit deployment' : 'New deployment'} onClose={onClose} busy={saving}>
      <form onSubmit={submit} className="space-y-3">
        {deployment ? (
          <p className="text-sm text-gray-300">
            {deviceName ? `Device: ${deviceName}` : deployment.deviceId ? 'Device: (deleted)' : 'No device (manual survey)'}
          </p>
        ) : (
          <>
            <Field label="Device" hint="Leave empty for a manual survey visit with no instrument.">
              <select className={selectCls} value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                <option value="">No device</option>
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>
            {!deviceId && (
              <Field label="What was collected">
                <select className={selectCls} value={modality} onChange={(e) => setModality(e.target.value)}>
                  {MODALITIES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </Field>
            )}
          </>
        )}
        <Field
          label="Site"
          hint={deployment ? undefined : 'Leave on automatic and it joins the site area that contains its location, if there is one.'}
        >
          <select className={selectCls} value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">{deployment ? 'Not in a site' : 'Automatic'}</option>
            {sites.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Started">
          <input type="datetime-local" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude">
            <input className={inputCls} value={lat} onChange={(e) => setLat(e.target.value)} required inputMode="decimal" />
          </Field>
          <Field label="Longitude">
            <input className={inputCls} value={lon} onChange={(e) => setLon(e.target.value)} required inputMode="decimal" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Mounted on">
            <select className={selectCls} value={platform} onChange={(e) => setPlatform(e.target.value as DevicePlatform | '')}>
              <option value="">Not recorded</option>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Height (m)" hint="Negative if underground.">
            <input className={inputCls} value={height} onChange={(e) => setHeight(e.target.value)} inputMode="decimal" placeholder="1.5" />
          </Field>
        </div>
        <Field label="Recording schedule (optional)">
          <input className={inputCls} value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="continuous 9PM–6AM local" />
        </Field>
        <Field label="Location type (optional)">
          <input className={inputCls} value={locationType} onChange={(e) => setLocationType(e.target.value)} placeholder="trail, waterSource, burrow…" />
        </Field>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className={`${ghostBtn} flex-1`}>Cancel</button>
          <button type="submit" disabled={saving || !start || !coordsOk || !heightOk} className={`${primaryBtn} flex-1`}>
            {saving ? 'Saving…' : deployment ? 'Save' : 'Start deployment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function EndDeploymentModal({
  projectId,
  deployment,
  onClose,
  onSaved,
}: {
  projectId: string
  deployment: Deployment
  onClose: () => void
  onSaved: () => void
}) {
  const [endedAt, setEndedAt] = useState(toLocalInput())
  const [status, setStatus] = useState<'ended' | 'retrieved'>('ended')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await endDeployment(projectId, deployment.id, { endedAt: new Date(endedAt).toISOString(), status })
      onSaved()
    } catch (err) {
      setError(errMsg(err, 'Failed to end deployment'))
      setSaving(false)
    }
  }

  return (
    <Modal title="End deployment" onClose={onClose} busy={saving}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Ended">
          <input type="datetime-local" className={inputCls} value={endedAt} onChange={(e) => setEndedAt(e.target.value)} required />
        </Field>
        <Field label="What happened to the device">
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as 'ended' | 'retrieved')}>
            <option value="ended">Stopped recording (still in the field)</option>
            <option value="retrieved">Retrieved (collected)</option>
          </select>
        </Field>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={saving} className={`${ghostBtn} flex-1`}>Cancel</button>
          <button type="submit" disabled={saving || !endedAt} className={`${primaryBtn} flex-1`}>
            {saving ? 'Ending…' : 'End deployment'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ------------------------------------------------------------------------------- main

type ModalState =
  | null
  | { kind: 'site'; site: Site | null }
  | { kind: 'deployment'; site: Site | null; deployment: Deployment | null }
  | { kind: 'end'; deployment: Deployment }
  | { kind: 'delete-site'; site: Site }
  | { kind: 'delete-deployment'; deployment: Deployment }

/**
 * Sites (named places) and the deployments (device placements, with start/end) at each.
 * Uploading a file to a new location creates a site and deployment automatically; this is
 * where they're named, corrected, ended and tidied up.
 */
export default function SiteManager({ projectId, isAdmin }: { projectId: string; isAdmin: boolean }) {
  const [sites, setSites] = useState<Site[] | null>(null)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalState>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [s, d, dev] = await Promise.all([listSites(projectId), listDeployments(projectId), listDevices(projectId)])
      setSites(s)
      setDeployments(d)
      setDevices(dev)
      setError(null)
    } catch (err) {
      setError(errMsg(err, 'Failed to load sites'))
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  const bySite = useMemo(() => {
    const map = new Map<string, Deployment[]>()
    for (const d of deployments) if (d.siteId) map.set(d.siteId, [...(map.get(d.siteId) ?? []), d])
    return map
  }, [deployments])
  const unsited = useMemo(() => deployments.filter((d) => !d.siteId), [deployments])
  const deviceName = (id: string | null) => (id ? devices.find((d) => d.id === id)?.name ?? 'Deleted device' : 'Manual survey')

  function closeModal() {
    setModal(null)
    setDeleteError(null)
  }

  async function saved() {
    closeModal()
    await load()
  }

  async function confirmDelete() {
    if (!modal || (modal.kind !== 'delete-site' && modal.kind !== 'delete-deployment')) return
    setDeleting(true)
    setDeleteError(null)
    try {
      if (modal.kind === 'delete-site') await deleteSite(projectId, modal.site.id)
      else await deleteDeployment(projectId, modal.deployment.id)
      closeModal()
      await load()
    } catch (err) {
      setDeleteError(errMsg(err, 'Delete failed'))
    } finally {
      setDeleting(false)
    }
  }

  const renderDeployment = (d: Deployment, site: Site | null) => (
    <li key={d.id} className="py-2.5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-white truncate">{deviceName(d.deviceId)}</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[d.status]}`}>{d.status}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {fmtDate(d.deploymentStart)} → {d.deploymentEnd ? fmtDate(d.deploymentEnd) : 'ongoing'}
          {` · ${d.lat.toFixed(4)}, ${d.lon.toFixed(4)}`}
          {d.devicePlatform ? ` · ${d.devicePlatform}` : ''}
          {d.deviceHeightM != null ? ` · ${d.deviceHeightM} m` : ''}
          {d.recordingSchedule ? ` · ${d.recordingSchedule}` : ''}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        {d.status === 'active' && (
          <button className={linkBtn} onClick={() => setModal({ kind: 'end', deployment: d })}>End</button>
        )}
        <button className={linkBtn} onClick={() => setModal({ kind: 'deployment', site, deployment: d })}>Edit</button>
        {isAdmin && (
          <button className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors" onClick={() => setModal({ kind: 'delete-deployment', deployment: d })}>
            Delete
          </button>
        )}
      </div>
    </li>
  )

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-6">
        <p className="text-sm text-gray-400 max-w-lg">
          Sites are the areas you monitor. A deployment is a device placed at a point for a period of time, usually
          within a site. Manage sites and deployments here.
        </p>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <a href={`/projects/map?projectId=${encodeURIComponent(projectId)}&drawSite=1`} className={primaryBtn}>
            Add site on map
          </a>
          <button onClick={() => setModal({ kind: 'site', site: null })} className={linkBtn}>
            Or add a single point by coordinates
          </button>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">Could not load sites: {error}</p>}
      {!error && sites === null && <p className="text-gray-400 text-sm">Loading sites…</p>}
      {sites && sites.length === 0 && (
        <p className="text-gray-400 text-sm bg-white/5 border border-white/10 rounded-lg px-5 py-6">
          No sites yet. Use "Add site on map" to draw an area around a place you monitor. Uploaded files get a deployment automatically, and join a site if their location falls inside one.
        </p>
      )}

      <ul className="space-y-4">
        {sites?.map((site) => {
          const point = pointOf(site)
          const list = bySite.get(site.id) ?? []
          return (
            <li key={site.id} className="bg-white/5 border border-white/10 rounded-lg px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-white font-medium truncate">{site.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {point ? `Point · ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}` : 'Area'}
                    {site.description ? ` · ${site.description}` : ''}
                  </p>
                </div>
                <div className="shrink-0 flex items-center gap-3">
                  <button className={linkBtn} onClick={() => setModal({ kind: 'site', site })}>Edit</button>
                  {isAdmin && (
                    <button className="text-xs font-medium text-red-400 hover:text-red-300 transition-colors" onClick={() => setModal({ kind: 'delete-site', site })}>
                      Delete
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 border-t border-white/5 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs uppercase tracking-wide text-gray-500">
                    Deployments ({list.length})
                  </h3>
                  <button className={linkBtn} onClick={() => setModal({ kind: 'deployment', site, deployment: null })}>
                    + New deployment
                  </button>
                </div>
                {list.length === 0 && <p className="text-xs text-gray-500">No deployments at this site yet.</p>}
                <ul className="divide-y divide-white/5">
                  {list.map((d) => renderDeployment(d, site))}
                </ul>
              </div>
            </li>
          )
        })}

        {unsited.length > 0 && (
          <li className="bg-white/5 border border-white/10 rounded-lg px-5 py-4">
            <h2 className="text-white font-medium">Not in a site</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Deployments whose location isn&apos;t inside any site area. Draw a site around them, or open one and choose a site.
            </p>
            <ul className="divide-y divide-white/5 mt-3 border-t border-white/5">
              {unsited.map((d) => renderDeployment(d, null))}
            </ul>
          </li>
        )}
      </ul>

      <div className="mt-4">
        <button className={linkBtn} onClick={() => setModal({ kind: 'deployment', site: null, deployment: null })}>
          + New deployment
        </button>
      </div>

      {modal?.kind === 'site' && (
        <SiteFormModal
          projectId={projectId}
          site={modal.site}
          otherSites={sites ?? []}
          deploymentPoints={deployments.map((d) => ({ lat: d.lat, lon: d.lon }))}
          onClose={closeModal}
          onSaved={saved}
        />
      )}
      {modal?.kind === 'deployment' && (
        <DeploymentFormModal
          projectId={projectId}
          site={modal.site}
          sites={sites ?? []}
          deployment={modal.deployment}
          devices={devices}
          onClose={closeModal}
          onSaved={saved}
        />
      )}
      {modal?.kind === 'end' && (
        <EndDeploymentModal projectId={projectId} deployment={modal.deployment} onClose={closeModal} onSaved={saved} />
      )}
      {(modal?.kind === 'delete-site' || modal?.kind === 'delete-deployment') && (
        <ConfirmDialog
          title={modal.kind === 'delete-site' ? 'Delete this site?' : 'Delete this deployment?'}
          message={
            <>
              {modal.kind === 'delete-site'
                ? `"${modal.site.name}" will be removed. A site that still has deployments can't be deleted.`
                : 'A deployment that still has files can\'t be deleted - delete or move those files first.'}
              {deleteError && <span className="block text-red-400 mt-2">{deleteError}</span>}
            </>
          }
          busy={deleting}
          onCancel={closeModal}
          onConfirm={confirmDelete}
        />
      )}
    </>
  )
}
