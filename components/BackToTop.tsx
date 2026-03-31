'use client'
import { useState, useEffect } from 'react'

export default function BackToTop() {
  const [atTop, setAtTop] = useState(true)

  useEffect(() => {
    const onScroll = () => setAtTop(window.scrollY < 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <style>{`
        @keyframes btt-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(78,205,196,0.25); }
          50%       { box-shadow: 0 0 0 6px rgba(78,205,196,0); }
        }
      `}</style>
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Back to top"
        style={{
          animation: 'btt-pulse 2.4s ease-in-out infinite',
          opacity: atTop ? 0 : 1,
          pointerEvents: atTop ? 'none' : 'auto',
          transition: 'opacity 0.4s ease',
        }}
        className="fixed bottom-6 right-6 z-50 w-10 h-10 rounded-full bg-ocean-dark border border-white/20 flex items-center justify-center text-white/60 hover:text-white hover:border-white/40 hover:bg-ocean-mid transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 12V4M4 7l4-4 4 4"/>
        </svg>
      </button>
    </>
  )
}
