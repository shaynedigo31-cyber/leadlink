import { Link } from 'react-router-dom'
import { Building2, Plus, CheckCircle2, Clock, ShieldAlert } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function MyOrganizations() {
  const { memberships } = useAuth()

  const activeMemberships = memberships.filter((m) => m.status === 'active')
  const pendingMemberships = memberships.filter((m) => m.status === 'pending')

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">My organizations</h1>
          <p className="mt-1 text-sm text-muted">All student organizations where you hold an active membership or pending status.</p>
        </div>
        <Link to="/dashboard" className="btn-primary shrink-0 self-start sm:self-auto">
          <Plus size={16} /> Register organization
        </Link>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-ink">Active Memberships</h2>
        {activeMemberships.length === 0 ? (
          <div className="card flex flex-col items-center p-10 text-center">
            <span className="icon-chip"><Building2 size={22} strokeWidth={1.75} /></span>
            <p className="mt-4 font-bold text-ink">No active organizations</p>
            <p className="mt-1 text-sm text-muted">You are not currently an active member of any organization.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/discover" className="btn-primary">Discover organizations</Link>
              <Link to="/dashboard" className="btn-ghost">Register new</Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {activeMemberships.map((m) => {
              const isApproved = m.org_status === 'approved'

              return (
                <Link
                  key={m.id}
                  to={`/org/${m.org_id}/dashboard`}
                  className="card flex flex-col justify-between p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="icon-chip"><Building2 size={20} strokeWidth={1.75} /></span>
                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                        {m.role_name ?? 'Member'}
                      </span>
                    </div>
                    <h3 className="mt-4 text-lg font-bold text-ink">{m.org_name}</h3>
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-hairline pt-4 text-xs font-medium">
                    {isApproved ? (
                      <span className="flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 size={13} /> Approved Workspace
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-700">
                        <Clock size={13} /> Awaiting Platform Approval
                      </span>
                    )}
                    <span className="text-brand">Open workspace →</span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {pendingMemberships.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">Pending Membership Requests</h2>
            <Link to="/my-requests" className="text-sm font-semibold text-brand hover:underline">
              View all requests →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {pendingMemberships.map((m) => (
              <div key={m.id} className="card p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-ink">{m.org_name}</h3>
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    <Clock size={12} /> Pending Review
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted">Awaiting confirmation by organization administrators.</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
