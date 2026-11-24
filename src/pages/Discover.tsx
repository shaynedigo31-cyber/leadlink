import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Search, Send, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type OrgRecord = {
  id: string
  name: string
  slug: string
  description: string | null
  status: string
  created_at: string
}

export default function Discover() {
  const { user, memberships, refresh } = useAuth()
  const [orgs, setOrgs] = useState<OrgRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [submittingOrgId, setSubmittingOrgId] = useState<string | null>(null)

  const membershipMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of memberships) {
      map.set(m.org_id, m.status)
    }
    return map
  }, [memberships])

  const fetchOrganizations = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name, slug, description, status, created_at')
      .eq('status', 'approved')
      .order('name', { ascending: true })

    if (error) {
      console.error('Error fetching organizations:', error.message)
    } else {
      setOrgs(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchOrganizations()
  }, [])

  const handleJoinRequest = async (orgId: string) => {
    if (!user) return
    setActionError('')
    setActionSuccess('')
    setSubmittingOrgId(orgId)

    const { error } = await supabase.rpc('request_to_join_organization', { p_org: orgId })

    setSubmittingOrgId(null)
    if (error) {
      setActionError(error.message)
    } else {
      setActionSuccess('Membership request submitted successfully!')
      await refresh()
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orgs
    return orgs.filter(
      (o) => o.name.toLowerCase().includes(q) || (o.description && o.description.toLowerCase().includes(q)),
    )
  }, [orgs, search])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Discover organizations</h1>
        <p className="mt-1 text-sm text-muted">Browse approved student organizations and request to join their community.</p>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <p>{actionError}</p>
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          <CheckCircle2 size={18} className="shrink-0" />
          <p>{actionSuccess}</p>
        </div>
      )}

      <div className="relative max-w-md">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder="Search organizations by name or keyword…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
          aria-label="Search organizations"
        />
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card animate-pulse p-6">
              <div className="h-5 w-40 rounded bg-brand-soft" />
              <div className="mt-3 h-4 w-full rounded bg-brand-soft" />
              <div className="mt-2 h-4 w-2/3 rounded bg-brand-soft" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <span className="icon-chip"><Building2 size={24} strokeWidth={1.75} /></span>
          <p className="mt-4 font-bold text-ink">No organizations found</p>
          <p className="mt-1 text-sm text-muted">
            {search ? 'Try adjusting your search terms.' : 'No approved organizations are available yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((org) => {
            const memberStatus = membershipMap.get(org.id)
            const isSubmitting = submittingOrgId === org.id

            return (
              <div key={org.id} className="card flex flex-col justify-between p-6">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="icon-chip"><Building2 size={20} strokeWidth={1.75} /></span>
                    {memberStatus === 'active' && (
                      <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={13} /> Active Member
                      </span>
                    )}
                    {memberStatus === 'pending' && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                        <Clock size={13} /> Request Pending
                      </span>
                    )}
                  </div>
                  <h2 className="mt-4 text-lg font-bold text-ink">{org.name}</h2>
                  <p className="mt-1 line-clamp-3 text-sm text-muted">
                    {org.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-6 border-t border-hairline pt-4">
                  {memberStatus === 'active' ? (
                    <Link
                      to={`/org/${org.id}/dashboard`}
                      className="btn-primary w-full text-center"
                    >
                      Open Workspace
                    </Link>
                  ) : memberStatus === 'pending' ? (
                    <Link
                      to="/my-requests"
                      className="btn-ghost w-full text-center text-amber-700 hover:bg-amber-50"
                    >
                      View in My Requests
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleJoinRequest(org.id)}
                      className="btn-primary w-full disabled:opacity-60"
                    >
                      <Send size={15} />
                      {isSubmitting ? 'Submitting…' : 'Request to join'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
