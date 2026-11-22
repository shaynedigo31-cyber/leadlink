import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  History, Clock, AlertCircle, RefreshCw
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type LogEntry = {
  id: string
  created_at: string
  action: string
  category: 'membership' | 'role' | 'ownership' | 'governance' | 'settings' | 'position'
  actor_name: string
  details: string
}

type DbLog = {
  id: string
  created_at: string
  action: string
  category: LogEntry['category']
  details: string
  actor_id: string | null
  profiles: { full_name: string } | null
}

export default function ActivityLog() {
  const { orgId } = useParams<{ orgId: string }>()
  const { memberships } = useAuth()
  const currentMembership = memberships.find((m) => m.org_id === orgId)

  const [filter, setFilter] = useState<'all' | 'membership' | 'role' | 'ownership' | 'governance' | 'settings' | 'position'>('all')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchLogs = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    setError('')

    // Query real persistent activity_logs table
    const { data, error: dbErr } = await supabase
      .from('activity_logs')
      .select('id, created_at, action, category, details, actor_id, profiles(full_name)')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (dbErr) {
      console.warn('activity_logs query notice:', dbErr.message)
      setLogs([])
      setError(dbErr.message)
    } else if (data) {
      const records = (data as unknown as DbLog[]).map((r) => ({
        id: r.id,
        created_at: r.created_at,
        action: r.action,
        category: r.category,
        actor_name: r.profiles?.full_name || 'System / Member',
        details: r.details,
      }))
      setLogs(records)
    }
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  const filteredLogs = useMemo(() => {
    if (filter === 'all') return logs
    return logs.filter((l) => l.category === filter)
  }, [logs, filter])

  if (!currentMembership) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Access Denied</h1>
        <p className="mt-2 text-sm text-muted">You are not a member of this organization.</p>
        <Link to="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
      </div>
    )
  }

  const categoryBadge = (cat: LogEntry['category']) => {
    switch (cat) {
      case 'ownership':
        return <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700">Ownership</span>
      case 'role':
        return <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">Roles</span>
      case 'membership':
        return <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Membership</span>
      case 'governance':
        return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Governance</span>
      case 'settings':
        return <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">Settings</span>
      case 'position':
        return <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">Position</span>
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold sm:text-3xl">Activity Log</h1>
            <span className="rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-semibold text-brand">
              {currentMembership.org_name}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">
            Auditable, database-backed record of organization events, approvals, and leadership actions.
          </p>
        </div>

        {/* Filter Controls & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl border border-hairline bg-white p-1">
            {(['all', 'membership', 'role', 'ownership', 'position', 'governance', 'settings'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition-colors ${
                  filter === cat
                    ? 'bg-brand text-white shadow-sm'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={fetchLogs}
            disabled={loading}
            className="btn-ghost flex items-center gap-1 p-2 text-xs"
            title="Refresh logs"
            aria-label="Refresh activity logs"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="card divide-y divide-hairline">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading activity history…</div>
        ) : filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center p-12 text-center">
            <span className="icon-chip"><History size={22} strokeWidth={1.75} /></span>
            <p className="mt-4 font-bold text-ink">No activity records recorded</p>
            <p className="mt-1 text-sm text-muted">
              {filter !== 'all'
                ? `No events matching category "${filter}".`
                : 'Events will be recorded here when leadership actions and membership changes occur.'}
            </p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex flex-col justify-between gap-3 p-5 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-canvas text-brand">
                  <Clock size={16} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{log.action}</span>
                    {categoryBadge(log.category)}
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{log.details}</p>
                </div>
              </div>

              <div className="shrink-0 text-right text-xs text-muted">
                {new Date(log.created_at).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
