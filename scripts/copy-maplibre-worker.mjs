// Turbopack's dev bundling doesn't give maplibre-gl a real http(s) import.meta.url, so
// its auto-detected worker URL resolution (see maplibre-gl.mjs's `Ki()`) falls back to
// an empty string, and `new Worker('')` silently resolves to the *page's own* URL,
// instantly failing (parsing HTML as a JS module) — the map's vector tiles then never
// load, no error thrown, no console output; it just renders a blank/black basemap.
//
// Fix: serve maplibre-gl's own worker bundle as a static asset and point
// maplibregl.setWorkerUrl() at it explicitly (see components/ProjectMap.tsx). This
// script copies that file into public/ on every install so it can't drift out of sync
// with whatever maplibre-gl version package.json resolves to.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'node_modules', 'maplibre-gl', 'dist')
const destDir = join(__dirname, '..', 'public')

// maplibre-gl-worker.mjs has a relative `import ... from "./maplibre-gl-shared.mjs"` —
// since it's served raw (unprocessed by Turbopack) as a static file, that sibling has to
// exist at the same public path too, or the worker fails to load with no clear error.
const files = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']

mkdirSync(destDir, { recursive: true })
for (const file of files) {
  const src = join(distDir, file)
  if (!existsSync(src)) {
    console.warn(`[copy-maplibre-worker] source not found, skipping: ${src}`)
    continue
  }
  copyFileSync(src, join(destDir, file))
  console.log(`[copy-maplibre-worker] copied ${file}`)
}
