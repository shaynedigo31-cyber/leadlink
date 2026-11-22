import { useEffect, useState, useMemo, type FormEvent } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  Settings, Shield, Plus, Edit2, Trash2, AlertCircle, CheckCircle2,
  Lock, Building2, Info
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type Role = {
  id: string
  name: string
  permissions: string[]
  is_system: boolean
}

const AVAILABLE_PERMISSIONS = [
  { key: 'org.manage', label: 'Manage Organization Details', privileged: true, desc: 'Update organization name, description, and profile settings' },
  { key: 'members.manage', label: 'Manage Members & Requests', privileged: true, desc: 'Approve join requests, assign roles, and remove members' },
  { key: 'roles.manage', label: 'Manage Custom Roles', privileged: true, desc: 'Create, edit, and delete custom organization roles' },
  { key: 'events.manage', label: 'Manage Events', privileged: false, desc: 'Create, update, and publish organization events' },
  { key: 'projects.manage', label: 'Manage Projects', privileged: false, desc: 'Organize tasks, assign projects, and update progress' },
  { key: 'announcements.manage', label: 'Post Announcements', privileged: false, desc: 'Broadcast notices to all organization members' },
]

export default function OrgSettings() {
  const { orgId } = useParams<{ orgId: string }>()
  const { user, memberships, refresh } = useAuth()

  const currentMembership = memberships.find((m) => m.org_id === orgId)
  const [orgDetails, setOrgDetails] = useState<{ name: string; description: string; status: string } | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)

  // Details form
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [detailsSaving, setDetailsSaving] = useState(false)

  // Role editor modal
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [roleName, setRoleName] = useState('')
  const [rolePerms, setRolePerms] = useState<string[]>([])
  const [roleSaving, setRoleSaving] = useState(false)

  const [feedbackError, setFeedbackError] = useState('')
  const [feedbackSuccess, setFeedbackSuccess] = useState('')

  const isOwner = useMemo(() => {
    return currentMembership?.role_name === 'Owner'
  }, [currentMembership])

  const canManageRoles = useMemo(() => {
    return isOwner || currentMembership?.role_name === 'Administrator'
  }, [isOwner, currentMembership])

  const loadData = async () => {
    if (!orgId) return
    setLoading(true)

    const [orgRes, rolesRes] = await Promise.all([
      supabase.from('organizations').select('name, description, status').eq('id', orgId).single(),
      supabase.from('org_roles').select('id, name, permissions, is_system').eq('org_id', orgId).order('created_at', { ascending: true }),
    ])

    if (orgRes.data) {
      setOrgDetails(orgRes.data)
      setName(orgRes.data.name)
      setDescription(orgRes.data.description || '')
    }

    if (rolesRes.data) {
      setRoles(rolesRes.data)
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [orgId])

  const handleSaveDetails = async (e: FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    setFeedbackError('')
    setFeedbackSuccess('')

    if (name.trim().length < 2) {
      setFeedbackError('Organization name must be at least 2 characters.')
      return
    }

    setDetailsSaving(true)
    const { error } = await supabase
      .from('organizations')
      .update({
        name: name.trim(),
        description: description.trim() || null,
      })
      .eq('id', orgId)

    setDetailsSaving(false)
    if (error) {
      setFeedbackError(error.message)
    } else {
      setFeedbackSuccess('Organization details updated successfully.')
      await refresh()
    }
  }

  const openCreateRole = () => {
    setEditingRoleId(null)
    setRoleName('')
    setRolePerms([])
    setRoleModalOpen(true)
  }

  const openEditRole = (r: Role) => {
    setEditingRoleId(r.id)
    setRoleName(r.name)
    setRolePerms([...r.permissions])
    setRoleModalOpen(true)
  }

  const togglePermission = (permKey: string) => {
    setRolePerms((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey],
    )
  }

  const handleSaveRole = async (e: FormEvent) => {
    e.preventDefault()
    if (!orgId) return
    setFeedbackError('')
    setFeedbackSuccess('')

    if (roleName.trim().length < 2) {
      setFeedbackError('Role name must be between 2 and 80 characters.')
      return
    }

    setRoleSaving(true)

    if (editingRoleId) {
      // Update existing role
      const { error } = await supabase.rpc('update_org_role', {
        p_role: editingRoleId,
        p_name: roleName.trim(),
        p_permissions: rolePerms,
      })
      setRoleSaving(false)
      if (error) {
        setFeedbackError(error.message)
      } else {
        setFeedbackSuccess(`Role "${roleName}" updated.`)
        setRoleModalOpen(false)
        await loadData()
      }
    } else {
      // Create new custom role
      const { error } = await supabase.rpc('create_org_role', {
        p_org: orgId,
        p_name: roleName.trim(),
        p_permissions: rolePerms,
      })
      setRoleSaving(false)
      if (error) {
        setFeedbackError(error.message)
      } else {
        setFeedbackSuccess(`Custom role "${roleName}" created.`)
        setRoleModalOpen(false)
        await loadData()
      }
    }
  }

  const handleDeleteRole = async (roleId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete custom role "${name}"? Members assigned to this role must be reassigned first.`)) {
      return
    }

    setFeedbackError('')
    setFeedbackSuccess('')
    const { error } = await supabase.rpc('delete_org_role', { p_role: roleId })
    if (error) {
      setFeedbackError(error.message)
    } else {
      setFeedbackSuccess(`Role "${name}" deleted.`)
      await loadData()
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
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Organization Settings</h1>
        <p className="mt-1 text-sm text-muted">Configure organization details, custom roles, and authorization policies.</p>
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

      {/* General Details Form */}
      <section className="card max-w-2xl p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Building2 size={18} /> General Information
        </h2>
        <p className="mt-1 text-sm text-muted">Organization name and public mission description.</p>

        <form onSubmit={handleSaveDetails} className="mt-6 space-y-4">
          <div>
            <label htmlFor="org-name" className="mb-1.5 block text-sm font-medium">Organization Name</label>
            <input
              id="org-name"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="org-desc" className="mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              id="org-desc"
              rows={3}
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does your student organization do?"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-muted">
              Status: <span className="font-semibold capitalize text-ink">{orgDetails?.status ?? 'active'}</span>
            </span>
            <button type="submit" disabled={detailsSaving} className="btn-primary disabled:opacity-60">
              {detailsSaving ? 'Saving…' : 'Save Details'}
            </button>
          </div>
        </form>
      </section>

      {/* Roles & Permissions Section */}
      <section className="card p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Shield size={18} /> Roles & Permissions
            </h2>
            <p className="mt-1 text-sm text-muted">System roles are protected; custom roles can be defined to match your organization structure.</p>
          </div>

          {canManageRoles && (
            <button
              type="button"
              onClick={openCreateRole}
              className="btn-primary flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus size={16} /> New Custom Role
            </button>
          )}
        </div>

        <div className="mt-6 divide-y divide-hairline">
          {roles.map((r) => (
            <div key={r.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">{r.name}</span>
                  {r.is_system ? (
                    <span className="flex items-center gap-1 rounded-full bg-canvas px-2.5 py-0.5 text-xs font-semibold text-muted">
                      <Lock size={11} /> System Role
                    </span>
                  ) : (
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      Custom Role
                    </span>
                  )}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {r.permissions.length === 0 ? (
                    <span className="text-xs text-muted">Standard Member Permissions</span>
                  ) : r.permissions.includes('*') ? (
                    <span className="rounded bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">All Permissions (Wildcard *)</span>
                  ) : (
                    r.permissions.map((p) => (
                      <span key={p} className="rounded bg-canvas px-2 py-0.5 text-xs font-medium text-ink">
                        {p}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {!r.is_system && canManageRoles && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditRole(r)}
                    className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs font-semibold"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteRole(r.id, r.name)}
                    className="btn-ghost flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Custom Role Modal */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-ink">
              {editingRoleId ? 'Edit Custom Role' : 'Create Custom Role'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              Configure role name and assign appropriate operational privileges.
            </p>

            <form onSubmit={handleSaveRole} className="mt-4 space-y-4">
              <div>
                <label htmlFor="custom-role-name" className="mb-1 block text-xs font-semibold text-ink">Role Name</label>
                <input
                  id="custom-role-name"
                  className="input"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. Committee Chair, Creative Lead"
                  required
                />
              </div>

              <div>
                <span className="mb-2 block text-xs font-semibold text-ink">Granted Permissions</span>
                {!isOwner && (
                  <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <p>Privileged permissions (Organization, Member, and Role management) can only be granted by the organization Owner.</p>
                  </div>
                )}
                <div className="space-y-2 rounded-xl border border-hairline bg-canvas/30 p-3">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = rolePerms.includes(perm.key)
                    const disabled = perm.privileged && !isOwner

                    return (
                      <label
                        key={perm.key}
                        className={`flex items-start gap-3 rounded-lg p-2 transition-colors ${
                          disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-canvas'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={disabled}
                          onChange={() => togglePermission(perm.key)}
                          className="mt-0.5 rounded border-hairline text-brand focus:ring-brand"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ink">{perm.label}</span>
                            {perm.privileged && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[10px] font-semibold text-amber-800">
                                Privileged
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted">{perm.desc}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="btn-ghost text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={roleSaving}
                  className="btn-primary text-sm disabled:opacity-60"
                >
                  {roleSaving ? 'Saving…' : editingRoleId ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
