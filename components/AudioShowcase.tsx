'use client'
import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import AnimatedSection from './AnimatedSection'

const soundscapes = [
  { label: 'Tui', location: 'Lake Tikitapu', duration: '3:03', color: '#0ea5e9', src: 'https://xeno-canto.org/857958/download' },
  { label: 'Bellbird (Kōmako)',   location: 'Kahurangi National Park',   duration: '1:35', color: '#6366f1', src: 'https://xeno-canto.org/842925/download' },
  { label: 'Little Spotted Kiwi (Kiwi Pukupuku)',  location: 'Kapiti Island',       duration: '0:51', color: '#10b981', src: 'https://xeno-canto.org/88143/download' },
]

function WaveformBars({ playing, color }: { playing: boolean; color: string }) {
  return (
    <div className="flex items-center gap-0.5 h-8">
      {Array.from({ length: 28 }).map((_, i) => {
        const base = 30 + Math.sin(i * 0.8) * 50 + Math.sin(i * 0.3) * 30
        return (
          <motion.div
            key={i}
            className="w-1 rounded-full"
            style={{ backgroundColor: color }}
            animate={playing ? { scaleY: [1, 0.3 + Math.random() * 0.7, 1] } : { scaleY: base / 100 }}
            transition={playing ? { repeat: Infinity, duration: 0.4 + Math.random() * 0.4, delay: i * 0.02 } : {}}
          />
        )
      })}
    </div>
  )
}

export default function AudioShowcase() {
  const [playing, setPlaying] = useState<number | null>(null)
  const audioRefs = useRef<(HTMLAudioElement | null)[]>([])

  // Pause whichever track was playing when a new one starts
  useEffect(() => {
    audioRefs.current.forEach((audio, i) => {
      if (!audio) return
      if (i === playing) {
        audio.play().catch(() => {}) // catch autoplay policy errors silently
      } else {
        audio.pause()
      }
    })
  }, [playing])

  function handleEnded() {
    setPlaying(null)
  }

  return (
    <section className="bg-ocean-dark text-white py-24">
      <div className="max-w-5xl mx-auto px-6">
        <AnimatedSection>
          <h2 className="font-serif text-4xl mb-4">Listen to New Zealand</h2>
          <p className="text-gray-400 mb-12">
            A selection of soundscapes from our field recording archive.
          </p>
        </AnimatedSection>

        {/* Hidden audio elements — one per track */}
        {soundscapes.map((s, i) => (
          <audio
            key={s.src}
            ref={el => { audioRefs.current[i] = el }}
            src={s.src}
            onEnded={handleEnded}
            preload="none"
          />
        ))}

        <div className="space-y-4">
          {soundscapes.map((s, i) => (
            <AnimatedSection key={s.label} delay={i * 0.1}>
              <div className="flex items-center gap-6 bg-white/5 hover:bg-white/10 rounded-2xl px-6 py-5 transition-colors group">
                <button
                  onClick={() => setPlaying(playing === i ? null : i)}
                  className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center flex-shrink-0 hover:border-white/60 transition-colors"
                  aria-label={playing === i ? 'Pause' : 'Play'}
                >
                  {playing === i ? (
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
                  <p className="font-medium text-white">{s.label}</p>
                  <p className="text-sm text-gray-400">{s.location}</p>
                </div>

                <div className="hidden sm:block flex-1">
                  <WaveformBars playing={playing === i} color={s.color} />
                </div>

                <span className="text-sm text-gray-400 flex-shrink-0">{s.duration}</span>
              </div>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  )
}
