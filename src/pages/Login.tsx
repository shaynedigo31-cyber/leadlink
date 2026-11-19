import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    const next: typeof errors = {}
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = 'Enter a valid email address.'
    if (password.length < 8) next.password = 'Password must be at least 8 characters.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setFormError(error.message)
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-3xl font-extrabold">Log in</h1>
      <p className="mt-2 text-sm text-muted">Welcome back to LEADLINK.</p>
      {!isSupabaseConfigured && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p>Supabase is not set up yet. Add your keys to .env.local and restart the dev server.</p>
        </div>
      )}
      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6" noValidate>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">Email</label>
          <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
          {errors.email && <p className="mt-1 text-xs text-rose-700">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">Password</label>
          <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
          {errors.password && <p className="mt-1 text-xs text-rose-700">{errors.password}</p>}
        </div>
        {formError && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{formError}</p>}
        <button type="submit" disabled={busy || !isSupabaseConfigured} className="btn-primary w-full disabled:opacity-60">{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">New here? <Link to="/register" className="font-semibold text-brand">Create an account</Link></p>
    </div>
  )
}
