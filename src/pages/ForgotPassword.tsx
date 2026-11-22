import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setNotice('')

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setBusy(true)
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#/profile`,
    })
    setBusy(false)

    if (resetErr) {
      setError(resetErr.message)
    } else {
      setNotice('Password reset link sent! Check your email inbox to proceed.')
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Link to="/login" className="mb-6 flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink">
        <ArrowLeft size={14} /> Back to log in
      </Link>

      <h1 className="text-3xl font-extrabold text-ink">Reset password</h1>
      <p className="mt-2 text-sm text-muted">
        Enter the email address associated with your LEADLINK account and we will send you a reset link.
      </p>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {notice && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          <CheckCircle2 size={18} className="shrink-0" />
          <p>{notice}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="card mt-6 space-y-4 p-6" noValidate>
        <div>
          <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium">Email address</label>
          <input
            id="reset-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            placeholder="you@example.com"
            required
          />
        </div>

        <button
          type="submit"
          disabled={busy || !isSupabaseConfigured}
          className="btn-primary w-full disabled:opacity-60"
        >
          {busy ? 'Sending link…' : 'Send reset link'}
        </button>
      </form>
    </div>
  )
}
