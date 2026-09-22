'use client'

import { useMemo, useState } from 'react'
import { useSpeciesNames } from '@/lib/speciesNames'

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
  const { commonName } = useSpeciesNames()

  const suggestionCodes = useMemo(() => new Set(suggestions.map((s) => s.code)), [suggestions])

  const searchResults = useMemo(() => {
    if (query.trim().length < 2) return []
    const q = query.toLowerCase()
    // Most people know a bird by its English name, not its scientific binomial - match
    // both so "tui" finds "Prosthemadera novaeseelandiae" just as well as the Latin would.
    return allSpecies
      .filter((s) => !suggestionCodes.has(s) && (s.toLowerCase().includes(q) || commonName(s).toLowerCase().includes(q)))
      .slice(0, 8)
  }, [query, allSpecies, suggestionCodes, commonName])

  // Species the user selected via search (not among the original suggestions) still
  // need to show as a pill afterward, or a confirmed selection would silently disappear
  // the moment the search box is cleared.
  const extraSelected = useMemo(
    () => Array.from(selected).filter((s) => !suggestionCodes.has(s)),
    [selected, suggestionCodes]
  )

  return (
    <div>
      {(suggestions.length > 0 || extraSelected.length > 0) && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-gray-500">{selected.size} selected</span>
          {selected.size > 0 && (
            <button
              onClick={() => Array.from(selected).forEach(onToggle)}
              className="text-[11px] text-gray-500 hover:text-white underline"
            >
              Clear
            </button>
          )}
        </div>
      )}
      {/* Capped + scrollable, not letting the pill count push the rest of the form
          (and the submit button) off-screen — "select all" can add 100+ at once. */}
      <div className="flex flex-wrap gap-1.5 mb-2 max-h-40 overflow-y-auto p-1 -m-1 hide-scrollbar">
        {suggestions.map((s) => (
          <button
            key={s.code}
            onClick={() => onToggle(s.code)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              selected.has(s.code)
                ? 'bg-brand-500 border-brand-500 text-white'
                : 'bg-white/5 border-white/15 text-gray-300 hover:border-white/30'
            }`}
            title={`${commonName(s.code)} · Perch score ${s.score.toFixed(2)}`}
          >
            {commonName(s.code)}
          </button>
        ))}
        {extraSelected.map((code) => (
          <button
            key={code}
            onClick={() => onToggle(code)}
            title={commonName(code)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border bg-brand-500 border-brand-500 text-white"
          >
            {commonName(code)}
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
                    {commonName(code)}
                    {commonName(code) !== code && <span className="text-gray-500 italic ml-1.5">{code}</span>}
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
