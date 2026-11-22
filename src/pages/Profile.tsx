import { useState, type FormEvent } from 'react'
import { User, Lock, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const { user, fullName, refresh } = useAuth()
  const [name, setName] = useState(fullName)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [profileSaving, setProfileSaving] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)

  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    setProfileError('')
    setProfileMessage('')

    if (name.trim().length < 2) {
      setProfileError('Full name must be at least 2 characters.')
      return
    }

    setProfileSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() })
      .eq('id', user.id)

    setProfileSaving(false)
    if (error) {
      setProfileError(error.message)
    } else {
      setProfileMessage('Profile details updated successfully.')
      await refresh()
    }
  }

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordMessage('')

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)

    if (error) {
      setPasswordError(error.message)
    } else {
      setPasswordMessage('Password changed successfully.')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Account Profile</h1>
        <p className="mt-1 text-sm text-muted">Manage your personal identification and security settings.</p>
      </div>

      {/* Name and Basic Info */}
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <User size={18} /> Personal Details
        </h2>
        <p className="mt-1 text-sm text-muted">Your name is displayed across all organizations you join.</p>

        {profileError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            <AlertCircle size={16} className="shrink-0" />
            <p>{profileError}</p>
          </div>
        )}

        {profileMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
            <CheckCircle2 size={16} className="shrink-0" />
            <p>{profileMessage}</p>
          </div>
        )}

        <form onSubmit={handleUpdateProfile} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email-static" className="mb-1.5 block text-xs font-semibold text-muted">Email Address (Managed by Auth)</label>
            <input
              id="email-static"
              type="text"
              value={user?.email ?? ''}
              disabled
              className="input cursor-not-allowed bg-canvas text-muted"
            />
          </div>

          <div>
            <label htmlFor="full-name" className="mb-1.5 block text-xs font-semibold text-ink">Full Name</label>
            <input
              id="full-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={profileSaving} className="btn-primary disabled:opacity-60">
              {profileSaving ? 'Saving…' : 'Save Details'}
            </button>
          </div>
        </form>
      </section>

      {/* Password Update */}
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Lock size={18} /> Update Password
        </h2>
        <p className="mt-1 text-sm text-muted">Set a secure password of at least 8 characters.</p>

        {passwordError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            <AlertCircle size={16} className="shrink-0" />
            <p>{passwordError}</p>
          </div>
        )}

        {passwordMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
            <CheckCircle2 size={16} className="shrink-0" />
            <p>{passwordMessage}</p>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-xs font-semibold text-ink">New Password</label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-semibold text-ink">Confirm New Password</label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input"
              required
            />
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={passwordSaving} className="btn-primary disabled:opacity-60">
              {passwordSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
