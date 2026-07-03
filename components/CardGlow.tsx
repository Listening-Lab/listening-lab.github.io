'use client'
import { useEffect, useRef, ReactNode } from 'react'

interface Props {
  children: ReactNode
  className?: string
  color?: string
}

// Tracks the cursor across the whole page (not just on-hover) and exposes
// its position as CSS vars relative to this card, so the glow drifts
// naturally as the mouse moves anywhere — including cards it hasn't reached yet.
export default function CardGlow({ children, className = '', color = '#4ecdc4' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    let x = 0, y = 0
    const apply = () => {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${x - rect.left}px`)
      el.style.setProperty('--my', `${y - rect.top}px`)
      raf = 0
    }
    const onMove = (e: MouseEvent) => {
      x = e.clientX; y = e.clientY
      if (!raf) raf = requestAnimationFrame(apply)
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div
      ref={ref}
      className={`group relative overflow-hidden transition-transform duration-300 hover:-translate-y-1 ${className}`}
      style={{ ['--accent' as any]: `${color}80` }}
    >
      <div
        className="cursor-glow pointer-events-none absolute inset-0 opacity-70 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `
            radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), ${color}59, transparent 60%),
            radial-gradient(600px circle at var(--mx, 50%) var(--my, 50%), ${color}26, transparent 65%)
          `,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ boxShadow: `inset 0 0 0 1px ${color}40, 0 12px 28px -16px ${color}55` }}
      />
      <div className="relative z-10 h-full flex flex-col items-center">
        {children}
      </div>
    </div>
  )
}