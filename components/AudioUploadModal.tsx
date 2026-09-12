'use client'
import { useState, useRef, useEffect, ChangeEvent, DragEvent } from 'react'
import { classifyAudio, ClassificationResult } from '@/lib/perchClient'

interface AudioUploadModalProps {
  isOpen: boolean
  onClose: () => void
  defaultLat?: number
  defaultLon?: number
  referenceCentroids?: Map<string, [number, number, number]>
  onClassified: (result: ClassificationResult) => void
}

export default function AudioUploadModal({
  isOpen,
  onClose,
  defaultLat = -41.2,
  defaultLon = 172.5,
  referenceCentroids,
  onClassified,
}: AudioUploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [lat, setLat] = useState<string>(defaultLat.toString())
  const [lon, setLon] = useState<string>(defaultLon.toString())
  const [isDragging, setIsDragging] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisStatus, setAnalysisStatus] = useState('Preparing audio...')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ClassificationResult | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setFile(null)
      setAudioUrl(null)
      setDuration(null)
      setIsAnalyzing(false)
      setError(null)
      setResult(null)
      setLat(defaultLat.toString())
      setLon(defaultLon.toString())
    }
  }, [isOpen, defaultLat, defaultLon])

  if (!isOpen) return null

  const handleFileChange = (selectedFile: File) => {
    setError(null)
    setResult(null)
    if (!selectedFile.type.startsWith('audio/') && !selectedFile.name.match(/\.(wav|mp3|flac|ogg|m4a)$/i)) {
      setError('Please upload a valid audio file (.wav, .mp3, .flac, .ogg, .m4a)')
      return
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    const url = URL.createObjectURL(selectedFile)
    setFile(selectedFile)
    setAudioUrl(url)
  }

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) handleFileChange(selected)
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const onDragLeave = () => {
    setIsDragging(false)
  }

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) handleFileChange(dropped)
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  const handleRunClassification = async () => {
    if (!file) return
    setIsAnalyzing(true)
    setError(null)
    setAnalysisStatus('Sending recording to local Perch v2 server (localhost:8000)...')

    const statusTimer1 = setTimeout(() => {
      setAnalysisStatus('Computing bioacoustic embeddings via Perch v2...')
    }, 1000)

    const statusTimer2 = setTimeout(() => {
      setAnalysisStatus('Evaluating species logits & scores...')
    }, 2000)

    try {
      const parsedLat = parseFloat(lat) || defaultLat
      const parsedLon = parseFloat(lon) || defaultLon

      const res = await classifyAudio(file, {
        lat: parsedLat,
        lon: parsedLon,
        referenceCentroids,
      })
      clearTimeout(statusTimer1)
      clearTimeout(statusTimer2)
      setResult(res)
    } catch (err: any) {
      clearTimeout(statusTimer1)
      clearTimeout(statusTimer2)
      setError(err.message || 'Classification failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAddToMap = () => {
    if (result) {
      onClassified(result)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl bg-[#0a1628]/95 border border-white/20 rounded-3xl shadow-2xl p-6 sm:p-8 text-white z-10 max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
          title="Close dialog"
        >
          ✕
        </button>

        {/* Title */}
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-widest text-[#4ecdc4] mb-1">
            Bioacoustic Analysis · Perch v2
          </p>
          <h3 className="font-serif text-2xl sm:text-3xl text-white">
            Upload & Classify Soundscape
          </h3>
          <p className="text-gray-400 text-xs sm:text-sm mt-1">
            Analyze field recordings with the local Perch v2 sidecar and map their geographic and acoustic space.
          </p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-200 text-xs sm:text-sm">
            <p className="font-semibold text-red-300 mb-1">Inference Notice</p>
            <p className="leading-relaxed">{error}</p>
          </div>
        )}

        {/* ── STEP 1: Upload Zone (when no result yet) ── */}
        {!result && (
          <div className="space-y-5">
            {/* Drag & Drop Area */}
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#4ecdc4] bg-[#4ecdc4]/10'
                  : 'border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/[0.08]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
                className="hidden"
                onChange={onFileInputChange}
              />
              <div className="w-12 h-12 rounded-full bg-[#4ecdc4]/15 border border-[#4ecdc4]/30 flex items-center justify-center mx-auto mb-3 text-[#4ecdc4]">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-white mb-1">
                {file ? file.name : 'Click to select or drag audio here'}
              </p>
              <p className="text-xs text-gray-400">
                Supports WAV, MP3, FLAC, OGG, M4A up to 60s
              </p>
            </div>

            {/* Selected File Details & Preview */}
            {file && audioUrl && (
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-300">
                  <span className="truncate max-w-[240px] font-medium text-white">{file.name}</span>
                  <span>{formatFileSize(file.size)} {duration ? `· ${formatDuration(duration)}` : ''}</span>
                </div>
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  className="w-full h-9 rounded-lg"
                  onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                />
              </div>
            )}

            {/* Coordinates Input (Lat / Lon) */}
            <div className="space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
                Geographic Coordinates (Aotearoa NZ)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[11px] text-gray-400 mb-1">Latitude</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="-41.2000"
                    className="w-full bg-[#0d1e35] border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#4ecdc4] transition-colors"
                  />
                </div>
                <div>
                  <span className="block text-[11px] text-gray-400 mb-1">Longitude</span>
                  <input
                    type="number"
                    step="0.0001"
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    placeholder="172.5000"
                    className="w-full bg-[#0d1e35] border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-[#4ecdc4] transition-colors"
                  />
                </div>
              </div>
              <p className="text-[11px] text-gray-400">
                Pre-populated with central New Zealand coordinates. Adjust to locate recording on map.
              </p>
            </div>

            {/* Analyze Button */}
            <button
              onClick={handleRunClassification}
              disabled={!file || isAnalyzing}
              className={`w-full py-3.5 rounded-full font-medium text-sm transition-all flex items-center justify-center gap-2 ${
                !file || isAnalyzing
                  ? 'bg-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-[#4ecdc4] text-[#0a1628] hover:bg-[#3dbdb4] shadow-lg shadow-[#4ecdc4]/20'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-[#0a1628]" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  <span>{analysisStatus}</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span>Classify with Perch v2</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ── STEP 2: Results Display ── */}
        {result && (
          <div className="space-y-6">
            {/* Primary Match Card */}
            <div className="p-5 rounded-2xl bg-[#4ecdc4]/10 border border-[#4ecdc4]/40">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] tracking-widest uppercase font-semibold text-[#4ecdc4] px-2 py-0.5 rounded-full bg-[#4ecdc4]/20">
                      Primary Prediction
                    </span>
                    <span className="text-[10px] tracking-widest uppercase font-medium text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                      eDNA NZ Avifauna
                    </span>
                  </div>
                  <h4 className="text-xl sm:text-2xl font-serif text-white mt-1">
                    {result.commonName}
                  </h4>
                  <p className="text-sm italic text-gray-300">
                    {result.genus} {result.species}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-mono font-bold text-[#4ecdc4]">
                    {result.confidence.toFixed(3)}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-gray-400">
                    Perch Score
                  </span>
                </div>
              </div>

              {/* Score meter bar */}
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mb-3">
                <div
                  className="bg-gradient-to-r from-[#4ecdc4] to-[#74b9ff] h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(5, result.confidence * 100))}%` }}
                />
              </div>

              {/* Audio playback in results */}
              <audio src={result.audioBlobUrl} controls className="w-full h-8 mt-2 rounded" />
            </div>

            {/* Other Candidate Predictions */}
            {result.topPredictions.length > 1 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                  Other Detected Candidates
                </p>
                <div className="space-y-1.5">
                  {result.topPredictions.slice(1, 5).map((pred, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs"
                    >
                      <div>
                        <span className="text-white font-medium">{pred.commonName}</span>
                        {pred.genus !== 'Unknown' && (
                          <span className="text-gray-400 italic ml-2">
                            ({pred.genus} {pred.species})
                          </span>
                        )}
                      </div>
                      <span className="text-gray-300 font-mono">
                        Score: {pred.confidence.toFixed(3)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coordinates & Acoustic Info */}
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Location:</span>
                <span className="font-mono text-white/70">
                  {result.lat.toFixed(4)}°, {result.lon.toFixed(4)}°
                </span>
              </div>
              <div className="flex justify-between">
                <span>Acoustic 3D Coordinates:</span>
                <span className="font-mono text-white/70">
                  [{result.umapCoords.map((c) => c.toFixed(2)).join(', ')}]
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={handleAddToMap}
                className="flex-1 py-3 px-6 rounded-full font-medium text-sm bg-[#4ecdc4] text-[#0a1628] hover:bg-[#3dbdb4] transition-colors shadow-lg shadow-[#4ecdc4]/20 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add & Focus on Acoustic Map</span>
              </button>
              <button
                onClick={() => setResult(null)}
                className="py-3 px-5 rounded-full font-medium text-sm bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                Upload Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
