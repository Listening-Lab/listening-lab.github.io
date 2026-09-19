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
  /** ISO 8601 recording timestamp, entered manually at MVP stage. */
  recordedAt: string
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
  options: { assetId?: string; species?: string; minScore?: number; limit?: number } = {}
): Promise<Detection[]> {
  const params = new URLSearchParams()
  if (options.assetId !== undefined) params.set('asset_id', options.assetId)
  if (options.species !== undefined) params.set('species', options.species)
  if (options.minScore !== undefined) params.set('min_score', String(options.minScore))
  if (options.limit !== undefined) params.set('limit', String(options.limit))
  const qs = params.toString()
  return apiFetch<Detection[]>(`/v1/projects/${projectId}/detections${qs ? `?${qs}` : ''}`)
}

/**
 * Full upload flow per the brief: request a signed URL, upload direct to storage, then
 * notify the API so it can create the processing job. Returns the new job id to poll.
 */
export async function uploadRecording(
  projectId: string,
  file: File,
  location: { lat: number; lon: number; recordedAt: string }
): Promise<string> {
  const { uploadUrl, fileKey } = await requestUploadUrl(projectId, file.name, file.type)
  await uploadFileToStorage(uploadUrl, file)
  const { jobId } = await completeUpload(projectId, { fileKey, ...location })
  return jobId
}

export { apiFetch }
