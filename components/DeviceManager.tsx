'use client'

import { useEffect, useState } from 'react'
import { listDevices, createDevice, updateDevice, deleteDevice, type Device } from '@/lib/apiClient'
import ConfirmDialog from '@/components/ConfirmDialog'
import type { FilenameFormat } from '@/lib/filenameParsing'

// Same order as PATTERNS in lib/filenameParsing.ts (most common/specific first) - this is
// just which one gets tried FIRST for this device; every other convention is still tried
// as a fallback regardless (see parseFilename), so picking the "wrong" one here never
// makes auto-fill worse, only skips a wasted first attempt. 'sequence_only' (a bare
// counter with no date at all - Zoom/Tascam/Batlogger raw files) is deliberately excluded
// here since it can never resolve a date on its own; it's still tried internally as the
// last-resort structural match.
const FILENAME_FORMAT_OPTIONS: { value: FilenameFormat | ''; label: string }[] = [
  { value: '', label: 'Auto-detect (tries every known convention)' },
  { value: 'frontier_labs_start_end', label: 'Frontier Labs BAR-LT (start+end, high precision)' },
  { value: 'iso_basic_T', label: 'Frontier Labs BAR / ISO-8601 basic (YYYYMMDDThhmmss)' },
  { value: 'songmeter_sm3', label: 'Wildlife Acoustics SM3' },
  { value: 'swift', label: 'Cornell Swift / SwiftOne' },
  { value: 'frontier_labs_legacy_loc', label: 'Frontier Labs BAR (legacy, with location)' },
  { value: 'datetime_iso6709', label: 'Datetime + ISO 6709 coordinates' },
  { value: 'wa_audiomoth_standard', label: 'AudioMoth / Wildlife Acoustics SM2/SM4/Mini/Micro (most common)' },
  { value: 'dash_datetime', label: 'Generic YYYYMMDD-hhmmss (Ecosounds/A2O, BTO)' },
  { value: 'owlsense', label: 'OwlSense' },
  { value: 'pettersson', label: 'Pettersson D500X/D1000X' },
  { value: 'peersonic', label: 'Peersonic (READ RPA export)' },
  { value: 'iso_extended', label: 'ISO 8601 extended (NoiseNet, scripted exports)' },
  { value: 'soundtrap', label: 'Ocean Instruments SoundTrap' },
  { value: 'upam', label: 'Seiche uPAM' },
  { value: 'compact14', label: 'Compact YYYYMMDDhhmmss' },
  { value: 'audiomoth_hex', label: 'AudioMoth, firmware <1.2.2 (hex unix time)' },
  { value: 'short_year', label: 'Short year yyMMDD_hhmm' },
  { value: 'unix_epoch', label: 'Unix epoch filename' },
]

// 'closed' — nothing open. 'form' — creating (editingDevice null) or editing
// (editingDevice set) one device. 'list' — the manage view (edit/delete existing
// devices). `formOrigin` says which of 'closed'/'list' Cancel should return the form to.
type View = 'closed' | 'form' | 'list'

/**
 * A saved-device picker for the upload flow: pick an existing project device (fills in
 * its lat/lon and filename convention), add a new one, or manage (edit/delete) existing
 * ones. Devices are shared across the project, same as regions/models, so a device saved
 * by one teammate is immediately reselectable by another.
 */
export default function DeviceManager({
  projectId,
  selectedDeviceId,
  onSelect,
  onRequestMapPick,
  onDevicesChanged,
}: {
  projectId: string
  selectedDeviceId: string | null
  onSelect: (device: Device | null) => void
  /** When provided (the map-embedded upload panel passes ProjectMap's
   *  startPickingLocation), the device form shows a "Pick on map" button that arms
   *  the map for one click and fills lat/lon from it, instead of typing coordinates. */
  onRequestMapPick?: (onPicked: (lat: number, lon: number) => void) => void
  /** Fires after any create/update/delete — e.g. so the map's device markers refresh. */
  onDevicesChanged?: () => void
}) {
  const [devices, setDevices] = useState<Device[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<View>('closed')
  const [formOrigin, setFormOrigin] = useState<'closed' | 'list'>('closed')
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [filenameFormat, setFilenameFormat] = useState<FilenameFormat | ''>('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listDevices(projectId)
      .then((d) => { if (!cancelled) setDevices(d) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load devices') })
    return () => { cancelled = true }
  }, [projectId])

  function resetForm() {
    setName('')
    setLat('')
    setLon('')
    setFilenameFormat('')
    setSaveError(null)
  }

  function openCreateForm(origin: 'closed' | 'list') {
    resetForm()
    setEditingDevice(null)
    setFormOrigin(origin)
    setView('form')
  }

  function openEditForm(device: Device) {
    setName(device.name)
    setLat(String(device.lat))
    setLon(String(device.lon))
    setFilenameFormat((device.filenameFormat as FilenameFormat | null) ?? '')
    setSaveError(null)
    setEditingDevice(device)
    setFormOrigin('list')
    setView('form')
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    if (value === '__add__') {
      openCreateForm('closed')
      return
    }
    if (value === '__manage__') {
      setView('list')
      return
    }
    if (value === '') {
      onSelect(null)
      return
    }
    const device = (devices ?? []).find((d) => d.id === value)
    onSelect(device ?? null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsedLat = parseFloat(lat)
    const parsedLon = parseFloat(lon)
    if (!name.trim() || Number.isNaN(parsedLat) || Number.isNaN(parsedLon)) return

    setSaving(true)
    setSaveError(null)
    try {
      if (editingDevice) {
        const updated = await updateDevice(projectId, editingDevice.id, {
          name: name.trim(),
          lat: parsedLat,
          lon: parsedLon,
          filenameFormat: filenameFormat || null,
        })
        setDevices((prev) => (prev ?? []).map((d) => (d.id === updated.id ? updated : d)))
        if (updated.id === selectedDeviceId) onSelect(updated) // refresh the caller's stale copy
        setView('list')
      } else {
        const device = await createDevice(projectId, {
          name: name.trim(),
          lat: parsedLat,
          lon: parsedLon,
          filenameFormat: filenameFormat || null,
        })
        setDevices((prev) => [...(prev ?? []), device])
        onSelect(device)
        setView(formOrigin === 'list' ? 'list' : 'closed')
      }
      onDevicesChanged?.()
      resetForm()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save device')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingDevice) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteDevice(projectId, deletingDevice.id)
      setDevices((prev) => (prev ?? []).filter((d) => d.id !== deletingDevice.id))
      if (deletingDevice.id === selectedDeviceId) onSelect(null)
      onDevicesChanged?.()
      setDeletingDevice(null)
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete device')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <select
        value={selectedDeviceId ?? ''}
        onChange={handleSelectChange}
        style={{ colorScheme: 'dark' }}
        className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <option value="" style={{ backgroundColor: '#0a1628', color: 'white' }}>No device — enter location manually</option>
        {(devices ?? []).map((d) => (
          <option key={d.id} value={d.id} style={{ backgroundColor: '#0a1628', color: 'white' }}>{d.name}</option>
        ))}
        <option value="__add__" style={{ backgroundColor: '#0a1628', color: 'white' }}>+ Add a new device…</option>
        {devices && devices.length > 0 && (
          <option value="__manage__" style={{ backgroundColor: '#0a1628', color: 'white' }}>⚙ Manage devices…</option>
        )}
      </select>
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}

      {view === 'list' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setView('closed')} />
          <div className="relative w-full max-w-sm bg-[#0a1628] border border-white/20 rounded-2xl shadow-2xl p-6 text-white z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl">Manage devices</h3>
              <button onClick={() => setView('closed')} className="text-gray-400 hover:text-white text-sm">✕</button>
            </div>
            <ul className="space-y-2 max-h-80 overflow-y-auto -mx-1 px-1">
              {(devices ?? []).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{d.name}</p>
                    <p className="text-[11px] text-gray-500 font-mono">{d.lat.toFixed(4)}, {d.lon.toFixed(4)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button onClick={() => openEditForm(d)} className="text-xs text-gray-400 hover:text-white transition-colors">Edit</button>
                    <button onClick={() => setDeletingDevice(d)} className="text-xs text-gray-500 hover:text-red-400 transition-colors">Delete</button>
                  </div>
                </li>
              ))}
              {(devices ?? []).length === 0 && <p className="text-sm text-gray-500">No devices saved yet.</p>}
            </ul>
            <button
              onClick={() => openCreateForm('list')}
              className="w-full mt-4 bg-white/10 text-white border border-white/20 px-4 py-2.5 rounded-full text-sm font-medium hover:bg-white/20 transition-colors"
            >
              + Add a new device
            </button>
          </div>
        </div>
      )}

      {deletingDevice && (
        <ConfirmDialog
          title="Delete device?"
          message={
            <>
              This permanently deletes <span className="text-white font-medium">{deletingDevice.name}</span>. Recordings
              already uploaded from it keep their saved location — only the reusable device entry goes away.
              {deleteError && <span className="block text-red-400 mt-2">{deleteError}</span>}
            </>
          }
          busy={deleting}
          onCancel={() => { setDeletingDevice(null); setDeleteError(null) }}
          onConfirm={handleDelete}
        />
      )}

      {view === 'form' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setView(formOrigin)} />
          <form
            onSubmit={handleSubmit}
            className="relative w-full max-w-sm bg-[#0a1628] border border-white/20 rounded-2xl shadow-2xl p-6 text-white z-10 space-y-4"
          >
            <h3 className="font-serif text-xl mb-1">{editingDevice ? 'Edit device' : 'Add device'}</h3>
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Name</label>
              <input
                value={name} onChange={(e) => setName(e.target.value)} required
                placeholder="e.g. AudioMoth #3, Site A"
                className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Latitude</label>
                <input
                  type="number" step="any" value={lat} onChange={(e) => setLat(e.target.value)} required
                  placeholder="-41.2000"
                  className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Longitude</label>
                <input
                  type="number" step="any" value={lon} onChange={(e) => setLon(e.target.value)} required
                  placeholder="172.5000"
                  className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
            {onRequestMapPick && (
              <button
                type="button"
                onClick={() => {
                  setView('closed') // the form's own modal would otherwise sit on top of the map, blocking the click
                  onRequestMapPick((pickedLat, pickedLon) => {
                    setLat(String(pickedLat))
                    setLon(String(pickedLon))
                    setView('form')
                  })
                }}
                className="text-xs text-brand-100 hover:text-white underline -mt-2"
              >
                📍 Pick location on map instead
              </button>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">Filename convention</label>
              <select
                value={filenameFormat}
                onChange={(e) => setFilenameFormat(e.target.value as FilenameFormat | '')}
                style={{ colorScheme: 'dark' }}
                className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                {FILENAME_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value} style={{ backgroundColor: '#0a1628', color: 'white' }}>{opt.label}</option>
                ))}
              </select>
              <p className="text-gray-500 text-[11px] mt-1">Used to auto-fill recording time from this device's filenames.</p>
            </div>

            {saveError && <p className="text-red-500 text-sm">{saveError}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setView(formOrigin)}
                disabled={saving}
                className="flex-1 bg-white/10 text-white border border-white/20 px-4 py-2.5 rounded-full text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-white text-ocean-dark px-4 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : editingDevice ? 'Save changes' : 'Save device'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
