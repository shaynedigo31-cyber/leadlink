import { useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Logo from '../components/Logo'

const links = [
  { to: '/features', label: 'Features' },
  { to: '/about', label: 'About' },
]

export default function PublicLayout() {
  const [open, setOpen] = useState(false)
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-hairline bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-brand-light text-brand' : 'text-muted hover:text-ink'}`}>
                {l.label}
              </NavLink>
            ))}
            <Link to="/login" className="btn-ghost ml-2">Log in</Link>
            <Link to="/register" className="btn-primary">Create account</Link>
          </nav>
          <button className="rounded-xl p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <div className="flex flex-col gap-2 border-t border-hairline bg-white p-4 md:hidden">
            {links.map((l) => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-sm font-medium hover:bg-brand-light">{l.label}</Link>
            ))}
            <Link to="/login" onClick={() => setOpen(false)} className="btn-ghost">Log in</Link>
            <Link to="/register" onClick={() => setOpen(false)} className="btn-primary">Create account</Link>
          </div>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="border-t border-hairline bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display font-semibold text-ink">LEADLINK · Connect. Lead. Inspire.</p>
          <p>Built for student organizations. Every leader builds. Every generation continues.</p>
        </div>
      </footer>
    </div>
  )
}
