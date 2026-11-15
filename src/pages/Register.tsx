import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'

type Errors = { name?: string; email?: string; password?: string; confirm?: string }

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const next: Errors = {}
    if (form.name.trim().length < 2) next.name = 'Enter your full name.'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address.'
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters.'
    if (form.confirm !== form.password) next.confirm = 'Passwords do not match.'
    setErrors(next)
    setSubmitted(Object.keys(next).length === 0)
  }

  const field = (id: keyof typeof form, label: string, type = 'text') => (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={id} type={type} className="input" value={form[id]} onChange={set(id)} aria-invalid={!!errors[id]} />
      {errors[id] && <p className="mt-1 text-xs text-rose-700">{errors[id]}</p>}
    </div>
  )

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 className="text-3xl font-extrabold">Create your account</h1>
      <p className="mt-2 text-sm text-muted">One account works for every organization you join.</p>
      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6" noValidate>
        {field('name', 'Full name')}
        {field('email', 'Email', 'email')}
        {field('password', 'Password', 'password')}
        {field('confirm', 'Confirm password', 'password')}
        <button type="submit" className="btn-primary w-full">Create account</button>
        {submitted && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
            <Info size={18} className="mt-0.5 shrink-0" />
            <p>Registration is not connected yet, so no account was created. It arrives in Phase 2 with Supabase.</p>
          </div>
        )}
      </form>
      <p className="mt-5 text-center text-sm text-muted">Already have an account? <Link to="/login" className="font-semibold text-brand">Log in</Link></p>
    </div>
  )
}
