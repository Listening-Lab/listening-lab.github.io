'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchWavWindow } from '@/lib/wavRangeFetch'
import { getSharedAudioContext } from '@/lib/sharedAudioContext'

const FFT_SIZE = 1024
const HOP_SIZE = 512

// In-place iterative radix-2 Cooley-Tukey FFT (re/im, length must be a power of 2). No
// external dependency for something this contained — this is the one piece of real
// signal-processing code in the app, everything else here is just calling it.
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr
      const ti = im[i]; im[i] = im[j]; im[j] = ti
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len
    const wr = Math.cos(ang)
    const wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cwr = 1
      let cwi = 0
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j]
        const ui = im[i + j]
        const vr = re[i + j + len / 2] * cwr - im[i + j + len / 2] * cwi
        const vi = re[i + j + len / 2] * cwi + im[i + j + len / 2] * cwr
        re[i + j] = ur + vr
        im[i + j] = ui + vi
        re[i + j + len / 2] = ur - vr
        im[i + j + len / 2] = ui - vi
        const ncwr = cwr * wr - cwi * wi
        const ncwi = cwr * wi + cwi * wr
        cwr = ncwr
        cwi = ncwi
      }
    }
  }
}

/** Magnitude-spectrogram frames (Hann-windowed, 50% overlap) over a slice of samples. */
function computeSpectrogram(samples: Float32Array): Float32Array[] {
  const window = new Float64Array(FFT_SIZE)
  for (let i = 0; i < FFT_SIZE; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT_SIZE - 1))
  }
  const numFrames = Math.max(1, Math.floor((samples.length - FFT_SIZE) / HOP_SIZE) + 1)
  const frames: Float32Array[] = []
  const re = new Float64Array(FFT_SIZE)
  const im = new Float64Array(FFT_SIZE)
  for (let f = 0; f < numFrames; f++) {
    const start = f * HOP_SIZE
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = start + i
      re[i] = (idx < samples.length ? samples[idx] : 0) * window[i]
      im[i] = 0
    }
    fft(re, im)
    const mags = new Float32Array(FFT_SIZE / 2)
    for (let i = 0; i < FFT_SIZE / 2; i++) mags[i] = Math.hypot(re[i], im[i])
    frames.push(mags)
  }
  return frames
}

// ocean-dark -> brand teal -> white, matching the app's palette instead of a generic
// scientific colormap (viridis etc.) that would look visually inconsistent here.
function colorFor(t: number): [number, number, number] {
  const stops: [number, number, number][] = [
    [10, 22, 40], // ocean-dark
    [78, 205, 196], // teal accent
    [255, 255, 255],
  ]
  const scaled = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(scaled))
  const frac = scaled - i
  const [r1, g1, b1] = stops[i]
  const [r2, g2, b2] = stops[i + 1]
  return [r1 + (r2 - r1) * frac, g1 + (g2 - g1) * frac, b1 + (b2 - b1) * frac]
}

function renderToCanvas(canvas: HTMLCanvasElement, samples: Float32Array) {
  const frames = computeSpectrogram(samples)
  const maxBin = FFT_SIZE / 2

  let maxDb = -Infinity
  let minDb = Infinity
  const dbFrames = frames.map((mags) => {
    const db = new Float32Array(maxBin)
    for (let i = 0; i < maxBin; i++) {
      db[i] = 20 * Math.log10(mags[i] + 1e-6)
      if (db[i] > maxDb) maxDb = db[i]
      if (db[i] < minDb) minDb = db[i]
    }
    return db
  })
  const range = Math.max(1e-6, maxDb - minDb)

  canvas.width = frames.length
  canvas.height = maxBin
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const imageData = ctx.createImageData(canvas.width, canvas.height)
  for (let x = 0; x < dbFrames.length; x++) {
    const db = dbFrames[x]
    for (let y = 0; y < maxBin; y++) {
      const t = (db[y] - minDb) / range
      const [r, g, b] = colorFor(t)
      // Flip vertically so low frequencies sit at the bottom, matching every
      // conventional spectrogram reading orientation.
      const py = maxBin - 1 - y
      const p = (py * canvas.width + x) * 4
      imageData.data[p] = r
      imageData.data[p + 1] = g
      imageData.data[p + 2] = b
      imageData.data[p + 3] = 255
    }
  }
  ctx.putImageData(imageData, 0, 0)
}

export default function Spectrogram({
  downloadUrl,
  contentType,
  offsetSeconds,
  windowSeconds,
  fallbackAudioBuffer,
}: {
  downloadUrl: string | null
  /** Only `audio/wav` gets the fast Range-request path — see lib/wavRangeFetch.ts. */
  contentType: string | undefined
  offsetSeconds: number
  windowSeconds: number
  /** Whole-file decode, shared across an asset's segments — used for non-WAV formats
   * (compressed audio can't be sliced by byte range) or if the fast path fails. */
  fallbackAudioBuffer: AudioBuffer | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !downloadUrl) return
    let cancelled = false
    setError(false)
    setReady(false)

    async function render() {
      try {
        let samples: Float32Array
        if (contentType === 'audio/wav' || contentType === 'audio/x-wav') {
          const buffer = await fetchWavWindow(getSharedAudioContext(), downloadUrl!, offsetSeconds, windowSeconds)
          if (cancelled) return
          samples = buffer.getChannelData(0)
        } else {
          if (!fallbackAudioBuffer) return // wait for the parent's full decode to finish
          const sr = fallbackAudioBuffer.sampleRate
          const channel = fallbackAudioBuffer.getChannelData(0)
          const start = Math.max(0, Math.floor(offsetSeconds * sr))
          const end = Math.min(channel.length, Math.floor((offsetSeconds + windowSeconds) * sr))
          samples = channel.subarray(start, end)
        }
        if (samples.length < FFT_SIZE) throw new Error('window shorter than one FFT frame')
        if (!cancelled && canvasRef.current) {
          renderToCanvas(canvasRef.current, samples)
          setReady(true)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    render()
    return () => { cancelled = true }
  }, [downloadUrl, contentType, offsetSeconds, windowSeconds, fallbackAudioBuffer])

  return (
    <div className="relative w-full h-20 bg-ocean-dark rounded overflow-hidden border border-white/10">
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">Loading…</div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-500">No spectrogram</div>
      )}
      <canvas ref={canvasRef} className="w-full h-full" style={{ imageRendering: 'auto' }} />
    </div>
  )
}
