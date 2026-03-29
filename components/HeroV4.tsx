'use client'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import RegionMap from '@/components/Map'

// ── Waveform bar heights ──────────────────────────────────────────────────────
const WAVEFORM_HEIGHTS = Array.from({ length: 28 }, (_, i) =>
  Math.max(3, Math.round(4 + Math.sin(i * 0.7) * 9 + Math.sin(i * 0.28) * 5))
)


export default function HeroV4() {
  return (
    <section className="relative min-h-[90vh] bg-ocean-dark text-white overflow-hidden flex items-center">
      {/* ── Background photo ── */}
      <div className="absolute inset-0">
        <Image
          src="/images/merlin-kraus-F5becDFzhHc-unsplash.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center"
        />
      </div>

      {/* ── Blend layers ── */}
      <div className="absolute inset-0 bg-ocean-dark/55" />
      {/* Left-to-right: solid on text side, feathers across entire right half so
          the Three.js canvas boundary is never visible */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to right, #0a1628 28%, rgba(10,22,40,0.82) 44%, rgba(10,22,40,0.45) 62%, rgba(10,22,40,0.1) 80%, transparent 100%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 70% 50%, rgba(3,105,161,0.18) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(10,22,40,0.5) 0%, transparent 30%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'linear-gradient(to bottom, transparent, #0a1628)' }}
      />

      {/* ── Right: zoomed NZ map ── */}
      <div className="absolute right-0 top-0 w-[62%] h-full pointer-events-none">
        <RegionMap selectedRegion="Manawatu-Wanganui" className="opacity-75" static/>
      </div>

      {/* ── Left: text content (same as V3) ── */}
      <div className="relative z-20 w-full md:w-[60%] px-8 sm:px-12 md:pl-24 md:pr-8 py-28 md:pb-28 md:pt-0 mt-0 md:-mt-2 flex flex-col">

        {/* Waveform accent strip */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.9, delay: 0.1, ease: 'easeOut' }}
          className="mb-8 origin-left"
        >
          <svg viewBox="0 0 196 28" className="w-36 h-5 opacity-50">
            {WAVEFORM_HEIGHTS.map((h, i) => (
              <rect
                key={i}
                x={i * 7} y={(28 - h) / 2}
                width="4" height={h}
                fill="#4ecdc4" rx="1.5"
              />
            ))}
          </svg>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="text-brand-100 text-xs tracking-widest uppercase mb-4"
        >
          The Listening Lab
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.12 }}
          className="font-serif text-5xl md:text-[3.2rem] lg:text-6xl leading-tight mb-6"
        >
          Sound is how we Understand Nature.
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.48 }}
          className="flex flex-wrap gap-4"
        >
          <Link
            href="/research"
            className="bg-white text-ocean-dark px-8 py-3 rounded-full font-medium hover:bg-brand-50 transition-colors"
          >
            Our Research
          </Link>
          <Link
            href="/blog"
            className="border border-white/40 px-8 py-3 rounded-full hover:bg-white/10 transition-colors"
          >
            Read the Blog
          </Link>
        </motion.div>
      </div>

      {/* ── Scroll indicator ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-5 h-8 border-2 border-white/30 rounded-full flex justify-center pt-1.5"
        >
          <div className="w-1 h-2 bg-white/50 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  )
}
