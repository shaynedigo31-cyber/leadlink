import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Crown, LogOut, Save, Trash2, UserPlus, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { can } from '../lib/permissions'
import Notice, { type NoticeState } from '../components/Notice'

type Member = {
  member_id: string
  user_id: string
  full_name: string
  status: 'active' | 'pending'
  role_id: string | null
  role_name: string | null
  position_title: string | null
  joined_at: string | null
}
type Role = { id: string; name: string; permissions: string[] }
type Result = PromiseLike<{ error: { message: string } | null }>

const PRIVILEGED = ['org.manage', 'members.manage', 'roles.manage']
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || '?'

export default function Members() {
  const { orgId } = useParams()
  const { user, memberships, refresh } = useAuth()
  const me = memberships.find((m) => m.org_id === orgId)
  const canManage = can(me, 'members.manage')
  const iAmOwner = can(me, '*')

  const [members, setMembers] = useState<Member[] | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [notice, setNotice] = useState<NoticeState>(null)
  const [busy, setBusy] = useState('')
  const [approveRole, setApproveRole] = useState<Record<string, string>>({})
  const [positions, setPositions] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!orgId) return
    const [m, r] = await Promise.all([
      supabase.rpc('list_org_members', { p_org: orgId }),
      supabase.from('org_roles').select('id, name, permissions').eq('org_id', orgId).order('name'),
    ])
    if (m.error) setNotice({ ok: false, text: m.error.message })
    const list = (m.data ?? []) as Member[]
    setMembers(list)
    setRoles((r.data ?? []) as Role[])
    setPositions(Object.fromEntries(list.map((x) => [x.member_id, x.position_title ?? ''])))
  }, [orgId])

  useEffect(() => {
    void load()
  }, [load])

  const run = async (key: string, action: () => Result, okText: string) => {
    setBusy(key)
    setNotice(null)
    const { error } = await action()
    setBusy('')
    if (error) {
      setNotice({ ok: false, text: error.message })
      return
    }
    setNotice({ ok: true, text: okText })
    await load()
    await refresh()
  }

  if (!me || me.status !== 'active') {
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Members</h1>
        <p className="mt-2 text-sm text-muted">Only active members of this organization can see its member list.</p>
        <Link to="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
      </div>
    )
  }

  // Only an Owner may hand out roles that carry management permissions. The database enforces this too.
  const assignable = roles.filter(
    (r) => !r.permissions.includes('*') && (iAmOwner || !r.permissions.some((p) => PRIVILEGED.includes(p))),
  )
  const memberRoleId = roles.find((r) => r.name === 'Member' && !r.permissions.includes('*'))?.id ?? ''
  const isOwnerRole = (id: string | null) => !!roles.find((r) => r.id === id)?.permissions.includes('*')
  const pending = (members ?? []).filter((m) => m.status === 'pending')
  const active = (members ?? []).filter((m) => m.status === 'active')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Members</h1>
        <p className="mt-1 text-sm text-muted">{me.org_name}</p>
      </div>
      <Notice notice={notice} />

      {members === null && <div className="h-28 animate-pulse rounded-2xl bg-brand-soft" />}

      {canManage && pending.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <UserPlus size={18} strokeWidth={1.75} /> Join requests <span className="tabular-nums text-muted">({pending.length})</span>
          </h2>
          <ul className="space-y-3">
            {pending.map((m) => (
              <li key={m.member_id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-sm font-semibold text-amber-700">{initials(m.full_name)}</span>
                  <p className="font-semibold">{m.full_name || 'Unnamed user'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="input w-auto"
                    aria-label={`Role for ${m.full_name}`}
                    value={approveRole[m.member_id] ?? memberRoleId}
                    onChange={(e) => setApproveRole({ ...approveRole, [m.member_id]: e.target.value })}
                  >
                    {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button className="btn-primary disabled:opacity-60" disabled={busy === m.member_id}
                    onClick={() => run(m.member_id, () => supabase.rpc('approve_membership_request', { p_member: m.member_id, p_role: approveRole[m.member_id] ?? memberRoleId }), `${m.full_name} was approved.`)}>
                    <Check size={16} /> Approve
                  </button>
                  <button className="btn-ghost disabled:opacity-60" disabled={busy === m.member_id}
                    onClick={() => run(m.member_id, () => supabase.rpc('reject_membership_request', { p_member: m.member_id }), `${m.full_name}’s request was declined.`)}>
                    <X size={16} /> Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Active members <span className="tabular-nums text-muted">({active.length})</span></h2>
        <ul className="space-y-3">
          {active.map((m) => {
            const isMe = m.user_id === user?.id
            const owner = isOwnerRole(m.role_id)
            const editable = canManage && !isMe && !owner
            return (
              <li key={m.member_id} className="card flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700">{initials(m.full_name)}</span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.full_name || 'Unnamed user'}{isMe && <span className="ml-2 text-xs font-medium text-muted">You</span>}</p>
                    <p className="text-sm text-muted">{m.position_title || 'No position set'}</p>
                  </div>
                </div>
                {editable ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="input w-auto"
                      aria-label={`Role for ${m.full_name}`}
                      value={m.role_id ?? ''}
                      disabled={busy === m.member_id}
                      onChange={(e) => run(m.member_id, () => supabase.rpc('assign_org_member_role', { p_member: m.member_id, p_role: e.target.value }), `${m.full_name}’s role was updated.`)}
                    >
                      {/* Keep the current role visible even if this viewer may not assign it. */}
                      {m.role_id && !assignable.some((r) => r.id === m.role_id) && <option value={m.role_id}>{m.role_name}</option>}
                      {assignable.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <input
                      className="input w-44"
                      placeholder="Position (e.g. Treasurer)"
                      aria-label={`Position for ${m.full_name}`}
                      value={positions[m.member_id] ?? ''}
                      onChange={(e) => setPositions({ ...positions, [m.member_id]: e.target.value })}
                    />
                    <button className="btn-ghost disabled:opacity-60" disabled={busy === m.member_id}
                      onClick={() => run(m.member_id, () => supabase.rpc('set_org_member_position', { p_member: m.member_id, p_position_title: positions[m.member_id] ?? '' }), 'Position saved.')}>
                      <Save size={16} /> Save
                    </button>
                    {iAmOwner && (
                      <button className="btn-ghost disabled:opacity-60" disabled={busy === m.member_id} aria-label={`Make ${m.full_name} the Owner`} title="Transfer ownership"
                        onClick={() => window.confirm(`Transfer ownership of ${me.org_name} to ${m.full_name}? You will become an Administrator.`) && run(m.member_id, () => supabase.rpc('transfer_organization_ownership', { p_org: orgId, p_new_owner: m.user_id }), `${m.full_name} is now the Owner.`)}>
                        <Crown size={16} />
                      </button>
                    )}
                    <button className="btn-ghost text-rose-700 disabled:opacity-60" disabled={busy === m.member_id} aria-label={`Remove ${m.full_name}`}
                      onClick={() => window.confirm(`Remove ${m.full_name} from ${me.org_name}?`) && run(m.member_id, () => supabase.rpc('remove_org_member', { p_member: m.member_id }), `${m.full_name} was removed.`)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${owner ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>{m.role_name ?? 'Member'}</span>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {!iAmOwner && (
        <section className="border-t border-hairline pt-6">
          <button className="btn-ghost text-rose-700 disabled:opacity-60" disabled={busy === 'leave'}
            onClick={() => window.confirm(`Leave ${me.org_name}?`) && run('leave', () => supabase.rpc('leave_organization', { p_org: orgId }), 'You left the organization.')}>
            <LogOut size={16} /> Leave organization
          </button>
        </section>
      )}
    </div>
  )
}