'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Project } from '@/lib/apiClient'

/**
 * Everything except the primary "Map" link, tucked behind a dropdown — the project list
 * was getting cluttered with a 5-6 button row per project as more pages were added.
 */
export default function ProjectActionsMenu({ project }: { project: Project }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const items = [
    { label: 'Files', href: `/projects/files?projectId=${encodeURIComponent(project.id)}` },
    { label: 'Label', href: `/projects/labeling?projectId=${encodeURIComponent(project.id)}` },
    { label: 'Models', href: `/projects/models?projectId=${encodeURIComponent(project.id)}` },
    { label: 'Upload', href: `/projects/map?projectId=${encodeURIComponent(project.id)}&panel=upload` },
    ...(project.role === 'admin'
      ? [{ label: 'Members', href: `/projects/members?projectId=${encodeURIComponent(project.id)}` }]
      : []),
  ]

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-expanded={open}
        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20 hover:text-white transition-colors"
      >
        <span aria-hidden className="text-lg leading-none -mt-1">⋯</span>
      </button>
      {open && (
        <ul className="absolute right-0 mt-2 w-40 bg-[#0a1628] border border-white/20 rounded-lg shadow-2xl z-20 py-1 overflow-hidden">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-gray-200 hover:bg-white/10 transition-colors"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
