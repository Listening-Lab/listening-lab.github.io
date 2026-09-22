'use client'

import { useRef, useState } from 'react'
import { filesFromDataTransfer } from '@/lib/dropZoneFiles'

/**
 * One drop target for either loose files or a whole folder — no separate "choose files"
 * vs "choose folder" controls. Drag either in (a folder's structure is preserved via
 * filesFromDataTransfer); click falls back to a plain multi-file browse, since a native
 * click-triggered picker can't offer both files and folders in one dialog.
 */
export default function FileDropZone({
  onFiles,
  disabled,
  accept = 'audio/*',
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
  accept?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragDepth = useRef(0)

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault()
    if (disabled) return
    dragDepth.current += 1
    setDragActive(true)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragActive(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setDragActive(false)
    if (disabled) return
    const files = await filesFromDataTransfer(e.dataTransfer)
    if (files.length > 0) onFiles(files)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (files && files.length > 0) onFiles(Array.from(files))
    e.target.value = ''
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        disabled ? 'opacity-60 cursor-not-allowed border-white/10' : 'cursor-pointer'
      } ${dragActive ? 'border-brand-500 bg-brand-500/10' : 'border-white/20 hover:border-white/35'}`}
    >
      <p className="text-white text-sm font-medium">
        Drag audio files or a folder here
      </p>
      <p className="text-gray-400 text-xs mt-1">or click to browse files — dropping a folder keeps its structure</p>
      <input ref={inputRef} type="file" multiple accept={accept} hidden disabled={disabled} onChange={handleInputChange} />
    </div>
  )
}
