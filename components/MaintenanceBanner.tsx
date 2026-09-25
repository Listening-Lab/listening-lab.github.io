'use client'

import { useEffect, useState } from 'react'

interface MaintenanceConfig {
  enabled: boolean
  /** ISO 8601 - when the maintenance window starts. */
  start: string
  /** ISO 8601 - when it's expected to finish. The banner disappears after this. */
  end: string
  /** Optional extra sentence, e.g. "Uploads will be unavailable." */
  note?: string
}

const DISMISS_PREFIX = 'll:maintenance-dismissed:'

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/**
 * A quiet, dismissible note about planned downtime. Driven by /maintenance.json (edit that file and
 * redeploy the site to switch it on or off) and fetched at runtime rather than baked into the build,
 * so it also shows while the API is down - the static site doesn't depend on it.
 */
export default function MaintenanceBanner() {
  const [config, setConfig] = useState<MaintenanceConfig | null>(null)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/maintenance.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MaintenanceConfig | null) => {
        if (cancelled || !data || !data.enabled) return
        if (Date.now() > new Date(data.end).getTime()) return
        setConfig(data)
        try {
          setDismissed(localStorage.getItem(DISMISS_PREFIX + data.start) === '1')
        } catch {
          setDismissed(false)
        }
      })
      .catch(() => {
        // No config or offline: simply no banner.
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (!config || dismissed) return null

  const inProgress = Date.now() >= new Date(config.start).getTime()

  function dismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_PREFIX + config!.start, '1')
    } catch {
      // Not persisted - it will just show again next visit.
    }
  }

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-40 max-w-sm rounded-lg border border-amber-300/30 bg-[#0a1628]/95 px-4 py-3 text-xs text-amber-100 shadow-lg backdrop-blur"
    >
      <div className="flex items-start gap-3">
        <p className="leading-relaxed">
          {inProgress ? (
            <>
              <span className="font-medium">Maintenance in progress.</span> The site may be unavailable or behave
              unexpectedly until about {fmt(config.end)}.
            </>
          ) : (
            <>
              <span className="font-medium">Scheduled maintenance</span> from {fmt(config.start)} to {fmt(config.end)}.
              The site may be unavailable for part of this time.
            </>
          )}
          {config.note ? ` ${config.note}` : ''}
        </p>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-amber-200/70 hover:text-white transition-colors leading-none text-base"
        >
          ×
        </button>
      </div>
    </div>
  )
}
