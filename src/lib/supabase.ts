import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && key)

// Placeholder values keep the app from crashing when .env.local is missing.
// Screens check isSupabaseConfigured and show a setup message instead.
export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'not-configured')
