import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Award, Users, Briefcase, Plus, Edit2, CheckCircle2, AlertCircle,
  Building2, Layers
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type MemberRecord = {
  id: string
  user_id: string
  position_title: string | null
  status: string
  profiles: {
    full_name: string
    avatar_url: string | null
  } | null
  org_roles: {
    id: string
    name: string
    permissions: string[]
    is_system: boolean
  } | null
}

const STANDARD_COMMITTEES = [
  'Executive Board',
  'Secretariat & Documentation',
  'Finance & Sponsorships',
  'Logistics & Operations',
  'Public Relations & Creatives',
  'Membership & Community',
  'Programs & Events',
]

export default function OrgStructure() {
  const { orgId } = useParams<{ orgId: string }>()
  const { user, memberships } = useAuth()
  const currentMembership = memberships.find((m) => m.org_id === orgId)

  const [members, setMembers] = useState<MemberRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Edit Position Modal
  const [editingMember, setEditingMember] = useState<MemberRecord | null>(null)
  const [positionInput, setPositionInput] = useState('')
  const [selectedCommittee, setSelectedCommittee] = useState('Executive Board')
  const [saving, setSaving] = useState(false)

  const isOwner = currentMembership?.role_name === 'Owner'
  const canManage = isOwner || currentMembership?.role_name === 'Administrator'

  const loadMembers = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError('')

    const { data, error: fetchErr } = await supabase
      .from('organization_members')
      .select(`
        id, user_id, position_title, status,
        profiles (full_name, avatar_url),
        org_roles!organization_members_role_id_fkey (id, name, permissions, is_system)
      `)
      .eq('org_id', orgId)
      .eq('status', 'active')

    if (fetchErr) {
      setError(fetchErr.message)
    } else {
      setMembers((data as unknown as MemberRecord[]) ?? [])
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    void loadMembers()
  }, [loadMembers])

  const officers = useMemo(() => {
    return members.filter((m) => Boolean(m.position_title))
  }, [members])

  const openEditPosition = (m: MemberRecord) => {
    setEditingMember(m)
    const current = m.position_title || ''
    if (current.includes(' - ')) {
      const [comm, pos] = current.split(' - ')
      setSelectedCommittee(STANDARD_COMMITTEES.includes(comm) ? comm : 'Executive Board')
      setPositionInput(pos || '')
    } else {
      setSelectedCommittee('Executive Board')
      setPositionInput(current)
    }
    setError('')
    setSuccess('')
  }

  const handleSavePosition = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingMember || !orgId) return

    setSaving(true)
    setError('')
    setSuccess('')

    const formattedTitle = positionInput.trim()
      ? `${selectedCommittee} - ${positionInput.trim()}`
      : null

    const { error: updateErr } = await supabase.rpc('set_org_member_position', {
      p_member: editingMember.id,
      p_position_title: formattedTitle,
    })

    setSaving(false)
    if (updateErr) {
      setError(updateErr.message)
    } else {
      setSuccess(`Updated position title for ${editingMember.profiles?.full_name || 'member'}.`)
      setEditingMember(null)
      await loadMembers()
    }
  }

  if (!currentMembership) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="mt-2 text-sm text-muted">You are not a member of this organization.</p>
        <Link to="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold sm:text-3xl">Officers & Structure</h1>
            <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
              {currentMembership.org_name}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Organizational hierarchy, committee divisions, and appointed officer titles.
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          <CheckCircle2 size={18} className="shrink-0" />
          <p>{success}</p>
        </div>
      )}

      {/* Officers Roster Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Award size={18} className="text-brand" /> Executive & Appointed Officers ({officers.length})
          </h2>
          <span className="text-xs text-muted">
            {members.length} active total members
          </span>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse p-6">
                <div className="h-5 w-32 rounded bg-brand-soft" />
                <div className="mt-3 h-4 w-48 rounded bg-brand-soft" />
              </div>
            ))}
          </div>
        ) : officers.length === 0 ? (
          <div className="card flex flex-col items-center p-10 text-center">
            <span className="icon-chip"><Briefcase size={22} strokeWidth={1.75} /></span>
            <p className="mt-4 font-bold text-ink">No officer titles assigned yet</p>
            <p className="mt-1 text-sm text-muted">
              Appoint active members to executive roles (President, Secretary, Committee Heads) below.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {officers.map((m) => (
              <div key={m.id} className="card flex flex-col justify-between p-5 transition-all duration-200 hover:-translate-y-0.5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-700">
                      {m.profiles?.full_name ? m.profiles.full_name[0].toUpperCase() : '?'}
                    </span>
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                      {m.org_roles?.name || 'Member'}
                    </span>
                  </div>
                  <h3 className="mt-3 font-bold text-ink">{m.profiles?.full_name || 'Anonymous User'}</h3>
                  <p className="mt-1 text-sm font-medium text-brand">
                    {m.position_title}
                  </p>
                </div>

                {canManage && (
                  <div className="mt-4 border-t border-hairline pt-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEditPosition(m)}
                      className="text-xs font-semibold text-brand hover:underline"
                    >
                      Change Position
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Member Position Assignment Table */}
      <section className="card overflow-hidden p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Layers size={18} /> Position & Committee Assignment
            </h2>
            <p className="mt-1 text-sm text-muted">
              Designate titles and assign active members to operational committees.
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-hairline bg-canvas text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Current Position / Title</th>
                <th className="px-4 py-3">System Role</th>
                {canManage && <th className="px-4 py-3 text-right">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-canvas/40">
                  <td className="px-4 py-3 font-semibold text-ink">
                    {m.profiles?.full_name || 'Anonymous User'}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {m.position_title || <span className="italic text-muted/70">Unassigned (General Member)</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink">
                      {m.org_roles?.name || 'Member'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEditPosition(m)}
                        className="btn-ghost flex items-center gap-1 ml-auto px-2.5 py-1 text-xs font-semibold"
                      >
                        <Edit2 size={13} /> Edit Title
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Position Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-ink">Assign Officer Position</h2>
            <p className="mt-1 text-sm text-muted">
              Assign an executive position or committee role to <span className="font-semibold text-ink">{editingMember.profiles?.full_name}</span>.
            </p>

            <form onSubmit={handleSavePosition} className="mt-4 space-y-4">
              <div>
                <label htmlFor="committee-select" className="mb-1 block text-xs font-semibold text-ink">Committee / Division</label>
                <select
                  id="committee-select"
                  value={selectedCommittee}
                  onChange={(e) => setSelectedCommittee(e.target.value)}
                  className="input text-sm"
                >
                  {STANDARD_COMMITTEES.map((comm) => (
                    <option key={comm} value={comm}>{comm}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="position-title" className="mb-1 block text-xs font-semibold text-ink">Position Title</label>
                <input
                  id="position-title"
                  className="input"
                  value={positionInput}
                  onChange={(e) => setPositionInput(e.target.value)}
                  placeholder="e.g. Chairperson, Secretary, Lead Developer, Member"
                />
                <p className="mt-1 text-[11px] text-muted">Leave empty to reset to General Member.</p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="btn-ghost text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-sm disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save Position'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
