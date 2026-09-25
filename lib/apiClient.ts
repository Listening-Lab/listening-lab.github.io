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

export interface Me {
  id: string
  email: string
  createdAt: string
}

/** The signed-in user's own account record. Also the trigger for auto-provisioning
 *  (see API get_app_user_id) if this is their very first authenticated call. */
export function getMe(): Promise<Me> {
  return apiFetch<Me>('/v1/me')
}

export type ProjectRole = 'admin' | 'member'

export interface Project {
  id: string
  name: string
  description?: string
  isPublic: boolean
  role: ProjectRole
  /** True for the project's single owner (reported as 'admin' in `role`). */
  isOwner?: boolean
  /** The organisation that owns this project, if any. */
  orgId?: string | null
  /** Machine detections scoring below this (0-1) don't create consensus observations. */
  detectionConsensusThreshold?: number | null
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

export interface UpdateProjectPayload {
  name?: string
  description?: string
}

/** Rename a project or change its description. Requires admin. */
export function updateProject(projectId: string, patch: UpdateProjectPayload): Promise<Project> {
  return apiFetch<Project>(`/v1/projects/${projectId}`, {
    method: 'PATCH',
    body: patch,
  })
}

/** Deletes the project and everything scoped to it (assets, models, training runs,
 *  regions, devices) — irreversible. Requires admin. The Public project can't be deleted
 *  (the API itself refuses this, not enforced here). */
export function deleteProject(projectId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}`, {
    method: 'DELETE',
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
  /** Which saved device this came from, if one was selected. */
  deviceId?: string
  /** A trained custom model to also run against this file, alongside Perch. */
  modelVersionId?: string
}

export interface CompleteUploadResponse {
  jobId: string
}

// --- Sites and deployments -------------------------------------------------------------
// Every file belongs to a deployment (one time-boxed placement of a device at a point). The
// upload UI still asks only for a device + location, so the deployment is found (or created)
// from those. One promise per (project, device, location) so a batch of
// files uploaded in parallel shares a single deployment instead of racing to create several.

interface DeploymentDto {
  id: string
  siteId: string | null
  deviceId: string | null
  lat: number
  lon: number
  deploymentEnd: string | null
}

const deploymentPromises = new Map<string, Promise<string>>()

function ensureDeployment(
  projectId: string,
  spec: { deviceId?: string; lat: number; lon: number; startsAt: string }
): Promise<string> {
  const key = `${projectId}|${spec.deviceId ?? ''}|${spec.lat.toFixed(4)}|${spec.lon.toFixed(4)}`
  const cached = deploymentPromises.get(key)
  if (cached) return cached

  const promise = (async () => {
    const existing = await apiFetch<DeploymentDto[]>(`/v1/projects/${projectId}/deployments?limit=500`)
    const match = existing.find(
      (d) =>
        (d.deviceId ?? undefined) === spec.deviceId &&
        !d.deploymentEnd &&
        Math.abs(d.lat - spec.lat) < 1e-4 &&
        Math.abs(d.lon - spec.lon) < 1e-4
    )
    if (match) return match.id

    // No site is created here: a deployment is just a device at a point, and the API places it in
    // whichever drawn site area contains it (none, if it isn't inside one).
    const deployment = await apiFetch<{ id: string }>(`/v1/projects/${projectId}/deployments`, {
      method: 'POST',
      body: {
        deviceId: spec.deviceId,
        modality: 'audio',
        lat: spec.lat,
        lon: spec.lon,
        deploymentStart: spec.startsAt,
      },
    })
    return deployment.id
  })()

  // A failure shouldn't poison later attempts.
  promise.catch(() => deploymentPromises.delete(key))
  deploymentPromises.set(key, promise)
  return promise
}

/** Tell the API the upload finished — registers the file (hashing what was actually stored)
 *  and queues its automated analysis. */
export async function completeUpload(
  projectId: string,
  payload: CompleteUploadPayload
): Promise<CompleteUploadResponse> {
  const deploymentId = await ensureDeployment(projectId, {
    deviceId: payload.deviceId,
    lat: payload.lat,
    lon: payload.lon,
    startsAt: payload.recordedAt,
  })
  const media = await apiFetch<{ jobId: string | null }>(`/v1/projects/${projectId}/uploads/complete`, {
    method: 'POST',
    body: {
      fileKey: payload.fileKey,
      deploymentId,
      capturedAt: payload.recordedAt,
      lat: payload.lat,
      lon: payload.lon,
      folder: payload.folder,
      requestedModelVersionId: payload.modelVersionId,
    },
  })
  return { jobId: media.jobId ?? '' }
}

export type JobStatus = 'pending' | 'processing' | 'complete' | 'failed'

export interface Job {
  id: string
  status: JobStatus
  error?: string
  mediaId?: string
}

export function getJob(jobId: string): Promise<Job> {
  return apiFetch<Job>(`/v1/jobs/${jobId}`)
}

// --- Media (shown to the rest of the app as "assets": a recording and its metadata) -------

export interface Asset {
  id: string
  filename: string
  contentType: string
  folder: string | null
  lat: number | null
  lon: number | null
  recordedAt: string | null
  durationSeconds: number | null
  /** Which saved device (if any) this recording came from. */
  deviceId: string | null
  createdAt: string
  latestJobId: string | null
  latestJobStatus: JobStatus | null
}

interface MediaDto {
  id: string
  filename: string
  contentType: string
  folder: string | null
  lat: number | null
  lon: number | null
  capturedAt: string
  durationSeconds: number | null
  deviceId: string | null
  analysisJobId: string | null
  analysisStatus: JobStatus | null
  createdAt: string
}

function toAsset(m: MediaDto): Asset {
  return {
    id: m.id,
    filename: m.filename,
    contentType: m.contentType,
    folder: m.folder,
    lat: m.lat,
    lon: m.lon,
    recordedAt: m.capturedAt,
    durationSeconds: m.durationSeconds,
    deviceId: m.deviceId,
    createdAt: m.createdAt,
    latestJobId: m.analysisJobId,
    latestJobStatus: m.analysisStatus,
  }
}

export async function listAssets(
  projectId: string,
  options: { folder?: string; limit?: number } = {}
): Promise<Asset[]> {
  const params = new URLSearchParams()
  if (options.folder !== undefined) params.set('folder', options.folder)
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  const qs = params.toString()
  const media = await apiFetch<MediaDto[]>(`/v1/projects/${projectId}/media${qs ? `?${qs}` : ''}`)
  return media.map(toAsset)
}

export async function getAsset(projectId: string, assetId: string): Promise<Asset> {
  return toAsset(await apiFetch<MediaDto>(`/v1/projects/${projectId}/media/${assetId}`))
}

export interface AssetUpdatePayload {
  filename?: string
  folder?: string | null
  lat?: number
  lon?: number
  recordedAt?: string
}

export async function updateAsset(
  projectId: string,
  assetId: string,
  patch: AssetUpdatePayload
): Promise<Asset> {
  const { recordedAt, ...rest } = patch
  const body = recordedAt !== undefined ? { ...rest, capturedAt: recordedAt } : rest
  return toAsset(
    await apiFetch<MediaDto>(`/v1/projects/${projectId}/media/${assetId}`, { method: 'PATCH', body })
  )
}

/** Hard, irreversible delete — removes the file from storage along with its detections,
 *  labels and observations (the API refuses this without `force`, which is recorded in the
 *  project's audit log). */
export function deleteAsset(projectId: string, assetId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}/media/${assetId}?force=true`, {
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

/** Short-lived signed GET URL for a recording, for playback. */
export async function getAssetDownloadUrl(projectId: string, assetId: string): Promise<DownloadUrlResponse> {
  const { url } = await apiFetch<{ url: string }>(`/v1/projects/${projectId}/media/${assetId}/download-url`)
  return { downloadUrl: url }
}

// --- Detections (machine evidence) -------------------------------------------------------

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

interface DetectionDto {
  id: string
  mediaId: string
  scientificName: string
  confidence: number
  spatialRegion: { offset_s?: number; window_s?: number } | null
  modelVersionLabel: string | null
  lat: number | null
  lon: number | null
}

export async function listDetections(
  projectId: string,
  options: {
    assetId?: string
    species?: string
    minScore?: number
    limit?: number
    /** Restrict to one preview set — e.g. 'perch_v2' (global top-5), 'perch_v2_nz'
     *  (NZ-restricted top-5, see nzModelVersion below), or a custom model's
     *  'custom:{name}:v{n}' tag. Omit for every model version mixed together. */
    modelVersion?: string
  } = {}
): Promise<Detection[]> {
  const params = new URLSearchParams()
  if (options.assetId !== undefined) params.set('media_id', options.assetId)
  if (options.species !== undefined) params.set('species', options.species)
  if (options.minScore !== undefined) params.set('min_confidence', String(options.minScore))
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  if (options.modelVersion !== undefined) params.set('model_version_label', options.modelVersion)
  const qs = params.toString()
  const rows = await apiFetch<DetectionDto[]>(`/v1/projects/${projectId}/detections${qs ? `?${qs}` : ''}`)
  return rows.map((d) => ({
    id: d.id,
    assetId: d.mediaId,
    modelVersion: d.modelVersionLabel ?? 'unknown',
    offsetSeconds: d.spatialRegion?.offset_s ?? 0,
    windowSeconds: d.spatialRegion?.window_s ?? 5,
    speciesCode: d.scientificName,
    score: d.confidence,
    lat: d.lat,
    lon: d.lon,
  }))
}

/** The NZ-restricted top-5 preview's model tag (worker.py computes this alongside the
 *  unfiltered top-5, restricted to the ~127-species NZ Aves whitelist) — the default
 *  prediction view across the app, per lib/speciesNames.ts's whitelist. */
export function nzModelVersion(modelVersion = 'perch_v2'): string {
  return `${modelVersion}_nz`
}

// --- Labels (human evidence) --------------------------------------------------------------

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

interface LabelDto {
  id: string
  mediaId: string
  scientificName: string
  value: LabelValue
  spatialRegion: { offset_s?: number; window_s?: number } | null
  labeledBy: string
  createdAt: string
}

// Whole-file labels have no time window; this app only works with per-window ones.
function toLabel(l: LabelDto): Label | null {
  if (l.spatialRegion?.offset_s === undefined) return null
  return {
    id: l.id,
    assetId: l.mediaId,
    offsetSeconds: l.spatialRegion.offset_s,
    windowSeconds: l.spatialRegion.window_s ?? 5,
    speciesCode: l.scientificName,
    value: l.value,
    labeledBy: l.labeledBy,
    createdAt: l.createdAt,
  }
}

export async function listLabels(
  projectId: string,
  options: { assetId?: string; species?: string; limit?: number } = {}
): Promise<Label[]> {
  const params = new URLSearchParams()
  if (options.assetId !== undefined) params.set('media_id', options.assetId)
  if (options.species !== undefined) params.set('species', options.species)
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  const qs = params.toString()
  const rows = await apiFetch<LabelDto[]>(`/v1/projects/${projectId}/labels${qs ? `?${qs}` : ''}`)
  return rows.map(toLabel).filter((l): l is Label => l !== null)
}

export interface CreateLabelPayload {
  assetId: string
  offsetSeconds: number
  windowSeconds: number
  speciesCode: string
  value: LabelValue
}

export async function createLabel(projectId: string, payload: CreateLabelPayload): Promise<Label> {
  const created = await apiFetch<LabelDto>(`/v1/projects/${projectId}/labels`, {
    method: 'POST',
    body: {
      mediaId: payload.assetId,
      scientificName: payload.speciesCode,
      value: payload.value,
      spatialRegion: { offset_s: payload.offsetSeconds, window_s: payload.windowSeconds },
    },
  })
  return toLabel(created) as Label
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
  deviceType?: string
  serial?: string | null
  modality?: string
  /** Where the device currently is: its active deployment's location, else its own saved
   *  location, else its latest deployment's. Null if it has never been placed anywhere. */
  lat: number | null
  lon: number | null
  /** e.g. 'audiomoth', 'audiomoth_hex', 'iso_datetime' — see lib/filenameParsing.ts.
   *  Null means no known convention; recording time is filled in manually. */
  filenameFormat: string | null
  createdAt: string
}

export async function listDevices(projectId: string): Promise<Device[]> {
  const [devices, deployments] = await Promise.all([
    apiFetch<Device[]>(`/v1/projects/${projectId}/devices`),
    listDeployments(projectId),
  ])
  // A device is an instrument; where it is comes from its deployments. Prefer the active one.
  return devices.map((device) => {
    const mine = deployments
      .filter((d) => d.deviceId === device.id)
      .sort((a, b) => b.deploymentStart.localeCompare(a.deploymentStart))
    const active = mine.find((d) => !d.deploymentEnd)
    const spot = active ?? (device.lat != null && device.lon != null ? null : mine[0])
    return spot ? { ...device, lat: spot.lat, lon: spot.lon } : device
  })
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

export function getModel(projectId: string, modelId: string): Promise<Model> {
  return apiFetch<Model>(`/v1/projects/${projectId}/models/${modelId}`)
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

export interface ApiKey {
  id: string
  name: string
  /** First few characters only — the full value is shown exactly once, at creation. */
  keyPrefix: string
  /** If true, this key can view/label but never upload, train, delete, or manage members. */
  readOnly: boolean
  /** Projects this key is restricted to. Empty means unrestricted — every project the
   *  account can access, including ones created after the key. Immutable after creation. */
  projectIds: string[]
  rateLimitPerMinute: number | null
  spendLimitCents: number | null
  lastUsedAt: string | null
  expiresAt: string | null
  /** Set once this key has been revoked; a revoked key is rejected on every request from
   *  then on. */
  revokedAt: string | null
  createdAt: string
}

/** Your own API keys' metadata — never the raw key values again after creation. Requires
 *  a Firebase session; not usable with another API key. */
export function listApiKeys(): Promise<ApiKey[]> {
  return apiFetch<ApiKey[]>('/v1/api-keys')
}

export interface CreateApiKeyPayload {
  name: string
  readOnly?: boolean
  projectIds?: string[]
  rateLimitPerMinute?: number
  spendLimitCents?: number
  expiresAt?: string
}

export interface CreateApiKeyResponse {
  apiKey: ApiKey
  /** The full key — shown exactly once, in this response. Cannot be retrieved again. */
  rawKey: string
}

/** Mints a new API key. Requires an active subscription. */
export function createApiKey(payload: CreateApiKeyPayload): Promise<CreateApiKeyResponse> {
  return apiFetch<CreateApiKeyResponse>('/v1/api-keys', {
    method: 'POST',
    body: payload,
  })
}

export interface UpdateApiKeyPayload {
  name?: string
  readOnly?: boolean
  rateLimitPerMinute?: number
  spendLimitCents?: number
  expiresAt?: string
}

/** Project restrictions can't be changed here — revoke and create a new key instead. */
export function updateApiKey(keyId: string, patch: UpdateApiKeyPayload): Promise<ApiKey> {
  return apiFetch<ApiKey>(`/v1/api-keys/${keyId}`, {
    method: 'PATCH',
    body: patch,
  })
}

/** Revokes a key (soft delete — its history is kept, just rejected on every future
 *  request). Irreversible from the caller's side. */
export function revokeApiKey(keyId: string): Promise<void> {
  return apiFetch<void>(`/v1/api-keys/${keyId}`, {
    method: 'DELETE',
  })
}

export interface UsageKindTotal {
  /** 'gcs_write_ops' (uploads) | 'gcs_read_ops' (download URLs issued) |
   *  'inference_seconds' (automated-analysis compute) | 'training_seconds' (model
   *  training compute). Each maps to a real GCP billing unit. */
  kind: string
  /** Total in the kind's own native unit (ops, or seconds), across all history. */
  quantity: number
  /** Our own price for that quantity, in cents — separate from GCP's actual cost. */
  costCents: number
}

export interface ProjectUsageSummary {
  projectId: string
  /** Computed live from storage at the moment this is called — always current, not a
   *  cached/periodic figure. */
  currentStorageGib: number
  currentStorageCostCentsEstimate: number
  /** Everything except storage — see currentStorageGib for that. */
  events: UsageKindTotal[]
}

/** On-demand usage/cost summary for one project — safe to call whenever someone actually
 *  looks at it (e.g. an account/usage view), not meant for polling. */
export function getProjectUsage(projectId: string): Promise<ProjectUsageSummary> {
  return apiFetch<ProjectUsageSummary>(`/v1/projects/${projectId}/usage`)
}

export interface DeletedProjectUsage {
  /** The project's name at the time it was deleted — the id itself is gone, so this is
   *  the only identifying label left. */
  projectName: string
  events: UsageKindTotal[]
}

/** Historical usage for projects that no longer exist, grouped by name — deleting a
 *  project doesn't erase what it already cost. Scoped to your own past actions only (the
 *  API can no longer check who administered a project once it's gone). */
export function listDeletedProjectUsage(): Promise<DeletedProjectUsage[]> {
  return apiFetch<DeletedProjectUsage[]>('/v1/usage/deleted-projects')
}

export { apiFetch }

// --- Sites and deployments -------------------------------------------------------------
// A site is a named place; a deployment is one time-boxed placement of a device (or a manual
// survey visit) at a site. Every file belongs to exactly one deployment.

export interface Site {
  id: string
  name: string
  /** GeoJSON Point ([lon, lat]) or Polygon. */
  geometry: { type: string; coordinates: unknown }
  description: string | null
  createdAt: string
}

export interface CreateSitePayload {
  name: string
  geometry: { type: string; coordinates: unknown }
  description?: string | null
}

export type UpdateSitePayload = Partial<CreateSitePayload>

export function listSites(projectId: string): Promise<Site[]> {
  return apiFetch<Site[]>(`/v1/projects/${projectId}/sites`)
}

export function createSite(projectId: string, payload: CreateSitePayload): Promise<Site> {
  return apiFetch<Site>(`/v1/projects/${projectId}/sites`, { method: 'POST', body: payload })
}

export function updateSite(projectId: string, siteId: string, patch: UpdateSitePayload): Promise<Site> {
  return apiFetch<Site>(`/v1/projects/${projectId}/sites/${siteId}`, { method: 'PATCH', body: patch })
}

/** Rejected (409) while the site still has deployments. Requires admin. */
export function deleteSite(projectId: string, siteId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}/sites/${siteId}`, { method: 'DELETE' })
}

export type DeploymentStatus = 'active' | 'ended' | 'retrieved'
export type DevicePlatform = 'buoy' | 'vegetation' | 'building' | 'structure' | 'unattached'

export interface Deployment {
  id: string
  /** Null when the deployment isn't inside any site area. */
  siteId: string | null
  /** Null for a manual survey visit with no instrument. */
  deviceId: string | null
  modality: string
  lat: number
  lon: number
  deviceHeightM: number | null
  devicePlatform: DevicePlatform | null
  deploymentStart: string
  deploymentEnd: string | null
  recordingSchedule: string | null
  locationType: string | null
  status: DeploymentStatus
  tags: string[]
  createdAt: string
}

export interface CreateDeploymentPayload {
  /** Omit to join whichever site area contains the location (none if it isn't inside one). */
  siteId?: string
  deviceId?: string | null
  modality?: string
  lat: number
  lon: number
  deviceHeightM?: number | null
  devicePlatform?: DevicePlatform | null
  deploymentStart: string
  recordingSchedule?: string | null
  locationType?: string | null
}

export type UpdateDeploymentPayload = Partial<Omit<CreateDeploymentPayload, 'siteId' | 'deviceId' | 'modality'>> & {
  /** Move to another site, or null to take it out of its site. */
  siteId?: string | null
}

export function listDeployments(projectId: string, options: { siteId?: string } = {}): Promise<Deployment[]> {
  const params = new URLSearchParams({ limit: '500' })
  if (options.siteId) params.set('site_id', options.siteId)
  return apiFetch<Deployment[]>(`/v1/projects/${projectId}/deployments?${params}`)
}

export function createDeployment(projectId: string, payload: CreateDeploymentPayload): Promise<Deployment> {
  return apiFetch<Deployment>(`/v1/projects/${projectId}/deployments`, { method: 'POST', body: payload })
}

export function updateDeployment(
  projectId: string,
  deploymentId: string,
  patch: UpdateDeploymentPayload
): Promise<Deployment> {
  return apiFetch<Deployment>(`/v1/projects/${projectId}/deployments/${deploymentId}`, {
    method: 'PATCH',
    body: patch,
  })
}

/** Close out a deployment. 'retrieved' means the device was physically collected. */
export function endDeployment(
  projectId: string,
  deploymentId: string,
  options: { endedAt?: string; status?: 'ended' | 'retrieved' } = {}
): Promise<Deployment> {
  return apiFetch<Deployment>(`/v1/projects/${projectId}/deployments/${deploymentId}/end`, {
    method: 'POST',
    body: options,
  })
}

/** Rejected (409) while the deployment still has files. Requires admin. */
export function deleteDeployment(projectId: string, deploymentId: string): Promise<void> {
  return apiFetch<void>(`/v1/projects/${projectId}/deployments/${deploymentId}`, { method: 'DELETE' })
}
