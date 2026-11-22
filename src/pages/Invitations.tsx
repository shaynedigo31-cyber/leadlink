import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Mail, CheckCircle2, XCircle, Compass, AlertCircle, Plus, Send } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type DbInvitation = {
  id: string
  org_id: string
  invited_email: string
  status: string
  created_at: string
  organizations: { name: string; slug: string } | null
  org_roles: { name: string } | null
}

export default function Invitations() {
  const { user, refresh } = useAuth()
  const [invites, setInvites] = useState<DbInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchInvitations = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    setLoadError('')

    const { data, error: dbErr } = await supabase
      .from('organization_invitations')
      .select('id, org_id, invited_email, status, created_at, organizations(name, slug), org_roles(name)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (dbErr) {
      console.warn('invitations fetch error:', dbErr.message)
      setInvites([])
      setLoadError(dbErr.message)
    } else {
      setInvites((data as unknown as DbInvitation[]) ?? [])
    }
    setLoading(false)
  }, [user?.email])

  useEffect(() => {
    void fetchInvitations()
  }, [fetchInvitations])

  const handleResponse = async (invitationId: string, action: 'accept' | 'decline') => {
    setBusyId(invitationId)
    setNotice('')
    setError('')

    const { data: response, error: rpcErr } = await supabase.rpc('respond_to_invitation', {
      p_invitation: invitationId,
      p_action: action,
    })

    setBusyId(null)
    if (rpcErr) {
      setError(rpcErr.message)
    } else if (response === 'expired') {
      setError('This invitation has expired. No membership was created; ask the organization to send a new invitation.')
      setInvites((prev) => prev.filter((i) => i.id !== invitationId))
    } else if (response !== (action === 'accept' ? 'accepted' : 'declined')) {
      setError('The invitation response was not confirmed. Refresh the page before trying again.')
    } else {
      setNotice(`Invitation ${action === 'accept' ? 'accepted' : 'declined'} successfully.`)
      setInvites((prev) => prev.filter((i) => i.id !== invitationId))
      if (response === 'accepted') await refresh()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Invitations</h1>
        <p className="mt-1 text-sm text-muted">
          Manage invitations to join student organizations sent to <span className="font-semibold text-ink">{user?.email}</span>.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <p>Invitations could not be loaded: {loadError}</p>
          <button type="button" className="btn-ghost text-xs" onClick={() => void fetchInvitations()}>
            Try again
          </button>
        </div>
      )}

      {notice && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          <CheckCircle2 size={18} className="shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-sm text-muted">Loading invitations…</div>
      ) : loadError ? null : invites.length === 0 ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <span className="icon-chip"><Mail size={24} strokeWidth={1.75} /></span>
          <p className="mt-4 font-bold text-ink">No pending invitations</p>
          <p className="mt-1 text-sm text-muted">
            You do not have any pending organization invitations at this time.
          </p>
          <Link to="/discover" className="btn-primary mt-6">
            <Compass size={16} /> Discover organizations
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {invites.map((inv) => (
            <div key={inv.id} className="card flex flex-col justify-between gap-4 p-6 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-ink">
                    {inv.organizations?.name || 'Organization'}
                  </h3>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    {inv.org_roles?.name || 'Member'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  Invited on {new Date(inv.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={() => handleResponse(inv.id, 'accept')}
                  className="btn-primary text-xs disabled:opacity-60"
                >
                  <CheckCircle2 size={14} /> Accept Invitation
                </button>
                <button
                  type="button"
                  disabled={busyId === inv.id}
                  onClick={() => handleResponse(inv.id, 'decline')}
                  className="btn-ghost text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                >
                  <XCircle size={14} /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
