'use client'

import { useState } from 'react'
import { updateSite, deleteSite, type Site } from '@/lib/apiClient'
import ConfirmDialog from '@/components/ConfirmDialog'

/**
 * The project map's panel for the site the user clicked: rename it, edit its area right on the
 * map, or delete it. Area editing itself happens on the map (drag corners); this just saves it.
 */
export default function SelectedSiteCard({
  projectId,
  site,
  editingArea,
  onEditArea,
  onSaveArea,
  onCancelArea,
  onClose,
  onChanged,
}: {
  projectId: string
  site: Site
  editingArea: boolean
  onEditArea: () => void
  /** Saves the edited outline; resolves when done (rejects with a message on failure). */
  onSaveArea: () => Promise<void>
  onCancelArea: () => void
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState(site.name)
  const [description, setDescription] = useState(site.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dirty = name.trim() !== site.name || (description.trim() || null) !== (site.description ?? null)
  const isArea = site.geometry.type === 'Polygon'

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mb-6 bg-white/5 border border-[#f4c95d]/40 rounded-lg px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-[#f4c95d] font-medium">Selected site</h3>
        <button onClick={onClose} disabled={busy} className="text-xs text-gray-500 hover:text-white transition-colors">
          Close
        </button>
      </div>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        aria-label="Site name"
        className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        placeholder="Description (optional)"
        aria-label="Site description"
        className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />

      {dirty && (
        <button
          disabled={busy || !name.trim()}
          onClick={() =>
            run(async () => {
              await updateSite(projectId, site.id, { name: name.trim(), description: description.trim() || null })
              onChanged()
            })
          }
          className="w-full bg-white text-ocean-dark px-4 py-2 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60 mb-2"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      )}

      {isArea ? (
        editingArea ? (
          <div className="space-y-2">
            <p className="text-[11px] text-gray-400">Drag the corners on the map to reshape the area, then save it.</p>
            <div className="flex gap-2">
              <button onClick={onCancelArea} disabled={busy} className="flex-1 bg-white/10 text-white border border-white/20 px-3 py-2 rounded-full text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-60">
                Cancel
              </button>
              <button onClick={() => run(onSaveArea)} disabled={busy} className="flex-1 bg-white text-ocean-dark px-3 py-2 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60">
                {busy ? 'Saving…' : 'Save area'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={onEditArea} disabled={busy} className="w-full bg-white/10 text-white border border-white/20 px-4 py-2 rounded-full text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-60">
            Edit area on map
          </button>
        )
      ) : (
        <p className="text-[11px] text-gray-500">This site is a single point. Edit its coordinates on the Sites page.</p>
      )}

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

      {!editingArea && (
        <button onClick={() => setConfirmDelete(true)} disabled={busy} className="mt-3 text-xs font-medium text-red-400 hover:text-red-300 transition-colors">
          Delete site
        </button>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this site?"
          message={
            <>
              &quot;{site.name}&quot; will be removed. A site that still has deployments can&apos;t be deleted - move them out first.
              {error && <span className="block text-red-400 mt-2">{error}</span>}
            </>
          }
          busy={busy}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            run(async () => {
              await deleteSite(projectId, site.id)
              setConfirmDelete(false)
              onChanged()
              onClose()
            })
          }
        />
      )}
    </div>
  )
}
