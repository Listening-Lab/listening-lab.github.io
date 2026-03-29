'use client'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const links = [
  { href: '/', label: 'Home' },
  { href: '/about', label: 'About' },
  // { href: '/research', label: 'Research' },
  { href: '/team', label: 'Team' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
]

const TEAL = '#4ecdc4'

export default function Navbar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [atTop, setAtTop] = useState(true)
  const [hoveredLink, setHoveredLink] = useState<string | null>(null)

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
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image
            src="/assets/logo_transparent.png"
            alt="Listening Lab"
            width={30}
            height={30}
            className="h-10 w-auto mix-blend-lighten"
          />
        </Link>

        {/* Desktop */}
        <ul
          className="hidden md:flex items-center gap-1"
          onMouseLeave={() => setHoveredLink(null)}
        >
          {links.map(link => {
            const isActive = pathname === link.href
            return (
              <li key={link.href} className="relative">
                {hoveredLink === link.href && (
                  <motion.div
                    layoutId="nav-highlight"
                    className="absolute inset-0 rounded-full"
                    style={{ backgroundColor: `${TEAL}20`, border: `1px solid ${TEAL}30` }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Link
                  href={link.href}
                  onMouseEnter={() => setHoveredLink(link.href)}
                  className="relative z-10 px-4 py-1.5 rounded-full text-sm transition-colors block"
                  style={{
                    color: isActive ? TEAL : 'rgba(255,255,255,0.75)',
                    fontWeight: isActive ? 500 : undefined,
                  }}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-dot"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{ backgroundColor: TEAL }}
                    />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden p-2 text-white"
          aria-label="Toggle menu"
        >
          <span className={`block w-5 h-0.5 bg-current transition-transform ${open ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`block w-5 h-0.5 bg-current mt-1 transition-opacity ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-current mt-1 transition-transform ${open ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden overflow-hidden bg-ocean-dark border-b border-white/10"
          >
            <ul className="px-6 pb-4 space-y-3">
              {links.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className="block py-2 text-sm transition-colors"
                    style={{ color: pathname === link.href ? TEAL : 'rgba(255,255,255,0.7)' }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}
