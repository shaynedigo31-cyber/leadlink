import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Info } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export default function ProtectedRoute() {
  const { user, loading, dataReady } = useAuth()
  const location = useLocation()

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto mt-16 flex max-w-md items-start gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <Info size={18} className="mt-0.5 shrink-0" />
        <p>Supabase is not set up. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local, then restart the dev server.</p>
      </div>
    )
  }
  if (loading || (user && !dataReady)) {
    return (
      <div className="space-y-3 p-10">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-brand-soft" />
        <div className="h-24 w-full max-w-md animate-pulse rounded-2xl bg-brand-soft" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}