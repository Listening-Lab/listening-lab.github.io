'use client'

import { useState, useEffect } from 'react'

export interface SpeciesData {
  commonName: string
  scientificName: string
  description: string
  extract: string
  photoUrl: string
  photoAttribution: string
  conservationStatus: string
  rank: string
  order: string
  family: string
  genus: string
  observationsCount: string
  wikiUrl: string
  inatUrl: string
  audioUrl: string
}

const PRESETS = [
  { label: '🦜 Kea', query: 'Kea' },
  { label: '🐦 Tūī', query: 'Tūī' },
  { label: '🦉 Kākāpō', query: 'Kākāpō' },
  { label: '🥝 Kiwi', query: 'Kiwi' },
  { label: '🪶 Pīwakawaka', query: 'New Zealand fantail' },
  { label: '🦉 Ruru (Morepork)', query: 'Morepork' },
  { label: '🦅 Peregrine Falcon', query: 'Peregrine falcon' },
  { label: '🦉 Barn Owl', query: 'Barn owl' },
]

function normalizeText(text?: string | null): string {
  if (!text) return ''
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

export default function BirdSpeciesDemo() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [species, setSpecies] = useState<SpeciesData | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  async function handleSearch(searchTerm: string) {
    if (!searchTerm.trim()) return
    setLoading(true)
    setError(null)

    try {
      // 1. Fetch Wikipedia
      let wikiData: any = null
      try {
        const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchTerm)}`)
        if (summaryRes.ok) {
          const json = await summaryRes.json()
          if (json.extract && json.type !== 'disambiguation') {
            wikiData = json
          }
        }
        if (!wikiData) {
          const searchRes = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(searchTerm + ' bird')}&format=json&origin=*`)
          if (searchRes.ok) {
            const searchJson = await searchRes.json()
            const hits = searchJson.query?.search
            if (hits && hits.length > 0) {
              const bestTitle = hits[0].title
              const detailRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`)
              if (detailRes.ok) wikiData = await detailRes.json()
            }
          }
        }
      } catch (e) {
        console.warn('Wikipedia fetch failed', e)
      }

      // 2. Fetch iNaturalist
      let inatData: any = null
      const queriesToTry = [searchTerm]
      if (wikiData?.title && wikiData.title.toLowerCase() !== searchTerm.toLowerCase()) {
        queriesToTry.push(wikiData.title)
      }

      const normQ = normalizeText(searchTerm)
      for (const qTry of queriesToTry) {
        try {
          const res = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(qTry)}&taxon_id=3&per_page=10`)
          if (!res.ok) continue
          const data = await res.json()
          if (data.results && data.results.length > 0) {
            const exact = data.results.find((r: any) => {
              const common = normalizeText(r.preferred_common_name)
              const sci = normalizeText(r.name)
              return normQ === common || normQ === sci
            })
            inatData = exact || data.results.find((r: any) => r.rank === 'species' || r.rank === 'subspecies') || data.results[0]
            if (inatData) break
          }
        } catch (e) {
          console.warn('iNaturalist fetch failed', e)
        }
      }

      if (!wikiData && !inatData) {
        setError(`We couldn't locate information for "${searchTerm}". Try checking the spelling or picking a suggestion.`)
        setSpecies(null)
        setLoading(false)
        return
      }

      // Merge data
      const common = inatData?.preferred_common_name || wikiData?.title || searchTerm
      const sci = inatData?.name || ''
      const photo = wikiData?.originalimage?.source || wikiData?.thumbnail?.source || inatData?.default_photo?.medium_url || ''
      const photoCredit = wikiData?.originalimage?.source ? 'Wikimedia Commons' : (inatData?.default_photo?.attribution || 'iNaturalist')
      
      const status = inatData?.conservation_status?.status_name || 
        (wikiData?.extract?.toLowerCase().includes('endangered') ? 'Endangered' : 
        (wikiData?.extract?.toLowerCase().includes('vulnerable') ? 'Vulnerable' : 'Least Concern'))

      setSpecies({
        commonName: common,
        scientificName: sci,
        description: wikiData?.description || `${inatData?.rank || 'Species'} in class Aves`,
        extract: wikiData?.extract || 'Biological record retrieved from open biodiversity databases.',
        photoUrl: photo,
        photoAttribution: photoCredit,
        conservationStatus: status,
        rank: inatData?.rank || 'species',
        order: inatData?.ancestors?.find((a: any) => a.rank === 'order')?.name || '-',
        family: inatData?.ancestors?.find((a: any) => a.rank === 'family')?.name || '-',
        genus: inatData?.ancestors?.find((a: any) => a.rank === 'genus')?.name || (sci ? sci.split(' ')[0] : '-'),
        observationsCount: inatData?.observations_count ? inatData.observations_count.toLocaleString() : '1,000+',
        wikiUrl: wikiData?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(common)}`,
        inatUrl: inatData?.id ? `https://www.inaturalist.org/taxa/${inatData.id}` : `https://www.inaturalist.org/search?q=${encodeURIComponent(common)}`,
        audioUrl: `https://xeno-canto.org/explore?query=${encodeURIComponent(sci || common)}`,
      })
    } catch (err) {
      setError('An unexpected error occurred while communicating with species databases.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Initial lookup demonstration
    handleSearch('Kea')
  }, [])

  return (
    <div className="w-full max-w-4xl mx-auto my-8 font-sans">
      {/* Search Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSearch(query)
        }}
        className="relative flex items-center mb-4"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter bird species (e.g. Kea, Tūī, Peregrine Falcon, Kākāpō...)"
          className="w-full pl-5 pr-28 py-3.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] transition-colors"
        />
        <button
          type="submit"
          className="absolute right-2 px-5 py-2 bg-[#4ecdc4] hover:bg-[#3dbdb4] text-gray-900 font-semibold text-xs rounded-lg transition-colors"
        >
          Search
        </button>
      </form>

      {/* Preset Chips */}
      <div className="flex flex-wrap gap-2 mb-8">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setQuery(p.query)
              handleSearch(p.query)
            }}
            className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-xs text-gray-300 hover:text-white border border-white/10 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="p-8 rounded-2xl bg-white/5 border border-white/10 animate-pulse flex flex-col md:flex-row gap-6">
          <div className="w-full md:w-5/12 h-64 bg-white/10 rounded-xl"></div>
          <div className="w-full md:w-7/12 space-y-4">
            <div className="h-6 w-24 bg-white/10 rounded"></div>
            <div className="h-8 w-2/3 bg-white/10 rounded"></div>
            <div className="h-4 w-1/2 bg-white/10 rounded"></div>
            <div className="h-20 w-full bg-white/10 rounded"></div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-6 rounded-2xl bg-red-950/30 border border-red-500/30 text-center">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Result Card */}
      {species && !loading && (
        <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-2xl">
          <div className="grid md:grid-cols-12">
            {/* Photo */}
            <div className="md:col-span-5 relative bg-black/40 min-h-[300px] flex items-center justify-center overflow-hidden">
              {species.photoUrl ? (
                <img
                  src={species.photoUrl}
                  alt={species.commonName}
                  onClick={() => setLightboxOpen(true)}
                  className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="text-gray-500 text-sm">No photo available</div>
              )}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-3 text-[11px] text-gray-300 truncate">
                {species.photoAttribution}
              </div>
            </div>

            {/* Info */}
            <div className="md:col-span-7 p-6 flex flex-col justify-between">
              <div>
                <div className="flex gap-2 mb-3">
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#4ecdc4]/20 text-[#4ecdc4] border border-[#4ecdc4]/30 font-medium uppercase tracking-wider">
                    {species.conservationStatus}
                  </span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-gray-300 font-medium capitalize">
                    {species.rank}
                  </span>
                </div>

                <h3 className="font-serif text-3xl font-bold text-white leading-tight">
                  {species.commonName}
                </h3>
                {species.scientificName && (
                  <p className="text-[#4ecdc4] italic font-serif text-base mt-0.5 mb-3">
                    {species.scientificName}
                  </p>
                )}

                <p className="text-xs text-gray-400 mb-3 border-b border-white/10 pb-2">
                  {species.description}
                </p>

                <p className="text-sm text-gray-300 leading-relaxed mb-5 max-h-36 overflow-y-auto pr-2">
                  {species.extract}
                </p>

                {/* Taxonomy */}
                <div className="grid grid-cols-4 gap-2 text-xs bg-black/20 p-3 rounded-xl border border-white/5 mb-5">
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Order</span>
                    <span className="text-white font-medium truncate block">{species.order}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Family</span>
                    <span className="text-white font-medium truncate block">{species.family}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Genus</span>
                    <span className="text-white font-medium truncate block">{species.genus}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px] uppercase">Recorded</span>
                    <span className="text-white font-medium truncate block">{species.observationsCount}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
                <a
                  href={species.wikiUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white transition-colors"
                >
                  Wikipedia ↗
                </a>
                <a
                  href={species.inatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white transition-colors"
                >
                  iNaturalist ↗
                </a>
                <a
                  href={species.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-[#4ecdc4]/20 hover:bg-[#4ecdc4]/30 text-[#4ecdc4] border border-[#4ecdc4]/30 text-xs transition-colors"
                >
                  🔊 Audio on Xeno-Canto ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxOpen && species?.photoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={species.photoUrl}
            alt={species.commonName}
            className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
          />
          <p className="text-gray-300 text-xs mt-3 font-light">
            {species.commonName} ({species.scientificName}) — {species.photoAttribution}
          </p>
        </div>
      )}
    </div>
  )
}
