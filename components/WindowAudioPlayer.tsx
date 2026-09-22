'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchWavWindow } from '@/lib/wavRangeFetch'
import { getSharedAudioContext } from '@/lib/sharedAudioContext'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

function PlayIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z" /></svg>
}
function PauseIcon() {
  return <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" /><rect x="9" y="2" width="4" height="12" /></svg>
}

function PlayButton({
  playing,
  loading,
  disabled,
  onClick,
}: {
  playing: boolean
  loading: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-12 h-12 rounded-full bg-white text-ocean-dark flex items-center justify-center hover:bg-brand-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
      aria-label={playing ? 'Pause' : 'Play window'}
    >
      {loading ? <span className="text-xs">…</span> : playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  )
}

/**
 * WAV fast path: decodes just the [offset, offset+window) byte range via Web Audio
 * instead of pointing a native `<audio>` element at the full file. Native `<audio>`
 * turned out to issue *open-ended* Range requests (`bytes=N-`, no end) when seeking -
 * confirmed via a real asset, this pulled ~35MB for a 23.88MB file (the initial
 * metadata probe plus the post-seek buffer-ahead each requested "to the end of the
 * file") even though playback itself correctly paused at the window boundary. At
 * "terabytes of data" scale that's not a rounding error - it's a full-file download per
 * click. AudioBufferSourceNode has no such behavior: the buffer it plays is already
 * exactly the window's audio, nothing more to over-fetch.
 */
function WavWindowPlayer({
  url,
  offsetSeconds,
  windowSeconds,
  onUnsupported,
}: {
  url: string | null
  offsetSeconds: number
  windowSeconds: number
  onUnsupported: () => void
}) {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const sourceRef = useRef<AudioBufferSourceNode | null>(null)
  const bufferCacheRef = useRef<{ key: string; buffer: AudioBuffer } | null>(null)

  function stop() {
    try {
      sourceRef.current?.stop()
    } catch {
      // already stopped/ended - nothing to do
    }
    sourceRef.current = null
    setPlaying(false)
  }

  // A new segment should never keep the previous one's audio going.
  useEffect(() => {
    stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, offsetSeconds, windowSeconds])

  useEffect(() => stop, [])

  async function play() {
    if (!url) return
    // Resume synchronously, before the async fetch below - browsers tie an
    // AudioContext's autoplay permission to a user gesture in the same call stack, and
    // that window can close well before a network fetch (GCS Range requests take
    // 1-3s+ on some networks) resolves.
    const ctx = getSharedAudioContext()
    if (ctx.state === 'suspended') ctx.resume()

    setLoading(true)
    try {
      const cacheKey = `${url}:${offsetSeconds}:${windowSeconds}`
      let buffer = bufferCacheRef.current?.key === cacheKey ? bufferCacheRef.current.buffer : null
      if (!buffer) {
        buffer = await fetchWavWindow(ctx, url, offsetSeconds, windowSeconds)
        bufferCacheRef.current = { key: cacheKey, buffer }
      }
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.onended = () => {
        if (sourceRef.current === source) {
          sourceRef.current = null
          setPlaying(false)
        }
      }
      sourceRef.current = source
      source.start()
      setPlaying(true)
    } catch {
      // Malformed/non-canonical WAV this parser can't handle - degrade to the native
      // <audio> path rather than leaving playback broken for this one asset.
      onUnsupported()
    } finally {
      setLoading(false)
    }
  }

  function handleClick() {
    if (playing) {
      stop()
      return
    }
    play()
  }

  return (
    <div className="flex items-center gap-3">
      <PlayButton playing={playing} loading={loading} disabled={!url} onClick={handleClick} />
      <span className="text-sm text-gray-400 font-mono">
        {formatTime(offsetSeconds)}–{formatTime(offsetSeconds + windowSeconds)}
      </span>
    </div>
  )
}

/**
 * Fallback for formats the Range-fetch path can't handle (compressed audio - mp3 etc. -
 * has no fixed byte-to-time mapping, so an arbitrary slice isn't independently
 * decodable). Plays a bounded [offsetSeconds, offsetSeconds + windowSeconds) slice of
 * the full file via seek-on-play + `timeupdate`-based auto-pause - the native `<audio>`
 * element still fetches more than the window (see WavWindowPlayer's doc comment above),
 * a real remaining gap for compressed formats, deferred rather than solved here.
 */
function NativeWindowPlayer({
  url,
  offsetSeconds,
  windowSeconds,
}: {
  url: string | null
  offsetSeconds: number
  windowSeconds: number
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setPlaying(false)
  }, [url, offsetSeconds, windowSeconds])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTimeUpdate = () => {
      if (audio.currentTime >= offsetSeconds + windowSeconds) {
        audio.pause()
        setPlaying(false)
      }
    }
    audio.addEventListener('timeupdate', onTimeUpdate)
    return () => audio.removeEventListener('timeupdate', onTimeUpdate)
  }, [offsetSeconds, windowSeconds])

  function seekAndPlay() {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = offsetSeconds
    audio.play()
    setPlaying(true)
  }

  function handlePlayClick() {
    const audio = audioRef.current
    if (!audio || !url) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    if (audio.readyState >= 1) {
      seekAndPlay()
    } else {
      setLoading(true)
      const onLoaded = () => {
        setLoading(false)
        seekAndPlay()
      }
      audio.addEventListener('loadedmetadata', onLoaded, { once: true })
    }
  }

  return (
    <div className="flex items-center gap-3">
      {url && <audio ref={audioRef} src={url} preload="metadata" onEnded={() => setPlaying(false)} />}
      <PlayButton playing={playing} loading={loading} disabled={!url} onClick={handlePlayClick} />
      <span className="text-sm text-gray-400 font-mono">
        {formatTime(offsetSeconds)}–{formatTime(offsetSeconds + windowSeconds)}
      </span>
    </div>
  )
}

export default function WindowAudioPlayer({
  url,
  contentType,
  offsetSeconds,
  windowSeconds,
}: {
  url: string | null
  /** Only `audio/wav` gets the Range-fetch fast path - see WavWindowPlayer above. */
  contentType: string | undefined
  offsetSeconds: number
  windowSeconds: number
}) {
  const isWav = contentType === 'audio/wav' || contentType === 'audio/x-wav'
  const [wavUnsupported, setWavUnsupported] = useState(false)

  useEffect(() => {
    setWavUnsupported(false)
  }, [url, contentType])

  if (isWav && !wavUnsupported) {
    return (
      <WavWindowPlayer
        url={url}
        offsetSeconds={offsetSeconds}
        windowSeconds={windowSeconds}
        onUnsupported={() => setWavUnsupported(true)}
      />
    )
  }
  return <NativeWindowPlayer url={url} offsetSeconds={offsetSeconds} windowSeconds={windowSeconds} />
}
