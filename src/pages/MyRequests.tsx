import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Clock, XCircle, AlertCircle, CheckCircle2, Compass } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type PendingRequest = {
  id: string
  org_id: string
  status: string
  created_at: string
  organizations: {
    name: string
    description: string | null
    slug: string
  } | null
}

export default function MyRequests() {
  const { user, refresh } = useAuth()
  const [requests, setRequests] = useState<PendingRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const fetchRequests = async () => {
    if (!user) return
    setLoading(true)
    setError('')
    const { data, error: fetchErr } = await supabase
      .from('organization_members')
      .select('id, org_id, status, created_at, organizations(name, description, slug)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (fetchErr) {
      setError(fetchErr.message)
    } else {
      setRequests((data as unknown as PendingRequest[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    void fetchRequests()
  }, [user])

  const handleCancel = async (memberId: string) => {
    setError('')
    setSuccess('')
    setCancellingId(memberId)

    const { error: rpcErr } = await supabase.rpc('cancel_membership_request', {
      p_member: memberId,
    })

    setCancellingId(null)
    if (rpcErr) {
      setError(rpcErr.message)
    } else {
      setSuccess('Membership request cancelled.')
      setRequests((prev) => prev.filter((r) => r.id !== memberId))
      await refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">My requests</h1>
        <p className="mt-1 text-sm text-muted">Review or withdraw your pending applications to join student organizations.</p>
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

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="card animate-pulse p-6">
              <div className="h-5 w-48 rounded bg-brand-soft" />
              <div className="mt-3 h-4 w-full max-w-sm rounded bg-brand-soft" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <span className="icon-chip"><Send size={24} strokeWidth={1.75} /></span>
          <p className="mt-4 font-bold text-ink">No pending requests</p>
          <p className="mt-1 text-sm text-muted">You do not have any pending membership requests at this time.</p>
          <Link to="/discover" className="btn-primary mt-6">
            <Compass size={16} /> Discover organizations
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((r) => {
            const org = r.organizations
            const isCancelling = cancellingId === r.id

            return (
              <div key={r.id} className="card flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-bold text-ink">
                      {org?.name ?? 'Unknown Organization'}
                    </h2>
                    <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                      <Clock size={12} /> Pending Review
                    </span>
                  </div>
                  {org?.description && (
                    <p className="mt-1 text-sm text-muted line-clamp-1">{org.description}</p>
                  )}
                  <p className="mt-2 text-xs text-muted">
                    Requested on {new Date(r.created_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    disabled={isCancelling}
                    onClick={() => handleCancel(r.id)}
                    className="btn-ghost text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                  >
                    <XCircle size={16} />
                    {isCancelling ? 'Cancelling…' : 'Cancel request'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
