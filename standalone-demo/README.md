# Bird Species Explorer — Standalone Demo

A lightweight, standalone demo that takes a bird species prompt (common, Māori, or scientific name) and returns a high-resolution photograph and comprehensive biological profile.

This demo runs completely standalone and **does not modify any files in the current Listening Lab website**.

---

## What's Included

1. **`index.html`** — Interactive Web Application
   - Single-file zero-dependency web app with real-time search.
   - Built with Tailwind CSS and responsive design matching the Listening Lab aesthetic.
   - Live photo display with high-resolution lightbox modal.
   - Comprehensive taxonomy, conservation status, encyclopedic summary, and bioacoustic links (Xeno-Canto recordings).
   - Quick-pick preset prompts for iconic species (*Kea*, *Tūī*, *Kākāpō*, *Kiwi*, *Pīwakawaka / Fantail*, *Ruru / Morepork*, *Peregrine Falcon*, *Barn Owl*).

2. **`demo.py`** — Terminal & CLI Tool
   - Python script (uses only standard library, zero `pip` dependencies needed).
   - Interactive prompt or command-line query argument.
   - Formatted ANSI output displaying names, classification, conservation status, summary text, photo URLs, and sound links.

3. **`BirdSpeciesDemo.tsx`** — Future-Ready React Component
   - Modular TypeScript React component ready to be dropped into `components/` and MDX pages whenever you are ready to integrate it into the website.

---

## How to Run

### 1. Web Demo
Simply open `standalone-demo/index.html` directly in any web browser:
- Double-click `index.html` in File Explorer, or
- Run a quick local server (optional):
  ```bash
  python -m http.server 8000 --directory standalone-demo
  ```
  and open `http://localhost:8000`.

### 2. Python CLI
Run with a species name as an argument:
```bash
python standalone-demo/demo.py "Kea"
```
Or with the `--open` flag to automatically open the photo in your default browser:
```bash
python standalone-demo/demo.py "Tui" --open
```
Or run interactively:
```bash
python standalone-demo/demo.py
```

---

## Data Sources
- **Wikipedia REST & Search APIs**: Used for high-resolution photography, encyclopedic summary extracts, and article references.
- **iNaturalist API**: Used for taxonomic classification (Order, Family, Genus, Species), conservation status rankings, and global sighting counts.
- **Xeno-Canto**: Provides linked acoustic soundscapes and recordings for bioacoustic cross-referencing.
- Fully client-side and CORS-compatible: requires no API keys and no backend server.
