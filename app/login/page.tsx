'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/AuthProvider'

type Mode = 'signin' | 'signup'

function friendlyAuthError(err: unknown): string {
  const code = (err as { code?: string })?.code || ''
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

export default function LoginPage() {
  const router = useRouter()
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, isConfigured } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setStatus('submitting')
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
      } else {
        await signUpWithEmail(email, password)
      }
      router.push('/projects')
    } catch (err) {
      setError(friendlyAuthError(err))
      setStatus('idle')
    }
  }

  async function handleGoogle() {
    setError(null)
    setStatus('submitting')
    try {
      await signInWithGoogle()
      router.push('/projects')
    } catch (err) {
      setError(friendlyAuthError(err))
      setStatus('idle')
    }
  }

  return (
    <div className="min-h-screen bg-ocean-dark flex items-center justify-center px-6 py-24">
      <div className="w-full max-w-sm">
        <h1 className="font-serif text-4xl text-white mb-2">
          {mode === 'signin' ? 'Sign In' : 'Create Account'}
        </h1>
        <p className="text-gray-400 mb-8 text-sm">
          Access your Listening Lab projects and recordings.
        </p>

        {!isConfigured && (
          <p className="text-amber-400 text-sm bg-amber-400/10 border border-amber-400/20 rounded-lg px-4 py-3 mb-6">
            Sign-in is not configured yet on this deployment.
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <input
              id="email" type="email" required autoComplete="email"
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              id="password" type="password" required minLength={6}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={status === 'submitting' || !isConfigured}
            className="w-full bg-white text-ocean-dark px-8 py-3 rounded-full font-medium hover:bg-brand-50 transition-colors disabled:opacity-60"
          >
            {status === 'submitting' ? 'Please wait…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-white/10 flex-1" />
          <span className="text-xs text-gray-500 uppercase tracking-wider">or</span>
          <div className="h-px bg-white/10 flex-1" />
        </div>

        <button
          onClick={handleGoogle}
          disabled={status === 'submitting' || !isConfigured}
          className="w-full bg-white/10 text-white border border-white/20 px-8 py-3 rounded-full font-medium hover:bg-white/20 transition-colors disabled:opacity-60"
        >
          Continue with Google
        </button>

        <p className="text-sm text-gray-400 mt-8 text-center">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
            className="text-brand-500 hover:underline"
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>

        <p className="text-sm text-gray-500 mt-4 text-center">
          <Link href="/" className="hover:text-white transition-colors">← Back to Home</Link>
        </p>
      </div>
    </div>
  )
}
