import { useEffect, useState, useCallback } from 'react'
import { Bell, Check, Trash2, CheckCircle2, Clock, Info, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

type NotificationItem = {
  id: string
  title: string
  message: string
  created_at: string
  is_read: boolean
  type: 'info' | 'success' | 'warning' | 'alert'
}

export default function Notifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setError('')

    const { data, error: dbErr } = await supabase
      .from('user_notifications')
      .select('id, title, message, created_at, is_read, type')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (dbErr) {
      console.warn('notifications fetch notice:', dbErr.message)
      setNotifications([])
    } else {
      setNotifications((data as unknown as NotificationItem[]) ?? [])
    }
    setLoading(false)
  }, [user?.id])

  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  const markAllRead = async () => {
    setError('')
    setSuccess('')
    const { error: rpcErr } = await supabase.rpc('mark_all_notifications_read')
    if (rpcErr) {
      // Local fallback
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } else {
      setSuccess('All notifications marked as read.')
      await fetchNotifications()
    }
  }

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    await supabase.from('user_notifications').delete().eq('id', id)
  }

  const clearAll = async () => {
    if (!user?.id) return
    setNotifications([])
    await supabase.from('user_notifications').delete().eq('user_id', user.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted">
            Stay updated with organization requests, leadership approvals, and platform alerts.
          </p>
        </div>

        {notifications.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllRead}
              className="btn-ghost flex items-center gap-1.5 text-xs font-semibold"
            >
              <Check size={14} /> Mark all read
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="btn-ghost flex items-center gap-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
            >
              <Trash2 size={14} /> Clear all
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
          <AlertCircle size={18} className="shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">
          <CheckCircle2 size={18} className="shrink-0" />
          <p>{success}</p>
        </div>
      )}

      <div className="card divide-y divide-hairline">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Loading notifications…</div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center p-12 text-center">
            <span className="icon-chip"><Bell size={24} strokeWidth={1.75} /></span>
            <p className="mt-4 font-bold text-ink">No notifications</p>
            <p className="mt-1 text-sm text-muted">You are all caught up!</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between gap-4 p-5 transition-colors ${
                n.is_read ? 'bg-white' : 'bg-brand-light/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  n.type === 'success' ? 'bg-emerald-50 text-emerald-700' :
                  n.type === 'alert' || n.type === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-indigo-50 text-indigo-700'
                }`}>
                  {n.type === 'success' ? <CheckCircle2 size={16} /> :
                   n.type === 'alert' || n.type === 'warning' ? <Clock size={16} /> : <Info size={16} />}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-ink">{n.title}</h3>
                    {!n.is_read && (
                      <span className="h-2 w-2 rounded-full bg-brand" title="Unread" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">{n.message}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {new Date(n.created_at).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => deleteNotification(n.id)}
                className="text-muted hover:text-rose-700 p-1"
                title="Dismiss"
                aria-label="Dismiss notification"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
