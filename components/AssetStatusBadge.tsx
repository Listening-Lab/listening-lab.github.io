import type { JobStatus } from '@/lib/apiClient'

const STYLES: Record<JobStatus, string> = {
  pending: 'bg-gray-500/15 text-gray-300 border-gray-500/30',
  processing: 'bg-brand-500/15 text-brand-100 border-brand-500/30 animate-pulse',
  complete: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/15 text-red-300 border-red-500/30',
}

export default function AssetStatusBadge({ status }: { status: JobStatus | null }) {
  if (!status) {
    return (
      <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border bg-white/5 text-gray-400 border-white/10">
        no job
      </span>
    )
  }

  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-medium border capitalize ${STYLES[status]}`}>
      {status}
    </span>
  )
}
