'use client'

import { useEffect, useState } from 'react'
import RequireAuth from '@/lib/auth/RequireAuth'
import { useAuth } from '@/lib/auth/AuthProvider'
import { getMe, type Me, ApiError } from '@/lib/apiClient'

const TEAL = '#4ecdc4'

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function AccountContent() {
  const { signOut } = useAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMe()
      .then((result) => { if (!cancelled) setMe(result) })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Could not load your account.')
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-2xl mx-auto px-6 py-24">
        <h1 className="font-serif text-5xl text-white mb-4">Account</h1>
        <p className="text-xl text-gray-400 mb-12">
          Manage your Nature Commons account and subscription.
        </p>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}

        <div className="bg-white/5 border border-white/15 rounded-2xl p-6 md:p-8 mb-6">
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            Profile
          </p>
          {me ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-400">Email</dt>
                <dd className="text-white">{me.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-400">Member since</dt>
                <dd className="text-white">{formatJoined(me.createdAt)}</dd>
              </div>
            </dl>
          ) : (
            !error && <p className="text-gray-500 text-sm">Loading…</p>
          )}
        </div>

        <div className="bg-white/5 border border-white/15 rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <p className="text-xs tracking-widest uppercase font-medium" style={{ color: TEAL }}>
              Subscription
            </p>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/10 text-gray-300 border border-white/15">
              Coming soon
            </span>
          </div>
          <p className="text-gray-300 leading-relaxed">
            Viewing and labeling data in the shared Public project stays free, always. Paid
            subscriptions — for your own private projects, data storage, and model training —
            aren&apos;t open yet.
          </p>
        </div>

        <button
          onClick={signOut}
          className="px-6 py-2.5 rounded-full text-sm font-medium border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-white"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  )
}
