'use client'
import { useRef, useCallback } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
} from 'framer-motion'
import Link from 'next/link'

// ── NZ region paths ──────────────────────────────────────────────────────────
// Derived from public/regions.json using Douglas-Peucker simplification
// (tolerance 1.2 px). Projection: lon/lat → viewBox "0 0 240 310".
// x = (lon - 165.9) / 12.75 * 240   y = (lat - (-34.3)) / (-13.1) * 310
const NZ_PATHS = [
  // Southland (sub-polygons — mainland only, skipping tiny offshore islands)
  "M43.3,301.7 L44.3,302.6 L37.7,305 L35.1,303.8 L32.3,305.6 L34.4,305.4 L33.4,306.7 L30.5,307 L35.9,298.7 L35.9,293.2 L38.9,293.4 L42.9,297.3 L38.9,299.9 L43.9,299.9 L43.3,301.7 Z",
  "M62,291.5 L59,293 L56.3,292.4 L55.4,290.1 L51.2,289.8 L50.7,291.4 L46.8,289.7 L46.6,291.5 L44.6,289.6 L46.8,288.7 L46.5,286.7 L45.2,288.2 L42.8,284.8 L36.7,286.3 L31.8,280.6 L29.2,280.4 L26.5,283.3 L16.2,282.1 L14.5,280.5 L19.8,275.5 L13.5,279 L17.1,275.2 L14.9,275.5 L15.9,273.6 L10.8,276.8 L11.1,272.3 L20.9,270.2 L16.5,270.2 L18.7,268.6 L16.5,268.7 L16.6,267.3 L20.6,266.8 L21.7,264.8 L15.3,266.8 L16.3,262.9 L19.8,263.5 L17.4,260.7 L18.7,259.9 L21.6,261.8 L20.9,263.3 L22.5,262.2 L24.6,264.5 L21.6,260.9 L26.5,260.6 L21.6,259.6 L20.9,256.4 L23.9,257.6 L21.7,255.6 L22.9,254.1 L24.3,256.4 L25.9,255.4 L23.6,253.4 L27,254.1 L24.5,252 L28,249.5 L30.4,253 L29.3,248.2 L31.2,248.1 L31.4,250.4 L31,246.9 L33.5,247.7 L31.9,246.1 L34.9,243.8 L38.3,246 L36.5,241.5 L42.1,236.2 L44.1,235.8 L46.6,238.3 L41.9,250 L44.7,253.9 L45.3,260.3 L51.5,259.3 L55.6,263.4 L59.3,260 L61.7,262 L58.3,271.3 L61.9,281.8 L62,291.5 Z",
  // Marlborough
  "M144.8,159.9 L146.3,161.1 L146.8,158.5 L152.8,156.2 L148.3,158.8 L148.5,161.2 L151.6,159.9 L148.5,165.4 L155,162.7 L150.5,163.1 L151.5,160.4 L152,162 L153.3,160.7 L152.4,157.8 L155.9,157.9 L156.4,160.2 L158.5,158.5 L157.3,161.6 L155.6,161.3 L156.5,163.1 L151.3,164.9 L158.6,163.7 L153.4,168.9 L157.9,176.4 L154,181.5 L147.4,180.2 L134.5,193.4 L128.1,185 L144.8,159.9 Z",
  "M144.8,159.9 L141,166.4 L137.6,166.8 L144.8,159.9 Z",
  // Tasman / Nelson
  "M139,167.7 L138.6,170.7 L132.5,176.3 L128.1,185 L122.5,189.6 L116,181.1 L117.2,176 L128,163.3 L123.6,159.7 L120.9,160 L119.2,153.3 L126.9,146.9 L133.6,147.3 L128.8,147.2 L127.8,152.3 L130.9,154.9 L134,153.8 L135.1,165.3 L139,167.7 Z",
  // West Coast
  "M45.7,241.1 L45.4,236.5 L41.5,235.7 L46.5,230.5 L54.7,229.5 L66,221.4 L71.9,219.5 L79.3,211.8 L81.7,211.5 L82.6,208.4 L91.7,203.9 L97.2,197.7 L101.7,189.2 L104.8,176.7 L112.1,174.3 L116.2,168.4 L116.8,155.9 L119.2,153.3 L120.9,160 L123.6,159.7 L128,163.3 L117.2,176 L116,181.1 L122.3,189.4 L123.9,189 L123,191.2 L109.2,203.7 L102.2,205 L88.4,215.9 L81,218.5 L71,229 L65.3,232 L58.8,232.3 L53.5,238.9 L45.7,241.1 Z",
  // Otago
  "M62,291.5 L61.9,281.8 L58.3,271.3 L61.7,262 L59.3,260 L55.6,263.4 L51.5,259.3 L45.3,260.3 L44.7,253.9 L41.9,250 L45.7,241.1 L53.5,238.9 L58.8,232.3 L65.3,232 L70.4,228.7 L68.8,240.1 L70.8,243.4 L75.4,245.3 L78.6,251.2 L82.9,251.2 L84.5,254.6 L93,250.4 L99.2,252.1 L94.6,258.8 L93.5,264.6 L88.9,270.1 L91.5,271.6 L87.7,274.4 L91.8,271.7 L91.8,273.9 L83.5,276.4 L74.3,287.9 L70.8,288.5 L72.6,288.7 L71.6,289.9 L65.7,292.1 L62,291.5 Z",
  // Canterbury
  "M128.1,185 L134.9,193.4 L147.4,180.2 L154,181.5 L147.4,192.4 L144.2,193.8 L139.1,204.8 L132,208.3 L128.9,212.2 L128.9,219.3 L130.5,220.1 L127.7,221 L134.9,221.2 L135.4,226.1 L133.6,226.9 L132.7,223.7 L133.1,227.3 L129.2,224.6 L122.8,226.1 L127,224.4 L122.7,223.3 L121.9,226.3 L102.5,236.1 L99.3,242.5 L99.2,252.1 L93,250.4 L84.5,254.6 L82.9,251.2 L78.6,251.2 L75.4,245.3 L70.8,243.4 L68.8,240.1 L68.6,234.4 L71,229 L81,218.5 L88.4,215.9 L102.2,205 L109.5,203.5 L128.1,185 Z",
  // Auckland (offshore island)
  "M181.4,46.9 L181.1,48.6 L177.6,45.5 L178.4,41.8 L181.4,46.9 Z",
  // Auckland (mainland)
  "M165.1,70.8 L163,65.4 L165,65.5 L166.4,69.7 L167.6,67.8 L166,67.5 L170.1,65.4 L166.9,62.3 L161.9,64.7 L155.9,51 L160.6,56 L161.3,49.2 L157.6,48.2 L164.8,43.4 L169,48.5 L166.6,48.6 L167.1,51.8 L166,50 L166.1,54.3 L168.6,54.7 L166.1,55.2 L167.9,59.7 L164.2,59.1 L165.3,61.7 L169,60.4 L169.3,62.9 L170.1,60 L170.6,62.3 L172.4,61 L173.1,63.2 L175.8,62.5 L177.4,64.1 L174.7,64.8 L173.1,68.4 L165.1,70.8 Z",
  // Waikato
  "M165.1,70.8 L173.1,68.4 L174.7,64.8 L177.4,64.1 L178.2,68.8 L183.1,69.6 L179.5,60.7 L181.4,58.8 L180.7,55.2 L178.1,51.5 L181.7,52.7 L183.1,58.3 L187.3,57.2 L184.5,60.2 L187.3,60.1 L188.6,65.2 L189.3,72.6 L186.5,75.9 L189.6,87.1 L199.7,97.7 L194.2,110.9 L186.6,118.3 L182.5,117.7 L183.8,110.8 L181.9,110.5 L181.9,99.3 L170.8,103.4 L168.8,105.9 L164.1,104.3 L165.8,90 L168.4,91.2 L170.2,89.9 L167.4,89.6 L169.2,87.2 L167.3,87.2 L167.4,84.5 L170.9,82.9 L170.7,81.3 L168.5,82 L166.2,74.7 L168.2,70.8 L166.2,72.5 L165.1,70.8 Z",
  // Wellington
  "M196.7,151.4 L189.5,164.4 L177.5,173 L175.5,173.1 L174.7,168.4 L168.8,168.5 L169.2,163.9 L167.1,164.7 L167.5,166.5 L163.9,165.5 L168.8,161 L174,150.8 L176.2,153 L196.7,151.4 Z",
  // Manawatu-Whanganui
  "M168.8,105.9 L181,98.9 L183.1,100.5 L181.2,105.5 L181.9,110.5 L183.8,110.8 L182.5,117.7 L186.6,118.3 L190.5,113.2 L191.7,114.2 L193.9,127.2 L192.1,134.8 L196.1,136.6 L197.4,143.5 L202,145.6 L196.7,151.4 L186.9,153.2 L184.8,151.4 L176.6,153 L174.2,151.4 L174.8,138.1 L170.7,132.9 L167,131.6 L171.1,127 L170.7,123 L166.1,115.7 L168.8,105.9 Z",
  // Taranaki
  "M164.1,104.3 L168.8,105.9 L166.1,115.7 L171.2,124.4 L171.1,127 L167,131.6 L162.7,130.5 L158.5,125.7 L152.2,124.1 L147.9,118.4 L149.7,114.4 L161.1,109.7 L164.1,104.3 Z",
  // Northland
  "M164.8,43.4 L159.1,47.2 L158.1,46.5 L160.8,43.5 L158.7,45.6 L156.7,43 L156.1,44.4 L158.5,45.9 L157.2,46.6 L152.4,43 L150.7,37.2 L150.2,39.3 L156.3,48.5 L154,49.7 L141.3,30.1 L142.5,26.6 L143.8,27.3 L146.1,24 L144.3,23.1 L140.6,28.8 L139.6,23.7 L138.1,25.2 L138.5,23.2 L135.4,21.5 L137.4,19.1 L136.6,15.3 L127.5,4.3 L128.1,2.6 L135.1,2.6 L134.4,5.3 L133.1,3.9 L131.9,5.7 L133.8,8.3 L134.3,6 L136,12.1 L139.3,14.4 L138.7,16.7 L142,11.7 L142.3,16.1 L144.7,16.9 L144.7,14.8 L148.4,16.7 L148,18.9 L149.9,16.5 L154.9,19.8 L152.8,21.7 L155.3,25.3 L157.2,24.4 L155.4,23.1 L159.1,21.3 L160.4,25.4 L158.7,24.4 L163.2,30.6 L161.4,31.8 L163.9,36.5 L159.7,35.2 L159.2,33.4 L159.1,36.5 L162,36.2 L161.8,39.9 L164.8,43.4 Z",
  // Bay of Plenty
  "M195.1,109 L199.7,97.7 L189.6,87.1 L186.5,75.9 L188.6,72.9 L193.2,78.3 L189,76.2 L190.2,79 L194.1,80.9 L194.2,78.5 L211.4,88.1 L217.2,87 L222.8,79.9 L229.2,76.9 L227.3,78.7 L227.3,81.4 L228.9,81.9 L224.8,90.1 L221.9,88.1 L221.2,91.3 L213.5,97.7 L212.1,101.3 L208.6,104.2 L203.9,104.5 L203.3,107.7 L200.1,106.7 L198.7,111 L195.1,109 Z",
  // Gisborne
  "M212.2,101 L213.5,97.7 L221.2,91.3 L221.9,88.1 L225.6,89.1 L228.9,81.9 L227.3,81.4 L227.3,78.7 L229.2,76.9 L238.1,80 L234.3,87.9 L233.4,100.1 L229.3,104.3 L226.5,104.2 L226.1,110.3 L212.2,101 Z",
  // Hawke's Bay
  "M191.7,114.2 L195.1,109 L198.3,111.2 L200.1,106.7 L203.3,107.7 L203.9,104.5 L208.6,104.2 L212.2,101 L226.1,110.3 L225.6,113.2 L227.7,114.3 L225.3,118.1 L225,113.3 L216.7,112.6 L209.9,116.2 L207.1,121.4 L208.2,126 L211.2,127 L202,145.6 L197.4,143.5 L196.1,136.6 L192.1,134.8 L193.9,127.2 L191.7,114.2 Z",
]

// ── Monitoring stations (one per region, positioned at region centroid) ───────
// Coordinates match the same projection as NZ_PATHS above.
const STATIONS = [
  { x: 148, y: 20,  r: 1.8 },  // Northland
  { x: 171, y: 56,  r: 1.8 },  // Auckland
  { x: 178, y: 88,  r: 1.8 },  // Waikato
  { x: 162, y: 118, r: 1.8 },  // Taranaki
  { x: 183, y: 125, r: 1.8 },  // Manawatu-Whanganui
  { x: 218, y: 92,  r: 1.8 },  // Gisborne
  { x: 204, y: 87,  r: 1.8 },  // Bay of Plenty
  { x: 204, y: 122, r: 1.8 },  // Hawke's Bay
  { x: 178, y: 162, r: 1.8 },  // Wellington
  { x: 125, y: 168, r: 1.8 },  // Tasman / Nelson
  { x: 155, y: 165, r: 1.8 },  // Marlborough
  { x: 88,  y: 196, r: 1.8 },  // West Coast
  { x: 118, y: 213, r: 1.8 },  // Canterbury
  { x: 80,  y: 260, r: 1.8 },  // Otago
  { x: 38,  y: 260, r: 1.8 },  // Southland
]

// ── Decorative waveform bar heights ──────────────────────────────────────────
const WAVEFORM_HEIGHTS = Array.from({ length: 28 }, (_, i) =>
  Math.max(3, Math.round(4 + Math.sin(i * 0.7) * 9 + Math.sin(i * 0.28) * 5))
)

export default function HeroV2() {
  const sectionRef = useRef<HTMLElement>(null)

  const rawX = useMotionValue(0.5)
  const rawY = useMotionValue(0.5)
  const springX = useSpring(rawX, { stiffness: 200, damping: 30 })
  const springY = useSpring(rawY, { stiffness: 200, damping: 30 })

  // Background radial glow follows cursor
  const bgX = useTransform(springX, [0, 1], [20, 80])
  const bgY = useTransform(springY, [0, 1], [20, 80])
  const bgGradient = useMotionTemplate`radial-gradient(ellipse 60% 65% at ${bgX}% ${bgY}%, rgba(14,165,233,0.09) 0%, transparent 68%)`

  // Parallax offsets (layers shift opposite to cursor → depth illusion)
  const g1x = useTransform(springX, [0, 1], [5, -5])
  const g1y = useTransform(springY, [0, 1], [3, -3])
  const g2x = useTransform(springX, [0, 1], [11, -11])
  const g2y = useTransform(springY, [0, 1], [7, -7])
  const g3x = useTransform(springX, [0, 1], [20, -20])
  const g3y = useTransform(springY, [0, 1], [13, -13])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = sectionRef.current?.getBoundingClientRect()
      if (!rect) return
      rawX.set((e.clientX - rect.left) / rect.width)
      rawY.set((e.clientY - rect.top) / rect.height)
    },
    [rawX, rawY]
  )

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      className="relative min-h-[90vh] bg-ocean-dark text-white overflow-hidden flex items-center"
    >
      {/* ── Sonar pulse animation ── */}
      <style>{`
        @keyframes sonarPulse {
          0%   { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(8); opacity: 0;   }
        }
        .sonar {
          transform-box: fill-box;
          transform-origin: center;
          animation: sonarPulse 6s ease-out infinite;
        }
      `}</style>

      {/* ── Mouse-reactive background glow ── */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{ background: bgGradient }}
      />

      {/* ── Left: text content ── */}
      <div className="relative z-20 w-full md:w-[44%] px-8 sm:px-12 md:pl-36 md:pr-8 py-28 md:pb-28 md:pt-0 mt-0 md:-mt-64 flex flex-col">

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

        {/* <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28 }}
          className="text-gray-300 text-lg mb-10 max-w-sm"
        >
          We are a multidisciplinary research group developing computational
          bioacoustic tools for conservation.
        </motion.p> */}

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

        {/* <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="mt-10 text-[11px] text-white/25 tracking-widest uppercase"
        >
          {STATIONS.length} monitoring regions &middot; Aotearoa New Zealand
        </motion.p> */}
      </div>

      {/* ── Right: NZ map panel ── */}
      <div className="absolute inset-0 md:relative md:w-[56%] h-full flex items-center justify-center">

        {/* Mobile gradient so text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-ocean-dark via-ocean-dark/75 to-transparent md:hidden pointer-events-none" />

        <svg
          viewBox="0 0 240 315"
          className="w-full h-full"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <filter id="landGlow" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="dotGlow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Layer 0: coordinate grid (farthest / slowest) */}
          <motion.g style={{ x: g1x, y: g1y }}>
            {[40, 70, 100, 130, 160, 190, 220, 250, 280].map(yv => (
              <line key={`h${yv}`} x1="-20" y1={yv} x2="270" y2={yv}
                stroke="rgba(78,205,196,0.055)" strokeWidth="0.5" />
            ))}
            {[20, 50, 80, 110, 140, 170, 200, 230].map(xv => (
              <line key={`v${xv}`} x1={xv} y1="-20" x2={xv} y2="340"
                stroke="rgba(78,205,196,0.055)" strokeWidth="0.5" />
            ))}
          </motion.g>

          {/* Layer 1: NZ region polygons (mid-depth) */}
          <motion.g style={{ x: g2x, y: g2y }} filter="url(#landGlow)">
            {NZ_PATHS.map((d, i) => (
              <motion.path
                key={i}
                d={d}
                fill="rgba(78,205,196,0.045)"
                strokeLinejoin="round"
                strokeWidth="0.9"
                animate={{
                  stroke: [
                    'rgba(78,205,196,0.25)',
                    'rgba(78,205,196,0.48)',
                    'rgba(78,205,196,0.25)',
                  ],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 5,
                  ease: 'easeInOut',
                  delay: (i * 0.15) % 2,
                }}
              />
            ))}
            <text
              x="148" y="172"
              fontSize="4"
              fill="rgba(255,255,255,0.16)"
              fontFamily="system-ui, sans-serif"
              letterSpacing="0.1em"
              textAnchor="middle"
            >
              COOK STRAIT
            </text>
          </motion.g>

          {/* Layer 2: monitoring stations (nearest / fastest) */}
          <motion.g style={{ x: g3x, y: g3y }}>
            {STATIONS.map((s, i) => (
              <g key={i} filter="url(#dotGlow)">
                {/* Single sonar ring, staggered across all stations */}
                <circle
                  cx={s.x} cy={s.y}
                  r={s.r * 1.6}
                  fill="none"
                  stroke="rgba(78,205,196,0.55)"
                  strokeWidth="0.7"
                  className="sonar"
                  style={{ animationDelay: `${(i * 0.45) % 6}s` }}
                />
                {/* Station dot */}
                <circle cx={s.x} cy={s.y} r={s.r} fill="rgba(78,205,196,0.85)" />
                <circle cx={s.x} cy={s.y} r={s.r * 0.4} fill="white" opacity="0.9" />
              </g>
            ))}
          </motion.g>
        </svg>
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
