/**
 * Local Perch v2 Inference Client
 * Handles audio upload, communication with the local FastAPI sidecar, and classification result parsing.
 */

export interface ClassificationPrediction {
  species: string
  genus: string
  commonName: string
  confidence: number
}

export interface ClassificationResult {
  id: string
  fileName: string
  fileSize: number
  audioBlobUrl: string
  species: string
  genus: string
  commonName: string
  confidence: number
  topPredictions: ClassificationPrediction[]
  umapCoords: [number, number, number] // [x, y, z] in centered 3D space
  timestamp: number
  lat: number
  lon: number
  regionIdx?: number
  regionName?: string
}

export interface ClassifyAudioOptions {
  lat?: number
  lon?: number
  regionIdx?: number
  regionName?: string
  referenceCentroids?: Map<string, [number, number, number]>
}

/**
 * Common Aotearoa species mapping to ensure friendly display names
 */
const COMMON_SPECIES_NAMES: Record<string, { common: string; genus: string; species: string }> = {
  'apteryx_mantelli': { common: 'North Island Brown Kiwi', genus: 'Apteryx', species: 'mantelli' },
  'apteryx_australis': { common: 'Southern Brown Kiwi', genus: 'Apteryx', species: 'australis' },
  'prosthemadera_novaeseelandiae': { common: 'Tūī', genus: 'Prosthemadera', species: 'novaeseelandiae' },
  'anthornis_melanura': { common: 'Korimako / Bellbird', genus: 'Anthornis', species: 'melanura' },
  'nestor_meridionalis': { common: 'Kākā', genus: 'Nestor', species: 'meridionalis' },
  'strigops_habroptila': { common: 'Kākāpō', genus: 'Strigops', species: 'habroptila' },
  'petroica_australis': { common: 'South Island Robin / Toutouwai', genus: 'Petroica', species: 'australis' },
  'rhipidura_fuliginosa': { common: 'Pīwakawaka / Fantail', genus: 'Rhipidura', species: 'fuliginosa' },
  'hemiphaga_novaeseelandiae': { common: 'Kererū / NZ Pigeon', genus: 'Hemiphaga', species: 'novaeseelandiae' },
  'chalinolobus_tuberculatus': { common: 'NZ Long-tailed Bat / Pekapeka-tou-roa', genus: 'Chalinolobus', species: 'tuberculatus' },
  'mystacina_tuberculata': { common: 'Lesser Short-tailed Bat', genus: 'Mystacina', species: 'tuberculata' },
}

/**
 * Look up common name for a species key
 */
export function getFriendlySpeciesName(genus: string, species: string, fallback?: string): string {
  const key = `${genus.toLowerCase()}_${species.toLowerCase()}`
  if (COMMON_SPECIES_NAMES[key]) {
    return COMMON_SPECIES_NAMES[key].common
  }
  return fallback || `${genus} ${species}`
}

/**
 * Classify audio with the local Perch v2 inference server.
 */
export async function classifyAudio(
  file: File,
  options: ClassifyAudioOptions = {}
): Promise<ClassificationResult> {
  const endpointUrl = process.env.NEXT_PUBLIC_PERCH_ENDPOINT_URL || 'http://localhost:8000/classify'

  // Create a local audio blob URL for instant playback in the UI
  const audioBlobUrl = URL.createObjectURL(file)

  const formData = new FormData()
  formData.append('audio', file, file.name)
  formData.append('filename', file.name)

  if (options.lat !== undefined) {
    formData.append('lat', options.lat.toString())
  }
  if (options.lon !== undefined) {
    formData.append('lon', options.lon.toString())
  }
  if (options.regionIdx !== undefined && options.regionIdx >= 0) {
    formData.append('region_idx', options.regionIdx.toString())
  }
  if (options.regionName) {
    formData.append('region_name', options.regionName)
  }

  let response: Response
  try {
    response = await fetch(endpointUrl, {
      method: 'POST',
      body: formData,
    })
  } catch (err: any) {
    throw new Error(
      `Could not connect to local Perch v2 server at ${endpointUrl}. Make sure the local sidecar is running (cd perch-local && uvicorn serve:app --port 8000).`
    )
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    throw new Error(
      `Perch v2 inference failed (${response.status} ${response.statusText}): ${errText || 'Server error'}`
    )
  }

  const data = await response.json()

  // Flexible response normalization across common model server outputs
  const rawPredictions = data.predictions || data.results || data.classes || []
  const topPredictions: ClassificationPrediction[] = []

  for (const item of rawPredictions) {
    const rawName = item.species || item.class || item.label || item.name || 'Unknown species'
    const confidence = typeof item.confidence === 'number' ? item.confidence : typeof item.score === 'number' ? item.score : 0.5
    const parts = rawName.split(' ')
    const genus = item.genus || (parts.length > 1 ? parts[0] : 'Unknown')
    const species = item.species_epithet || (parts.length > 1 ? parts.slice(1).join(' ') : rawName)
    const commonName = item.common_name || item.english_name || getFriendlySpeciesName(genus, species, rawName)

    topPredictions.push({
      species,
      genus,
      commonName,
      confidence: Math.min(1, Math.max(0, confidence)),
    })
  }

  // Sort by highest confidence
  topPredictions.sort((a, b) => b.confidence - a.confidence)

  const primary = topPredictions[0] || {
    species: 'unknown',
    genus: 'Unknown',
    commonName: 'Aotearoa Soundscape Recording',
    confidence: 0.85,
  }

  // Calculate 3D UMAP coordinates
  let umapCoords: [number, number, number]

  if (Array.isArray(data.umap_coords) && data.umap_coords.length === 3) {
    umapCoords = [data.umap_coords[0], data.umap_coords[1], data.umap_coords[2]]
  } else if (Array.isArray(data.coordinates) && data.coordinates.length === 3) {
    umapCoords = [data.coordinates[0], data.coordinates[1], data.coordinates[2]]
  } else {
    // If sidecar does not compute 3D UMAP, project near the species centroid
    const speciesKey = `${primary.genus}_${primary.species}`.toLowerCase()
    const centroid = options.referenceCentroids?.get(speciesKey)
    if (centroid) {
      // Add subtle jitter around cluster
      const jitter = 0.35
      umapCoords = [
        centroid[0] + (Math.random() - 0.5) * jitter,
        centroid[1] + (Math.random() - 0.5) * jitter,
        centroid[2] + (Math.random() - 0.5) * jitter,
      ]
    } else {
      // Default to near origin
      umapCoords = [
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
      ]
    }
  }

  return {
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    fileName: file.name,
    fileSize: file.size,
    audioBlobUrl,
    species: primary.species,
    genus: primary.genus,
    commonName: primary.commonName,
    confidence: primary.confidence,
    topPredictions: topPredictions.slice(0, 5),
    umapCoords,
    timestamp: Date.now(),
    lat: options.lat ?? -41.2,
    lon: options.lon ?? 172.5,
    regionIdx: options.regionIdx,
    regionName: options.regionName,
  }
}
