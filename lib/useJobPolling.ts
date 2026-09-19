import { useEffect, useState } from 'react'
import { getJob, type Job } from '@/lib/apiClient'

const POLL_INTERVAL_MS = 3000

/** Polls a processing job until it reaches a terminal state. Processing is always async. */
export function useJobPolling(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setError(null)
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      try {
        const result = await getJob(jobId as string)
        if (cancelled) return
        setJob(result)
        if (result.status === 'pending' || result.status === 'processing') {
          timer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to check job status')
      }
    }

    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [jobId])

  return { job, error }
}
