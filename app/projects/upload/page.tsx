'use client'

import { useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import { uploadRecording } from '@/lib/apiClient'
import { useJobPolling } from '@/lib/useJobPolling'

type Stage = 'idle' | 'uploading' | 'polling' | 'error'

function UploadForm() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [file, setFile] = useState<File | null>(null)
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [recordedAt, setRecordedAt] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [error, setError] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { job, error: pollError } = useJobPolling(jobId)

  if (!projectId) {
    return (
      <p className="text-red-500 text-sm">
        No project selected. Go back to{' '}
        <Link href="/projects" className="underline">your projects</Link> and choose one to upload to.
      </p>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) return
    setError(null)
    setStage('uploading')
    try {
      const id = await uploadRecording(projectId as string, file, {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
        recordedAt: new Date(recordedAt).toISOString(),
      })
      setJobId(id)
      setStage('polling')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setStage('error')
    }
  }

  function reset() {
    setFile(null)
    setLat('')
    setLon('')
    setRecordedAt('')
    setJobId(null)
    setStage('idle')
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const busy = stage === 'uploading' || stage === 'polling'

  return (
    <>
      {stage !== 'polling' || !jobId ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="file" className="block text-sm font-medium text-gray-300 mb-2">Audio file</label>
            <input
              ref={fileInputRef}
              id="file" type="file" accept="audio/*" required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="lat" className="block text-sm font-medium text-gray-300 mb-2">Latitude</label>
              <input
                id="lat" type="number" step="any" required
                value={lat} onChange={(e) => setLat(e.target.value)} placeholder="-41.2000"
                className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label htmlFor="lon" className="block text-sm font-medium text-gray-300 mb-2">Longitude</label>
              <input
                id="lon" type="number" step="any" required
                value={lon} onChange={(e) => setLon(e.target.value)} placeholder="172.5000"
                className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="recordedAt" className="block text-sm font-medium text-gray-300 mb-2">Recording time</label>
            <input
              id="recordedAt" type="datetime-local" required
              value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)}
              className="w-full bg-white/5 border border-white/15 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={!file || busy}
            className="w-full bg-white text-ocean-dark px-8 py-3 rounded-full font-medium hover:bg-brand-50 transition-colors disabled:opacity-60"
          >
            {stage === 'uploading' ? 'Uploading…' : 'Upload Recording'}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="bg-white/5 border border-white/10 rounded-lg px-5 py-4">
            <p className="text-white font-medium mb-1">
              {job?.status === 'complete' && 'Processing complete'}
              {job?.status === 'failed' && 'Processing failed'}
              {(job?.status === 'pending' || job?.status === 'processing' || !job) && 'Processing…'}
            </p>
            <p className="text-gray-400 text-sm">
              Job status: <span className="font-mono">{job?.status ?? 'pending'}</span>
            </p>
            {job?.status === 'failed' && job.error && (
              <p className="text-red-500 text-sm mt-2">{job.error}</p>
            )}
            {pollError && <p className="text-red-500 text-sm mt-2">{pollError}</p>}
          </div>

          {(job?.status === 'complete' || job?.status === 'failed' || pollError) && (
            <button
              onClick={reset}
              className="bg-white/10 text-white border border-white/20 px-6 py-2.5 rounded-full text-sm font-medium hover:bg-white/20 transition-colors"
            >
              Upload another
            </button>
          )}
        </div>
      )}
    </>
  )
}

function UploadPageContent() {
  return (
    <div className="min-h-screen bg-ocean-dark px-6 py-24">
      <div className="max-w-lg mx-auto">
        <p className="text-sm text-gray-500 mb-2">
          <Link href="/projects" className="hover:text-white transition-colors">← Your Projects</Link>
        </p>
        <h1 className="font-serif text-4xl text-white mb-2">Upload Recording</h1>
        <p className="text-gray-400 mb-10 text-sm">
          Enter the recording's location and time manually — filename and metadata parsing comes later.
        </p>
        <UploadForm />
      </div>
    </div>
  )
}

export default function UploadPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <UploadPageContent />
      </Suspense>
    </RequireAuth>
  )
}
