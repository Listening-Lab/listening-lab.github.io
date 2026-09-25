import type { Asset } from '@/lib/apiClient'

/** Shared by ProjectMap and ProjectMapSidebar - both refetch on this cadence for as long
 *  as any asset is still pending/processing, so a recording finishing while its status is
 *  on screen (map marker colors, the Overview panel's counts) updates on its own instead
 *  of needing a manual refresh or a remount. Same interval as useJobPolling, for the same
 *  reason: frequent enough to feel live, far below anything that could strain the API. */
export const ASSET_POLL_INTERVAL_MS = 5000

export function hasUnsettledAsset(assets: Asset[]): boolean {
  return assets.some((a) => a.latestJobStatus === 'pending' || a.latestJobStatus === 'processing')
}
