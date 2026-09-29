'use client'

import Link from 'next/link'
import { CURRENCY, money, num, type Estimate, type PricingInput } from '@/lib/pricing'

function Row({ label, detail, amount, muted }: { label: string; detail?: string; amount: string; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 border-b border-white/10">
      <div>
        <div className={muted ? 'text-gray-400 text-sm' : 'text-gray-200 text-sm'}>{label}</div>
        {detail && <div className="text-xs text-gray-500 mt-0.5">{detail}</div>}
      </div>
      <div className="text-sm text-white tabular-nums whitespace-nowrap">{amount}</div>
    </div>
  )
}

/** The headline price on its own, for pinning above a scrolling panel. */
export function EstimateSummary({ input, est, onBreakdown }: { input: PricingInput; est: Estimate; onBreakdown?: () => void }) {
  if (input.levels.length === 0) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-gray-500">{CURRENCY}</span>
        <span className="text-2xl font-medium text-gray-600">&ndash;</span>
        <span className="text-sm text-gray-500 ml-1">Select what you want to know</span>
      </div>
    )
  }
  const months = input.studyMonths
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-gray-500">{CURRENCY}</span>
          <span className="text-2xl font-medium text-white tabular-nums tracking-tight">{money(est.perMonth)}</span>
          <span className="text-sm text-gray-400">/ month</span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5 tabular-nums">
          {CURRENCY} {money(est.total)} over {months} {months === 1 ? 'month' : 'months'}
          <span className="text-gray-600"> · excl. GST</span>
        </div>
      </div>
      {onBreakdown && (
        <button type="button" onClick={onBreakdown} className="text-xs text-gray-400 hover:text-white shrink-0 pb-0.5">
          Breakdown ↓
        </button>
      )}
    </div>
  )
}

export default function EstimatePanel({ input, est, pinned }: { input: PricingInput; est: Estimate; pinned?: boolean }) {
  const months = input.studyMonths

  // The headline is pinned elsewhere; only the breakdown is needed here.
  if (pinned && input.levels.length === 0) return null

  if (input.levels.length === 0) {
    return (
      <div>
        <h2 className="font-serif text-xl text-white mb-4">Estimate</h2>
        <div className="rounded-lg bg-white/[0.04] border border-white/10 px-4 py-4">
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-gray-500">{CURRENCY}</span>
            <span className="text-4xl font-medium text-gray-600">&ndash;</span>
          </div>
          <div className="text-sm text-gray-400 mt-1.5">Select what you want to know to see an estimate.</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="font-serif text-xl text-white mb-4">{pinned ? 'Cost breakdown' : 'Estimate'}</h2>

      <div className={`rounded-lg bg-white/[0.04] border border-white/10 px-4 py-4 mb-5 ${pinned ? 'hidden' : ''}`}>
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-gray-500">{CURRENCY}</span>
          <span className="text-4xl font-medium text-white tabular-nums tracking-tight">{money(est.perMonth)}</span>
          <span className="text-sm text-gray-400">/ month</span>
        </div>
        <div className="text-sm text-gray-400 mt-1.5 tabular-nums">
          {CURRENCY} {money(est.total)} over {months} {months === 1 ? 'month' : 'months'}
          <span className="text-gray-600"> · excl. GST</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-1">
        {num(input.audioHours)} audio-hours · {num(input.devices)} {input.devices === 1 ? 'device' : 'devices'} at once
      </p>

      <h3 className="text-xs uppercase tracking-widest text-gray-500 mt-4">Analysis</h3>
      {est.analysisLines.map((l) => (
        <Row key={l.key} label={l.label} detail={l.detail} amount={money(l.amount)} />
      ))}
      {est.minimumApplied && (
        <Row
          label="Minimum engagement"
          detail={`Analysis below ${money(est.analysisFee)} is charged at the minimum`}
          amount={'+' + money(est.analysisFee - est.analysisSubtotal)}
          muted
        />
      )}

      <h3 className="text-xs uppercase tracking-widest text-gray-500 mt-5">Processing and storage</h3>
      <Row label="Processing" detail={`${num(input.audioHours)} audio-hours`} amount={money(est.processingFee)} />
      <Row
        label="Storage"
        detail={`Builds up to ${num(est.storageGb)} GB of lossless audio`}
        amount={money(est.storageTotal)}
      />

      <p className="text-xs text-gray-500 mt-4 leading-relaxed">
        Indicative only. Processing and storage are charged as used, and you see the exact cost before
        any audio is processed. Hardware is extra, at cost. Study design help is included, up to
        10 hours. See the <Link href="/terms/service" className="underline hover:text-white">service terms</Link>.
      </p>
    </div>
  )
}
