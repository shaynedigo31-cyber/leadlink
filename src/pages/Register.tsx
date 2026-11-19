import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type Errors = { name?: string; email?: string; password?: string; confirm?: string }

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError('')
    setNotice('')
    const next: Errors = {}
    if (form.name.trim().length < 2) next.name = 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.'
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.'
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.name.trim() } },
    })
    setBusy(false)
    if (error) {
      setFormError(error.message)
      return
    }
    if (data.session) {
      navigate('/dashboard', { replace: true })
    } else {
      setNotice('Account created. Check your email to confirm it, then log in.')
    }
  }

  const field = (id: keyof typeof form, label: string, type = 'text', autoComplete?: string) => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={id} type={type} autoComplete={autoComplete} className="input" value={form[id]} onChange={set(id)} aria-invalid={!!errors[id]} />
      {errors[id] && <p className="mt-1 text-xs text-rose-700">{errors[id]}</p>}
    </div>
  )

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-3xl font-extrabold">Create your account</h1>
      <p className="mt-2 text-sm text-muted">One account works for every organization you join.</p>
      {!isSupabaseConfigured && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <Info size={18} className="mt-0.5 shrink-0" />
          <p>Supabase is not set up yet. Add your keys to .env.local and restart the dev server.</p>
        </div>
      )}
      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6" noValidate>
        {field('name', 'Full name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        {field('password', 'Password', 'password', 'new-password')}
        {field('confirm', 'Confirm password', 'password', 'new-password')}
        {formError && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{formError}</p>}
        {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p>}
        <button type="submit" disabled={busy || !isSupabaseConfigured} className="btn-primary w-full disabled:opacity-60">{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">Already have an account? <Link to="/login" className="font-semibold text-brand">Log in</Link></p>
    </div>
  )
}
