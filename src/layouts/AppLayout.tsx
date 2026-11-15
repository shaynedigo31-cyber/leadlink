import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useParams } from 'react-router-dom'
import { ChevronsUpDown, Menu, X } from 'lucide-react'
import Logo from '../components/Logo'
import CommandPalette from '../components/CommandPalette'
import { orgNav, personalNav } from '../lib/nav'
import { mockOrgs } from '../lib/mock'

export default function AppLayout() {
  const { orgId } = useParams()
  const [drawer, setDrawer] = useState(false)
  const [switcher, setSwitcher] = useState(false)
  const items = useMemo(() => (orgId ? orgNav(orgId) : personalNav), [orgId])
  const currentOrg = mockOrgs.find((o) => o.id === orgId)

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-4">
      <Logo to="/dashboard" />
      <div className="relative">
        <button onClick={() => setSwitcher((s) => !s)} className="flex w-full items-center justify-between rounded-xl border border-hairline bg-canvas px-3 py-2.5 text-left text-sm transition-all duration-200 hover:bg-brand-light">
          <span className="min-w-0">
            <span className="block truncate font-semibold">{currentOrg ? currentOrg.name : 'Personal workspace'}</span>
            <span className="block text-xs text-muted">{currentOrg ? currentOrg.role : 'Switch organization'}</span>
          </span>
          <ChevronsUpDown size={16} className="shrink-0 text-muted" />
        </button>
        {switcher && (
          <div className="card absolute left-0 right-0 z-10 mt-2 p-1.5">
            <Link to="/dashboard" onClick={() => { setSwitcher(false); setDrawer(false) }} className="block rounded-xl px-3 py-2 text-sm hover:bg-brand-light">Personal workspace</Link>
            {mockOrgs.map((o) => (
              <Link key={o.id} to={`/org/${o.id}/dashboard`} onClick={() => { setSwitcher(false); setDrawer(false) }} className="block rounded-xl px-3 py-2 text-sm hover:bg-brand-light">{o.name}</Link>
            ))}
            <p className="px-3 py-2 text-xs text-muted">Sample organizations only.</p>
          </div>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} onClick={() => setDrawer(false)} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${isActive ? 'bg-brand-light text-brand' : 'text-muted hover:bg-canvas hover:text-ink'}`}>
            <i.icon size={18} strokeWidth={1.75} />
            {i.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-hairline bg-white lg:block">{sidebar}</aside>

      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setDrawer(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button className="absolute right-3 top-4 rounded-xl p-2" onClick={() => setDrawer(false)} aria-label="Close menu"><X size={20} /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-hairline bg-white/80 px-4 backdrop-blur-md">
          <button className="rounded-xl p-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu"><Menu size={22} /></button>
          <div className="ml-auto flex items-center gap-3">
            <CommandPalette items={items} />
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700" title="Sample user">SU</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  )
}
