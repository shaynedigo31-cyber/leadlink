import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import MockBanner from '../components/MockBanner'
import { mockOrgs } from '../lib/mock'

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Your dashboard</h1>
        <p className="mt-1 text-sm text-muted">Everything you belong to, in one place.</p>
      </div>
      <MockBanner />
      <section>
        <h2 className="mb-3 text-lg font-bold">Your organizations</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {mockOrgs.map((o) => (
            <Link key={o.id} to={`/org/${o.id}/dashboard`} className="card flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5">
              <span className="icon-chip"><Building2 size={20} strokeWidth={1.75} /></span>
              <span>
                <span className="block font-bold">{o.name}</span>
                <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{o.role}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
