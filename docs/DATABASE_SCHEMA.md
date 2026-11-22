# Database Schema

Source of truth: sequential migrations in `supabase/migrations/`.
`0001_foundation.sql` defines the Phase 2 schema. `0002_phase3_organization_security.sql`
hardens its policies and adds organization-management RPCs. Apply migrations in order;
do not rerun `0001_foundation.sql`.

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
- `set_organization_status(org, status)` — platform administrators only; creators and organization managers cannot approve their own organization.
- Helpers used by policies: `is_platform_admin`, `is_org_member`, `has_org_permission`, `shares_org_with`; internal `is_org_owner` is reserved for owner-only RPCs.
- `create_org_role`, `update_org_role`, `delete_org_role` — require active approved-organization `roles.manage`; system roles and wildcard permissions are protected.
- `request_to_join_organization`, `approve_membership_request`, `reject_membership_request`, `assign_org_member_role`, `remove_org_member`, `leave_organization`, `cancel_membership_request` — validated membership operations; administrative changes require active approved-organization `members.manage`.
- `transfer_organization_ownership(org, new_owner)` — in an approved organization, transfers the system Owner role to an existing active member, atomically retaining an active Owner.

Normal organization membership and permissions require an active membership and an
approved organization. Platform administrators have read access under the existing
platform-oversight SELECT policies and may change organization status only through
`set_organization_status`. Platform-admin status does not authorize organization
membership or custom-role changes. Those operations require the caller's active
membership permission (`members.manage` or `roles.manage`); organization detail
updates require `org.manage`. Only an actual active Owner can transfer ownership
or grant baseline privileged permissions. Direct authenticated membership
inserts/updates/deletes and role writes are revoked; use the RPCs instead.

Membership statuses remain `pending`, `active`, and `removed`. First-time
role-less pending requests are created through `request_to_join_organization`.
Rejections mark a request removed; a user can cancel their own pending request
through the RPC. Removed users can request to join again through the RPC; it
resets their row to pending without granting a role. Active membership approval
sets the role and `joined_at` together.

## Not yet built
Committees, events, projects, tasks, announcements, notifications, library, legacy,
turnover, invitations, and activity logs. The live Supabase schema and RLS behavior
have not been independently queried by this repository.
