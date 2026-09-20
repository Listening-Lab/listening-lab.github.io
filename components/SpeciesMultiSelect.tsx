'use client'

import { useMemo, useState } from 'react'

export interface SpeciesSuggestion {
  code: string
  score: number
}

/**
 * Multi-select for "which species are present in this segment" — suggestions (Perch's
 * own top-K guesses, highest score first) are shown as toggleable pills up front so the
 * common case is a couple of clicks; the search box covers the long tail (~14,795
 * possible species) for anything Perch didn't rank highly, or got wrong entirely.
 */
export default function SpeciesMultiSelect({
  suggestions,
  allSpecies,
  selected,
  onToggle,
}: {
  suggestions: SpeciesSuggestion[]
  allSpecies: string[]
  selected: Set<string>
  onToggle: (species: string) => void
}) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)

  const suggestionCodes = useMemo(() => new Set(suggestions.map((s) => s.code)), [suggestions])

  const searchResults = useMemo(() => {
    if (query.trim().length < 2) return []
    const q = query.toLowerCase()
    return allSpecies.filter((s) => s.toLowerCase().includes(q) && !suggestionCodes.has(s)).slice(0, 8)
  }, [query, allSpecies, suggestionCodes])

  // Species the user selected via search (not among the original suggestions) still
  // need to show as a pill afterward, or a confirmed selection would silently disappear
  // the moment the search box is cleared.
  const extraSelected = useMemo(
    () => Array.from(selected).filter((s) => !suggestionCodes.has(s)),
    [selected, suggestionCodes]
  )

  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {suggestions.map((s) => (
          <button
            key={s.code}
            onClick={() => onToggle(s.code)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              selected.has(s.code)
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'bg-white/5 border-white/15 text-gray-300 hover:border-white/30'
            }`}
            title={`Perch score ${s.score.toFixed(2)}`}
          >
            {s.code}
          </button>
        ))}
        {extraSelected.map((code) => (
          <button
            key={code}
            onClick={() => onToggle(code)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border bg-brand-500 border-brand-500 text-white"
          >
            {code}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchOpen(true)}
          onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
          placeholder="Search other species…"
          className="w-full bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {searchOpen && query.trim().length >= 2 && (
          <ul className="absolute z-20 mt-1 w-full bg-[#0a1628] border border-white/20 rounded-lg shadow-2xl max-h-48 overflow-y-auto">
            {searchResults.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-500">No matches</li>
            ) : (
              searchResults.map((code) => (
                <li key={code}>
                  <button
                    onMouseDown={(e) => e.preventDefault()} // survive the input's onBlur
                    onClick={() => { onToggle(code); setQuery('') }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10"
                  >
                    {code}
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
