import { useEffect, useState } from 'react'
import { Settings as SettingsIcon, Shield, Bell, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const { user, isPlatformAdmin, refresh } = useAuth()
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('profiles')
      .select('preferences')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.preferences && typeof data.preferences === 'object') {
          const prefs = data.preferences as { email_notifications?: boolean }
          setEmailNotifs(prefs.email_notifications ?? true)
        }
        setLoading(false)
      })
  }, [user?.id])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) return
    setSaving(true)
    setError('')
    setSaved(false)

    const updated = { email_notifications: emailNotifs }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ preferences: updated })
      .eq('id', user.id)

    setSaving(false)
    if (updateErr) {
      setError(updateErr.message)
    } else {
      setSaved(true)
      await refresh()
      setTimeout(() => setSaved(false), 3000)
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">Personal Settings</h1>
        <p className="mt-1 text-sm text-muted">
          Manage your interface preferences, communication alerts, and session configuration.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          <CheckCircle2 size={18} className="shrink-0" />
          <p>Preferences saved to database.</p>
        </div>
      )}

      {/* Notifications Preferences */}
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Bell size={18} /> Notification Preferences
        </h2>
        <p className="mt-1 text-sm text-muted">Choose how you receive organization announcements and updates.</p>

        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={emailNotifs}
              disabled={loading}
              onChange={(e) => setEmailNotifs(e.target.checked)}
              className="mt-0.5 rounded border-hairline text-brand focus:ring-brand"
            />
            <div>
              <p className="text-sm font-semibold text-ink">Email Notifications</p>
              <p className="text-xs text-muted">Receive membership updates and request status changes at {user?.email}.</p>
            </div>
          </label>

          <div className="pt-2">
            <button type="submit" disabled={saving || loading} className="btn-primary text-xs disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </section>

      {/* Account Security Overview */}
      <section className="card p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Shield size={18} /> Account & Role Security
        </h2>
        <p className="mt-1 text-sm text-muted">Verification status for this active session.</p>

        <div className="mt-4 space-y-3 divide-y divide-hairline text-sm">
          <div className="flex items-center justify-between pt-2">
            <span className="text-muted">Account Identity</span>
            <span className="font-semibold text-ink">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between pt-3">
            <span className="text-muted">Platform Authorization</span>
            <span className="font-semibold text-ink">
              {isPlatformAdmin ? (
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-bold text-purple-700">Platform Administrator</span>
              ) : (
                'Standard User'
              )}
            </span>
          </div>
          <div className="flex items-center justify-between pt-3">
            <span className="text-muted">Authentication Provider</span>
            <span className="font-semibold text-ink">Supabase Secure Auth</span>
          </div>
        </div>
      </section>
    </div>
  )
}
