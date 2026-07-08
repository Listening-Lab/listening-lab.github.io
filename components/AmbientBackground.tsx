'use client'
import { useEffect, useRef } from 'react'

const BLOBS = [
  { colorRGB: '78, 205, 196',   freq: 0.05, phase: 0.0, radius: 250, size: 1200 }, // TEAL
  { colorRGB: '195, 166, 255',  freq: 0.04, phase: 2.1, radius: 350, size: 1500 }, // PURPLE
  { colorRGB: '116, 185, 255',  freq: 0.06, phase: 4.2, radius: 300, size: 1300 }, // BLUE
  { colorRGB: '255, 159, 67',   freq: 0.03, phase: 1.4, radius: 450, size: 1800 }, // ORANGE
  { colorRGB: '253, 121, 168',  freq: 0.04, phase: 3.3, radius: 400, size: 1400 }, // PINK
]

export default function AmbientBackground() {
  const bgRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bgRef.current
    if (!el) return
    let raf: number
    let curX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0
    let curY = typeof window !== 'undefined' ? window.innerHeight / 2 : 0
    let mouseX = curX
    let mouseY = curY
    const start = performance.now()

    const animate = (now: number) => {
      const rect = el.getBoundingClientRect()
      const tx = mouseX - rect.left
      const ty = mouseY - rect.top
      curX += (tx - curX) * 0.015
      curY += (ty - curY) * 0.015
      const t = (now - start) / 1000
      BLOBS.forEach((b, i) => {
        const ox = Math.cos(t * b.freq + b.phase) * b.radius
        const oy = Math.sin(t * b.freq * 1.3 + b.phase) * b.radius
        el.style.setProperty(`--bx${i}`, `${(curX + ox).toFixed(1)}px`)
        el.style.setProperty(`--by${i}`, `${(curY + oy).toFixed(1)}px`)
      })
      raf = requestAnimationFrame(animate)
    }
    raf = requestAnimationFrame(animate)

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX
      mouseY = e.clientY
    }
    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={bgRef} className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: b.size,
            height: b.size,
            left: `var(--bx${i}, 50%)`,
            top: `var(--by${i}, 50%)`,
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, rgba(${b.colorRGB}, 0.07) 0%, rgba(${b.colorRGB}, 0) 70%)`,
          }}
        />
      ))}
    </div>
  )
}