
'use client'

import { useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import type { ResearchMeta } from '@/lib/research'

// Colors derived from AcousticMap precedent
const TAG_COLORS = [
  '#4ecdc4','#ffe66d','#ff6b6b','#a8e6cf','#c3a6ff',
  '#ff9f43','#74b9ff','#fd79a8','#fdcb6e','#00b894'
]

// Place nodes on a golden-angle spiral so they start pre-spread with no
// overlap, instead of relying on random placement that can occasionally
// settle the physics sim into a stuck, overlapping local minimum.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

function goldenSpiralLayout(n: number, cx: number, cy: number) {
  const spacing = 140 // tuned to clear the 310px hard-collision boundary as n grows
  return Array.from({ length: n }, (_, i) => {
    const r = spacing * Math.sqrt(i + 0.5)
    const theta = i * GOLDEN_ANGLE
    return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) }
  })
}

export default function ResearchTrack({ researchItems }: { researchItems: ResearchMeta[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const nodesRef = useRef<{x: number, y: number, vx: number, vy: number, isDragging: boolean, el: HTMLDivElement|null}[]>([])
  const linesRef = useRef<(SVGLineElement|null)[]>([])
  const tagRefs = useRef<(HTMLDivElement|null)[]>([])
  const prewarmed = useRef(false)

  // Initialize node physics state synchronously so refs can attach safely.
  // Golden-angle spiral placement starts nodes already spread out, so the
  // sim settles cleanly instead of occasionally getting stuck in a bad
  // overlapping configuration.
  if (nodesRef.current.length !== researchItems.length) {
    const initialWidth = typeof window !== 'undefined' ? Math.max(window.innerWidth, 1400) : 1400
    const spiral = goldenSpiralLayout(researchItems.length, initialWidth / 2, 400)
    nodesRef.current = researchItems.map((_, i) => ({
      x: spiral[i].x,
      y: spiral[i].y,
      vx: 0, vy: 0,
      isDragging: false,
      el: nodesRef.current[i]?.el || null
    }))
  }

  // Map tags to colors, build edges, and find multi-item tags
  const { edges, multiTags } = useMemo(() => {
    const allTags = Array.from(new Set(researchItems.flatMap(r => r.tags))).sort()
    const tagColorMap = new Map<string, string>()
    allTags.forEach((t, i) => tagColorMap.set(t, TAG_COLORS[i % TAG_COLORS.length]))

    const newEdges: { source: number, target: number, color: string }[] = []
    const tagNodesMap = new Map<string, number[]>()

    researchItems.forEach((r, idx) => {
      r.tags.forEach(t => {
        if (!tagNodesMap.has(t)) tagNodesMap.set(t, [])
        tagNodesMap.get(t)!.push(idx)
      })
    })

    for (let i = 0; i < researchItems.length; i++) {
      for (let j = i + 1; j < researchItems.length; j++) {
        const shared = researchItems[i].tags.find(t => researchItems[j].tags.includes(t))
        if (shared) {
          newEdges.push({ source: i, target: j, color: tagColorMap.get(shared)! })
        }
      }
    }

    const newMultiTags: { tag: string, color: string, nodeIndices: number[] }[] = []
    tagNodesMap.forEach((indices, tag) => {
      if (indices.length > 1) {
        newMultiTags.push({ tag, color: tagColorMap.get(tag)!, nodeIndices: indices })
      }
    })

    return { edges: newEdges, multiTags: newMultiTags }
  }, [researchItems])

  // Physics loop
  useEffect(() => {
    const stepPhysics = (W: number, H: number, time: number) => {
      const nodes = nodesRef.current

      nodes.forEach((n, i) => {
        if (n.isDragging) return

        // Stronger repulsion from top and bottom edges
        const marginY = 180
        const marginX = 160
        if (n.y < marginY)       n.vy += (marginY - n.y) * 0.012
        if (n.y > H - marginY)   n.vy -= (n.y - (H - marginY)) * 0.012
        if (n.x < marginX)       n.vx += (marginX - n.x) * 0.004
        if (n.x > W - marginX)   n.vx -= (n.x - (W - marginX)) * 0.004

        // Repulsion & Collision
        nodes.forEach((n2, j) => {
          if (i === j) return
          const dx = n.x - n2.x; const dy = n.y - n2.y
          const distSq = dx*dx + dy*dy || 1
          const dist = Math.sqrt(distSq)

          if (dist < 310) { // Hard collision boundary
            const f = (310 - dist) * 0.15
            n.vx += (dx / dist) * f
            n.vy += (dy / dist) * f
          } else if (dist < 600) { // Ambient repulsion
            const f = 130 / dist
            n.vx += (dx / dist) * f
            n.vy += (dy / dist) * f
          }
        })
      })

      // Gentle tug from connections
      edges.forEach((e) => {
        const s = nodes[e.source]; const t = nodes[e.target]
        if (s.isDragging && t.isDragging) return
        const dx = t.x - s.x; const dy = t.y - s.y
        const dist = Math.sqrt(dx*dx + dy*dy) || 1
        if (dist > 350) {
          const f = (dist - 350) * 0.003
          if (!s.isDragging) { s.vx += (dx / dist) * f; s.vy += (dy / dist) * f }
          if (!t.isDragging) { t.vx -= (dx / dist) * f; t.vy -= (dy / dist) * f }
        }
      })

      // Integration
      nodes.forEach(n => {
        if (!n.isDragging) {
          n.vx *= 0.85
          n.vy *= 0.85
          // Sleep threshold — squash residual sub-pixel velocity once a node
          // is effectively at rest, so it doesn't keep micro-jittering.
          if (Math.abs(n.vx) < 0.02) n.vx = 0
          if (Math.abs(n.vy) < 0.02) n.vy = 0
          n.x += n.vx
          n.y += n.vy
        }
      })
    }

    // Pre-warm the graph so it doesn't explode on load
    if (!prewarmed.current && canvasRef.current) {
      prewarmed.current = true
      const W = canvasRef.current.clientWidth || 1200
      const H = canvasRef.current.clientHeight || 800
      for (let i = 0; i < 300; i++) stepPhysics(W, H, i * 0.016)
    }

    let animId: number
    const tick = () => {
      if (!canvasRef.current) return
      const W = canvasRef.current.clientWidth
      const H = canvasRef.current.clientHeight
      const time = Date.now() / 1000
      
      stepPhysics(W, H, time)

      const nodes = nodesRef.current

      // Update DOM
      nodes.forEach(n => {
        if (n.el) {
          // Bubble is 260x260, offset by half to center it on x/y
          n.el.style.transform = `translate(${n.x - 130}px, ${n.y - 130}px)`
        }
      })

      // Update multi-item tag centroids
      multiTags.forEach((t, idx) => {
        const el = tagRefs.current[idx]
        if (el) {
          let sumX = 0, sumY = 0
          t.nodeIndices.forEach(ni => {
            const node = nodes[ni]
            if (node) { sumX += node.x; sumY += node.y }
          })
          const cx = sumX / t.nodeIndices.length
          const cy = sumY / t.nodeIndices.length
          el.style.transform = `translate(${cx}px, ${cy}px)`
        }
      })

      edges.forEach((e, idx) => {
        const s = nodes[e.source]; const t = nodes[e.target]
        const line = linesRef.current[idx]
        if (line) {
          line.setAttribute('x1', s.x.toString())
          line.setAttribute('y1', s.y.toString())
          line.setAttribute('x2', t.x.toString())
          line.setAttribute('y2', t.y.toString())
        }
      })

      animId = requestAnimationFrame(tick)
    }
    animId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animId)
  }, [edges, researchItems])

  // Center scroll horizontally on mount if the canvas overflows
  useEffect(() => {
    if (containerRef.current && canvasRef.current) {
      const scrollMax = canvasRef.current.clientWidth - containerRef.current.clientWidth
      if (scrollMax > 0) {
        containerRef.current.scrollLeft = scrollMax / 2
      }
    }
  }, [])

  const handlePointerDown = (i: number, e: React.PointerEvent) => {
    const n = nodesRef.current[i]
    if (!n || !canvasRef.current) return
    n.isDragging = true
    n.vx = 0; n.vy = 0

    const rect = canvasRef.current.getBoundingClientRect()
    const pointerId = e.pointerId

    const containerX = e.clientX - rect.left
    const containerY = e.clientY - rect.top
    const offsetX = n.x - containerX
    const offsetY = n.y - containerY

    const initialX = e.clientX; 
    const initialY = e.clientY

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      n.x = (ev.clientX - rect.left) + offsetX
      n.y = (ev.clientY - rect.top) + offsetY
      n.vx = 0; n.vy = 0
    }
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      n.isDragging = false
      const dragDist = Math.hypot(ev.clientX - initialX, ev.clientY - initialY)
      if (dragDist > 10) {
        n.el?.setAttribute('data-dragged', 'true')
        setTimeout(() => n.el?.removeAttribute('data-dragged'), 100)
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <>
      {/* Desktop Force Graph View */}
      <div className="hidden md:flex justify-start relative w-full h-[800px] overflow-x-auto overflow-y-hidden hide-scrollbar" ref={containerRef}>
        <div className="relative h-full w-full min-w-[1400px] mx-auto" ref={canvasRef}>
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
          <defs>
            <filter id="tag-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {edges.map((e, idx) => (
            <line
              key={idx}
              ref={el => { linesRef.current[idx] = el }}
              stroke={e.color}
              strokeWidth="2.5"
              strokeOpacity="0.65"
              filter="url(#tag-glow)"
            />
          ))}
        </svg>

        {/* Multi-item Tag Centroids */}
        {multiTags.map((t, idx) => {
          const count = t.nodeIndices.length;
          const size = 100 + count * 30;
          const blur = 20 + count * 5;
          return (
            <div
              key={t.tag}
              ref={el => { tagRefs.current[idx] = el }}
              className="absolute top-0 left-0 w-0 h-0 z-[5] pointer-events-none flex items-center justify-center will-change-transform"
            >
              <div
                className="absolute rounded-full opacity-40 mix-blend-screen pointer-events-none"
                style={{
                  backgroundColor: t.color,
                  width: size,
                  height: size,
                  filter: `blur(${blur}px)`
                }}
              />
            <div className="relative bg-black/50 backdrop-blur-md border border-white/10 rounded-xl px-4 py-2 flex flex-col items-center justify-center min-w-[100px]">
              <p className="text-white text-sm font-medium leading-tight whitespace-nowrap">{t.tag}</p>
            </div>
            </div>
          )
        })}

        {researchItems.map((item, idx) => (
          <div
            key={item.slug}
            ref={el => { nodesRef.current[idx] = nodesRef.current[idx] || {}; nodesRef.current[idx].el = el as any }}
            onPointerDown={(e) => handlePointerDown(idx, e)}
            className="absolute top-0 left-0 w-[260px] h-[260px] z-10 will-change-transform touch-none flex items-center justify-center"
          >
            <Link
              href={`/research/${item.slug}`}
              onClick={(e) => { if (nodesRef.current[idx]?.el?.hasAttribute('data-dragged')) e.preventDefault() }}
              draggable={false}
              className="relative block w-[260px] hover:w-[480px] h-[260px] rounded-[130px] bg-[#0a1628]/60 backdrop-blur-sm border-2 border-white/25 hover:border-white/60 overflow-hidden group transition-all duration-500 ease-out focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-grab active:cursor-grabbing shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),0_0_25px_rgba(78,205,196,0.12)] hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25),0_0_45px_rgba(78,205,196,0.35)]"
            >
              <div className="absolute inset-0 z-0 pointer-events-none rounded-[130px] overflow-hidden">
                <Image src={item.image || '/images/merlin-kraus-F5becDFzhHc-unsplash.jpg'} fill className="object-cover opacity-30 group-hover:opacity-50 transition-opacity duration-500" alt="" draggable={false} />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(10,22,40,0.1)_0%,rgba(10,22,40,0.6)_85%,rgba(10,22,40,0.85)_100%)] group-hover:bg-[radial-gradient(ellipse_at_center,rgba(10,22,40,0.0)_20%,rgba(10,22,40,0.4)_90%,rgba(10,22,40,0.7)_100%)] transition-all duration-500" />
              </div>
              
              {/* Travel intent marker */}
              <div className="absolute right-8 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-6 transition-all duration-500 pointer-events-none flex items-center justify-center text-white drop-shadow-lg">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>

              <div className="relative z-10 p-6 w-[260px] flex-shrink-0 mx-auto h-full flex flex-col justify-center text-center pointer-events-none">
                <h3 className="font-serif text-2xl text-white mb-2 leading-tight drop-shadow-md">{item.title}</h3>
                <p className="text-gray-300 text-sm leading-relaxed line-clamp-3 drop-shadow-md">{item.excerpt}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>
      </div>
      {/* Mobile Horizontal Scroll Fallback */}
      <div className="md:hidden w-full overflow-x-auto pb-16 pt-8 hide-scrollbar snap-x snap-mandatory">
        <div className="flex gap-6 w-max px-[5vw] items-center">
          {researchItems.map((item, idx) => (
            <Link
              key={item.slug}
              href={`/research/${item.slug}`}
              className={`shrink-0 relative block w-[260px] h-[260px] rounded-[120px] bg-[#0a1628]/60 backdrop-blur-sm border border-white/35 overflow-hidden snap-center shadow-2xl ${idx % 2 === 0 ? 'mt-4' : 'mt-12'}`}
            >
              <div className="absolute inset-0 z-0 pointer-events-none rounded-[120px] overflow-hidden">
                <Image src={item.image || '/images/merlin-kraus-F5becDFzhHc-unsplash.jpg'} fill className="object-cover opacity-30" alt="" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#0a1628]/20 via-[#0a1628]/60 to-[#0a1628]/90" />
              </div>
              <div className="relative z-10 p-6 h-full flex flex-col justify-center text-center pointer-events-none">
                <h3 className="font-serif text-xl text-white mb-2 leading-tight">{item.title}</h3>
                <p className="text-gray-300 text-xs leading-relaxed line-clamp-3">{item.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  )
}