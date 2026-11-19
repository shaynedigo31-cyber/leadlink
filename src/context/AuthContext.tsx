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
}

type Row = {
  id: string
  org_id: string
  status: Membership['status']
  organizations: { name: string; status: string } | null
  org_roles: { name: string } | null
}

type AuthState = {
  user: User | null
  fullName: string
  loading: boolean
  memberships: Membership[]
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [fullName, setFullName] = useState('')
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
      return
    }
    const [m, p] = await Promise.all([
      supabase
        .from('organization_members')
        .select('id, org_id, status, organizations(name, status), org_roles(name)')
        .eq('user_id', uid)
        .neq('status', 'removed'),
      supabase.from('profiles').select('full_name').eq('id', uid).maybeSingle(),
    ])
    if (!m.error && m.data) {
      const rows = m.data as unknown as Row[]
      setMemberships(
        rows.map((r) => ({
          id: r.id,
          org_id: r.org_id,
          status: r.status,
          org_name: r.organizations?.name ?? 'Unknown organization',
          org_status: r.organizations?.status ?? 'pending',
          role_name: r.org_roles?.name ?? null,
        })),
      )
    }
    setFullName((p.data as { full_name?: string } | null)?.full_name ?? '')
  }, [uid])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setMemberships([])
    setFullName('')
  }, [])

  return (
    <AuthContext.Provider value={{ user, fullName, loading, memberships, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
