'use client'

import { useEffect, useState } from 'react'

export interface NZBird {
  scientific: string
  common: string
  maori: string
}

interface NZBirdList {
  species: NZBird[]
}

// Wilderlab's curated NZ Aves whitelist (public/edna_aves_species.json, ~127 species) -
// originally vendored "for Perch v2 restriction" and unused until now. Doubles as: the
// scientific->common name lookup for every species-code display in the app (most people
// don't know scientific names), and the "could plausibly occur in NZ" universe for
// coverage stats and the training species picker's "select all NZ birds" shortcut.
// Perch's own class list (~14,795 species, global) has no common-name data of its own -
// species outside this whitelist just fall back to showing their scientific name.
let cached: Promise<NZBird[]> | null = null

function loadNZBirds(): Promise<NZBird[]> {
  if (!cached) {
    cached = fetch('/edna_aves_species.json')
      .then((r) => r.json())
      .then((d: NZBirdList) => d.species)
      .catch(() => [])
  }
  return cached
}

export function useSpeciesNames() {
  const [birds, setBirds] = useState<NZBird[] | null>(null)

  useEffect(() => {
    let cancelled = false
    loadNZBirds().then((b) => { if (!cancelled) setBirds(b) })
    return () => { cancelled = true }
  }, [])

  const byScientific = new Map((birds ?? []).map((b) => [b.scientific, b]))

  return {
    ready: birds !== null,
    /** English common name for a species code, or the code itself if not in the NZ
     *  whitelist (e.g. a rare vagrant Perch's global class list still covers). */
    commonName: (speciesCode: string) => byScientific.get(speciesCode)?.common || speciesCode,
    nzBirds: birds ?? [],
  }
}
