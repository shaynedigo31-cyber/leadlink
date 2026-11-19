# Security

## Rules
- Access control is enforced by Row Level Security (RLS), never by hidden buttons alone.
- The browser only gets the Supabase URL and the **publishable** key. Secret and `service_role` keys never go in frontend code, chat or git.
- Secrets live in `.env.local` (git-ignored). `.env.example` has placeholders only.

## Phase 2 design (written, NOT yet tested)
- RLS is enabled on `profiles`, `organizations`, `org_roles`, `organization_members`.
- Table grants are limited. Users can edit only their own `full_name` and `avatar_url`; `is_platform_admin` cannot be changed from the app.
- Organizations are created only through `create_organization`, so nobody can give themselves a role directly.
- Members cannot request a role: join requests must be `pending` with no role and only for approved organizations.
- Only someone holding the Owner permission (`*`) can assign an Owner-level role.

## Known gaps
- No automated RLS tests yet. They must be run before Phase 2 is called done.
- Nothing yet stops removing the last Owner of an organization.
- No activity log yet.
