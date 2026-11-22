# LEADLINK — Final SQL-Level Security Gate

- Review date: 2026-11-23
- Scope: static review of migrations `0001`–`0004`, the schema and rollback SQL,
  and the Phase 3 preflight and two-account test plans.
- Production SQL was not run for this review. No production changes were made.

## Verdict: NOT READY

The local source now includes fixes for invitation acceptance and audit-event
coverage, but those edits have not been applied to any database or verified with
behavioral tests. The latest read-only production preflight recorded earlier in
this project session found no `supabase_migrations.schema_migrations` relation,
no CLI migration rows, the 0003 same-organization constraints present, and
incomplete 0002 hardening (including direct membership and role write grants).
That prior snapshot has not been refreshed for this review. Do not execute a
production migration until a new read-only preflight reconciles the actual live
schema and any partially applied SQL-Editor work.

## Findings and local remediation

| ID | Severity | File / function | Finding | Local status |
|---|---|---|---|---|
| F-01 | MEDIUM | `0004_activity_invitations_notifications.sql`, `respond_to_invitation` | Acceptance did not require a currently approved organization. | Fixed in local source: acceptance now locks and checks the organization before membership activation. Not live-verified. |
| F-02 | LOW | `0004_activity_invitations_notifications.sql`, audit triggers | Combined membership/role/position changes lost events; ownership transfers and invitation decline/cancel/expiry were not distinctly logged. Organization detail changes were not logged. | Fixed in local source: independent membership-event checks, ownership event, settings event, and invitation audit trigger. Not live-verified. |
| F-03 | MEDIUM | `0004_activity_invitations_notifications.sql`, `respond_to_invitation` | Updating an expired invitation and then raising an exception rolled back the expiration update. The pending-invitation unique index could remain blocked. | Fixed in local source: expiry is persisted and logged, and the RPC returns `expired`. Resending also expires a stale pending invitation for that organization/email. Not live-verified. |
| F-04 | HIGH | `0001_foundation.sql`, `0002_phase3_organization_security.sql`, `0003_role_same_org.sql`, `0004_activity_invitations_notifications.sql` | Several PL/pgSQL and DO bodies closed with `END` but omitted the required inner semicolon, making source migrations syntactically invalid. | Fixed in local source only. Validate on a disposable local database; do not assume production used these exact bytes. |
| F-05 | HIGH gate blocker | Live migration state | The most recent recorded production preflight showed partial/mixed migration state and open direct-write grants. | Unresolved here: requires a fresh read-only live preflight and a reviewed, project-specific reconciliation plan. No production SQL was run. |
| F-06 | MEDIUM | `0004_activity_invitations_notifications.sql`, `respond_to_invitation` | An invitation accepted after the recipient had independently become an active member could overwrite that member's current role. | Fixed in local source with a unique-key upsert that activates only non-active rows and rejects active memberships. Not live-verified. |

`respond_to_invitation(uuid, text)` now returns `accepted`, `declined`, or
`expired`. `src/pages/Invitations.tsx` checks that result and does not present an
expired response as a successful acceptance.

## 1. SECURITY DEFINER inventory and privilege matrix

The migrations do not issue `ALTER FUNCTION ... OWNER TO ...`; ownership is the
role that executes `CREATE FUNCTION`. A source file therefore cannot prove the
live owner. The expected owner is the trusted migration executor (normally
`postgres` when run from the Supabase SQL Editor). Verify the actual owner and
its role attributes with the catalog queries below. Every SECURITY DEFINER
function below specifies `SET search_path = ''`. The sole listed non-definer
function, `set_updated_at()`, has the default function search path and accesses
only `NEW.updated_at`.

Privilege columns below are expected effective `EXECUTE` privileges for
`PUBLIC`, `anon`, and `authenticated`, respectively. `Y` is intentional
authenticated access; each such function still has the authorization boundary
described in its row. No function is intended to be executable by `PUBLIC` or
`anon`. The internal trigger/helper functions are not client-callable.

| Exact signature | SECURITY DEFINER | Expected owner | `search_path` | PUBLIC / anon / authenticated EXECUTE | Authorization and organization boundary |
|---|---:|---|---|---|---|
| `public.handle_new_user()` | Yes | Migration executor; verify live | `''` | N / N / N | Auth trigger only; uses the inserted `auth.users` row and creates its matching profile. Not a client RPC. |
| `public.is_platform_admin()` | Yes | Migration executor; verify live | `''` | N / N / Y | Returns only the caller's platform-admin flag; no organization mutation. |
| `public.is_org_member(uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Tests the caller's active membership in the supplied approved organization. |
| `public.has_org_permission(uuid, text)` | Yes | Migration executor; verify live | `''` | N / N / Y | Tests the caller's active permission in an approved organization; role must be in that organization. |
| `public.shares_org_with(uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Tests whether the caller and target share an active approved organization; returns a boolean only. |
| `public.create_organization(text, text, text)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires a signed-in caller; creates the organization, default roles, and caller's Owner membership atomically. |
| `public.set_organization_status(uuid, text)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires platform-admin status; rejects creator/manager self-approval; status values are allow-listed. Its cross-organization reach is intentional platform oversight. |
| `public.is_org_owner(uuid)` | Yes | Migration executor; verify live | `''` | N / N / N | Internal Owner check; platform-admin status alone is not Owner authority. |
| `public.request_to_join_organization(uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Caller can create/reset only their own role-less pending membership for an approved organization. |
| `public.create_org_role(uuid, text, text[])` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires `roles.manage`; no wildcard; baseline privileged permissions require actual Owner authority. |
| `public.update_org_role(uuid, text, text[])` | Yes | Migration executor; verify live | `''` | N / N / Y | Resolves organization from role; requires `roles.manage`; system roles and wildcard are protected; privileged permissions require Owner. |
| `public.delete_org_role(uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires `roles.manage`; protects system roles and roles still assigned to members. |
| `public.approve_membership_request(uuid, uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires `members.manage`; rejects self-approval; requires approved organization and same-organization non-Owner role. |
| `public.reject_membership_request(uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires `members.manage`; rejects self-rejection and non-pending targets. |
| `public.assign_org_member_role(uuid, uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires `members.manage`; rejects self-change and Owner reassignment; validates role organization and privileged-permission authority. |
| `public.set_org_member_position(uuid, text)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires `members.manage`; target must be active; only an Owner may change an Owner's position. |
| `public.remove_org_member(uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires `members.manage`; no self-removal through this RPC; protects Owners and the final active Owner. |
| `public.leave_organization(uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Operates only on caller's active membership; prevents the final active Owner from leaving. |
| `public.cancel_membership_request(uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Deletes only the caller's pending membership request. |
| `public.transfer_organization_ownership(uuid, uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires actual active Owner and approved organization; target must be active; locks organization and transfers atomically. |
| `public.log_org_activity(uuid, text, text, text, jsonb)` | Yes | Migration executor; verify live | `''` | N / N / N | Contains internal authorization but deliberately is not executable by clients; do not grant it as a generic logging endpoint. |
| `public.trg_log_organization_events()` | Yes | Migration executor; verify live | `''` | N / N / N | Trigger only; derives organization and event from `NEW`/`OLD`, actor from `auth.uid()`. |
| `public.trg_log_member_status_change()` | Yes | Migration executor; verify live | `''` | N / N / N | Trigger only; derives organization and member state from affected row, actor from `auth.uid()`. |
| `public.trg_log_role_events()` | Yes | Migration executor; verify live | `''` | N / N / N | Trigger only; derives organization and role from affected row, actor from `auth.uid()`. |
| `public.trg_log_invitation_events()` | Yes | Migration executor; verify live | `''` | N / N / N | Trigger only; derives organization and status from affected row, actor from `auth.uid()`. |
| `public.create_organization_invitation(uuid, text, uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires `members.manage`, approved organization, same-organization role, and Owner for privileged roles; wildcard prohibited. |
| `public.respond_to_invitation(uuid, text)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires intended recipient email and pending/unexpired state; acceptance also requires a currently approved organization and same-organization non-wildcard role. Atomic upsert rejects an already-active recipient instead of changing their role. Returns a result string. |
| `public.cancel_organization_invitation(uuid)` | Yes | Migration executor; verify live | `''` | N / N / Y | Requires `members.manage`; only a pending invitation can be cancelled. |
| `public.mark_all_notifications_read()` | Yes | Migration executor; verify live | `''` | N / N / Y | Updates only notifications whose `user_id = auth.uid()`. |
| `public.set_updated_at()` | No | Migration executor; verify live | Default | N / N / N | Trigger only; changes `NEW.updated_at`; no client RPC or organization access. |

There are **29 unique SECURITY DEFINER signatures** across the four migrations;
`set_org_member_position(uuid, text)` is defined in both 0002 and 0004 with
the same authorization behavior and is one signature, not an overload. The
forward definition in 0004 preserves support for databases where an earlier
0002 copy omitted that RPC. There are **22 client-executable SECURITY DEFINER
signatures**; the other 7 are internal trigger functions or the internal
`is_org_owner` / `log_org_activity` functions.

All application tables and non-built-in functions referenced by these bodies
are schema-qualified (`public.*` or `auth.*`). Unqualified names are SQL/PL/pgSQL
constructs or built-ins. Empty `search_path` protects SECURITY DEFINER
resolution. Because the expected owner may bypass RLS, explicit checks inside
each mutation RPC remain essential; RLS is not a substitute for those checks.

### Function catalog verification (read-only)

Run only against the intended database after its state has been reconciled.
The query reports every expected exact signature, unexpected overloads,
function owner, security mode, path, PUBLIC ACL, and effective `anon` /
`authenticated` EXECUTE. `N` is expected for PUBLIC and anon on every row.

```sql
with expected(name, args, auth_execute) as (
  values
    ('handle_new_user', '', false),
    ('is_platform_admin', '', true),
    ('is_org_member', 'uuid', true),
    ('has_org_permission', 'uuid, text', true),
    ('shares_org_with', 'uuid', true),
    ('create_organization', 'text, text, text', true),
    ('set_organization_status', 'uuid, text', true),
    ('is_org_owner', 'uuid', false),
    ('request_to_join_organization', 'uuid', true),
    ('create_org_role', 'uuid, text, text[]', true),
    ('update_org_role', 'uuid, text, text[]', true),
    ('delete_org_role', 'uuid', true),
    ('approve_membership_request', 'uuid, uuid', true),
    ('reject_membership_request', 'uuid', true),
    ('assign_org_member_role', 'uuid, uuid', true),
    ('set_org_member_position', 'uuid, text', true),
    ('remove_org_member', 'uuid', true),
    ('leave_organization', 'uuid', true),
    ('cancel_membership_request', 'uuid', true),
    ('transfer_organization_ownership', 'uuid, uuid', true),
    ('log_org_activity', 'uuid, text, text, text, jsonb', false),
    ('trg_log_organization_events', '', false),
    ('trg_log_member_status_change', '', false),
    ('trg_log_role_events', '', false),
    ('trg_log_invitation_events', '', false),
    ('create_organization_invitation', 'uuid, text, uuid', true),
    ('respond_to_invitation', 'uuid, text', true),
    ('cancel_organization_invitation', 'uuid', true),
    ('mark_all_notifications_read', '', true)
),
actual as (
  select
    p.oid,
    p.proname as name,
    pg_catalog.oidvectortypes(p.proargtypes) as args,
    pg_get_userbyid(p.proowner) as function_owner,
    p.prosecdef,
    p.proconfig,
    coalesce((
      select bool_or(a.grantee = 0 and a.privilege_type = 'EXECUTE')
      from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    ), false) as public_execute,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
)
select
  e.name as expected_name,
  e.args as expected_arguments,
  a.function_owner,
  a.prosecdef,
  a.proconfig,
  a.public_execute,
  a.anon_execute,
  a.authenticated_execute,
  e.auth_execute as expected_authenticated_execute,
  case
    when a.oid is null then 'MISSING EXACT SIGNATURE'
    when a.prosecdef is distinct from true then 'SECURITY DEFINER MISMATCH'
    when not coalesce(a.proconfig @> array['search_path=""']::text[], false)
      then 'EMPTY SEARCH_PATH MISSING'
    when a.public_execute or a.anon_execute then 'UNEXPECTED PUBLIC/ANON EXECUTE'
    when a.authenticated_execute is distinct from e.auth_execute
      then 'AUTHENTICATED EXECUTE MISMATCH'
    when a.function_owner in ('anon', 'authenticated')
      then 'UNTRUSTED FUNCTION OWNER'
    else 'EXPECTED PRIVILEGES; REVIEW OWNER TRUST'
  end as result
from expected e
left join actual a on a.name = e.name and a.args = e.args
order by e.name, e.args;

-- Review all public SECURITY DEFINER signatures, including unexpected overloads.
select
  p.oid::regprocedure as signature,
  pg_get_userbyid(p.proowner) as function_owner,
  r.rolsuper as owner_is_superuser,
  r.rolbypassrls as owner_bypasses_rls,
  r.rolcanlogin as owner_can_login,
  p.proconfig,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_roles r on r.oid = p.proowner
where n.nspname = 'public' and p.prosecdef
order by p.proname, p.oid::regprocedure::text;
```

The matrix does not assert that a SECURITY DEFINER owner is `postgres`; inspect
the returned owner and confirm it is a trusted migration role. Any difference
from the expected signatures, execution matrix, or empty search path blocks
deployment pending investigation.

## 2. Audit-log integrity and event coverage

`log_org_activity` has an internal permission check but is revoked from PUBLIC,
anon, and authenticated. A manager cannot call it through PostgREST to forge
action names, actor IDs, organization IDs, details, or metadata. Database
triggers are not ordinary RPCs: their EXECUTE ACLs are revoked from client
roles, and the trigger supplies the row's organization and `auth.uid()` actor.
Trigger inserts occur in the same transaction as the underlying mutation;
failure to log aborts that mutation.

| Event | Trusted recorder | Expected result |
|---|---|---|
| Organization creation | `trg_log_organization_events` after organization insert | `Organization Created` |
| Organization approval/status change | Same trigger after `status` transition | `Organization Status Changed` |
| Organization name/description change | Same trigger after either detail changes | `Organization Details Updated` |
| Join request creation | `trg_log_member_status_change` after pending membership insert | `Join Request Submitted` |
| Join request cancellation | Same trigger after pending membership delete | `Join Request Cancelled` |
| Membership approval | Same trigger after `pending` → `active` | `Membership Approved` |
| Membership rejection | Same trigger after `pending` → `removed` | `Membership Rejected` |
| Member removal / leave | Same trigger after `active` → `removed`; actor determines label | `Member Removed` or `Member Left Organization` |
| Role creation/update/deletion | `trg_log_role_events` on custom-role mutations | Corresponding custom-role event; system roles are excluded |
| Member role assignment | `trg_log_member_status_change` on role change not involving Owner | `Member Role Assigned` when no prior role existed; otherwise `Member Role Reassigned` |
| Position assignment | Same trigger on position change | `Member Position Assigned` |
| Ownership transfer | Same trigger when a member transitions into the system Owner role | `Organization Ownership Transferred`; old Owner demotion is not separately mislabeled as a normal role change |
| Invitation creation | `trg_log_invitation_events` after insert | `Invitation Issued` |
| Invitation acceptance | Invitation trigger on status transition; membership trigger also records activation when it activates a pending row | `Invitation Accepted`; `Membership Activated via Invitation` when applicable |
| Invitation decline | Same trigger on status transition | `Invitation Declined` |
| Invitation cancellation | Same trigger on status transition | `Invitation Cancelled` |
| Invitation expiration | Same trigger on status transition to expired | `Invitation Expired`; expiration is lazy (recipient response or resend cleanup), not a scheduled background job |

Actor identity is derived from `auth.uid()`. A trusted database operation without
an end-user JWT can therefore produce a null actor; it cannot choose an
arbitrary authenticated actor. Activity-log reads are RLS-limited to active
organization members and platform administrators. Logs intentionally do not
include invitee email addresses.

## 3. Invitation and ownership invariants

- Invitation creation locks the organization and requires its current status
  to be approved, plus `members.manage`.
- The invitation role must belong to that organization. 0004 also adds
  `organization_invitations_role_same_org_fkey`, backed by the 0003 unique
  `(org_id, id)` role key.
- Wildcard Owner roles cannot be invited. Only an actual organization Owner
  can invite to baseline privileged roles.
- A partial unique index permits only one pending invite per organization and
  normalized email. Before issuing a replacement, the RPC expires and logs a
  stale pending invitation for that address.
- `respond_to_invitation` verifies the intended caller email before changing
  invitation state. It locks the organization before the invitation row, checks
  pending/unexpired state, and for acceptance rechecks the approved organization
  status and role scope. It does not activate membership if the organization
  is suspended, rejected, or pending.
- Expiration sets status and returns `expired` normally so the update and event
  log commit. Raising after the update would roll them back.
- Membership creation/update, invitation status change, and audit-trigger
  inserts share one transaction. The membership `(org_id, user_id)` unique
  constraint and conflict-targeted upsert prevent duplicate rows under
  concurrency. The upsert activates only a pending/removed membership and
  rejects an already-active member rather than overwriting their role. The
  organization lock serializes invite acceptance with join-request RPCs that
  take the same lock.
- Ownership transfer locks the organization, requires the caller's active
  Owner role and an active target, then updates Owner roles in one transaction.
  Leave/removal paths protect the final active Owner. These are source-level
  invariants; concurrency behavior still needs database tests.

## 4. Table schema, grants, RLS, constraints, and triggers

### Required columns

| Table.column | Expected local migration definition |
|---|---|
| `profiles.full_name` | `text NOT NULL DEFAULT ''` |
| `profiles.avatar_url` | nullable `text` |
| `profiles.preferences` | 0004: `jsonb NOT NULL DEFAULT '{"email_notifications": true, "theme": "system"}'::jsonb`, object check |
| `profiles.is_platform_admin` | `boolean NOT NULL DEFAULT false` |
| `organizations.name` | `text NOT NULL`, 2–120 character check |
| `organizations.description` | nullable `text` |
| `organizations.status` | `text NOT NULL DEFAULT 'pending'`, check: pending/approved/rejected/suspended |
| `organizations.created_by` | `uuid NOT NULL REFERENCES public.profiles(id)` |

The 0004 `preferences` block adds the column only if absent. If it already
exists with a different type, default, nullability, or check, the migration
does not reconcile that shape; inspect it first. Live values are not implied by
these source definitions.

### Effective table/column grants

The following are expected after all migrations. Verify effective privileges
and explicit PUBLIC ACLs: column grants do not replace a broader table grant.
RLS does not protect against TRUNCATE.

| Table | `anon` | `authenticated` table-level grants | Authenticated column writes |
|---|---|---|---|
| `profiles` | None | SELECT | UPDATE only `full_name`, `avatar_url`, `preferences` |
| `organizations` | None | SELECT | UPDATE only `name`, `description` |
| `org_roles` | None | SELECT | None |
| `organization_members` | None | SELECT | None |
| `activity_logs` | None | SELECT | None |
| `organization_invitations` | None | SELECT | None |
| `user_notifications` | None | SELECT, DELETE | UPDATE only `is_read` |

Authenticated must not have table-level INSERT/UPDATE/DELETE on profiles or
organizations, nor INSERT/UPDATE/DELETE on roles, memberships, logs, or
invitations. No client role (including PUBLIC) should have TRUNCATE on any
application table. Notifications are the exception for DELETE; RLS restricts
deletion to the user's own rows.

### RLS policy expectations

RLS is enabled, not forced, on all seven application tables. The SECURITY
DEFINER owner and table owner still require trusted ownership and careful
function logic.

| Table | Expected policies / effective row scope |
|---|---|
| `profiles` | `profiles: read own, co-members, or admin` (own, shared approved-org member, or platform admin); `profiles: update own` |
| `organizations` | `organizations: approved are discoverable`; `organizations: members, creator and admins can read`; `organizations: managers update details` (`org.manage`, no platform-admin update bypass) |
| `org_roles` | `org_roles: members read`; no client INSERT/UPDATE/DELETE policy after 0002 |
| `organization_members` | `members: read own row, org members, managers, admins`; no client INSERT/UPDATE/DELETE policy after 0002 |
| `activity_logs` | `activity_logs: members and admin can read` |
| `organization_invitations` | `invitations: managers and invitees can read` |
| `user_notifications` | `notifications: read own`; `notifications: update own read status`; `notifications: delete own` |

Permissive policies combine with OR. Compare each actual `qual` and
`with_check` with source, not just policy name or RLS-enabled state.

### Constraint and trigger expectations

- 0003: `org_roles_org_id_id_key UNIQUE (org_id, id)` and
  `organization_members_role_same_org_fkey FOREIGN KEY (org_id, role_id)
  REFERENCES org_roles (org_id, id)`.
- 0004: `organization_invitations_role_same_org_fkey` with the same-org role
  reference; `unique_pending_org_invitation` partial unique index; organization,
  role, membership, notification, and invitation constraints from their
  `CREATE TABLE` definitions.
- Triggers: `profiles_updated`, `organizations_updated`,
  `on_auth_user_created`, `on_organization_activity`,
  `on_member_status_change`, `on_role_activity`, and
  `on_invitation_activity`. All must be enabled and point to their expected
  functions.

### Read-only live catalog checks

These queries are verification templates only. They were not run as part of
this review.

```sql
-- Exact required columns and types/defaults for the security-sensitive fields.
with expected(table_name, column_name, data_type, udt_name, nullable, column_default) as (
  values
    ('profiles', 'full_name', 'text', 'text', 'NO', '''''::text'),
    ('profiles', 'avatar_url', 'text', 'text', 'YES', null::text),
    ('profiles', 'preferences', 'jsonb', 'jsonb', 'NO', '''{"email_notifications": true, "theme": "system"}''::jsonb'),
    ('profiles', 'is_platform_admin', 'boolean', 'bool', 'NO', 'false'),
    ('organizations', 'name', 'text', 'text', 'NO', null::text),
    ('organizations', 'description', 'text', 'text', 'YES', null::text),
    ('organizations', 'status', 'text', 'text', 'NO', '''pending''::text'),
    ('organizations', 'created_by', 'uuid', 'uuid', 'NO', null::text)
)
select e.*, c.data_type as actual_data_type, c.udt_name as actual_udt_name,
       c.is_nullable as actual_nullable, c.column_default as actual_default,
       case when c.column_name is null then 'MISSING OR NOT VISIBLE'
            when c.data_type is distinct from e.data_type
              or c.udt_name is distinct from e.udt_name
              or c.is_nullable is distinct from e.nullable
              or c.column_default is distinct from e.column_default
              then 'MISMATCH - REVIEW'
            else 'MATCH - CHECK CONSTRAINTS SEPARATELY' end as result
from expected e
left join information_schema.columns c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- Effective table privileges, including inherited and PUBLIC grants.
select role_name, table_name,
       has_table_privilege(role_name, table_name, 'SELECT') as can_select,
       has_table_privilege(role_name, table_name, 'INSERT') as can_insert,
       has_table_privilege(role_name, table_name, 'UPDATE') as can_update,
       has_table_privilege(role_name, table_name, 'DELETE') as can_delete,
       has_table_privilege(role_name, table_name, 'TRUNCATE') as can_truncate
from (values
  ('anon', 'public.profiles'), ('anon', 'public.organizations'),
  ('anon', 'public.org_roles'), ('anon', 'public.organization_members'),
  ('anon', 'public.activity_logs'), ('anon', 'public.organization_invitations'),
  ('anon', 'public.user_notifications'),
  ('authenticated', 'public.profiles'), ('authenticated', 'public.organizations'),
  ('authenticated', 'public.org_roles'), ('authenticated', 'public.organization_members'),
  ('authenticated', 'public.activity_logs'), ('authenticated', 'public.organization_invitations'),
  ('authenticated', 'public.user_notifications')
) requested(role_name, table_name)
order by role_name, table_name;

-- Effective sensitive column update privileges.
select role_name, table_name, column_name,
       has_column_privilege(role_name, table_name, column_name, 'UPDATE') as can_update
from (values
  ('anon', 'public.profiles', 'full_name'),
  ('authenticated', 'public.profiles', 'full_name'),
  ('authenticated', 'public.profiles', 'avatar_url'),
  ('authenticated', 'public.profiles', 'preferences'),
  ('authenticated', 'public.profiles', 'is_platform_admin'),
  ('authenticated', 'public.organizations', 'name'),
  ('authenticated', 'public.organizations', 'description'),
  ('authenticated', 'public.organizations', 'status'),
  ('authenticated', 'public.organizations', 'created_by'),
  ('authenticated', 'public.user_notifications', 'is_read'),
  ('authenticated', 'public.user_notifications', 'user_id')
) requested(role_name, table_name, column_name)
order by role_name, table_name, column_name;

-- Every actual policy on the seven tables, including unexpected policies.
select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in (
    'profiles', 'organizations', 'org_roles', 'organization_members',
    'activity_logs', 'organization_invitations', 'user_notifications'
  )
order by tablename, policyname;

-- Constraints and definition/validation state for same-org role references.
select c.relname as table_name, con.conname, con.contype, con.convalidated,
       pg_get_constraintdef(con.oid, true) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and (c.relname in ('org_roles', 'organization_members', 'organization_invitations')
       or con.conname in ('org_roles_org_id_id_key',
                          'organization_members_role_same_org_fkey',
                          'organization_invitations_role_same_org_fkey'))
order by c.relname, con.conname;

-- Expected trigger names, targets, definitions, and enablement.
select n.nspname as table_schema, c.relname as table_name, t.tgname,
       t.tgenabled, pg_get_triggerdef(t.oid, true) as trigger_definition,
       p.oid::regprocedure as trigger_function,
       pg_get_userbyid(p.proowner) as function_owner,
       p.prosecdef, p.proconfig
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
join pg_proc p on p.oid = t.tgfoid
where not t.tgisinternal
  and ((n.nspname = 'public' and c.relname in (
         'profiles', 'organizations', 'organization_members',
         'org_roles', 'organization_invitations'))
       or (n.nspname = 'auth' and c.relname = 'users'))
order by n.nspname, c.relname, t.tgname;
```

Catalog output is not proof of behavior. A missing table/column/function or
invisible catalog row is `NOT CHECKED`, never a pass. Review explicit ACLs as
well as effective privilege checks; no automatic REVOKE or policy change should
be made solely from an unverified result.

## 5. Migration safety and execution order

| Migration | Dependencies and transaction behavior | Re-run/data considerations |
|---|---|---|
| `0001_foundation.sql` | Establishes profiles, organizations, roles, memberships, functions, grants, policies, and triggers. No explicit transaction wrapper. | Not safe to rerun: plain CREATE statements will fail on existing objects. Do not rerun. |
| `0002_phase3_organization_security.sql` | Requires the 0001 schema; explicit `BEGIN`/`COMMIT`. Replaces helpers/status RPC, drops old write policies, removes direct membership/role writes, and defines guarded RPCs. | Mostly repeatable through `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, and explicit grants; still not safe to blindly rerun on an unknown/partially hardened live project. No intended row deletion. |
| `0003_role_same_org.sql` | Requires `org_roles` and `organization_members`; explicit transaction. Adds unique `(org_id,id)` and composite membership-role FK. Can technically follow 0001, but must precede 0004. | Adds constraints only; fails and rolls back if existing cross-org role rows violate the FK. Its DO block checks names/table identity, not an existing same-named constraint's exact definition; catalog verification is required. |
| `0004_activity_invitations_notifications.sql` | Requires 0002 RPCs/helpers and 0003's composite role key; explicit transaction. Creates logs, invitations, notifications, profile preferences, policies, triggers, and RPCs. Recommended last. | Uses conditional table/column/index creation and replaces named policies/triggers. Existing tables with incompatible shapes are not reconciled by `IF NOT EXISTS`. New unique indexes/FKs can fail on existing conflicting rows, rolling back the transaction. No migration statement intentionally deletes application rows. The `respond_to_invitation` drop/recreate only changes an RPC definition/return type; inspect dependent database objects before replay. |

Recommended order for a verified clean baseline: `0001` once, then `0002`,
`0003`, and `0004`. This is not authorization to apply them to the current
production database. First compare live definitions, data, constraints,
policies, privileges, and history, including SQL-Editor changes and partial
execution. Keep a restorable backup and obtain explicit approval before applying
any production migration.

## 6. Required behavioral tests (not executed)

Run mutation cases only in a controlled non-production database with two
ordinary accounts, an Owner, a manager, a platform administrator, and an
unrelated user.

| Test | Expected |
|---|---|
| Unauthenticated/anon invokes any mutation RPC | Denied by EXECUTE privilege |
| Authenticated non-member invokes membership/role RPCs for another organization | Denied |
| Platform admin without organization membership manages membership/roles | Denied |
| Member self-approves or self-assigns a role | Denied |
| Non-Owner grants baseline privileged permissions or wildcard | Denied |
| Cross-organization membership or invitation role reference | Denied by RPC and same-org constraint |
| Invitee accepts while organization is pending/rejected/suspended | Denied; no active membership |
| Wrong email accepts or declines an invitation | Denied; invitation unchanged |
| Expired invite is responded to by its intended recipient | Returns `expired`; status and audit event persist |
| Expired pending invite is replaced | Old row becomes expired; new pending row succeeds |
| Invitation accept races with join request for same org/user | At most one membership row; no partial invitation acceptance |
| Invitation accepted after recipient already became active | Rejected; existing membership role remains unchanged |
| Invitation role uses system Owner wildcard | Denied |
| Combined status, role, and position update | Each changed field family receives an event |
| Ownership transfer | Exactly one active Owner remains; one ownership event is recorded |
| Sole Owner leaves/is removed | Denied |
| Direct table writes to roles, memberships, invitations, or activity logs | Permission denied |
| User updates another user's notification or protected profile fields | Denied by grants and RLS |
| Public/anon/authenticated TRUNCATE on application tables | Denied |

## 7. Local validation and remaining production-only checks

For this review, `npm run build` passed (`tsc --noEmit` and Vite build); Vite
reported the generated JavaScript bundle exceeds 500 kB. `git diff --check`
passed. A local scan found no PL/pgSQL/DO `END` terminators missing their inner
semicolon, and the duplicate `set_org_member_position(uuid, text)` bodies in
0002 and 0004 compare identical. These checks do not substitute for PostgreSQL
parsing. No SQL migration was executed, no SQL was run against production, and
no two-account or database behavior test was executed.

Before any production migration:

1. Re-run the read-only migration-history and schema preflight.
2. Verify the exact owner, `search_path`, overloads, and effective/explicit
   EXECUTE ACLs for every function above.
3. Verify table and column privileges together, including PUBLIC/anon and
   TRUNCATE.
4. Compare all RLS policy definitions, constraints, indexes, triggers, and
   existing data with this document.
5. Reconcile any partial 0002/0003/0004 state with a reviewed forward-only plan;
   do not rerun a migration blindly.
6. Pass the behavioral matrix and two-account end-to-end plan on a controlled
   database before any production decision.

Until those checks pass, LEADLINK is **NOT READY** for production migration or
production use.
