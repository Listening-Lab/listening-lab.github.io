'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-ocean-dark text-white">
      {/* Animated waveform background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none">
        <svg viewBox="0 0 1200 200" className="w-full" preserveAspectRatio="none">
          {Array.from({ length: 80 }).map((_, i) => {
            const h = 20 + Math.sin(i * 0.4) * 60 + Math.sin(i * 0.15) * 40
            return (
              <rect
                key={i}
                x={i * 15}
                y={(200 - h) / 2}
                width="8"
                height={h}
                fill="white"
                rx="4"
              />
            )
          })}
        </svg>
      </div>

      <div className="relative z-10 text-center max-w-3xl mx-auto px-6">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-brand-100 text-sm tracking-widest uppercase mb-6"
        >
          Listening Lab NZ
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="font-serif text-6xl md:text-8xl leading-tight mb-8"
        >
          Sound is how we know the world.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-xl text-gray-300 mb-10 max-w-xl mx-auto"
        >
          We are a multidisciplinary research group developing computational bioacoustic tools for conservation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-wrap justify-center gap-4"
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

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
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
