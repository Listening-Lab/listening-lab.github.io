'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth/AuthProvider'
import { getMe } from '@/lib/apiClient'

/**
 * Staff view of the pricing pages: `?internal` in the URL and a signed-in account on the
 * API's early-access list.
 *
 * Temporary. This hides the internal cost model from clients' screens, not from the
 * bundle: the defaults in lib/pricing.ts ship to every visitor. Before these pages go
 * public, the internal costs move behind the API and a real staff role replaces
 * early access.
 */
export function useStaffView(): boolean {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const wanted = searchParams.has('internal')
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (!wanted || !user) {
      setAllowed(false)
      return
    }
    let cancelled = false
    getMe()
      .then((me) => { if (!cancelled) setAllowed(!!me.earlyAccess) })
      .catch(() => { if (!cancelled) setAllowed(false) })
    return () => { cancelled = true }
  }, [wanted, user])

  return wanted && allowed
}
