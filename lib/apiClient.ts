import { auth } from '@/lib/firebase'

// The Nature Commons API base URL. Configured per environment, never hardcoded, so
// other clients (and other deployments of this one) can point at different API instances.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

/**
 * Single entry point for every call to the Nature Commons API. Attaches the current
 * Firebase ID token as a bearer header; the API resolves roles/permissions itself, this
 * layer does not encode any authorization logic.
 */
async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured')
  }

  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  const token = await auth?.currentUser?.getIdToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let body: BodyInit | undefined
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(options.body)
  } else {
    body = options.body as BodyInit | undefined
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers, body })

  if (!response.ok) {
    const errText = await response.text().catch(() => '')
    let message = errText || response.statusText
    if (errText) {
      try {
        const parsed = JSON.parse(errText)
        if (typeof parsed?.detail === 'string') message = parsed.detail
      } catch {
        // Not JSON — keep the raw text.
      }
    }
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export type ProjectRole = 'admin' | 'member'

export interface Project {
  id: string
  name: string
  description?: string
  isPublic: boolean
  role: ProjectRole
}

export function listProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/v1/projects')
}

export interface CreateProjectPayload {
  name: string
  description?: string
}

/** Creates a new private project. The caller becomes its admin. */
export function createProject(payload: CreateProjectPayload): Promise<Project> {
  return apiFetch<Project>('/v1/projects', {
    method: 'POST',
    body: payload,
  })
}

export interface Member {
  userId: string
  email: string
  role: ProjectRole
}

export function listMembers(projectId: string): Promise<Member[]> {
  return apiFetch<Member[]>(`/v1/projects/${projectId}/members`)
}

/** 404s if the given email has never signed in to the app. */
export function addMember(
  projectId: string,
  payload: { email: string; role?: ProjectRole }
): Promise<Member> {
  return apiFetch<Member>(`/v1/projects/${projectId}/members`, {
    method: 'POST',
    body: payload,
  })
}

export function updateMemberRole(
  projectId: string,
  userId: string,
  role: ProjectRole
): Promise<Member> {
  return apiFetch<Member>(`/v1/projects/${projectId}/members/${userId}`, {
    method: 'PATCH',
    body: { role },
  })
}

/** Rejected if this would leave the project with zero admins. */
export function removeMember(projectId: string, userId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
  })
}

export interface UploadUrlResponse {
  /** Pre-signed URL to PUT the audio file directly to storage. */
  uploadUrl: string
  /** Storage object key the API needs back in completeUpload to find the file. */
  fileKey: string
}

/**
 * Ask the API for a pre-signed URL to upload directly to storage. Exact request/response
 * shape is provisional — the Nature Commons API doesn't exist yet, so this is written
 * against the contract described in the client-side brief and will need adjusting once
 * that API is real.
 */
export function requestUploadUrl(
  projectId: string,
  filename: string,
  contentType: string
): Promise<UploadUrlResponse> {
  return apiFetch<UploadUrlResponse>(`/v1/projects/${projectId}/uploads`, {
    method: 'POST',
    body: { filename, contentType },
  })
}

/** Upload the file straight to storage using the pre-signed URL — never through the API. */
async function uploadFileToStorage(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!response.ok) {
    throw new Error(`Upload to storage failed (${response.status} ${response.statusText})`)
  }
}

export interface CompleteUploadPayload {
  fileKey: string
  lat: number
  lon: number
  /** ISO 8601 recording timestamp — auto-filled from the filename when recognized,
   *  editable either way. */
  recordedAt: string
  /** Virtual folder path (e.g. "Site A/2026-summer") — derived from the source directory
   *  structure when uploading a folder, editable. */
  folder?: string
  /** Which saved device this came from, if one was selected — provenance only, doesn't
   *  affect lat/lon/recordedAt (those are still sent explicitly above). */
  deviceId?: string
  /** A trained custom model to also run against this file, alongside Perch. */
  modelVersionId?: string
}

export interface CompleteUploadResponse {
  jobId: string
}

/** Tell the API the upload finished — this is what actually creates the processing job. */
export function completeUpload(
  projectId: string,
  payload: CompleteUploadPayload
): Promise<CompleteUploadResponse> {
  return apiFetch<CompleteUploadResponse>(`/v1/projects/${projectId}/uploads/complete`, {
    method: 'POST',
    body: payload,
  })
}

export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed'

export interface Job {
  id: string
  status: JobStatus
  error?: string
  assetId?: string
}

export function getJob(jobId: string): Promise<Job> {
  return apiFetch<Job>(`/v1/jobs/${jobId}`)
}

export interface Asset {
  id: string
  filename: string
  contentType: string
  folder: string | null
  lat: number | null
  lon: number | null
  recordedAt: string | null
  durationSeconds: number | null
  /** Which saved device (if any) this recording came from — provenance only. */
  deviceId: string | null
  createdAt: string
  latestJobId: string | null
  latestJobStatus: JobStatus | null
}

export function listAssets(
  projectId: string,
  options: { folder?: string; limit?: number } = {}
): Promise<Asset[]> {
  const params = new URLSearchParams()
  if (options.folder !== undefined) params.set('folder', options.folder)
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  const qs = params.toString()
  return apiFetch<Asset[]>(`/v1/projects/${projectId}/assets${qs ? `?${qs}` : ''}`)
}

export function getAsset(projectId: string, assetId: string): Promise<Asset> {
  return apiFetch<Asset>(`/v1/projects/${projectId}/assets/${assetId}`)
}

export interface AssetUpdatePayload {
  filename?: string
  folder?: string | null
  lat?: number
  lon?: number
  recordedAt?: string
}

export function updateAsset(
  projectId: string,
  assetId: string,
  patch: AssetUpdatePayload
): Promise<Asset> {
  return apiFetch<Asset>(`/v1/projects/${projectId}/assets/${assetId}`, {
    method: 'PATCH',
    body: patch,
  })
}

/** Hard, irreversible delete — removes the DB record and the original file from storage. */
export function deleteAsset(projectId: string, assetId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}/assets/${assetId}`, {
    method: 'DELETE',
  })
}

/** Distinct folder paths currently in use for this project, for a folder picker/tree. */
export function listFolders(projectId: string): Promise<string[]> {
  return apiFetch<string[]>(`/v1/projects/${projectId}/folders`)
}

export interface DownloadUrlResponse {
  downloadUrl: string
}

/** Short-lived signed GET URL for an existing asset's audio, for playback. */
export function getAssetDownloadUrl(projectId: string, assetId: string): Promise<DownloadUrlResponse> {
  return apiFetch<DownloadUrlResponse>(`/v1/projects/${projectId}/assets/${assetId}/download-url`)
}

export interface Detection {
  id: string
  assetId: string
  modelVersion: string
  offsetSeconds: number
  windowSeconds: number
  speciesCode: string
  score: number
  lat: number | null
  lon: number | null
}

export function listDetections(
  projectId: string,
  options: {
    assetId?: string
    species?: string
    minScore?: number
    limit?: number
    /** Restrict to one preview set — e.g. 'perch_v2' (global top-5), 'perch_v2_nz'
     *  (NZ-restricted top-5, see nzModelVersion below), or a custom model's
     *  'custom:{name}:v{n}' tag. Omit for every model_version mixed together. */
    modelVersion?: string
  } = {}
): Promise<Detection[]> {
  const params = new URLSearchParams()
  if (options.assetId !== undefined) params.set('asset_id', options.assetId)
  if (options.species !== undefined) params.set('species', options.species)
  if (options.minScore !== undefined) params.set('min_score', String(options.minScore))
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  if (options.modelVersion !== undefined) params.set('model_version', options.modelVersion)
  const qs = params.toString()
  return apiFetch<Detection[]>(`/v1/projects/${projectId}/detections${qs ? `?${qs}` : ''}`)
}

/** The NZ-restricted top-5 preview's model_version tag (worker.py computes this
 *  alongside the unfiltered top-5, restricted to the ~127-species NZ Aves whitelist) —
 *  the default prediction view across the app, per lib/speciesNames.ts's whitelist. */
export function nzModelVersion(modelVersion = 'perch_v2'): string {
  return `${modelVersion}_nz`
}

export type LabelValue = 'present' | 'absent' | 'uncertain'

export interface Label {
  id: string
  assetId: string
  offsetSeconds: number
  windowSeconds: number
  speciesCode: string
  value: LabelValue
  labeledBy: string
  createdAt: string
}

export function listLabels(
  projectId: string,
  options: { assetId?: string; species?: string; limit?: number } = {}
): Promise<Label[]> {
  const params = new URLSearchParams()
  if (options.assetId !== undefined) params.set('asset_id', options.assetId)
  if (options.species !== undefined) params.set('species', options.species)
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  const qs = params.toString()
  return apiFetch<Label[]>(`/v1/projects/${projectId}/labels${qs ? `?${qs}` : ''}`)
}

export interface CreateLabelPayload {
  assetId: string
  offsetSeconds: number
  windowSeconds: number
  speciesCode: string
  value: LabelValue
}

export function createLabel(projectId: string, payload: CreateLabelPayload): Promise<Label> {
  return apiFetch<Label>(`/v1/projects/${projectId}/labels`, {
    method: 'POST',
    body: payload,
  })
}

export interface SpeciesReadiness {
  speciesCode: string
  positiveCount: number
  negativeCount: number
  sufficient: boolean
}

export interface LabelingReadiness {
  hasAnyLabels: boolean
  minLabelCount: number
  species: SpeciesReadiness[]
}

// Rule 1 (any labels at all) + Rule 2 (flat per-species positive/negative minimum) from
// the training plan (Manager/log/2026-09-20-regions-and-training-plan.md §2.4). A
// species below `minLabelCount` isn't excluded from training later, just untrusted until
// it clears the bar — the labeling UI uses `sufficient: false` to prioritize that
// species, not to hide it. Pass `regionIds` to scope the check to a specific training
// scope (e.g. before starting a run) rather than the whole project.
export function getLabelingReadiness(
  projectId: string,
  options: { regionIds?: string[] } = {}
): Promise<LabelingReadiness> {
  const params = new URLSearchParams()
  if (options.regionIds && options.regionIds.length > 0) params.set('region_ids', options.regionIds.join(','))
  const qs = params.toString()
  return apiFetch<LabelingReadiness>(`/v1/projects/${projectId}/labeling/readiness${qs ? `?${qs}` : ''}`)
}

// Same list for every project on a given model_version - it's the model's fixed class
// list, not project-specific data - so it's safe to cache in the browser across
// projects/sessions rather than refetching ~340KB of JSON (compressed by the API's
// GZip middleware, but still a full round trip) every time the labeling page loads.
const SPECIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000

function speciesCacheKey(modelVersion: string): string {
  return `nc:species:${modelVersion}`
}

function readSpeciesCache(modelVersion: string): string[] | null {
  try {
    const raw = localStorage.getItem(speciesCacheKey(modelVersion))
    if (!raw) return null
    const { species, cachedAt } = JSON.parse(raw) as { species: string[]; cachedAt: number }
    if (Date.now() - cachedAt > SPECIES_CACHE_TTL_MS) return null
    return species
  } catch {
    return null // corrupt entry, storage disabled, etc. - just refetch
  }
}

function writeSpeciesCache(modelVersion: string, species: string[]) {
  try {
    localStorage.setItem(speciesCacheKey(modelVersion), JSON.stringify({ species, cachedAt: Date.now() }))
  } catch {
    // storage full/disabled - caching is a pure optimization, nothing to fall back to
  }
}

/**
 * The full class list a Perch model can predict (~14,795 scientific names for
 * perch_v2) — for the labeling UI's species search, distinct from a window's top-5
 * `detection` preview. Empty if no job has completed in this project yet (the worker
 * writes this file lazily, once per bucket).
 */
export async function listSpecies(projectId: string, modelVersion = 'perch_v2'): Promise<string[]> {
  const cached = readSpeciesCache(modelVersion)
  if (cached) return cached
  const params = new URLSearchParams({ model_version: modelVersion })
  const species = await apiFetch<string[]>(`/v1/projects/${projectId}/species?${params}`)
  if (species.length > 0) writeSpeciesCache(modelVersion, species)
  return species
}

export type RegionKind = 'drawn' | 'nz_admin'

export interface Region {
  id: string
  kind: RegionKind
  name: string
  color: string
  /** Set only for `kind: 'drawn'` — a GeoJSON Polygon or MultiPolygon. */
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
  /** Set only for `kind: 'nz_admin'` — id into the frontend's own NZ-regions dataset. */
  nzRegionRef: string | null
  createdAt: string
}

export function listRegions(projectId: string): Promise<Region[]> {
  return apiFetch<Region[]>(`/v1/projects/${projectId}/regions`)
}

export interface CreateRegionPayload {
  kind: RegionKind
  name: string
  color: string
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon
  nzRegionRef?: string
}

export function createRegion(projectId: string, payload: CreateRegionPayload): Promise<Region> {
  return apiFetch<Region>(`/v1/projects/${projectId}/regions`, {
    method: 'POST',
    body: payload,
  })
}

export interface UpdateRegionPayload {
  name?: string
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

export function updateRegion(
  projectId: string,
  regionId: string,
  patch: UpdateRegionPayload
): Promise<Region> {
  return apiFetch<Region>(`/v1/projects/${projectId}/regions/${regionId}`, {
    method: 'PATCH',
    body: patch,
  })
}

export function deleteRegion(projectId: string, regionId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}/regions/${regionId}`, {
    method: 'DELETE',
  })
}

/** A saved recording device — name, fixed location, and (optionally) which filename
 *  convention its recordings use — reselectable on a later upload instead of retyping
 *  lat/lon. Per-project, like regions and models. */
export interface Device {
  id: string
  name: string
  lat: number
  lon: number
  /** e.g. 'audiomoth', 'audiomoth_hex', 'iso_datetime' — see lib/filenameParsing.ts.
   *  Null means no known convention; recording time is filled in manually. */
  filenameFormat: string | null
  createdAt: string
}

export function listDevices(projectId: string): Promise<Device[]> {
  return apiFetch<Device[]>(`/v1/projects/${projectId}/devices`)
}

export interface CreateDevicePayload {
  name: string
  lat: number
  lon: number
  filenameFormat?: string | null
}

export function createDevice(projectId: string, payload: CreateDevicePayload): Promise<Device> {
  return apiFetch<Device>(`/v1/projects/${projectId}/devices`, {
    method: 'POST',
    body: payload,
  })
}

export interface UpdateDevicePayload {
  name?: string
  lat?: number
  lon?: number
  filenameFormat?: string | null
}

export function updateDevice(
  projectId: string,
  deviceId: string,
  patch: UpdateDevicePayload
): Promise<Device> {
  return apiFetch<Device>(`/v1/projects/${projectId}/devices/${deviceId}`, {
    method: 'PATCH',
    body: patch,
  })
}

export function deleteDevice(projectId: string, deviceId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}/devices/${deviceId}`, {
    method: 'DELETE',
  })
}

export type TrainingRunStatus = 'pending' | 'running' | 'complete' | 'failed'

export interface SpeciesCoverage {
  positiveCount: number
  negativeCount: number
  sufficient: boolean
}

export interface TrainingRun {
  id: string
  projectId: string
  modelId: string | null
  speciesCodes: string[]
  status: TrainingRunStatus
  hyperparameters: Record<string, unknown>
  labelCoverage: Record<string, SpeciesCoverage> | null
  error: string | null
  createdAt: string
  completedAt: string | null
}

export interface CreateTrainingRunPayload {
  /** Omit to create a brand-new model; when set, speciesCodes/regionIds must match that
   *  model's existing scope exactly. */
  modelId?: string
  name?: string
  speciesCodes?: string[]
  regionIds: string[]
  hyperparameters?: Record<string, unknown>
}

export function createTrainingRun(projectId: string, payload: CreateTrainingRunPayload): Promise<TrainingRun> {
  return apiFetch<TrainingRun>(`/v1/projects/${projectId}/training-runs`, {
    method: 'POST',
    body: payload,
  })
}

export function getTrainingRun(projectId: string, trainingRunId: string): Promise<TrainingRun> {
  return apiFetch<TrainingRun>(`/v1/projects/${projectId}/training-runs/${trainingRunId}`)
}

/** Re-enqueues a fresh attempt with the same scope/species/model target — only valid for
 *  a run whose status is 'failed'. The failed run itself is left in place. */
export function retryTrainingRun(projectId: string, trainingRunId: string): Promise<TrainingRun> {
  return apiFetch<TrainingRun>(`/v1/projects/${projectId}/training-runs/${trainingRunId}/retry`, {
    method: 'POST',
  })
}

/** Also deletes the model_version it produced, if any. Rejected (409) while the run is
 *  actively 'running'. */
export function deleteTrainingRun(projectId: string, trainingRunId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}/training-runs/${trainingRunId}`, {
    method: 'DELETE',
  })
}

export function listTrainingRuns(
  projectId: string,
  options: { modelId?: string; limit?: number } = {}
): Promise<TrainingRun[]> {
  const params = new URLSearchParams()
  if (options.modelId !== undefined) params.set('model_id', options.modelId)
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  const qs = params.toString()
  return apiFetch<TrainingRun[]>(`/v1/projects/${projectId}/training-runs${qs ? `?${qs}` : ''}`)
}

export interface Model {
  id: string
  name: string
  speciesCodes: string[]
  regionIds: string[]
  createdAt: string
  latestVersionNumber: number | null
  /** The model_version id to pass as `modelVersionId` when uploading, so the upload page
   *  never needs a separate listModelVersions round trip just to offer this model as a
   *  choice. Null until this model has at least one completed version. */
  latestVersionId: string | null
}

export function listModels(projectId: string): Promise<Model[]> {
  return apiFetch<Model[]>(`/v1/projects/${projectId}/models`)
}

export interface SpeciesMetrics {
  precision: number | null
  recall: number | null
  insufficientData: boolean
}

export interface ModelVersion {
  id: string
  modelId: string
  versionNumber: number
  trainingRunId: string
  weightsUri: string
  metrics: Record<string, SpeciesMetrics>
  createdAt: string
}

export function listModelVersions(projectId: string, modelId: string): Promise<ModelVersion[]> {
  return apiFetch<ModelVersion[]>(`/v1/projects/${projectId}/models/${modelId}/versions`)
}

/** Cascades to every version and training run this model has. Rejected (409) while a
 *  training run for it is currently 'running'. */
export function deleteModel(projectId: string, modelId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}/models/${modelId}`, {
    method: 'DELETE',
  })
}

/**
 * Full upload flow: request a signed URL, upload direct to storage, then notify the API
 * so it can create the processing job. Returns the new job id to poll. One file per call
 * — the upload page calls this once per staged row for a multi-file/folder batch.
 */
export async function uploadRecording(
  projectId: string,
  file: File,
  metadata: Omit<CompleteUploadPayload, 'fileKey'>
): Promise<string> {
  const { uploadUrl, fileKey } = await requestUploadUrl(projectId, file.name, file.type)
  await uploadFileToStorage(uploadUrl, file)
  const { jobId } = await completeUpload(projectId, { fileKey, ...metadata })
  return jobId
}

export { apiFetch }
