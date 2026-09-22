'use client'

/**
 * Generic confirm/cancel modal for a destructive action — same shape as the one already
 * used for asset deletion (app/projects/files/detail/page.tsx), pulled out here so
 * models/training-runs (and anything else later) don't each grow their own copy.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  busyLabel = 'Deleting…',
  busy,
  onCancel,
  onConfirm,
}: {
  title: string
  message: React.ReactNode
  confirmLabel?: string
  busyLabel?: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={busy ? undefined : onCancel} />
      <div className="relative w-full max-w-sm bg-[#0a1628] border border-white/20 rounded-2xl shadow-2xl p-6 text-white z-10">
        <h3 className="font-serif text-xl mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="flex-1 bg-white/10 text-white border border-white/20 px-4 py-2.5 rounded-full text-sm font-medium hover:bg-white/20 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 bg-red-500 text-white px-4 py-2.5 rounded-full text-sm font-medium hover:bg-red-400 transition-colors disabled:opacity-60"
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
