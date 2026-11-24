import { useState, useEffect, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus, ShieldCheck, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type PendingOrg = {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  created_at: string
  created_by: string
}

const slugify = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function Dashboard() {
  const { fullName, memberships, isPlatformAdmin, refresh } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Platform admin state
  const [pendingOrgs, setPendingOrgs] = useState<PendingOrg[]>([])
  const [adminActionError, setAdminActionError] = useState('')
  const [adminActionSuccess, setAdminActionSuccess] = useState('')
  const [adminBusyId, setAdminBusyId] = useState<string | null>(null)

  const loadAdminQueue = async () => {
    if (!isPlatformAdmin) return
    const { data, error: err } = await supabase
      .from('organizations')
      .select('id, name, slug, description, status, created_at, created_by')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (!err && data) {
      setPendingOrgs(data)
    }
  }

  useEffect(() => {
    if (isPlatformAdmin) {
      void loadAdminQueue()
    }
  }, [isPlatformAdmin])

  const handleAdminStatusChange = async (orgId: string, status: 'approved' | 'rejected') => {
    setAdminActionError('')
    setAdminActionSuccess('')
    setAdminBusyId(orgId)

    const { error: rpcErr } = await supabase.rpc('set_organization_status', {
      p_org: orgId,
      p_status: status,
    })

    setAdminBusyId(null)
    if (rpcErr) {
      setAdminActionError(rpcErr.message)
    } else {
      setAdminActionSuccess(`Organization status changed to ${status}.`)
      await loadAdminQueue()
      await refresh()
    }
  }

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const base = slugify(name)
    if (name.trim().length < 2 || !base) {
      setError('Enter an organization name (at least 2 letters or numbers).')
      return
    }
    setBusy(true)
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
    const { error: rpcError } = await supabase.rpc('create_organization', {
      p_name: name,
      p_slug: slug,
      p_description: description || null,
    })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setName('')
    setDescription('')
    await refresh()
    if (isPlatformAdmin) {
      await loadAdminQueue()
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {fullName ? `Hi, ${fullName.split(' ')[0]}` : 'Your dashboard'}
          </h1>
          {isPlatformAdmin && (
            <span className="flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-bold text-purple-700">
              <ShieldCheck size={13} /> Platform Admin
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">Everything you belong to, in one place.</p>
      </div>

      {/* Platform Admin Organization Approval Queue */}
      {isPlatformAdmin && (
        <section className="card border-purple-200 bg-purple-50/20 p-6">
          <div className="flex items-center gap-2 text-purple-900">
            <ShieldCheck size={20} />
            <h2 className="text-lg font-bold">Platform Administration: Organization Approvals</h2>
          </div>
          <p className="mt-1 text-xs text-muted">
            Organizations awaiting platform review. System rule: Platform admins cannot approve organizations they created or manage.
          </p>

          {adminActionError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700" role="alert">
              <AlertCircle size={15} className="shrink-0" />
              <p>{adminActionError}</p>
            </div>
          )}

          {adminActionSuccess && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-xs text-emerald-700" role="status">
              <CheckCircle2 size={15} className="shrink-0" />
              <p>{adminActionSuccess}</p>
            </div>
          )}

          <div className="mt-4 divide-y divide-hairline">
            {pendingOrgs.length === 0 ? (
              <p className="py-4 text-xs text-muted">No pending organizations requiring review.</p>
            ) : (
              pendingOrgs.map((org) => {
                const isActioning = adminBusyId === org.id

                return (
                  <div key={org.id} className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ink">{org.name}</span>
                        <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.2 text-[11px] font-semibold text-amber-800">
                          <Clock size={11} /> Pending Review
                        </span>
                      </div>
                      <p className="text-xs text-muted">{org.description || 'No description provided.'}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        Submitted on {new Date(org.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isActioning}
                        onClick={() => handleAdminStatusChange(org.id, 'approved')}
                        className="btn-primary flex items-center gap-1 px-3 py-1 text-xs"
                      >
                        <CheckCircle2 size={13} /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={isActioning}
                        onClick={() => handleAdminStatusChange(org.id, 'rejected')}
                        className="btn-ghost flex items-center gap-1 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      >
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {/* Your Organizations */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Your organizations</h2>
          <Link to="/discover" className="text-xs font-semibold text-brand hover:underline">
            Discover more →
          </Link>
        </div>
        {memberships.length === 0 ? (
          <div className="card flex flex-col items-center p-10 text-center">
            <span className="icon-chip"><Building2 size={20} strokeWidth={1.75} /></span>
            <p className="mt-4 font-bold">No organizations yet</p>
            <p className="mt-1 text-sm text-muted">Create one below or discover approved student groups.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {memberships.map((m) => (
              <Link key={m.id} to={`/org/${m.org_id}/dashboard`} className="card flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5">
                <span className="icon-chip"><Building2 size={20} strokeWidth={1.75} /></span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{m.org_name}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{m.role_name ?? 'Pending'}</span>
                    {m.org_status !== 'approved' && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Awaiting approval</span>
                    )}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Register an Organization */}
      <section className="card max-w-xl p-6">
        <h2 className="text-lg font-bold">Register an organization</h2>
        <p className="mt-1 text-sm text-muted">New organizations need platform approval before they appear in Discover.</p>
        <form onSubmit={onCreate} className="mt-4 space-y-4" noValidate>
          <div>
            <label htmlFor="org-name" className="mb-1.5 block text-sm font-medium">Organization name</label>
            <input id="org-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="org-desc" className="mb-1.5 block text-sm font-medium">Description (optional)</label>
            <textarea id="org-desc" rows={3} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
            <Plus size={16} />
            {busy ? 'Creating…' : 'Create organization'}
          </button>
        </form>
      </section>
    </div>
  )
}
