'use client'

import { LEVELS, needsSpecies, type MeasurementLevel } from '@/lib/pricing'

export const inputCls =
  'w-full bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-500 [color-scheme:dark] [&_option]:bg-ocean-dark [&_option]:text-white'

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm text-gray-300 mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-gray-500 mt-1">{hint}</span>}
    </label>
  )
}

export function NumberInput({
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  suffix,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <div className="relative">
      <input
        type="number"
        className={inputCls + (suffix ? ' pr-14' : '')}
        value={Number.isFinite(value) ? value : ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const v = parseFloat(e.target.value)
          onChange(Number.isFinite(v) ? Math.max(min, max !== undefined ? Math.min(max, v) : v) : min)
        }}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 pointer-events-none">{suffix}</span>
      )}
    </div>
  )
}

/** Measurement levels (any combination), with the species count when it applies. */
export function LevelAndSpecies({
  levels,
  species,
  onLevels,
  onSpecies,
}: {
  levels: MeasurementLevel[]
  species: number
  onLevels: (l: MeasurementLevel[]) => void
  onSpecies: (n: number) => void
}) {
  function toggle(id: MeasurementLevel) {
    onLevels(levels.includes(id) ? levels.filter((l) => l !== id) : [...levels, id])
  }
  return (
    <div className="space-y-4">
      <div>
        <span className="block text-sm text-gray-300 mb-1.5">What do you want to know?</span>
        <div className="space-y-1.5">
          {LEVELS.map((l) => {
            const on = levels.includes(l.id)
            return (
              <button
                key={l.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(l.id)}
                className={`w-full flex items-center gap-3 text-left rounded-lg border px-3 py-2 transition-colors ${
                  on ? 'border-[#4ecdc4]/60 bg-[#4ecdc4]/10' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <span
                  className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[10px] ${
                    on ? 'bg-[#4ecdc4] border-[#4ecdc4] text-ocean-dark' : 'border-white/30'
                  }`}
                >
                  {on ? '✓' : ''}
                </span>
                <span>
                  <span className="text-sm text-white">{l.name}</span>
                  <span className="text-xs text-gray-500"> · {l.question}</span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {needsSpecies(levels) && (
        <Field label="Target species" hint="Each species is validated and calibrated separately.">
          <NumberInput value={species} onChange={onSpecies} min={1} max={200} />
        </Field>
      )}
    </div>
  )
}

// The slider moves a month at a time for the first year, then a year at a time up to ten
// years: positions 0-11 are 1-12 months, 12-20 are 2-10 years.
const SLIDER_MAX = 20

function monthsAt(pos: number): number {
  return pos < 12 ? pos + 1 : (pos - 10) * 12
}

function positionOf(months: number): number {
  return months <= 12 ? Math.max(0, months - 1) : Math.min(SLIDER_MAX, Math.round(months / 12) + 10)
}

/** Study length in months: how long the project runs and audio is kept. */
export function DurationSlider({ months, min = 1, onChange }: { months: number; min?: number; onChange: (m: number) => void }) {
  const years = months / 12
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
        <span className="text-gray-300">Study duration</span>
        <span className="flex items-center gap-2">
          {months >= 12 && (
            <span className="text-xs text-gray-500">{years % 1 === 0 ? years : years.toFixed(1)} yr</span>
          )}
          <span className="w-28">
            <NumberInput value={months} onChange={(m) => onChange(Math.max(min, Math.round(m)))} min={1} max={600} suffix="months" />
          </span>
        </span>
      </div>
      <input
        type="range"
        aria-label="Study duration"
        min={0}
        max={SLIDER_MAX}
        step={1}
        value={positionOf(months)}
        onChange={(e) => onChange(Math.max(min, monthsAt(parseInt(e.target.value, 10))))}
        className="w-full accent-[#4ecdc4]"
      />
      <div className="relative h-4 text-[11px] text-gray-600 mt-0.5">
        <span className="absolute left-0">1 mo</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${(11 / SLIDER_MAX) * 100}%` }}>1 yr</span>
        <span className="absolute right-0">10 yr</span>
      </div>
    </div>
  )
}
