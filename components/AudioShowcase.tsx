'use client'
import { useState, useRef, useEffect, PointerEvent } from 'react'
import { motion } from 'framer-motion'
import AnimatedSection from './AnimatedSection'

const soundscapes = [
  { label: 'Tui', location: 'Lake Tikitapu', duration: '3:03', color: '#0ea5e9', src: 'https://xeno-canto.org/857958/download', image: "/images/birds/andrea-lightfoot-0MU2XZbkGZ8-unsplash-tui.jpg", spectrogram: '/images/spectrograms/tui.png' },
  { label: 'Bellbird (Kōmako)',   location: 'Kahurangi National Park', duration: '1:35', color: '#6366f1', src: 'https://xeno-canto.org/842925/download', image: "/images/birds/tonia-kraakman-IriMHaXnyRQ-unsplash-bellbird.jpg", spectrogram: '/images/spectrograms/bellbird.png' },
  { label: 'Kea',  location: "Authur's Pass", duration: '0:05', color: '#10b981', src: 'https://xeno-canto.org/405514/download', image: "/images/birds/pablo-heimplatz-PSF2RhUBORs-unsplash-kea.jpg", spectrogram: '/images/spectrograms/kea.png' },
]

function TrackItem({ track, isPlaying, onToggle, onEnded }: { track: typeof soundscapes[0], isPlaying: boolean, onToggle: () => void, onEnded: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const scrubberRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const isDraggingRef = useRef(false)

  // Coordinate play/pause with parent state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) audio.play().catch(() => {})
    else audio.pause()
  }, [isPlaying])

  // Smooth progress tracking using rAF instead of the blocky 'timeupdate' event
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    let rafId: number
    const tick = () => {
      if (audio.duration && !isDraggingRef.current) {
        setProgress(audio.currentTime / audio.duration)
      }
      rafId = requestAnimationFrame(tick)
    }
    if (isPlaying) {
      rafId = requestAnimationFrame(tick)
    } else {
      if (audio.duration) setProgress(audio.currentTime / audio.duration)
      if (audio.duration && !isDraggingRef.current) {
        setProgress(audio.currentTime / audio.duration)
      }
    }
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying])

  // Scrubbing logic
  const handleScrub = (e: PointerEvent, commit: boolean) => {
    const rect = scrubberRef.current?.getBoundingClientRect()
    const audio = audioRef.current
    if (!rect || !audio || !audio.duration) return
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setProgress(x)
    if (commit) {
      audio.currentTime = x * audio.duration
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    isDraggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    handleScrub(e, true)
  }
  const onPointerMove = (e: PointerEvent) => {
    if (isDraggingRef.current && e.buttons > 0) handleScrub(e, false)
  }
  const onPointerUp = (e: PointerEvent) => {
    if (isDraggingRef.current) {
      handleScrub(e, true)
      isDraggingRef.current = false
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  return (
    <div className="flex flex-col gap-4 bg-white/5 hover:bg-white/10 rounded-2xl p-6 transition-colors group">
      <audio ref={audioRef} src={track.src} preload="auto" onEnded={onEnded} />

      <div className="flex items-center gap-6">
        {track.image ? (
          <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0">
            <img src={track.image} alt={track.label} className="w-full h-full object-cover object-center !m-0" />
          </div>
        ) : null}
        
        <button
          onClick={onToggle}
          className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0 hover:border-white/60 transition-colors"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>
            </svg>
          ) : (
            <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">{track.label}</p>
          <p className="text-sm text-gray-400 truncate">{track.location}</p>
        </div>

        <span className="text-sm text-gray-400 flex-shrink-0 tabular-nums">{track.duration}</span>
      </div>

      <div 
        ref={scrubberRef}
        onPointerDown={onPointerDown} 
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative h-[30vh] w-full bg-black/40 rounded-xl overflow-hidden cursor-crosshair border border-white/5 touch-none mt-2"
      >
        {/* Spectrogram image overlay */}
        {track.spectrogram && (
          <img 
            src={track.spectrogram} 
            alt="Spectrogram" 
            className="absolute inset-0 w-full h-full object-fill opacity-60 mix-blend-screen pointer-events-none !m-0" 
            draggable={false}
          />
        )}
        
        {/* Played area darkened */}
        <div 
          className="absolute top-0 bottom-0 left-0 bg-black/50 pointer-events-none transition-none" 
          style={{ width: `${progress * 100}%` }} 
        />
        
        {/* Playhead */}
        <div 
          className="absolute top-0 bottom-0 w-px pointer-events-none shadow-[0_0_8px_rgba(255,255,255,0.5)]" 
          style={{ left: `${progress * 100}%`, backgroundColor: track.color }} 
        />
      </div>
    </div>
  )
}

export default function AudioShowcase() {
  const [playing, setPlaying] = useState<number | null>(null)

  return (
    <section className="bg-ocean-dark text-white py-24 not-prose">
      <div className="max-w-5xl mx-auto px-6">
        <AnimatedSection>
          <h2 className="font-serif text-4xl mb-4">Listen</h2>
          <p className="text-gray-400 mb-12">
            A selection of soundscapes from our field recording archive.
          </p>
        </AnimatedSection>

        <div className="space-y-4">
          {soundscapes.map((s, i) => (
            <AnimatedSection key={s.src} delay={i * 0.1}>
              <TrackItem 
                track={s} 
                isPlaying={playing === i} 
                onToggle={() => setPlaying(playing === i ? null : i)} 
                onEnded={() => setPlaying(null)} 
              />
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  )
}
