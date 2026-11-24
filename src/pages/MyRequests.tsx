import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Send } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Notice, { type NoticeState } from '../components/Notice'

export default function MyRequests() {
  const { memberships, refresh } = useAuth()
  const [notice, setNotice] = useState<NoticeState>(null)
  const [busyId, setBusyId] = useState('')
  const pending = memberships.filter((m) => m.status === 'pending')

  const cancel = async (id: string) => {
    setBusyId(id)
    setNotice(null)
    const { error } = await supabase.rpc('cancel_membership_request', { p_member: id })
    setBusyId('')
    if (error) {
      setNotice({ ok: false, text: error.message })
      return
    }
    setNotice({ ok: true, text: 'Request cancelled.' })
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">My requests</h1>
        <p className="mt-1 text-sm text-muted">Organizations you’ve asked to join.</p>
      </div>
      <Notice notice={notice} />
      {pending.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center">
          <span className="icon-chip"><Send size={20} strokeWidth={1.75} /></span>
          <p className="mt-4 font-bold">No pending requests</p>
          <p className="mt-1 text-sm text-muted">Find an organization to join.</p>
          <Link to="/discover" className="btn-primary mt-6">Discover organizations</Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {pending.map((m) => (
            <li key={m.id} className="card flex items-center justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="truncate font-bold">{m.org_name}</p>
                <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Waiting for review</span>
              </div>
              <button className="btn-ghost disabled:opacity-60" disabled={busyId === m.id} onClick={() => cancel(m.id)}>Cancel</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}