'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'

const TEAL = '#4ecdc4'

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [atTop, setAtTop] = useState(true)

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        atTop ? 'bg-transparent' : 'bg-ocean-dark/95 backdrop-blur'
      }`}
    >
      <nav className="w-full px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/assets/logo_transparent.png"
            alt="Listening Lab"
            width={30}
            height={30}
            className="h-10 w-auto mix-blend-lighten"
          />
        </Link>

        <div className="flex items-center gap-4">
          <Link
            href="/#about"
            className="px-4 py-1.5 rounded-full text-sm transition-colors"
            style={{ color: 'rgba(255,255,255,0.75)' }}
          >
            About
          </Link>
          <Link
            href="/contact"
            className="px-4 py-1.5 rounded-full text-sm transition-colors"
            style={{
              color: pathname === '/contact' ? TEAL : 'rgba(255,255,255,0.75)',
              fontWeight: pathname === '/contact' ? 500 : undefined,
            }}
          >
            Contact
          </Link>
          {user ? (
            <>
              <Link
                href="/projects"
                className="px-4 py-1.5 rounded-full text-sm transition-colors"
                style={{
                  color: pathname === '/projects' ? TEAL : 'rgba(255,255,255,0.75)',
                  fontWeight: pathname === '/projects' ? 500 : undefined,
                }}
              >
                Projects
              </Link>
              <Link
                href="/account"
                className="px-4 py-1.5 rounded-full text-sm transition-colors"
                style={{
                  color: pathname === '/account' ? TEAL : 'rgba(255,255,255,0.75)',
                  fontWeight: pathname === '/account' ? 500 : undefined,
                }}
              >
                Account
              </Link>
              <button
                onClick={() => { signOut(); router.push('/') }}
                className="px-4 py-1.5 rounded-full text-sm font-medium border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-white"
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-full text-sm font-medium border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-white"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}
