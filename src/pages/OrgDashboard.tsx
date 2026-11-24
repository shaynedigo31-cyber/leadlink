import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CalendarDays, FileText, ListChecks, Users } from 'lucide-react'
import MockBanner from '../components/MockBanner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { mockEvents, mockStats, mockTasks } from '../lib/mock'

const icons = [Users, CalendarDays, ListChecks, FileText]

export default function OrgDashboard() {
  const { orgId } = useParams()
  const { memberships } = useAuth()
  const membership = memberships.find((m) => m.org_id === orgId)
  const [realMemberCount, setRealMemberCount] = useState<number | null>(null)

  useEffect(() => {
    if (!orgId) return
    supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('status', 'active')
      .then(({ count }) => {
        if (count !== null) setRealMemberCount(count)
      })
  }, [orgId])

  if (!membership) {
    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">Organization not found</h1>
        <p className="mt-2 text-sm text-muted">It doesn’t exist, or you aren’t a member of it.</p>
        <Link to="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
      </div>
    )
  }

  if (membership.status !== 'active' || membership.org_status !== 'approved') {
    const message = membership.status !== 'active'
      ? 'Your membership request is awaiting approval.'
      : membership.org_status === 'pending'
        ? 'This organization is awaiting platform approval.'
        : `This organization is ${membership.org_status} and its workspace is unavailable.`

    return (
      <div className="card mx-auto mt-10 max-w-md p-10 text-center">
        <h1 className="text-xl font-bold">{membership.org_name}</h1>
        <p className="mt-2 text-sm text-muted">{message}</p>
        <Link to="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{membership.org_name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          Organization overview
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{membership.role_name ?? 'Pending'}</span>
          {membership.org_status !== 'approved' && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Awaiting approval</span>
          )}
        </p>
      </div>
      <MockBanner />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {mockStats.map((s, i) => {
          const Icon = icons[i]
          const displayValue = s.label === 'Active members' && realMemberCount !== null
            ? String(realMemberCount)
            : s.value

          return (
            <div key={s.label} className="card p-4">
              <span className="icon-chip"><Icon size={20} strokeWidth={1.75} /></span>
              <p className="mt-3 font-display text-3xl font-extrabold tabular-nums">{displayValue}</p>
              <p className="text-sm text-muted">{s.label}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Upcoming events</h2>
          <ul className="divide-y divide-hairline">
            {mockEvents.map((e) => (
              <li key={e.title} className="flex items-center justify-between py-3 text-sm">
                <span className="font-medium">{e.title}</span>
                <span className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${e.tag === 'Public' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>{e.tag}</span>
                  <span className="tabular-nums text-muted">{e.date}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 text-lg font-bold">Task progress</h2>
          <ul className="space-y-4">
            {mockTasks.map((t) => (
              <li key={t.title}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{t.title}</span>
                  <span className="tabular-nums text-muted">{t.progress}%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-brand-soft">
                  <div className="h-2 rounded-full bg-brand" style={{ width: `${t.progress}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">{t.owner}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
