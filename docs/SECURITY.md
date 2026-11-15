# Security

## Rules
- Access control is enforced by Supabase Row Level Security and Storage policies, never by hidden buttons alone.
- The Supabase `service_role` key is never used in frontend code.
- Secrets live in `.env.local` (git-ignored). `.env.example` has placeholders only.

## Status
Phase 1 has no backend, no accounts and no stored data. Login and Register only validate input in the browser and do not send anything anywhere. RLS and Storage policies: not started.
