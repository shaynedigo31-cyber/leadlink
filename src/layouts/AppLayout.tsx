import { useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { ChevronsUpDown, LogOut, Menu, X } from 'lucide-react'
import Logo from '../components/Logo'
import CommandPalette from '../components/CommandPalette'
import { adminNav, orgNav, personalNav } from '../lib/nav'
import { useAuth } from '../context/AuthContext'

export default function AppLayout() {
  const { orgId } = useParams()
  const { user, fullName, isPlatformAdmin, memberships, signOut } = useAuth()
  const navigate = useNavigate()
  const [drawer, setDrawer] = useState(false)
  const [switcher, setSwitcher] = useState(false)
  const items = useMemo(() => (orgId ? orgNav(orgId) : isPlatformAdmin ? [...personalNav, ...adminNav] : personalNav), [orgId, isPlatformAdmin])
  const activeOrgs = memberships.filter((m) => m.status === 'active')
  const currentOrg = memberships.find((m) => m.org_id === orgId)
  const displayName = fullName || user?.email || 'You'
  const initials = displayName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const sidebar = (
    <div className="flex h-full flex-col gap-4 p-4">
      <Logo to="/dashboard" />
      <div className="relative">
        <button onClick={() => setSwitcher((s) => !s)} className="flex w-full items-center justify-between rounded-xl border border-hairline bg-canvas px-3 py-2.5 text-left text-sm transition-all duration-200 hover:bg-brand-light">
          <span className="min-w-0">
            <span className="block truncate font-semibold">{currentOrg ? currentOrg.org_name : 'Personal workspace'}</span>
            <span className="block text-xs text-muted">{currentOrg ? currentOrg.role_name ?? 'Member' : 'Switch organization'}</span>
          </span>
          <ChevronsUpDown size={16} className="shrink-0 text-muted" />
        </button>
        {switcher && (
          <div className="card absolute left-0 right-0 z-10 mt-2 p-1.5">
            <Link to="/dashboard" onClick={() => { setSwitcher(false); setDrawer(false) }} className="block rounded-xl px-3 py-2 text-sm hover:bg-brand-light">Personal workspace</Link>
            {activeOrgs.map((m) => (
              <Link key={m.id} to={`/org/${m.org_id}/dashboard`} onClick={() => { setSwitcher(false); setDrawer(false) }} className="block truncate rounded-xl px-3 py-2 text-sm hover:bg-brand-light">{m.org_name}</Link>
            ))}
            {activeOrgs.length === 0 && <p className="px-3 py-2 text-xs text-muted">You haven’t joined an organization yet.</p>}
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
      <button onClick={handleSignOut} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition-all duration-200 hover:bg-canvas hover:text-ink">
        <LogOut size={18} strokeWidth={1.75} />
        Log out
      </button>
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
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700" title={displayName}>{initials || '?'}</span>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  )
}



