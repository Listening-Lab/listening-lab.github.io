'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import RequireAuth from '@/lib/auth/RequireAuth'
import {
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
  type Member,
  type ProjectRole,
} from '@/lib/apiClient'

function AddMemberForm({
  projectId,
  onAdded,
}: {
  projectId: string
  onAdded: (member: Member) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectRole>('member')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const member = await addMember(projectId, { email: email.trim(), role })
      onAdded(member)
      setEmail('')
      setRole('member')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-lg px-5 py-4 mb-8">
      <h2 className="text-sm font-medium text-gray-300 mb-3">Add member</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="email" required placeholder="person@example.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="flex-1 bg-white/5 border border-white/15 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={role} onChange={(e) => setRole(e.target.value as ProjectRole)}
          className="bg-[#0d1e35] border border-white/15 text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
        <button
          type="submit"
          disabled={!email.trim() || saving}
          className="bg-white text-ocean-dark px-5 py-2.5 rounded-full text-sm font-medium hover:bg-brand-50 transition-colors disabled:opacity-60 shrink-0"
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
      {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
    </form>
  )
}

function MemberRow({
  projectId,
  member,
  onChanged,
  onRemoved,
}: {
  projectId: string
  member: Member
  onChanged: (member: Member) => void
  onRemoved: (userId: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRoleChange(role: ProjectRole) {
    setBusy(true)
    setError(null)
    try {
      const updated = await updateMemberRole(projectId, member.userId, role)
      onChanged(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    setError(null)
    try {
      await removeMember(projectId, member.userId)
      onRemoved(member.userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
      setBusy(false)
    }
  }

  return (
    <li className="border-b border-white/5 py-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-white text-sm truncate">{member.email}</span>
        <div className="shrink-0 flex items-center gap-2">
          <select
            value={member.role}
            disabled={busy}
            onChange={(e) => handleRoleChange(e.target.value as ProjectRole)}
            className="bg-[#0d1e35] border border-white/15 text-white rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={handleRemove}
            disabled={busy}
            className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      </div>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </li>
  )
}

function MembersPanel() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  const [members, setMembers] = useState<Member[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    listMembers(projectId)
      .then((data) => { if (!cancelled) setMembers(data) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load members') })
    return () => { cancelled = true }
  }, [projectId])

  if (!projectId) {
    return (
      <p className="text-red-500 text-sm">
        No project selected. Go back to{' '}
        <Link href="/projects" className="underline">your projects</Link> and choose one to manage.
      </p>
    )
  }

  return (
    <>
      <AddMemberForm
        projectId={projectId}
        onAdded={(member) => setMembers((prev) => [...(prev ?? []), member])}
      />

      {error && <p className="text-red-500 text-sm">Could not load members: {error}</p>}
      {!error && members === null && <p className="text-gray-400 text-sm">Loading members…</p>}

      {members && (
        <ul className="bg-white/5 border border-white/10 rounded-lg px-5 divide-y divide-white/5">
          {members.map((member) => (
            <MemberRow
              key={member.userId}
              projectId={projectId}
              member={member}
              onChanged={(updated) =>
                setMembers((prev) => (prev ?? []).map((m) => (m.userId === updated.userId ? updated : m)))
              }
              onRemoved={(userId) =>
                setMembers((prev) => (prev ?? []).filter((m) => m.userId !== userId))
              }
            />
          ))}
        </ul>
      )}
    </>
  )
}

function MembersPageContent() {
  return (
    <div className="min-h-screen bg-ocean-dark px-6 py-24">
      <div className="max-w-2xl mx-auto">
        <p className="text-sm text-gray-500 mb-2">
          <Link href="/projects" className="hover:text-white transition-colors">
            ← Your Projects
          </Link>
        </p>
        <h1 className="font-serif text-4xl text-white mb-10">Members</h1>
        <MembersPanel />
      </div>
    </div>
  )
}

export default function MembersPage() {
  return (
    <RequireAuth>
      <Suspense fallback={null}>
        <MembersPageContent />
      </Suspense>
    </RequireAuth>
  )
}
