'use client'
import { useRef } from 'react'

interface GlintCardProps {
  children: React.ReactNode
  className?: string
}

// Wraps a card and draws a thin border ring that lights up near the cursor.
// The glow is a radial gradient clipped via mask-XOR so it only ever shows
// on the border stroke, never bleeding into the card's interior.
export default function GlintCard({ children, className = '' }: GlintCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect || !glowRef.current) return
    glowRef.current.style.setProperty('--gx', `${e.clientX - rect.left}px`)
    glowRef.current.style.setProperty('--gy', `${e.clientY - rect.top}px`)
    glowRef.current.style.opacity = '1'
  }

  const handleLeave = () => {
    if (glowRef.current) glowRef.current.style.opacity = '0'
  }

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className={`relative ${className}`}
    >
      {children}
      <div ref={glowRef} aria-hidden className="glint-ring" />
      <style jsx>{`
        .glint-ring {
          position: absolute;
          inset: 0;
          z-index: 20;
          pointer-events: none;
          opacity: 0;
          transition: opacity 300ms ease;
          border-radius: inherit;
          padding: 1px;
          background: radial-gradient(
            350px circle at var(--gx, -9999px) var(--gy, -9999px),
            rgba(255, 255, 255, 0.8),
            rgba(78, 205, 196, 0.4) 30%,
            transparent 70%
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
        }
      `}</style>
    </div>
  )
}