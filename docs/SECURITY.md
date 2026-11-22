# Security

## Rules
- Access control is enforced by Row Level Security (RLS), never by hidden buttons alone.
- The browser only gets the Supabase URL and the **publishable** key. Secret and `service_role` keys never go in frontend code, chat or git.
- Secrets live in `.env.local` (git-ignored). `.env.example` has placeholders only.

## Phase 2 foundation
- RLS is enabled on `profiles`, `organizations`, `org_roles`, `organization_members`.
- Table grants are limited. Users can edit only their own `full_name` and `avatar_url`; `is_platform_admin` cannot be changed from the app.
- Organizations are created only through `create_organization`, so nobody can give themselves a role directly.
- Members cannot request a role: join requests must be `pending` with no role and only for approved organizations.

## Phase 3.1 migration (`0002_phase3_organization_security.sql`)
- `is_org_member` and `has_org_permission` require an active membership and an approved organization; permission checks also require the assigned role to belong to that organization.
- Platform administrators have read access through the existing platform-oversight SELECT policies and may change organization status through `set_organization_status`. That RPC is platform-admin-only and prevents creators and active members with `org.manage`, `members.manage`, `roles.manage`, or `*` from approving their own organization.
- Platform-admin status does not grant global organization management. Membership approval/rejection/removal requires the caller's active approved-organization `members.manage` permission; custom-role create/update/delete requires `roles.manage`; member role assignment requires `members.manage`; organization details updates require `org.manage`.
- Ownership transfer requires an approved organization and the actual active organization Owner. Platform administrators cannot transfer ownership or remove an Owner solely due to platform-admin status. The final active Owner is protected.
- Authenticated users can no longer directly insert, update, or delete memberships or write roles. Membership and role changes go through SECURITY DEFINER RPCs with an empty `search_path`, explicit `auth.uid()` checks, and caller/target validation.
- `request_to_join_organization` supports a first request or re-application by a removed member without allowing the user to choose a role.
- Membership approvals reject self-approval, require an approved organization, and validate that the assigned role belongs to that organization.
- Role assignment rejects wildcard roles outside ownership transfer. The `org.manage`, `members.manage`, and `roles.manage` permissions can only be assigned by an actual organization Owner; platform-admin status does not grant organization-owner permissions.
- Owners cannot change their own role through the member-role operation. Ownership transfer requires an active Owner and an active member as the new Owner, and updates the former active Owner(s) and successor atomically.
- Removing/leaving as an Owner is blocked when it would leave no active Owner. Ordinary member managers cannot remove an Owner.
- Custom-role RPCs cannot edit or delete system roles, or create wildcard roles. The baseline privileged permission names require Owner authority.
- Organization status is platform-admin-only. A platform administrator who created or manages an organization cannot approve that same organization.

### Post-migration SQL verification (read-only)
Run these only after applying the migration in the intended Supabase project. They
inspect catalog state and existing ownership invariants; they do not apply changes.

```sql
-- These are effective privilege checks: they include applicable PUBLIC and
-- inherited role grants. Review the relevant client roles, including anon and
-- authenticated; explicit ACL entries alone are not sufficient.
select
  has_table_privilege('anon', 'public.organization_members', 'INSERT') as anon_can_insert_members,
  has_table_privilege('anon', 'public.organization_members', 'UPDATE') as anon_can_update_members,
  has_table_privilege('anon', 'public.organization_members', 'DELETE') as anon_can_delete_members,
  has_table_privilege('authenticated', 'public.organization_members', 'INSERT') as can_insert_members,
  has_table_privilege('authenticated', 'public.organization_members', 'UPDATE') as can_update_members,
  has_table_privilege('authenticated', 'public.organization_members', 'DELETE') as can_delete_members,
  has_table_privilege('authenticated', 'public.org_roles', 'INSERT') as can_insert_roles,
  has_table_privilege('authenticated', 'public.org_roles', 'UPDATE') as can_update_roles,
  has_table_privilege('authenticated', 'public.org_roles', 'DELETE') as can_delete_roles,
  has_column_privilege('authenticated', 'public.organizations', 'status', 'UPDATE') as can_update_org_status;

-- Public RPCs must be executable by authenticated; the internal owner helper
-- must not be executable by authenticated.
select p.proname, has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'approve_membership_request', 'assign_org_member_role', 'cancel_membership_request',
    'create_org_role', 'delete_org_role', 'leave_organization', 'request_to_join_organization',
    'reject_membership_request', 'remove_org_member', 'set_organization_status',
    'transfer_organization_ownership', 'update_org_role', 'is_org_owner'
  )
order by p.proname;

-- Every SECURITY DEFINER function in this migration should show an empty
-- search_path in proconfig (search_path="").
select p.proname, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'approve_membership_request', 'assign_org_member_role', 'cancel_membership_request',
    'create_org_role', 'delete_org_role', 'is_org_member', 'is_org_owner',
    'has_org_permission', 'leave_organization', 'reject_membership_request',
    'remove_org_member', 'request_to_join_organization', 'set_organization_status',
    'shares_org_with', 'transfer_organization_ownership', 'update_org_role'
  )
order by p.proname;

-- This query must return no organizations: every organization has at least one
-- active member assigned the system wildcard Owner role.
select o.id, o.name
from public.organizations o
where not exists (
  select 1
  from public.organization_members m
  join public.org_roles r on r.id = m.role_id
  where m.org_id = o.id and m.status = 'active' and r.is_system
    and r.permissions @> array['*']::text[]
);

-- Review RLS policies after hardening.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('organizations', 'org_roles', 'organization_members')
order by tablename, policyname;
```

Catalog checks do not replace behavioral RLS tests. The following matrix is a
test plan, not a record of executed tests. Run it against a controlled database
with representative platform administrators, Owners, managers, ordinary members,
and unrelated users. Do not run mutation scenarios against production data.

| Test | Expected result | Status |
|---|---|---|
| Platform administrator approves a membership request in an unrelated organization | Deny | Not executed; source inspection only |
| Platform administrator rejects a membership request in an unrelated organization | Deny | Not executed; source inspection only |
| Platform administrator creates a custom role in an unrelated organization | Deny | Not executed; source inspection only |
| Platform administrator updates a custom role in an unrelated organization | Deny | Not executed; source inspection only |
| Platform administrator deletes a custom role in an unrelated organization | Deny | Not executed; source inspection only |
| Platform administrator assigns a role in an unrelated organization | Deny | Not executed; source inspection only |
| Platform administrator removes a member in an unrelated organization | Deny | Not executed; source inspection only |
| Platform administrator directly inserts, updates, or deletes a membership row | Deny | Not executed; source inspection only |
| Platform administrator directly modifies a custom-role row | Deny | Not executed; source inspection only |
| Platform administrator directly updates organization name or description without `org.manage` | Deny | Not executed; source inspection only |
| Platform administrator directly changes organization status instead of calling `set_organization_status` | Deny | Not executed; source inspection only |
| Active organization member with `members.manage` approves a request in their organization | Allow | Not executed; source inspection only |
| Active organization member with `roles.manage` creates a custom role in their organization | Allow | Not executed; source inspection only |
| Authorized member assigns a valid same-organization role to another member | Allow | Not executed; source inspection only |
| Membership references a role from another organization | Permission and Owner helpers deny the mismatched role | Not executed; source inspection only |
| Actual active Owner transfers ownership in an approved organization to an active member | Allow | Not executed; source inspection only |
| Owner attempts ownership transfer while organization is pending, rejected, or suspended | Deny | Not executed; source inspection only |
| Platform administrator without Owner membership transfers ownership | Deny | Not executed; source inspection only |
| Platform administrator attempts to remove the final Owner | Deny | Not executed; source inspection only |
| Platform administrator approves an unrelated organization's application | Allow, unless creator/active manager of that organization | Not executed; source inspection only |
| Platform administrator approves an organization they created | Deny | Not executed; source inspection only |
| Platform administrator with active `org.manage` membership approves that organization's application | Deny | Not executed; source inspection only |
| Platform administrator with active `members.manage` membership approves that organization's application | Deny | Not executed; source inspection only |
| Platform administrator with active `roles.manage` membership approves that organization's application | Deny | Not executed; source inspection only |
| Platform administrator with active wildcard membership approves that organization's application | Deny | Not executed; source inspection only |

The migration drops the foundation's direct membership-insert policy. Join
requests must use `request_to_join_organization`, which only creates or resets
the caller's own role-less pending row for an approved organization.

## Remaining risks
- No automated RLS/integration tests or live-schema verification are included.
- Privileged role names are currently the three permissions defined in the
  foundation migration. Any future permission that conveys administrative power
  must be added to the privileged-permission checks before it is exposed.
- Membership rejection is represented by `removed`; there is not yet a distinct
  rejected status or activity log.
- Platform administrators cannot transfer ownership unless they are also the
  active organization Owner; ownership recovery otherwise requires an active
  organization Owner.
- The legacy `create_organization` behavior is preserved and was not live-tested.
