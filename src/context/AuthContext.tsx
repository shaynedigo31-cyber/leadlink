import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

export type Membership = {
  id: string
  org_id: string
  status: 'pending' | 'active' | 'removed'
  org_name: string
  org_status: string
  role_name: string | null
  position_title: string | null
  permissions: string[]
}

type Row = {
  id: string
  org_id: string
  org_name: string
  org_status: string
  member_status: Membership['status']
  role_name: string | null
  position_title: string | null
  permissions: string[] | null
}

type AuthState = {
  user: User | null
  fullName: string
  isPlatformAdmin: boolean
  loading: boolean
  dataReady: boolean
  memberships: Membership[]
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [dataReady, setDataReady] = useState(false)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [fullName, setFullName] = useState('')
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const user = session?.user ?? null
  const uid = user?.id

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => data.subscription.unsubscribe()
  }, [])

  const refresh = useCallback(async () => {
    if (!uid) {
      setMemberships([])
      setFullName('')
      setIsPlatformAdmin(false)
      return
    }
    const [m, p] = await Promise.all([
      supabase.rpc('get_my_memberships'),
      supabase.from('profiles').select('full_name, is_platform_admin').eq('id', uid).maybeSingle(),
    ])
    if (m.error) {
      console.error('Memberships error:', m.error.message)
    } else {
      const rows = (m.data ?? []) as Row[]
      setMemberships(
        rows.map((r) => ({
          id: r.id,
          org_id: r.org_id,
          status: r.member_status,
          org_name: r.org_name,
          org_status: r.org_status,
          role_name: r.role_name,
          position_title: r.position_title,
          permissions: r.permissions ?? [],
        })),
      )
    }
    const profile = p.data as { full_name?: string; is_platform_admin?: boolean } | null
    setFullName(profile?.full_name ?? '')
    setIsPlatformAdmin(profile?.is_platform_admin ?? false)
  }, [uid])

  useEffect(() => {
    setDataReady(false)
    void refresh().finally(() => setDataReady(true))
  }, [refresh])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setMemberships([])
    setFullName('')
    setIsPlatformAdmin(false)
  }, [])

  return (
    <AuthContext.Provider value={{ user, fullName, isPlatformAdmin, loading, dataReady, memberships, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}