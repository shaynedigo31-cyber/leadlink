import { useEffect, useState } from 'react'
import { Building2, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Notice, { type NoticeState } from '../components/Notice'

type Org = { id: string; name: string; description: string | null }

export default function Discover() {
  const { memberships, refresh } = useAuth()
  const [orgs, setOrgs] = useState<Org[] | null>(null)
  const [query, setQuery] = useState('')
  const [notice, setNotice] = useState<NoticeState>(null)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    supabase
      .from('organizations')
      .select('id, name, description')
      .eq('status', 'approved')
      .order('name')
      .then(({ data, error }) => {
        if (error) setNotice({ ok: false, text: error.message })
        setOrgs((data ?? []) as Org[])
      })
  }, [])

  const requestToJoin = async (id: string) => {
    setBusyId(id)
    setNotice(null)
    const { error } = await supabase.rpc('request_to_join_organization', { p_org: id })
    setBusyId('')
    if (error) {
      setNotice({ ok: false, text: error.message })
      return
    }
    setNotice({ ok: true, text: 'Request sent. An officer will review it.' })
    await refresh()
  }

  const shown = (orgs ?? []).filter((o) => o.name.toLowerCase().includes(query.toLowerCase()))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Discover organizations</h1>
        <p className="mt-1 text-sm text-muted">Find an approved organization and ask to join.</p>
      </div>
      <Notice notice={notice} />
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3.5 top-3.5 text-muted" />
        <input className="input pl-10" placeholder="Search by name" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search organizations" />
      </div>

      {orgs === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-brand-soft" />)}
        </div>
      ) : shown.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center">
          <span className="icon-chip"><Building2 size={20} strokeWidth={1.75} /></span>
          <p className="mt-4 font-bold">{orgs.length === 0 ? 'No approved organizations yet' : 'No organizations match your search'}</p>
          <p className="mt-1 text-sm text-muted">Organizations appear here once a platform administrator approves them.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((o) => {
            const mine = memberships.find((m) => m.org_id === o.id)
            return (
              <div key={o.id} className="card flex flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span className="icon-chip shrink-0"><Building2 size={20} strokeWidth={1.75} /></span>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{o.name}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted">{o.description || 'No description yet.'}</p>
                  </div>
                </div>
                {mine?.status === 'active' ? (
                  <span className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">You’re a member</span>
                ) : mine?.status === 'pending' ? (
                  <span className="w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">Request pending</span>
                ) : (
                  <button className="btn-primary w-fit disabled:opacity-60" disabled={busyId === o.id} onClick={() => requestToJoin(o.id)}>
                    {busyId === o.id ? 'Sending…' : 'Request to join'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}