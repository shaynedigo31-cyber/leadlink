# Database Schema

Source of truth: `supabase/migrations/0001_foundation.sql`.
**Status: written, not yet run or tested against a real Supabase project.**

## Tables (Phase 2)
| Table | Purpose |
|---|---|
| `profiles` | One row per user (id = auth user id). `is_platform_admin` can only be changed in SQL, never by the app. |
| `organizations` | Name, unique slug, description, `status` (pending, approved, rejected, suspended). |
| `org_roles` | Per-organization roles holding a `permissions` list. System roles: Owner (`*`), Administrator, Officer, Adviser, Member. |
| `organization_members` | Links a user to an organization with a role, an optional position title, and a status (pending, active, removed). |

Position titles (President, Treasurer...) live in `organization_members.position_title`, separate from permissions.

## Functions
- `create_organization(name, slug, description)` — creates the org as `pending`, its default roles, and makes the caller the Owner.
- `set_organization_status(org, status)` — platform administrators only.
- Helpers used by policies: `is_platform_admin`, `is_org_member`, `has_org_permission`, `shares_org_with`.

## Not yet built
Committees, events, projects, tasks, announcements, notifications, library, legacy, turnover, approvals, activity logs.
