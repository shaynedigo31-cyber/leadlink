import { useLocation, Link } from 'react-router-dom'
import { Hammer } from 'lucide-react'

export default function ComingSoon() {
  const { pathname } = useLocation()
  const name = pathname.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ?? 'This page'
  return (
    <div className="card mx-auto mt-10 flex max-w-md flex-col items-center p-10 text-center">
      <span className="icon-chip"><Hammer size={20} strokeWidth={1.75} /></span>
      <h1 className="mt-4 text-xl font-bold capitalize">{name} isn’t built yet</h1>
      <p className="mt-2 text-sm text-muted">This page is planned for a later phase. See the roadmap in docs/DEVELOPMENT_ROADMAP.md.</p>
      <Link to="/dashboard" className="btn-primary mt-6">Back to dashboard</Link>
    </div>
  )
}
