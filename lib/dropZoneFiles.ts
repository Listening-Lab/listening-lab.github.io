/**
 * Resolves whatever was dropped onto a drop zone — one file, many files, a folder, or a
 * mix — into a flat File[] list. A dropped folder is walked recursively via the browser's
 * File and Directory Entries API, and each file inside it gets a synthesized
 * `webkitRelativePath` (matching what `<input webkitdirectory>` would have given it) so
 * downstream code (see app/projects/upload/page.tsx's buildRow) doesn't need to know
 * whether a file arrived via drag-and-drop or a folder `<input>` — both look identical.
 */
export async function filesFromDataTransfer(dataTransfer: DataTransfer): Promise<File[]> {
  const items = dataTransfer.items
  if (!items || items.length === 0) return Array.from(dataTransfer.files ?? [])

  const entries: FileSystemEntry[] = []
  for (let i = 0; i < items.length; i++) {
    const entry = items[i].webkitGetAsEntry?.()
    if (entry) entries.push(entry)
  }
  // Browsers without the entries API (rare today) fall back to the flat file list — folder
  // drops just won't preserve structure there, but individual files still work.
  if (entries.length === 0) return Array.from(dataTransfer.files ?? [])

  const files: File[] = []

  async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    const all: FileSystemEntry[] = []
    // readEntries() must be called repeatedly until it returns empty — Chrome caps each
    // call at 100 entries, it isn't a one-shot "give me everything" call.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
      if (batch.length === 0) break
      all.push(...batch)
    }
    return all
  }

  async function walk(entry: FileSystemEntry, path: string): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
      Object.defineProperty(file, 'webkitRelativePath', { value: `${path}${entry.name}`, configurable: true })
      files.push(file)
    } else if (entry.isDirectory) {
      const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader())
      await Promise.all(children.map((child) => walk(child, `${path}${entry.name}/`)))
    }
  }

  await Promise.all(entries.map((entry) => walk(entry, '')))
  return files
}
