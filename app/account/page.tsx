'use client'

import { useEffect, useState } from 'react'
import RequireAuth from '@/lib/auth/RequireAuth'
import { useAuth } from '@/lib/auth/AuthProvider'
import {
  getMe,
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listProjects,
  getProjectUsage,
  listDeletedProjectUsage,
  type Me,
  type ApiKey,
  type Project,
  type ProjectUsageSummary,
  type DeletedProjectUsage,
  ApiError,
} from '@/lib/apiClient'

const TEAL = '#4ecdc4'

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents < 100 ? 4 : 2)}`
}

const USAGE_KIND_LABELS: Record<string, string> = {
  gcs_write_ops: 'Uploads',
  gcs_read_ops: 'Downloads',
  inference_seconds: 'Analysis (sec)',
  training_seconds: 'Training (sec)',
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL

// Revoked keys are never actually deleted server-side (the API keeps them as an audit
// trail - see auth.py/main.py's own comments on revoke_api_key), so "clearing" one here
// only hides it from this browser's view going forward - a display preference, not a
// server call. Persisted so it stays cleared across reloads.
const HIDDEN_REVOKED_KEYS_STORAGE_KEY = 'nc:hiddenRevokedApiKeyIds'

function readHiddenRevokedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_REVOKED_KEYS_STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set() // corrupt entry, storage disabled, etc. - just show everything
  }
}

function writeHiddenRevokedIds(ids: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_REVOKED_KEYS_STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // storage full/disabled - this is a pure display preference, nothing to fall back to
  }
}

function ApiKeysSection() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [readOnly, setReadOnly] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  const [hiddenRevokedIds, setHiddenRevokedIds] = useState<Set<string>>(() => readHiddenRevokedIds())

  useEffect(() => {
    let cancelled = false
    listApiKeys()
      .then((data) => { if (!cancelled) setKeys(data) })
      .catch((err) => { if (!cancelled) setListError(err instanceof ApiError ? err.message : 'Could not load your API keys.') })
    return () => { cancelled = true }
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    setJustCreated(null)
    setCopied(false)
    try {
      const { apiKey, rawKey } = await createApiKey({ name: name.trim(), readOnly })
      setKeys((prev) => [apiKey, ...(prev ?? [])])
      setJustCreated(rawKey)
      setName('')
      setReadOnly(false)
    } catch (err) {
      // A non-subscriber sees the API's own real "coming soon" message here, unchanged —
      // no special-casing needed, it's already accurate (auth.require_early_access).
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create API key')
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(keyId: string) {
    setRevokingId(keyId)
    try {
      await revokeApiKey(keyId)
      setKeys((prev) => (prev ?? []).map((k) => (k.id === keyId ? { ...k, revokedAt: new Date().toISOString() } : k)))
    } catch (err) {
      setListError(err instanceof ApiError ? err.message : 'Failed to revoke key')
    } finally {
      setRevokingId(null)
    }
  }

  // Only hides currently-revoked keys from this browser's view - see this file's own
  // comment on HIDDEN_REVOKED_KEYS_STORAGE_KEY for why nothing is actually deleted.
  function handleClearRevoked() {
    const revokedIds = (keys ?? []).filter((k) => k.revokedAt).map((k) => k.id)
    const next = new Set(hiddenRevokedIds)
    for (const id of revokedIds) next.add(id)
    setHiddenRevokedIds(next)
    writeHiddenRevokedIds(next)
  }

  const visibleKeys = (keys ?? []).filter((k) => !(k.revokedAt && hiddenRevokedIds.has(k.id)))
  const visibleRevokedCount = visibleKeys.filter((k) => k.revokedAt).length

  return (
    <div className="bg-white/5 border border-white/15 rounded-2xl p-6 md:p-8 mb-6">
      <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
        API Keys
      </p>
      <p className="text-gray-400 text-sm mb-4">
        For integrating your own app with the Nature Commons API directly. Requires an
        active subscription to mint a new key.
      </p>

      {justCreated && (
        <div className="bg-brand-500/10 border border-brand-500/30 rounded-lg px-4 py-3 mb-4">
          <p className="text-xs text-gray-300 mb-2">
            Your new key — copy it now, it won&apos;t be shown again:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-white bg-black/30 rounded px-3 py-2 overflow-x-auto whitespace-nowrap">
              {justCreated}
            </code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard?.writeText(justCreated)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                } catch {
                  // Clipboard permission denied/unavailable — the key text is still
                  // selectable/copyable by hand right above this button.
                }
              }}
              className={`shrink-0 text-xs font-medium px-3 py-2 rounded transition-colors ${
                copied ? 'bg-brand-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
          <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-400 leading-relaxed">
            <p className="mb-1.5">
              Use it to call the API directly, in place of signing in through the browser —
              send it as a bearer token on any request:
            </p>
            <code className="block bg-black/30 rounded px-3 py-2 text-gray-300 overflow-x-auto whitespace-pre">
              {`curl -H "Authorization: Bearer ${justCreated}" \\\n  ${API_BASE_URL ?? '<API base URL>'}/v1/me`}
            </code>
            <p className="mt-1.5">
              Full reference for every endpoint:{' '}
              {API_BASE_URL ? (
                <a href={`${API_BASE_URL}/docs`} target="_blank" rel="noreferrer" className="underline hover:text-white">
                  {API_BASE_URL}/docs
                </a>
              ) : (
                '<API base URL>/docs'
              )}
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          type="text" required placeholder='Key name, e.g. "CI pipeline"'
          value={name} onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-300 shrink-0">
          <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} />
          Read-only
        </label>
        <button
          type="submit"
          disabled={!name.trim() || creating}
          className="bg-white text-ocean-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60 shrink-0"
        >
          {creating ? 'Creating…' : 'Create key'}
        </button>
      </form>
      {createError && <p className="text-red-400 text-sm mb-4">{createError}</p>}

      {listError && <p className="text-red-400 text-sm">{listError}</p>}
      {!listError && keys === null && <p className="text-gray-500 text-sm">Loading…</p>}
      {keys && keys.length === 0 && <p className="text-gray-500 text-sm">No API keys yet.</p>}

      {keys && keys.length > 0 && visibleRevokedCount > 0 && (
        <div className="flex justify-end mb-2">
          <button
            onClick={handleClearRevoked}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear {visibleRevokedCount} revoked key{visibleRevokedCount === 1 ? '' : 's'} from this list
          </button>
        </div>
      )}

      {keys && keys.length > 0 && visibleKeys.length === 0 && (
        <p className="text-gray-500 text-sm">All keys are revoked and cleared from this view.</p>
      )}
      {visibleKeys.length > 0 && (
        <ul className="divide-y divide-white/5">
          {visibleKeys.map((key) => (
            <li key={key.id} className="py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm truncate">{key.name}</span>
                  {key.readOnly && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/15 shrink-0">
                      read-only
                    </span>
                  )}
                  {key.revokedAt && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-400/10 text-red-400 border border-red-400/20 shrink-0">
                      revoked
                    </span>
                  )}
                </div>
                <p className="text-gray-500 text-xs font-mono mt-0.5">
                  {key.keyPrefix}… · {key.projectIds.length === 0 ? 'all projects' : `${key.projectIds.length} project${key.projectIds.length === 1 ? '' : 's'}`}
                  {key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleDateString('en-NZ')}` : ' · never used'}
                </p>
              </div>
              {!key.revokedAt && (
                <button
                  onClick={() => handleRevoke(key.id)}
                  disabled={revokingId === key.id}
                  className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors disabled:opacity-60 shrink-0"
                >
                  {revokingId === key.id ? 'Revoking…' : 'Revoke'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// A project's usage bill is the responsibility of whoever administers it, not every
// member it happens to have (a member you added to your project shouldn't see your
// storage cost as their own) - `role` on Project already tells us which side of that a
// given project is on, no separate API call needed to know it. Only admin-role projects
// fetch real numbers below; a member-role project never even calls getProjectUsage for
// itself - not just hidden client-side, genuinely not requested, since there's nothing
// for a member to be billed for.
function UsageSection() {
  const [adminRows, setAdminRows] = useState<{ project: Project; usage: ProjectUsageSummary }[] | null>(null)
  const [memberProjects, setMemberProjects] = useState<Project[]>([])
  const [deletedProjects, setDeletedProjects] = useState<DeletedProjectUsage[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([listProjects(), listDeletedProjectUsage()])
      .then(async ([projects, deleted]) => {
        // Public always first, regardless of role - it's the one project everyone
        // shares, so it anchors the list the same way for every viewer.
        const sorted = [...projects].sort((a, b) => Number(b.isPublic) - Number(a.isPublic))
        const adminProjects = sorted.filter((p) => p.role === 'admin')
        const summaries = await Promise.all(adminProjects.map((p) => getProjectUsage(p.id)))
        if (cancelled) return
        setAdminRows(adminProjects.map((project, i) => ({ project, usage: summaries[i] })))
        setMemberProjects(sorted.filter((p) => p.role !== 'admin'))
        setDeletedProjects(deleted)
      })
      .catch((err) => { if (!cancelled) setError(err instanceof ApiError ? err.message : 'Could not load usage.') })
    return () => { cancelled = true }
  }, [])

  const loaded = adminRows !== null
  const isEmpty = loaded && adminRows.length === 0 && memberProjects.length === 0 && deletedProjects.length === 0

  return (
    <div className="bg-white/5 border border-white/15 rounded-2xl p-6 md:p-8 mb-6">
      <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
        Usage
      </p>
      <p className="text-gray-400 text-sm mb-4">
        Cost belongs to whoever administers a project, not every member it has — you only
        see a real breakdown for projects you admin. Estimates are our own price sitting on
        top of real quantities, not what Google Cloud actually charges us. Storage is
        measured live, right now, each time this page loads.
      </p>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!error && !loaded && <p className="text-gray-500 text-sm">Loading…</p>}
      {isEmpty && <p className="text-gray-500 text-sm">No projects yet.</p>}
      {loaded && !isEmpty && (
        <div className="space-y-4">
          {adminRows.map(({ project, usage }) => {
            const eventsCostCents = usage.events.reduce((sum, e) => sum + e.costCents, 0)
            const totalCostCents = usage.currentStorageCostCentsEstimate + eventsCostCents
            return (
              <div key={project.id} className="border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <span className="text-white text-sm font-medium">{project.name}</span>
                  <span className="text-gray-300 text-sm">{formatCents(totalCostCents)} est.</span>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-400">
                  <div className="flex justify-between sm:block">
                    <dt>Storage</dt>
                    <dd className="text-gray-300">{usage.currentStorageGib.toFixed(3)} GiB</dd>
                  </div>
                  {usage.events.map((e) => (
                    <div key={e.kind} className="flex justify-between sm:block">
                      <dt>{USAGE_KIND_LABELS[e.kind] ?? e.kind}</dt>
                      <dd className="text-gray-300">{e.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
          {memberProjects.map((project) => (
            <div key={project.id} className="border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-center justify-between gap-4">
                <span className="text-white text-sm font-medium">{project.name}</span>
                <span className="text-xs font-medium px-3 py-1 rounded-full bg-brand-500/10 text-brand-500 border border-brand-500/20">
                  Free
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-1">Covered by this project&apos;s admins.</p>
            </div>
          ))}
          {deletedProjects.map((deleted) => {
            const totalCostCents = deleted.events.reduce((sum, e) => sum + e.costCents, 0)
            return (
              <div key={deleted.projectName} className="border-t border-white/5 pt-4 first:border-t-0 first:pt-0">
                <div className="flex items-center justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm font-medium">{deleted.projectName}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-400 border border-white/15">
                      Deleted
                    </span>
                  </div>
                  <span className="text-gray-300 text-sm">{formatCents(totalCostCents)} est.</span>
                </div>
                <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs text-gray-400">
                  {deleted.events.map((e) => (
                    <div key={e.kind} className="flex justify-between sm:block">
                      <dt>{USAGE_KIND_LABELS[e.kind] ?? e.kind}</dt>
                      <dd className="text-gray-300">{e.quantity.toLocaleString(undefined, { maximumFractionDigits: 1 })}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AccountContent() {
  const { signOut } = useAuth()
  const [me, setMe] = useState<Me | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getMe()
      .then((result) => { if (!cancelled) setMe(result) })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Could not load your account.')
      })
    return () => { cancelled = true }
  }, [])

  return (
    <div className="min-h-screen bg-ocean-dark">
      <div className="max-w-2xl mx-auto px-6 py-24">
        <h1 className="font-serif text-5xl text-white mb-4">Account</h1>
        <p className="text-xl text-gray-400 mb-12">
          Manage your Nature Commons account and subscription.
        </p>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}

        <div className="bg-white/5 border border-white/15 rounded-2xl p-6 md:p-8 mb-6">
          <p className="text-xs tracking-widest uppercase mb-4 font-medium" style={{ color: TEAL }}>
            Profile
          </p>
          {me ? (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-400">Email</dt>
                <dd className="text-white">{me.email}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-400">Member since</dt>
                <dd className="text-white">{formatJoined(me.createdAt)}</dd>
              </div>
            </dl>
          ) : (
            !error && <p className="text-gray-500 text-sm">Loading…</p>
          )}
        </div>

        <div className="bg-white/5 border border-white/15 rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <p className="text-xs tracking-widest uppercase font-medium" style={{ color: TEAL }}>
              Subscription
            </p>
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-white/10 text-gray-300 border border-white/15">
              Coming soon
            </span>
          </div>
          <p className="text-gray-300 leading-relaxed">
            Viewing and labeling data in the shared Public project stays free, always. Paid
            subscriptions — for your own private projects, data storage, and model training —
            aren&apos;t open yet.
          </p>
        </div>

        <ApiKeysSection />
        <UsageSection />

        <button
          onClick={signOut}
          className="px-6 py-2.5 rounded-full text-sm font-medium border border-white/20 bg-white/5 hover:bg-white/10 transition-colors text-white"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  )
}
