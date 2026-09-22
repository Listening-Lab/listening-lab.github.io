#!/usr/bin/env python3
"""
Bird Species Lookup — Standalone Demo CLI
Returns photo URLs and comprehensive biological/encyclopedic information
given a prompt of a bird species name.

Usage:
  python demo.py "Kea"
  python demo.py "Tui" --open
  python demo.py (interactive prompt)
"""

import sys
import json
import urllib.request
import urllib.parse
import webbrowser

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

USER_AGENT = "BirdSpeciesExplorerDemo/1.0 (bioacoustics-research; contact@listening-lab.org)"

import unicodedata

def normalize_text(text: str) -> str:
    if not text:
        return ""
    normalized = unicodedata.normalize('NFKD', text)
    stripped = "".join(c for c in normalized if not unicodedata.combining(c))
    return stripped.lower().strip()

def fetch_json(url: str):
    """Helper to perform HTTP GET and return parsed JSON."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except Exception:
        return None

def fetch_inaturalist(query: str, wiki_title: str = None):
    """Fetch bird taxonomy and observations from iNaturalist."""
    # Try query and optionally wiki_title
    queries_to_try = [query]
    if wiki_title and wiki_title.lower() != query.lower():
        queries_to_try.append(wiki_title)
    
    norm_q = normalize_text(query)
    
    for q_try in queries_to_try:
        encoded = urllib.parse.quote(q_try)
        url = f"https://api.inaturalist.org/v1/taxa?q={encoded}&taxon_id=3&per_page=10"
        data = fetch_json(url)
        if not data or not data.get("results"):
            continue
        
        results = data["results"]
        # 1. Look for normalized exact match with preferred common name or scientific name
        for r in results:
            common = normalize_text(r.get("preferred_common_name") or "")
            sci = normalize_text(r.get("name") or "")
            if norm_q == common or norm_q == sci:
                return r
        # 2. Look for common name contains or rank species
        for r in results:
            common = normalize_text(r.get("preferred_common_name") or "")
            if norm_q in common and r.get("rank") in ("species", "subspecies"):
                return r
        # 3. Any species or subspecies rank
        for r in results:
            if r.get("rank") in ("species", "subspecies"):
                return r
        return results[0]
    return None

def fetch_wikipedia(query: str):
    """Fetch summary and photo from Wikipedia."""
    encoded = urllib.parse.quote(query)
    # 1. Direct page summary
    summary = fetch_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{encoded}")
    if summary and summary.get("extract") and summary.get("type") != "disambiguation":
        return summary
    
    # 2. Search query fallback
    search_query = urllib.parse.quote(f"{query} bird")
    search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch={search_query}&format=json"
    search_res = fetch_json(search_url)
    if search_res and search_res.get("query", {}).get("search"):
        best_title = search_res["query"]["search"][0]["title"]
        return fetch_json(f"https://en.wikipedia.org/api/rest_v1/page/summary/{urllib.parse.quote(best_title)}")
    
    return None

def lookup_species(species_name: str, auto_open: bool = False):
    print(f"\nSearching databases for '{species_name}'...")
    
    wiki = fetch_wikipedia(species_name)
    wiki_title = wiki.get("title") if wiki else None
    inat = fetch_inaturalist(species_name, wiki_title=wiki_title)
    
    if not wiki and not inat:
        print(f"\n[!] Species '{species_name}' not found. Please check spelling (e.g. Kea, Tui, Peregrine Falcon).")
        return

    # Extract common & scientific names
    common_name = (inat and inat.get("preferred_common_name")) or (wiki and wiki.get("title")) or species_name
    scientific_name = (inat and inat.get("name")) or ""
    
    # Photo URL & attribution
    photo_url = None
    attribution = "Wikimedia Commons"
    if wiki and wiki.get("originalimage"):
        photo_url = wiki["originalimage"].get("source")
    elif wiki and wiki.get("thumbnail"):
        photo_url = wiki["thumbnail"].get("source")
    elif inat and inat.get("default_photo"):
        photo_url = inat["default_photo"].get("medium_url")
        attribution = inat["default_photo"].get("attribution", "iNaturalist")

    # Short Description & Extract
    description = (wiki and wiki.get("description")) or "Aves (Bird)"
    extract = (wiki and wiki.get("extract")) or "No extended summary available."

    # Conservation status
    status = "Identified"
    if inat and inat.get("conservation_status"):
        status = inat["conservation_status"].get("status_name", "Status noted")
    elif "critically endangered" in extract.lower():
        status = "Critically Endangered"
    elif "endangered" in extract.lower():
        status = "Endangered"
    elif "vulnerable" in extract.lower():
        status = "Vulnerable"
    elif "least concern" in extract.lower():
        status = "Least Concern"

    # Terminal Display
    divider = "-" * 70
    print("\n" + "=" * 70)
    print(f"  [SPECIES]  {common_name.upper()}")
    if scientific_name:
        print(f"             Scientific name: {scientific_name}")
    print("=" * 70)
    print(f" * Conservation Status : {status.upper()}")
    print(f" * Classification      : {description}")
    if inat and inat.get("observations_count"):
        print(f" * Global Observations : {inat['observations_count']:,} recorded")
    print(divider)
    print(" SUMMARY:")
    # Wrap extract text nicely
    import textwrap
    for line in textwrap.wrap(extract, width=68):
        print(f"   {line}")
    print(divider)
    print(" PHOTO:")
    if photo_url:
        print(f"   URL: {photo_url}")
        print(f"   Credit: {attribution}")
    else:
        print("   No direct photo found.")
    print(divider)
    print(" EXTERNAL LINKS & AUDIO:")
    if wiki and wiki.get("content_urls"):
        print(f"   * Wikipedia   : {wiki['content_urls'].get('desktop', {}).get('page')}")
    if inat and inat.get("id"):
        print(f"   * iNaturalist : https://www.inaturalist.org/taxa/{inat['id']}")
    sound_q = urllib.parse.quote(scientific_name or common_name)
    print(f"   * Soundscapes : https://xeno-canto.org/explore?query={sound_q}")
    print("=" * 70 + "\n")

    if auto_open and photo_url:
        print(f"Opening photo in browser: {photo_url}")
        webbrowser.open(photo_url)

def main():
    args = sys.argv[1:]
    auto_open = "--open" in args
    args = [a for a in args if a != "--open"]

    if args:
        query = " ".join(args)
        lookup_species(query, auto_open=auto_open)
    else:
        print("-" * 50)
        print(" Bird Species Lookup -- Standalone Demo")
        print(" Type a species name (e.g., Kea, Tui, Kakapo, Kiwi, Peregrine Falcon)")
        print(" Type 'quit' or 'exit' to stop.")
        print("-" * 50)
        while True:
            try:
                query = input("\nEnter bird species name > ").strip()
                if not query:
                    continue
                if query.lower() in ("quit", "exit", "q"):
                    break
                lookup_species(query, auto_open=auto_open)
            except (KeyboardInterrupt, EOFError):
                print("\nExiting.")
                break

if __name__ == "__main__":
    main()
