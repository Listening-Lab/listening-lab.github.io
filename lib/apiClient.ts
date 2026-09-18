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
    throw new ApiError(response.status, errText || response.statusText)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export interface Project {
  id: string
  name: string
  description?: string
}

export function listProjects(): Promise<Project[]> {
  return apiFetch<Project[]>('/v1/projects')
}

export { apiFetch }
