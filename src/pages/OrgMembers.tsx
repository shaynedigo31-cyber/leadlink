import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Users, UserCheck, UserX, Shield, Clock, AlertCircle, CheckCircle2,
  ChevronDown, LogOut, ArrowRightLeft, UserPlus, Info
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type MemberItem = {
  id: string
  user_id: string
  role_id: string | null
  position_title: string | null
  status: 'pending' | 'active' | 'removed'
  joined_at: string | null
  created_at: string
  profiles: {
    id: string
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

type RoleItem = {
  id: string
  name: string
  permissions: string[]
  is_system: boolean
}

export default function OrgMembers() {
  const { orgId } = useParams<{ orgId: string }>()
  const { user, memberships, refresh } = useAuth()
  const navigate = useNavigate()

  const currentMembership = memberships.find((m) => m.org_id === orgId)
  const [members, setMembers] = useState<MemberItem[]>([])
  const [roles, setRoles] = useState<RoleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'pending'>('active')

  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackSuccess, setFeedbackSuccess] = useState('')
  const [actionBusy, setActionBusy] = useState(false)

  // Selected role per pending request for approval
  const [selectedApprovalRole, setSelectedApprovalRole] = useState<Record<string, string>>({})

  // Transfer Ownership state
  const [transferTarget, setTransferTarget] = useState<string | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)

  // Leave Org modal
  const [showLeaveModal, setShowLeaveModal] = useState(false)

  // Invite Member modal
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRoleId, setInviteRoleId] = useState('')

  // Check caller permissions
  const callerRole = useMemo(() => {
    return members.find((m) => m.user_id === user?.id)?.org_roles ?? null
  }, [members, user?.id])

  const isOwner = useMemo(() => {
    if (!callerRole) return false
    return callerRole.is_system && callerRole.permissions.includes('*')
  }, [callerRole])

  const canManageMembers = useMemo(() => {
    if (isOwner) return true
    if (!callerRole) return false
    return (
      callerRole.permissions.includes('*') ||
      callerRole.permissions.includes('members.manage')
    )
  }, [callerRole, isOwner])

  const loadData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setFeedbackError('')

    const [membersRes, rolesRes] = await Promise.all([
      supabase
        .from('organization_members')
        .select(`
          id, user_id, role_id, position_title, status, joined_at, created_at,
          profiles (id, full_name, avatar_url),
          org_roles!organization_members_role_id_fkey (id, name, permissions, is_system)
        `)
        .eq('org_id', orgId)
        .neq('status', 'removed'),
      supabase
        .from('org_roles')
        .select('id, name, permissions, is_system')
        .eq('org_id', orgId)
        .order('name', { ascending: true }),
    ])

    if (membersRes.error) {
      setFeedbackError(membersRes.error.message)
    } else {
      setMembers((membersRes.data as unknown as MemberItem[]) ?? [])
    }

    if (rolesRes.error) {
      console.error('Error loading roles:', rolesRes.error.message)
    } else {
      setRoles(rolesRes.data ?? [])
    }

    setLoading(false)
  }, [orgId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const activeMembers = useMemo(
    () => members.filter((m) => m.status === 'active'),
    [members],
  )

  const pendingRequests = useMemo(
    () => members.filter((m) => m.status === 'pending'),
    [members],
  )

  // Default role for approvals: standard 'Member' role
  const defaultMemberRole = useMemo(() => {
    return roles.find((r) => r.name === 'Member')?.id || roles[0]?.id || ''
  }, [roles])

  // Approve member
  const handleApprove = async (memberId: string) => {
    setFeedbackError('')
    setFeedbackSuccess('')
    const roleId = selectedApprovalRole[memberId] || defaultMemberRole
    if (!roleId) {
      setFeedbackError('Please select a role to assign.')
      return
    }

    setActionBusy(true)
    const { error } = await supabase.rpc('approve_membership_request', {
      p_member: memberId,
      p_role: roleId,
    })
    setActionBusy(false)

    if (error) {
      setFeedbackError(error.message)
    } else {
      setFeedbackSuccess('Member request approved successfully.')
      await loadData()
      await refresh()
    }
  }

  // Reject member request
  const handleReject = async (memberId: string) => {
    setFeedbackError('')
    setFeedbackSuccess('')
    setActionBusy(true)

    const { error } = await supabase.rpc('reject_membership_request', {
      p_member: memberId,
    })
    setActionBusy(false)

    if (error) {
      setFeedbackError(error.message)
    } else {
      setFeedbackSuccess('Membership request declined.')
      await loadData()
      await refresh()
    }
  }

  // Assign role to active member
  const handleRoleChange = async (memberId: string, newRoleId: string) => {
    setFeedbackError('')
    setFeedbackSuccess('')
    setActionBusy(true)

    const { error } = await supabase.rpc('assign_org_member_role', {
      p_member: memberId,
      p_role: newRoleId,
    })
    setActionBusy(false)

    if (error) {
      setFeedbackError(error.message)
    } else {
      setFeedbackSuccess('Member role updated.')
      await loadData()
    }
  }

  // Remove member
  const handleRemove = async (memberId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this organization?`)) {
      return
    }

    setFeedbackError('')
    setFeedbackSuccess('')
    setActionBusy(true)

    const { error } = await supabase.rpc('remove_org_member', {
      p_member: memberId,
    })
    setActionBusy(false)

    if (error) {
      setFeedbackError(error.message)
    } else {
      setFeedbackSuccess(`${memberName} has been removed.`)
      await loadData()
    }
  }

  // Leave organization
  const handleLeave = async () => {
    if (!orgId) return
    setFeedbackError('')
    setActionBusy(true)

    const { error } = await supabase.rpc('leave_organization', { p_org: orgId })
    setActionBusy(false)

    if (error) {
      setFeedbackError(error.message)
      setShowLeaveModal(false)
    } else {
      await refresh()
      navigate('/dashboard', { replace: true })
    }
  }

  // Transfer ownership
  const handleTransferOwnership = async () => {
    if (!orgId || !transferTarget) return
    setFeedbackError('')
    setFeedbackSuccess('')
    setActionBusy(true)

    const { error } = await supabase.rpc('transfer_organization_ownership', {
      p_org: orgId,
      p_new_owner: transferTarget,
    })
    setActionBusy(false)
    setShowTransferModal(false)

    if (error) {
      setFeedbackError(error.message)
    } else {
      setFeedbackSuccess('Organization ownership transferred successfully.')
      await loadData()
      await refresh()
    }
  }

  // Send invitation
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!orgId || !inviteEmail.trim()) return

    setFeedbackError('')
    setFeedbackSuccess('')
    setActionBusy(true)

    const targetRoleId = inviteRoleId || defaultMemberRole

    const { error: rpcErr } = await supabase.rpc('create_organization_invitation', {
      p_org: orgId,
      p_email: inviteEmail.trim(),
      p_role: targetRoleId,
    })

    setActionBusy(false)
    if (rpcErr) {
      setFeedbackError(rpcErr.message)
    } else {
      setFeedbackSuccess(`Invitation sent to ${inviteEmail.trim()}.`)
      setShowInviteModal(false)
      setInviteEmail('')
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
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold sm:text-3xl">Members & Access</h1>
            <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
              {currentMembership.org_name}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Manage organization membership, roles, and pending applications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManageMembers && (
            <button
              type="button"
              onClick={() => setShowInviteModal(true)}
              className="btn-primary flex items-center gap-1.5 text-xs font-semibold"
            >
              <UserPlus size={14} /> Invite Member
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowTransferModal(true)}
              className="btn-ghost flex items-center gap-1.5 text-xs font-semibold"
            >
              <ArrowRightLeft size={14} /> Transfer Ownership
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowLeaveModal(true)}
            className="btn-ghost flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            <LogOut size={14} /> Leave Organization
          </button>
        </div>
      </div>

      {feedbackError && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <p>{feedbackError}</p>
        </div>
      )}

      {feedbackSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          <CheckCircle2 size={18} className="shrink-0" />
          <p>{feedbackSuccess}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-hairline">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            activeTab === 'active'
              ? 'border-brand text-brand'
              : 'border-transparent text-muted hover:text-ink'
          }`}
        >
          <Users size={16} />
          Active Members ({activeMembers.length})
        </button>

        {canManageMembers && (
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'pending'
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <Clock size={16} />
            Pending Requests
            {pendingRequests.length > 0 && (
              <span className="rounded-full bg-amber-500 px-2 py-0.2 text-xs font-bold text-white">
                {pendingRequests.length}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Active Members Table */}
      {activeTab === 'active' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-hairline bg-canvas text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-6 py-3.5">Member</th>
                  <th className="px-6 py-3.5">Position</th>
                  <th className="px-6 py-3.5">Role</th>
                  <th className="px-6 py-3.5">Joined Date</th>
                  {canManageMembers && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {loading ? (
                  <tr>
                    <td colSpan={canManageMembers ? 5 : 4} className="p-8 text-center text-muted">
                      Loading members…
                    </td>
                  </tr>
                ) : activeMembers.length === 0 ? (
                  <tr>
                    <td colSpan={canManageMembers ? 5 : 4} className="p-8 text-center text-muted">
                      No active members found.
                    </td>
                  </tr>
                ) : (
                  activeMembers.map((m) => {
                    const isSelf = m.user_id === user?.id
                    const targetIsOwner = m.org_roles?.is_system && m.org_roles?.permissions.includes('*')

                    return (
                      <tr key={m.id} className="hover:bg-canvas/50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 font-bold text-indigo-700">
                              {m.profiles?.full_name ? m.profiles.full_name[0].toUpperCase() : '?'}
                            </span>
                            <div>
                              <p className="font-semibold text-ink">
                                {m.profiles?.full_name || 'Anonymous User'}
                                {isSelf && <span className="ml-1.5 text-xs text-muted">(You)</span>}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted">
                          {m.position_title || '—'}
                        </td>
                        <td className="px-6 py-4">
                          {canManageMembers && !isSelf && !targetIsOwner ? (
                            <select
                              value={m.role_id || ''}
                              onChange={(e) => handleRoleChange(m.id, e.target.value)}
                              disabled={actionBusy}
                              className="rounded-lg border border-hairline bg-white px-2.5 py-1 text-xs font-medium focus:border-brand focus:outline-none"
                            >
                              {roles
                                .filter((r) => !r.permissions.includes('*')) // Ownership transferred separately
                                .map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                            </select>
                          ) : (
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                targetIsOwner
                                  ? 'bg-purple-50 text-purple-700'
                                  : 'bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              <Shield size={12} />
                              {m.org_roles?.name || 'Member'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-muted">
                          {m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}
                        </td>
                        {canManageMembers && (
                          <td className="px-6 py-4 text-right">
                            {!isSelf && !targetIsOwner ? (
                              <button
                                type="button"
                                disabled={actionBusy}
                                onClick={() => handleRemove(m.id, m.profiles?.full_name || 'this member')}
                                className="text-xs font-semibold text-rose-700 hover:underline disabled:opacity-50"
                              >
                                Remove
                              </button>
                            ) : (
                              <span className="text-xs text-muted">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pending Requests Queue */}
      {activeTab === 'pending' && canManageMembers && (
        <div className="space-y-4">
          {pendingRequests.length === 0 ? (
            <div className="card flex flex-col items-center p-12 text-center">
              <span className="icon-chip"><UserCheck size={24} strokeWidth={1.75} /></span>
              <p className="mt-4 font-bold text-ink">No pending membership requests</p>
              <p className="mt-1 text-sm text-muted">New requests from Discover will appear here for administrator review.</p>
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div key={req.id} className="card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 font-bold text-amber-700">
                    {req.profiles?.full_name ? req.profiles.full_name[0].toUpperCase() : '?'}
                  </span>
                  <div>
                    <h3 className="font-bold text-ink">{req.profiles?.full_name || 'Anonymous User'}</h3>
                    <p className="text-xs text-muted">
                      Requested on {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label htmlFor={`role-${req.id}`} className="text-xs font-medium text-muted">Assign role:</label>
                    <select
                      id={`role-${req.id}`}
                      value={selectedApprovalRole[req.id] || defaultMemberRole}
                      onChange={(e) =>
                        setSelectedApprovalRole({ ...selectedApprovalRole, [req.id]: e.target.value })
                      }
                      className="rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-xs font-medium focus:border-brand focus:outline-none"
                    >
                      {roles
                        .filter((r) => !r.permissions.includes('*'))
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleApprove(req.id)}
                    className="btn-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                  >
                    <UserCheck size={14} /> Approve
                  </button>

                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={() => handleReject(req.id)}
                    className="btn-ghost flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50"
                  >
                    <UserX size={14} /> Decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-ink">Transfer Organization Ownership</h2>
            <p className="mt-2 text-sm text-muted">
              Select an active member to become the new primary Owner. You will step down to the system Administrator role.
            </p>

            <div className="mt-4">
              <label htmlFor="target-owner" className="mb-1.5 block text-xs font-semibold text-ink">Select New Owner</label>
              <select
                id="target-owner"
                value={transferTarget || ''}
                onChange={(e) => setTransferTarget(e.target.value)}
                className="input text-sm"
              >
                <option value="">Choose an active member…</option>
                {activeMembers
                  .filter((m) => m.user_id !== user?.id)
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.profiles?.full_name || 'User'} ({m.org_roles?.name || 'Member'})
                    </option>
                  ))}
              </select>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="btn-ghost text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!transferTarget || actionBusy}
                onClick={handleTransferOwnership}
                className="btn-primary text-sm disabled:opacity-60"
              >
                {actionBusy ? 'Transferring…' : 'Confirm Ownership Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave Organization Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-ink">Leave Organization</h2>
            <p className="mt-2 text-sm text-muted">
              Are you sure you want to leave <span className="font-semibold text-ink">{currentMembership.org_name}</span>? You will lose access to its private workspace and will need to re-apply to rejoin.
            </p>
            {isOwner && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                <Info size={16} className="mt-0.5 shrink-0" />
                <p>As the organization Owner, if you are the final active Owner you must transfer ownership before leaving.</p>
              </div>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="btn-ghost text-sm"
              >
                Stay
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={handleLeave}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {actionBusy ? 'Leaving…' : 'Leave Organization'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-ink">Invite Member to Organization</h2>
            <p className="mt-1 text-sm text-muted">
              Send an email invitation to join <span className="font-semibold text-ink">{currentMembership.org_name}</span>.
            </p>

            <form onSubmit={handleSendInvite} className="mt-4 space-y-4">
              <div>
                <label htmlFor="invite-email" className="mb-1 block text-xs font-semibold text-ink">Recipient Email</label>
                <input
                  id="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="student@example.edu"
                  className="input text-sm"
                  required
                />
              </div>

              <div>
                <label htmlFor="invite-role" className="mb-1 block text-xs font-semibold text-ink">Assigned Role</label>
                <select
                  id="invite-role"
                  value={inviteRoleId || defaultMemberRole}
                  onChange={(e) => setInviteRoleId(e.target.value)}
                  className="input text-sm"
                >
                  {roles
                    .filter((r) => !r.permissions.includes('*'))
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="btn-ghost text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionBusy || !inviteEmail.trim()}
                  className="btn-primary text-sm disabled:opacity-60"
                >
                  {actionBusy ? 'Sending…' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
