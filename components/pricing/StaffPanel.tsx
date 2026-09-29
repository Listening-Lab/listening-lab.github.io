'use client'

import { useState } from 'react'
import {
  DEFAULT_INTERNAL,
  DEFAULT_RATES,
  money,
  num,
  type InternalCosts,
  type InternalEstimate,
  type Rates,
} from '@/lib/pricing'

const RATE_FIELDS: { key: keyof Rates; label: string; step: number }[] = [
  { key: 'onboarding', label: 'Project setup $', step: 10 },
  { key: 'perSpecies', label: 'Per species $', step: 10 },
  { key: 'checklist', label: 'Checklist $', step: 50 },
  { key: 'includedDevices', label: 'Devices included', step: 1 },
  { key: 'perExtraDevice', label: 'Per extra device $', step: 5 },
  { key: 'densityMultiplier', label: 'Density ×', step: 0.1 },
  { key: 'processingBandRate', label: 'Processing $/h', step: 0.01 },
  { key: 'processingBandHours', label: '…up to hours', step: 500 },
  { key: 'processingBeyondRate', label: 'Beyond $/h', step: 0.005 },
  { key: 'storagePerGbMonth', label: 'Storage $/GB·mo', step: 0.001 },
  { key: 'minimumAnalysisFee', label: 'Minimum $', step: 50 },
  { key: 'flacMbPerHour', label: 'FLAC MB/h', step: 1 },
]

const COST_FIELDS: { key: keyof InternalCosts; label: string; step: number }[] = [
  { key: 'processingPerHour', label: 'Processing $/h', step: 0.001 },
  { key: 'storagePerGbMonth', label: 'Storage $/GB·mo', step: 0.001 },
  { key: 'validatorRate', label: 'Validator $/h', step: 5 },
  { key: 'validationHoursPerSpecies', label: 'Hours per species', step: 0.5 },
  { key: 'checklistValidationHours', label: 'Checklist hours', step: 1 },
  { key: 'validationHoursPerDevice', label: 'Hours per device', step: 0.05 },
  { key: 'onboardingHours', label: 'Setup hours', step: 0.5 },
]

function Grid<T extends object>({
  fields,
  values,
  defaults,
  onChange,
}: {
  fields: { key: keyof T; label: string; step: number }[]
  values: T
  defaults: T
  onChange: (v: T) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2">
      {fields.map((f) => {
        const v = values[f.key] as number
        const changed = v !== (defaults[f.key] as number)
        return (
          <label key={String(f.key)} className="block">
            <span className={`block text-[11px] mb-0.5 ${changed ? 'text-amber-300' : 'text-gray-500'}`}>{f.label}</span>
            <input
              type="number"
              step={f.step}
              value={v}
              onChange={(e) => onChange({ ...values, [f.key]: parseFloat(e.target.value) || 0 })}
              className="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-xs text-white tabular-nums focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </label>
        )
      })}
    </div>
  )
}

export default function StaffPanel({
  rates,
  costs,
  internal,
  total,
  onRates,
  onCosts,
}: {
  rates: Rates
  costs: InternalCosts
  internal: InternalEstimate
  total: number
  onRates: (r: Rates) => void
  onCosts: (c: InternalCosts) => void
}) {
  const [open, setOpen] = useState(false)
  const pct = internal.marginPct * 100
  const tone = internal.margin < 0 ? 'text-red-400' : pct < 15 ? 'text-amber-300' : 'text-emerald-300'

  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-400/[0.04] p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-widest text-amber-300">Staff only</span>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="text-xs text-gray-400 hover:text-white"
        >
          {open ? 'Hide rates' : 'Edit rates'}
        </button>
      </div>

      <dl className="text-sm space-y-1.5">
        <div className="flex justify-between"><dt className="text-gray-400">Validation</dt><dd className="tabular-nums text-gray-200">{internal.validationHours.toFixed(1)} h · {money(internal.validationCost)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">Processing</dt><dd className="tabular-nums text-gray-200">{money(internal.processingCost)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">Storage</dt><dd className="tabular-nums text-gray-200">{money(internal.storageCost)}</dd></div>
        <div className="flex justify-between border-t border-white/10 pt-1.5"><dt className="text-gray-400">Cost to deliver</dt><dd className="tabular-nums text-white">{money(internal.total)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">Client pays</dt><dd className="tabular-nums text-white">{money(total)}</dd></div>
        <div className="flex justify-between"><dt className="text-gray-400">Margin</dt><dd className={`tabular-nums ${tone}`}>{money(internal.margin)} ({num(pct)}%)</dd></div>
      </dl>

      {open && (
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-xs text-gray-400">Client rates</span>
              <button type="button" className="text-[11px] text-gray-500 hover:text-white" onClick={() => onRates(DEFAULT_RATES)}>Reset</button>
            </div>
            <Grid fields={RATE_FIELDS} values={rates} defaults={DEFAULT_RATES} onChange={onRates} />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-xs text-gray-400">Our costs</span>
              <button type="button" className="text-[11px] text-gray-500 hover:text-white" onClick={() => onCosts(DEFAULT_INTERNAL)}>Reset</button>
            </div>
            <Grid fields={COST_FIELDS} values={costs} defaults={DEFAULT_INTERNAL} onChange={onCosts} />
          </div>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Edits apply to this browser tab only. Changed values are highlighted.
          </p>
        </div>
      )}
    </div>
  )
}
