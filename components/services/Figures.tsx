// Small diagrams for each service. Illustrative only: the data is made up to show the idea.
import type { ServiceSlug } from '@/lib/services'

const TEAL = '#4ecdc4'
const MUTED = 'rgba(255,255,255,0.35)'
const FAINT = 'rgba(255,255,255,0.12)'

/** Species accumulation: new species arrive quickly, then level off. */
function Richness() {
  const pts = Array.from({ length: 14 }, (_, i) => {
    const x = 20 + i * 15
    const y = 118 - 88 * (1 - Math.exp(-i / 3.2))
    return [x, y] as const
  })
  return (
    <>
      <line x1="20" y1="120" x2="225" y2="120" stroke={FAINT} />
      <line x1="20" y1="20" x2="20" y2="120" stroke={FAINT} />
      <line x1="20" y1="28" x2="225" y2="28" stroke={MUTED} strokeDasharray="3 4" />
      <text x="225" y="22" textAnchor="end" fontSize="9" fill={MUTED}>estimated total</text>
      <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={TEAL} strokeWidth="2" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.5" fill={TEAL} />)}
      <text x="122" y="134" textAnchor="middle" fontSize="9" fill={MUTED}>days recorded</text>
      <text x="12" y="70" textAnchor="middle" fontSize="9" fill={MUTED} transform="rotate(-90 12 70)">species</text>
    </>
  )
}

/** Sites as a grid: heard (solid) and not heard but estimated (shaded by probability). */
function Occupancy() {
  const p = [
    1, 0.7, 0.2, 1, 0.1, 0.5,
    0.6, 1, 1, 0.3, 0.05, 1,
    0.15, 0.8, 1, 0.4, 0.1, 0.25,
    1, 0.35, 0.6, 0.1, 1, 0.05,
  ]
  return (
    <>
      {p.map((v, i) => {
        const cx = 38 + (i % 6) * 32
        const cy = 22 + Math.floor(i / 6) * 26
        return v === 1 ? (
          <g key={i}>
            <circle cx={cx} cy={cy} r="9" fill={TEAL} />
            <circle cx={cx} cy={cy} r="12" fill="none" stroke={TEAL} strokeOpacity="0.4" />
          </g>
        ) : (
          <circle key={i} cx={cx} cy={cy} r="9" fill={TEAL} fillOpacity={v * 0.7} stroke={FAINT} />
        )
      })}
      <circle cx="40" cy="128" r="4" fill={TEAL} />
      <text x="48" y="131" fontSize="9" fill={MUTED}>heard</text>
      <circle cx="96" cy="128" r="4" fill={TEAL} fillOpacity="0.35" stroke={FAINT} />
      <text x="104" y="131" fontSize="9" fill={MUTED}>not heard: estimated chance present</text>
    </>
  )
}

/** Synchronised recorders locate each caller; circles show location uncertainty. */
function Density() {
  const recorders = [[40, 30], [200, 26], [36, 112], [196, 116], [120, 70]]
  const birds = [[82, 50, 9], [150, 44, 7], [100, 96, 11], [168, 92, 8], [58, 82, 10]]
  const [cx, cy] = birds[1]
  return (
    <>
      {recorders.map(([x, y], i) => (
        <line key={`l${i}`} x1={cx} y1={cy} x2={x} y2={y} stroke={TEAL} strokeOpacity="0.35" strokeDasharray="2 3" />
      ))}
      {birds.map(([x, y, r], i) => (
        <g key={`b${i}`}>
          <circle cx={x} cy={y} r={r} fill={TEAL} fillOpacity="0.12" stroke={TEAL} strokeOpacity="0.4" />
          <circle cx={x} cy={y} r="3" fill={TEAL} />
        </g>
      ))}
      {recorders.map(([x, y], i) => (
        <path key={`r${i}`} d={`M${x} ${y - 6} L${x + 6} ${y + 5} L${x - 6} ${y + 5} Z`} fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.5" />
      ))}
      <path d="M24 124 L29 134 L19 134 Z" fill="none" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.2" />
      <text x="32" y="133" fontSize="9" fill={MUTED}>recorder</text>
      <circle cx="84" cy="130" r="3" fill={TEAL} />
      <text x="92" y="133" fontSize="9" fill={MUTED}>individual</text>
    </>
  )
}

/** A stream of audio with one detection flagged. */
function Invasive() {
  const wave = Array.from({ length: 60 }, (_, i) => {
    const x = 16 + i * 3.5
    const burst = i > 34 && i < 42 ? 26 : 5
    const y = 72 + Math.sin(i * 1.7) * burst * (0.5 + ((i * 7) % 5) / 8)
    return `${x},${y.toFixed(1)}`
  }).join(' ')
  return (
    <>
      <polyline points={wave} fill="none" stroke={MUTED} strokeWidth="1.5" />
      <rect x="134" y="36" width="34" height="72" rx="4" fill="none" stroke={MUTED} strokeDasharray="3 3" />
      <rect x="150" y="12" width="70" height="20" rx="4" fill={FAINT} />
      <text x="185" y="26" textAnchor="middle" fontSize="9" fill={MUTED}>alert sent</text>
    </>
  )
}

const FIGURES: Record<ServiceSlug, () => React.ReactElement> = {
  richness: Richness,
  occupancy: Occupancy,
  density: Density,
  invasive: Invasive,
}

export default function ServiceFigure({ slug, className }: { slug: ServiceSlug; className?: string }) {
  const Fig = FIGURES[slug]
  return (
    <svg viewBox="0 0 240 142" className={className} role="img" aria-hidden="true" fontFamily="var(--font-inter), sans-serif">
      <Fig />
    </svg>
  )
}
