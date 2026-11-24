import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import Notice, { type NoticeState } from '../components/Notice'

type OrgRow = {
  id: string
  name: string
  description: string | null
  status: 'pending' | 'approved' | 'rejected' | 'suspended'
  created_at: string
  creator_name: string
  member_count: number
}

const filters = ['pending', 'approved', 'all'] as const
const badge: Record<OrgRow['status'], string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-rose-50 text-rose-700',
  suspended: 'bg-rose-50 text-rose-700',
}

export default function AdminApprovals() {
  const [rows, setRows] = useState<OrgRow[] | null>(null)
  const [filter, setFilter] = useState<(typeof filters)[number]>('pending')
  const [notice, setNotice] = useState<NoticeState>(null)
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('admin_list_organizations')
    if (error) setNotice({ ok: false, text: error.message })
    setRows((data ?? []) as OrgRow[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const setStatus = async (row: OrgRow, status: OrgRow['status']) => {
    if ((status === 'rejected' || status === 'suspended') && !window.confirm(`Mark “${row.name}” as ${status}?`)) return
    setBusyId(row.id)
    setNotice(null)
    const { error } = await supabase.rpc('set_organization_status', { p_org: row.id, p_status: status })
    setBusyId('')
    if (error) {
      setNotice({ ok: false, text: error.message })
      return
    }
    setNotice({ ok: true, text: `“${row.name}” is now ${status}.` })
    await load()
  }

  const shown = (rows ?? []).filter((r) => filter === 'all' || r.status === filter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Organization approvals</h1>
        <p className="mt-1 text-sm text-muted">Approve new organizations so people can find and join them.</p>
        <p className="mt-1 text-xs text-muted">You can’t approve an organization you created or manage. Use another platform administrator account for that.</p>
      </div>
      <Notice notice={notice} />
      <div className="flex gap-2">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-all duration-200 ${filter === f ? 'bg-brand-light text-brand' : 'text-muted hover:bg-white'}`}>{f}</button>
        ))}
      </div>

      {rows === null ? (
        <div className="h-28 animate-pulse rounded-2xl bg-brand-soft" />
      ) : shown.length === 0 ? (
        <div className="card flex flex-col items-center p-10 text-center">
          <span className="icon-chip"><ShieldCheck size={20} strokeWidth={1.75} /></span>
          <p className="mt-4 font-bold">Nothing here</p>
          <p className="mt-1 text-sm text-muted">No {filter === 'all' ? '' : filter} organizations.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {shown.map((r) => (
            <li key={r.id} className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold">{r.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${badge[r.status]}`}>{r.status}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted">{r.description || 'No description.'}</p>
                <p className="mt-1 text-xs text-muted">By {r.creator_name || 'Unknown'} · <span className="tabular-nums">{r.member_count}</span> active member(s) · <span className="tabular-nums">{new Date(r.created_at).toLocaleDateString()}</span></p>
              </div>
              <div className="flex shrink-0 gap-2">
                {r.status !== 'approved' && <button className="btn-primary disabled:opacity-60" disabled={busyId === r.id} onClick={() => setStatus(r, 'approved')}>Approve</button>}
                {r.status === 'pending' && <button className="btn-ghost disabled:opacity-60" disabled={busyId === r.id} onClick={() => setStatus(r, 'rejected')}>Reject</button>}
                {r.status === 'approved' && <button className="btn-ghost disabled:opacity-60" disabled={busyId === r.id} onClick={() => setStatus(r, 'suspended')}>Suspend</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}