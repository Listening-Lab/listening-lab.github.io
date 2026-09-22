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
        setError(null) // a later successful poll clears an earlier transient failure
        if (result.status === 'pending' || result.status === 'processing') {
          timer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to check job status')
        // Keep retrying - a single dropped request (e.g. a backend hot-reload, or a
        // momentary network blip) must not permanently freeze this job's displayed
        // status. Without this, the row silently stops updating and only a full page
        // reload (which restarts polling fresh) ever shows the real, possibly-already-
        // complete state.
        timer = setTimeout(poll, POLL_INTERVAL_MS)
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
