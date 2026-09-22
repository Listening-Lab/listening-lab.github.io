import { useEffect, useState } from 'react'
import { getTrainingRun, type TrainingRun } from '@/lib/apiClient'

const POLL_INTERVAL_MS = 3000

/** Polls a training run until it reaches a terminal state. Same shape as useJobPolling,
 *  duplicated rather than shared since TrainingRun has a richer terminal payload
 *  (labelCoverage, error) than the generic Job type that hook is tied to. */
export function useTrainingRunPolling(projectId: string, trainingRunId: string | null) {
  const [run, setRun] = useState<TrainingRun | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!trainingRunId) { setRun(null); setError(null); return }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function poll() {
      try {
        const result = await getTrainingRun(projectId, trainingRunId as string)
        if (cancelled) return
        setRun(result)
        if (result.status === 'pending' || result.status === 'running') {
          timer = setTimeout(poll, POLL_INTERVAL_MS)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to check training run status')
      }
    }
    poll()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [projectId, trainingRunId])

  return { run, error }
}
