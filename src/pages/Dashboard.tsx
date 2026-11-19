import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const slugify = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export default function Dashboard() {
  const { fullName, memberships, refresh } = useAuth()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const onCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const base = slugify(name)
    if (name.trim().length < 2 || !base) {
      setError('Enter an organization name (at least 2 letters or numbers).')
      return
    }
    setBusy(true)
    const slug = `${base}-${Math.random().toString(36).slice(2, 6)}`
    const { error: rpcError } = await supabase.rpc('create_organization', {
      p_name: name,
      p_slug: slug,
      p_description: description || null,
    })
    setBusy(false)
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    setName('')
    setDescription('')
    await refresh()
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{fullName ? `Hi, ${fullName.split(' ')[0]}` : 'Your dashboard'}</h1>
        <p className="mt-1 text-sm text-muted">Everything you belong to, in one place.</p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Your organizations</h2>
        {memberships.length === 0 ? (
          <div className="card flex flex-col items-center p-10 text-center">
            <span className="icon-chip"><Building2 size={20} strokeWidth={1.75} /></span>
            <p className="mt-4 font-bold">No organizations yet</p>
            <p className="mt-1 text-sm text-muted">Create one below to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {memberships.map((m) => (
              <Link key={m.id} to={`/org/${m.org_id}/dashboard`} className="card flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5">
                <span className="icon-chip"><Building2 size={20} strokeWidth={1.75} /></span>
                <span className="min-w-0">
                  <span className="block truncate font-bold">{m.org_name}</span>
                  <span className="mt-1 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{m.role_name ?? 'Pending'}</span>
                    {m.org_status !== 'approved' && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Awaiting approval</span>
                    )}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card max-w-xl p-6">
        <h2 className="text-lg font-bold">Register an organization</h2>
        <p className="mt-1 text-sm text-muted">New organizations need platform approval before they appear in Discover.</p>
        <form onSubmit={onCreate} className="mt-4 space-y-4" noValidate>
          <div>
            <label htmlFor="org-name" className="mb-1.5 block text-sm font-medium">Organization name</label>
            <input id="org-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="org-desc" className="mb-1.5 block text-sm font-medium">Description (optional)</label>
            <textarea id="org-desc" rows={3} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">
            <Plus size={16} />
            {busy ? 'Creating…' : 'Create organization'}
          </button>
        </form>
      </section>
    </div>
  )
}
