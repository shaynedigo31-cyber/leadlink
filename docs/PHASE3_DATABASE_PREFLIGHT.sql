-- LEADLINK Phase 3.1 read-only database preflight.
-- Run in the SQL Editor for the intended Supabase project, using a role that
-- can read PostgreSQL catalogs. Run section 1 before section 2; section 2
-- assumes supabase_migrations.schema_migrations exists.
-- Every statement in this file is a SELECT. Nothing here applies a migration
-- or changes database state.

-- 1. Migration-history relation
-- Healthy: identifies whether the conventional Supabase CLI history relation
-- exists. A missing relation means history is NOT CHECKED, not that migrations
-- were not run (especially if SQL Editor was used).
select to_regclass('supabase_migrations.schema_migrations') as migration_history_relation;

-- 2. Migration history (run only if section 1 returned a relation)
-- Prerequisite: section 1 must return a relation and the current role must be
-- able to read it. Otherwise skip and record NOT CHECKED. For CLI-managed
-- migrations, inspect the complete history, with
-- repository prefix/name pairs 0001/foundation and 0002/phase3_organization_security
-- represented as appropriate. Absence does not prove a SQL-Editor migration
-- was not run. Review every row for unexpected versions or naming.
select
  to_jsonb(m) ->> 'version' as version,
  to_jsonb(m) ->> 'name' as name
from supabase_migrations.schema_migrations as m
order by version, name;

-- 2a. Exact history matches for the repository migration filenames
-- Run only when section 1 found the history relation and section 2 was readable.
-- Healthy: one matching 0001/foundation row if 0001 was CLI-recorded. A
-- 0002/phase3_organization_security row means CLI history records 0002. Also
-- review the complete history above: a matching version with a different name
-- or multiple versions/names is an inconsistency. This cannot detect scripts
-- pasted into SQL Editor without migration-history bookkeeping.
select
  exists (
    select 1
    from supabase_migrations.schema_migrations as m
    where to_jsonb(m) ->> 'version' = '0001'
      and to_jsonb(m) ->> 'name' = 'foundation'
  ) as exact_0001_foundation_recorded,
  exists (
    select 1
    from supabase_migrations.schema_migrations as m
    where to_jsonb(m) ->> 'version' = '0001'
  ) as any_0001_version_recorded,
  exists (
    select 1
    from supabase_migrations.schema_migrations as m
    where to_jsonb(m) ->> 'version' = '0002'
      and to_jsonb(m) ->> 'name' = 'phase3_organization_security'
  ) as exact_0002_phase3_recorded,
  exists (
    select 1
    from supabase_migrations.schema_migrations as m
    where to_jsonb(m) ->> 'version' = '0002'
  ) as any_0002_version_recorded;

-- 3. Migration-history columns
-- If section 1 found no relation, skip and record NOT CHECKED; an empty result
-- or no visible columns despite a relation is NOT CHECKED, not evidence that
-- migrations were not run.
-- Healthy: exposes the actual history-table structure and avoids assuming
-- that a filename is stored verbatim as the migration version.
select column_name, data_type, udt_name, is_nullable
from information_schema.columns
where table_schema = 'supabase_migrations'
  and table_name = 'schema_migrations'
order by ordinal_position;

-- 4. Expected application columns
-- Source: 0001_foundation.sql. MATCH requires exact type, nullability, and
-- deparsed default agreement. MISSING TABLE/COLUMN and MISMATCH are explicit.
-- Built-in types are expected in pg_catalog; arrays report data_type=ARRAY and
-- their built-in element type name in udt_name. Information-schema visibility
-- depends on the inspecting role.
with expected(
  table_name,
  column_name,
  expected_data_type,
  expected_udt_schema,
  expected_udt_name,
  expected_nullable,
  expected_default
) as (
  values
    ('profiles', 'id', 'uuid', 'pg_catalog', 'uuid', 'NO', null::text),
    ('profiles', 'full_name', 'text', 'pg_catalog', 'text', 'NO', '''''::text'),
    ('profiles', 'avatar_url', 'text', 'pg_catalog', 'text', 'YES', null::text),
    ('profiles', 'is_platform_admin', 'boolean', 'pg_catalog', 'bool', 'NO', 'false'),
    ('profiles', 'created_at', 'timestamp with time zone', 'pg_catalog', 'timestamptz', 'NO', 'now()'),
    ('profiles', 'updated_at', 'timestamp with time zone', 'pg_catalog', 'timestamptz', 'NO', 'now()'),
    ('organizations', 'id', 'uuid', 'pg_catalog', 'uuid', 'NO', 'gen_random_uuid()'),
    ('organizations', 'name', 'text', 'pg_catalog', 'text', 'NO', null::text),
    ('organizations', 'slug', 'text', 'pg_catalog', 'text', 'NO', null::text),
    ('organizations', 'description', 'text', 'pg_catalog', 'text', 'YES', null::text),
    ('organizations', 'status', 'text', 'pg_catalog', 'text', 'NO', '''pending''::text'),
    ('organizations', 'created_by', 'uuid', 'pg_catalog', 'uuid', 'NO', null::text),
    ('organizations', 'created_at', 'timestamp with time zone', 'pg_catalog', 'timestamptz', 'NO', 'now()'),
    ('organizations', 'updated_at', 'timestamp with time zone', 'pg_catalog', 'timestamptz', 'NO', 'now()'),
    ('org_roles', 'id', 'uuid', 'pg_catalog', 'uuid', 'NO', 'gen_random_uuid()'),
    ('org_roles', 'org_id', 'uuid', 'pg_catalog', 'uuid', 'NO', null::text),
    ('org_roles', 'name', 'text', 'pg_catalog', 'text', 'NO', null::text),
    ('org_roles', 'permissions', 'ARRAY', 'pg_catalog', '_text', 'NO', '''{}''::text[]'),
    ('org_roles', 'is_system', 'boolean', 'pg_catalog', 'bool', 'NO', 'false'),
    ('org_roles', 'created_at', 'timestamp with time zone', 'pg_catalog', 'timestamptz', 'NO', 'now()'),
    ('organization_members', 'id', 'uuid', 'pg_catalog', 'uuid', 'NO', 'gen_random_uuid()'),
    ('organization_members', 'org_id', 'uuid', 'pg_catalog', 'uuid', 'NO', null::text),
    ('organization_members', 'user_id', 'uuid', 'pg_catalog', 'uuid', 'NO', null::text),
    ('organization_members', 'role_id', 'uuid', 'pg_catalog', 'uuid', 'YES', null::text),
    ('organization_members', 'position_title', 'text', 'pg_catalog', 'text', 'YES', null::text),
    ('organization_members', 'status', 'text', 'pg_catalog', 'text', 'NO', '''pending''::text'),
    ('organization_members', 'joined_at', 'timestamp with time zone', 'pg_catalog', 'timestamptz', 'YES', null::text),
    ('organization_members', 'created_at', 'timestamp with time zone', 'pg_catalog', 'timestamptz', 'NO', 'now()')
)
select
  e.table_name,
  e.column_name,
  e.expected_data_type,
  e.expected_udt_schema,
  e.expected_udt_name,
  e.expected_nullable,
  e.expected_default,
  c.data_type as actual_data_type,
  c.udt_schema as actual_udt_schema,
  c.udt_name as actual_udt,
  c.is_nullable,
  c.column_default,
  case when t.oid is not null then 'YES' else 'NO' end as table_exists,
  case
    when t.oid is null then 'MISSING TABLE'
    when c.column_name is null then 'MISSING COLUMN OR NOT VISIBLE'
    when c.data_type is distinct from e.expected_data_type
      or c.udt_schema is distinct from e.expected_udt_schema
      or c.udt_name is distinct from e.expected_udt_name
      or c.is_nullable is distinct from e.expected_nullable
      or c.column_default is distinct from e.expected_default
      then 'MISMATCH'
    else 'MATCH'
  end as result
from expected as e
left join pg_class as t
  on t.relnamespace = (select oid from pg_namespace where nspname = 'public')
 and t.relname = e.table_name
 and t.relkind in ('r', 'p')
left join information_schema.columns as c
  on c.table_schema = 'public'
 and c.table_name = e.table_name
 and c.column_name = e.column_name
order by e.table_name, e.column_name;

-- 5. Constraints and validation state
-- Expected names/types derive only from 0001_foundation.sql. Definitions are
-- shown side-by-side for review because PostgreSQL deparses CHECK expressions.
-- NOT CHECKED means the table is absent; empty results are never a pass.
with expected(table_name, constraint_name, expected_type, source_definition) as (
  values
    ('profiles', 'profiles_pkey', 'p', 'PRIMARY KEY (id)'),
    ('profiles', 'profiles_id_fkey', 'f', 'id REFERENCES auth.users(id) ON DELETE CASCADE'),
    ('organizations', 'organizations_pkey', 'p', 'PRIMARY KEY (id)'),
    ('organizations', 'organizations_name_check', 'c', 'char_length(name) between 2 and 120'),
    ('organizations', 'organizations_slug_key', 'u', 'UNIQUE (slug)'),
    ('organizations', 'organizations_slug_check', 'c', 'slug matches the foundation slug pattern'),
    ('organizations', 'organizations_status_check', 'c', 'status in pending, approved, rejected, suspended'),
    ('organizations', 'organizations_created_by_fkey', 'f', 'created_by REFERENCES public.profiles(id)'),
    ('org_roles', 'org_roles_pkey', 'p', 'PRIMARY KEY (id)'),
    ('org_roles', 'org_roles_org_id_fkey', 'f', 'org_id REFERENCES public.organizations(id) ON DELETE CASCADE'),
    ('org_roles', 'org_roles_org_id_name_key', 'u', 'UNIQUE (org_id, name)'),
    ('organization_members', 'organization_members_pkey', 'p', 'PRIMARY KEY (id)'),
    ('organization_members', 'organization_members_org_id_fkey', 'f', 'org_id REFERENCES public.organizations(id) ON DELETE CASCADE'),
    ('organization_members', 'organization_members_user_id_fkey', 'f', 'user_id REFERENCES public.profiles(id) ON DELETE CASCADE'),
    ('organization_members', 'organization_members_role_id_fkey', 'f', 'role_id REFERENCES public.org_roles(id)'),
    ('organization_members', 'organization_members_status_check', 'c', 'status in pending, active, removed'),
    ('organization_members', 'organization_members_org_id_user_id_key', 'u', 'UNIQUE (org_id, user_id)')
),
actual as (
  select
    c.relname as table_name,
    con.conname as constraint_name,
    con.contype::text as constraint_type,
    con.convalidated as is_validated,
    pg_get_constraintdef(con.oid, true) as actual_definition
  from pg_constraint as con
  join pg_class as c on c.oid = con.conrelid
  join pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles', 'organizations', 'org_roles', 'organization_members')
),
all_constraints as (
  select
    coalesce(e.table_name, a.table_name) as table_name,
    coalesce(e.constraint_name, a.constraint_name) as constraint_name,
    e.expected_type,
    e.source_definition,
    a.constraint_type,
    a.is_validated,
    a.actual_definition,
    e.constraint_name is not null as expected,
    a.constraint_name is not null as present
  from expected as e
  full join actual as a using (table_name, constraint_name)
),
table_presence as (
  select
    t.relname as table_name,
    true as present
  from pg_class as t
  join pg_namespace as n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relkind in ('r', 'p')
    and t.relname in ('profiles', 'organizations', 'org_roles', 'organization_members')
)
select
  x.table_name,
  x.constraint_name,
  x.expected_type,
  x.source_definition,
  x.constraint_type as actual_type,
  x.is_validated,
  x.actual_definition,
  case
    when tp.table_name is null then 'NOT CHECKED - MISSING TABLE'
    when not x.expected then 'UNEXPECTED CONSTRAINT - REVIEW'
    when not x.present then 'MISSING EXPECTED CONSTRAINT'
    when x.constraint_type is distinct from x.expected_type then 'TYPE MISMATCH'
    when x.is_validated is distinct from true then 'NOT VALIDATED'
    else 'PRESENT - VERIFY DEFINITION'
  end as result
from all_constraints as x
left join table_presence as tp using (table_name)
order by x.table_name, x.constraint_name;

-- 6. Relevant indexes
-- Expected indexes are those created by foundation primary/unique constraints
-- and the three explicit CREATE INDEX statements. Do not infer extra required
-- indexes. Missing tables/indexes and invalid/not-ready indexes are explicit.
with expected(table_name, index_name) as (
  values
    ('profiles', 'profiles_pkey'),
    ('organizations', 'organizations_pkey'),
    ('organizations', 'organizations_slug_key'),
    ('org_roles', 'org_roles_pkey'),
    ('org_roles', 'org_roles_org_id_name_key'),
    ('org_roles', 'org_roles_org_idx'),
    ('organization_members', 'organization_members_pkey'),
    ('organization_members', 'organization_members_org_id_user_id_key'),
    ('organization_members', 'organization_members_user_idx'),
    ('organization_members', 'organization_members_org_idx')
),
actual as (
  select
    t.relname as table_name,
    i.relname as index_name,
    ix.indisprimary as is_primary,
    ix.indisunique as is_unique,
    ix.indisvalid as is_valid,
    ix.indisready as is_ready,
    pg_get_indexdef(i.oid) as definition
  from pg_index as ix
  join pg_class as t on t.oid = ix.indrelid
  join pg_class as i on i.oid = ix.indexrelid
  join pg_namespace as n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relname in ('profiles', 'organizations', 'org_roles', 'organization_members')
),
all_indexes as (
  select
    coalesce(e.table_name, a.table_name) as table_name,
    coalesce(e.index_name, a.index_name) as index_name,
    e.index_name is not null as expected,
    a.index_name is not null as present,
    a.is_primary,
    a.is_unique,
    a.is_valid,
    a.is_ready,
    a.definition
  from expected as e
  full join actual as a using (table_name, index_name)
),
table_presence as (
  select
    t.relname as table_name
  from pg_class as t
  join pg_namespace as n on n.oid = t.relnamespace
  where n.nspname = 'public'
    and t.relkind in ('r', 'p')
    and t.relname in ('profiles', 'organizations', 'org_roles', 'organization_members')
)
select
  x.table_name,
  x.index_name,
  x.expected,
  x.is_primary,
  x.is_unique,
  x.is_valid,
  x.is_ready,
  x.definition,
  case
    when tp.table_name is null then 'NOT CHECKED - MISSING TABLE'
    when not x.expected then 'UNEXPECTED INDEX - REVIEW'
    when not x.present then 'MISSING EXPECTED INDEX'
    when x.is_valid is distinct from true or x.is_ready is distinct from true
      then 'INVALID OR NOT READY'
    else 'PRESENT'
  end as result
from all_indexes as x
left join table_presence as tp using (table_name)
order by x.table_name, x.index_name;

-- 7. RLS state and table owners
-- Expected foundation tables always produce rows, including missing-table
-- findings. Additional RLS-enabled public tables are listed for review.
with expected(table_name) as (
  values
    ('profiles'),
    ('organizations'),
    ('org_roles'),
    ('organization_members')
),
actual as (
  select
    c.relname as table_name,
    pg_get_userbyid(c.relowner) as table_owner,
    c.relrowsecurity as rls_enabled,
    c.relforcerowsecurity as rls_forced
  from pg_class as c
  join pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (
      c.relname in ('profiles', 'organizations', 'org_roles', 'organization_members')
      or c.relrowsecurity
    )
)
select
  coalesce(e.table_name, a.table_name) as table_name,
  a.table_owner,
  a.rls_enabled,
  a.rls_forced,
  case
    when e.table_name is not null and a.table_name is null then 'MISSING FOUNDATION TABLE'
    when e.table_name is null then 'ADDITIONAL RLS TABLE - REVIEW'
    when a.rls_enabled is distinct from true then 'RLS NOT ENABLED'
    when a.rls_forced then 'RLS FORCED - REVIEW AGAINST EXPECTED STATE'
    else 'PRESENT - RLS ENABLED'
  end as result
from expected as e
full join actual as a using (table_name)
order by table_name;

-- 8. RLS policies and OR-combination review
-- Expected policy presence is shown for both source states: foundation-only
-- and after 0002. Missing tables/policies and unexpected policies are explicit.
-- Compare actual expressions with the migration source. PERMISSIVE policies
-- for a command combine with OR.
with expected(tablename, policyname, in_0001, in_0002) as (
  values
    ('profiles', 'profiles: read own, co-members, or admin', true, true),
    ('profiles', 'profiles: update own', true, true),
    ('organizations', 'organizations: approved are discoverable', true, true),
    ('organizations', 'organizations: members, creator and admins can read', true, true),
    ('organizations', 'organizations: managers update details', true, true),
    ('org_roles', 'org_roles: members read', true, true),
    ('org_roles', 'org_roles: managers create custom roles', true, false),
    ('org_roles', 'org_roles: managers edit custom roles', true, false),
    ('org_roles', 'org_roles: managers delete custom roles', true, false),
    ('organization_members', 'members: read own row, org members, managers, admins', true, true),
    ('organization_members', 'members: request to join an approved org', true, false),
    ('organization_members', 'members: managers update members', true, false),
    ('organization_members', 'members: managers remove, people cancel own pending request', true, false)
),
actual as (
  select
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_expression,
    with_check
  from pg_policies
  where schemaname = 'public'
    and tablename in ('profiles', 'organizations', 'org_roles', 'organization_members')
),
all_policies as (
  select
    coalesce(e.tablename, a.tablename) as tablename,
    coalesce(e.policyname, a.policyname) as policyname,
    e.in_0001,
    e.in_0002,
    a.permissive,
    a.roles,
    a.cmd,
    a.using_expression,
    a.with_check,
    e.policyname is not null as expected,
    a.policyname is not null as present
  from expected as e
  full join actual as a using (tablename, policyname)
),
table_presence as (
  select c.relname as tablename
  from pg_class as c
  join pg_namespace as n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relname in ('profiles', 'organizations', 'org_roles', 'organization_members')
)
select
  p.tablename,
  p.policyname,
  p.in_0001 as expected_in_foundation,
  p.in_0002 as expected_after_0002,
  p.permissive,
  p.roles,
  p.cmd,
  p.using_expression,
  p.with_check,
  case
    when tp.tablename is null then 'NOT CHECKED - MISSING TABLE'
    when not p.expected then 'UNEXPECTED POLICY - REVIEW'
    when not p.present then 'MISSING POLICY - COMPARE WITH MIGRATION STATE'
    else 'PRESENT - COMPARE EXPRESSIONS'
  end as result
from all_policies as p
left join table_presence as tp using (tablename)
order by p.tablename, p.policyname;

-- 9. Relevant function signatures, owners, security settings, and effective
-- EXECUTE privileges
-- Healthy: all expected signatures are present. SECURITY DEFINER functions
-- have a trusted owner and an empty search_path (shown in function_config).
-- Client-callable RPCs are executable by authenticated only; is_org_owner is
-- not executable by authenticated, anon, or PUBLIC.
with expected(function_name, argument_types) as (
  values
    ('set_updated_at', ''),
    ('handle_new_user', ''),
    ('is_platform_admin', ''),
    ('is_org_member', 'uuid'),
    ('has_org_permission', 'uuid, text'),
    ('shares_org_with', 'uuid'),
    ('create_organization', 'text, text, text'),
    ('set_organization_status', 'uuid, text'),
    ('is_org_owner', 'uuid'),
    ('request_to_join_organization', 'uuid'),
    ('create_org_role', 'uuid, text, text[]'),
    ('update_org_role', 'uuid, text, text[]'),
    ('delete_org_role', 'uuid'),
    ('approve_membership_request', 'uuid, uuid'),
    ('reject_membership_request', 'uuid'),
    ('assign_org_member_role', 'uuid, uuid'),
    ('remove_org_member', 'uuid'),
    ('leave_organization', 'uuid'),
    ('cancel_membership_request', 'uuid'),
    ('transfer_organization_ownership', 'uuid, uuid')
)
select
  e.function_name as expected_function,
  e.argument_types as expected_argument_types,
  p.oid::regprocedure as actual_signature,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  case when p.oid is null then 'MISSING' else 'PRESENT' end as result,
  (anon_role.oid is not null) as anon_role_exists,
  (authenticated_role.oid is not null) as authenticated_role_exists,
  case
    when p.oid is not null and anon_role.oid is not null
      then has_function_privilege(anon_role.oid, p.oid, 'EXECUTE')
  end as anon_can_execute,
  case
    when p.oid is not null and authenticated_role.oid is not null
      then has_function_privilege(authenticated_role.oid, p.oid, 'EXECUTE')
  end as authenticated_can_execute
from expected as e
left join pg_proc as p
  on p.proname = e.function_name
 and p.prokind = 'f'
 and oidvectortypes(p.proargtypes) = e.argument_types
 and exists (
   select 1
   from pg_namespace as function_schema
   where function_schema.oid = p.pronamespace
     and function_schema.nspname = 'public'
 )
left join pg_roles as anon_role on anon_role.rolname = 'anon'
left join pg_roles as authenticated_role on authenticated_role.rolname = 'authenticated'
order by e.function_name;

-- 10. Explicit function ACL entries, including PUBLIC
-- One row per expected function distinguishes MISSING FUNCTION from an ACL
-- mismatch. Effective anon/authenticated checks include inherited grants;
-- explicit ACL text includes PUBLIC. NOT CHECKED means a required role is absent.
with expected(function_name, argument_types, authenticated_expected) as (
  values
    ('set_updated_at', '', false),
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
    ('remove_org_member', 'uuid', true),
    ('leave_organization', 'uuid', true),
    ('cancel_membership_request', 'uuid', true),
    ('transfer_organization_ownership', 'uuid, uuid', true)
),
function_acl as (
  select
    p.oid,
    bool_or(acl.grantee = 0 and acl.privilege_type = 'EXECUTE') as public_execute_acl,
    string_agg(
      case
        when acl.grantee = 0 then 'PUBLIC'
        else coalesce(grantee_role.rolname, acl.grantee::text)
      end || ':' || acl.privilege_type
        || case when acl.is_grantable then ' (grantable)' else '' end,
      ', ' order by acl.grantee, acl.privilege_type
    ) as explicit_acl_entries
  from pg_proc as p
  join pg_namespace as n on n.oid = p.pronamespace
  cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as acl
  left join pg_roles as grantee_role on grantee_role.oid = acl.grantee
  where n.nspname = 'public'
  group by p.oid
)
select
  e.function_name as expected_function,
  e.argument_types as expected_argument_types,
  p.oid::regprocedure as actual_signature,
  e.authenticated_expected,
  acl.explicit_acl_entries,
  coalesce(acl.public_execute_acl, false) as public_execute_acl,
  (anon_role.oid is not null) as anon_role_exists,
  (authenticated_role.oid is not null) as authenticated_role_exists,
  case when p.oid is not null and anon_role.oid is not null
    then has_function_privilege(anon_role.oid, p.oid, 'EXECUTE') end as anon_can_execute,
  case when p.oid is not null and authenticated_role.oid is not null
    then has_function_privilege(authenticated_role.oid, p.oid, 'EXECUTE') end as authenticated_can_execute,
  case
    when p.oid is null then 'MISSING FUNCTION'
    when anon_role.oid is null or authenticated_role.oid is null then 'NOT CHECKED - MISSING ROLE'
    when coalesce(acl.public_execute_acl, false)
      or has_function_privilege(anon_role.oid, p.oid, 'EXECUTE')
      then 'UNEXPECTED PUBLIC/ANON EXECUTE'
    when has_function_privilege(authenticated_role.oid, p.oid, 'EXECUTE')
      is distinct from e.authenticated_expected
      then 'AUTHENTICATED EXECUTE MISMATCH'
    else 'PRIVILEGES MATCH'
  end as result
from expected as e
left join pg_proc as p
  on p.proname = e.function_name
 and p.prokind = 'f'
 and oidvectortypes(p.proargtypes) = e.argument_types
 and exists (
   select 1
   from pg_namespace as function_schema
   where function_schema.oid = p.pronamespace
     and function_schema.nspname = 'public'
 )
left join function_acl as acl on acl.oid = p.oid
left join pg_roles as anon_role on anon_role.rolname = 'anon'
left join pg_roles as authenticated_role on authenticated_role.rolname = 'authenticated'
order by e.function_name;

-- 11. Full definitions of relevant functions
-- Prerequisite: use section 9 to identify missing functions. Missing functions
-- are omitted here, so an empty result is NOT a pass.
-- Healthy: compare each definition with 0001 and 0002. Every SECURITY DEFINER
-- body should validate auth.uid() and caller authority as appropriate, and
-- use schema-qualified object references with a safe search_path.
select
  p.oid::regprocedure as function_signature,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_updated_at', 'handle_new_user', 'is_platform_admin', 'is_org_member',
    'has_org_permission', 'shares_org_with', 'create_organization',
    'set_organization_status', 'is_org_owner', 'request_to_join_organization',
    'create_org_role', 'update_org_role', 'delete_org_role',
    'approve_membership_request', 'reject_membership_request',
    'assign_org_member_role', 'remove_org_member', 'leave_organization',
    'cancel_membership_request', 'transfer_organization_ownership'
  )
order by p.proname, p.oid::regprocedure::text;

-- 12. Function-owner role attributes
-- Prerequisite: compare with section 9; missing functions are omitted here.
-- Healthy: SECURITY DEFINER owners are trusted database roles, not anon or
-- authenticated. Review superuser/BYPASSRLS attributes and ensure the owner
-- is the intended migration execution role.
select
  p.oid::regprocedure as function_signature,
  owner_role.rolname as function_owner,
  owner_role.rolsuper as owner_is_superuser,
  owner_role.rolbypassrls as owner_bypasses_rls,
  owner_role.rolcanlogin as owner_can_login,
  p.prosecdef as security_definer,
  p.proconfig as function_config
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
join pg_roles as owner_role on owner_role.oid = p.proowner
where n.nspname = 'public'
  and p.proname in (
    'handle_new_user', 'is_platform_admin', 'is_org_member',
    'has_org_permission', 'shares_org_with', 'create_organization',
    'set_organization_status', 'is_org_owner', 'request_to_join_organization',
    'create_org_role', 'update_org_role', 'delete_org_role',
    'approve_membership_request', 'reject_membership_request',
    'assign_org_member_role', 'remove_org_member', 'leave_organization',
    'cancel_membership_request', 'transfer_organization_ownership'
  )
order by p.proname;

-- 13. Any additional SECURITY DEFINER functions in public
-- Healthy: no unexpected privileged function exists. Review every row's
-- definition, owner, search_path, and ACL before proceeding. An empty result
-- is not a pass unless section 9 confirms expected functions exist.
with expected(function_name, argument_types) as (
  values
    ('handle_new_user', ''),
    ('is_platform_admin', ''),
    ('is_org_member', 'uuid'),
    ('has_org_permission', 'uuid, text'),
    ('shares_org_with', 'uuid'),
    ('create_organization', 'text, text, text'),
    ('set_organization_status', 'uuid, text'),
    ('is_org_owner', 'uuid'),
    ('request_to_join_organization', 'uuid'),
    ('create_org_role', 'uuid, text, text[]'),
    ('update_org_role', 'uuid, text, text[]'),
    ('delete_org_role', 'uuid'),
    ('approve_membership_request', 'uuid, uuid'),
    ('reject_membership_request', 'uuid'),
    ('assign_org_member_role', 'uuid, uuid'),
    ('remove_org_member', 'uuid'),
    ('leave_organization', 'uuid'),
    ('cancel_membership_request', 'uuid'),
    ('transfer_organization_ownership', 'uuid, uuid')
)
select
  p.oid::regprocedure as function_signature,
  pg_get_userbyid(p.proowner) as function_owner,
  p.prosecdef as security_definer,
  p.proconfig as function_config,
  (anon_role.oid is not null) as anon_role_exists,
  (authenticated_role.oid is not null) as authenticated_role_exists,
  case
    when anon_role.oid is null or authenticated_role.oid is null
      then 'NOT CHECKED - MISSING ROLE'
    else 'REVIEW REQUIRED - inspect function definition, owner, search_path, and ACL'
  end as review_status,
  case when anon_role.oid is not null
    then has_function_privilege(anon_role.oid, p.oid, 'EXECUTE') end as anon_can_execute,
  case when authenticated_role.oid is not null
    then has_function_privilege(authenticated_role.oid, p.oid, 'EXECUTE') end as authenticated_can_execute,
  (
    select string_agg(
      case when acl.grantee = 0 then 'PUBLIC'
           else coalesce(grantee_role.rolname, acl.grantee::text)
      end || ':' || acl.privilege_type
        || case when acl.is_grantable then ' (grantable)' else '' end,
      ', ' order by acl.grantee, acl.privilege_type
    )
    from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as acl
    left join pg_roles as grantee_role on grantee_role.oid = acl.grantee
  ) as explicit_acl_entries,
  pg_get_functiondef(p.oid) as function_definition
from pg_proc as p
join pg_namespace as n on n.oid = p.pronamespace
left join pg_roles as anon_role on anon_role.rolname = 'anon'
left join pg_roles as authenticated_role on authenticated_role.rolname = 'authenticated'
where n.nspname = 'public'
  and p.prosecdef
  and not exists (
    select 1
    from expected as e
    where e.function_name = p.proname
      and e.argument_types = oidvectortypes(p.proargtypes)
  )
order by p.proname, p.oid::regprocedure::text;

-- 14. Foundation triggers
-- Expected triggers derive from 0001_foundation.sql; 0002 adds none. Missing
-- target tables are NOT CHECKED. Unexpected user triggers are listed for review.
with expected(schema_name, table_name, trigger_name, function_name) as (
  values
    ('public', 'profiles', 'profiles_updated', 'public.set_updated_at()'),
    ('public', 'organizations', 'organizations_updated', 'public.set_updated_at()'),
    ('auth', 'users', 'on_auth_user_created', 'public.handle_new_user()')
),
actual as (
  select
    n.nspname as schema_name,
    c.relname as table_name,
    t.tgname as trigger_name,
    function_schema.nspname || '.' || p.proname
      || '(' || oidvectortypes(p.proargtypes) || ')' as function_name,
    t.tgenabled as enabled_state,
    pg_get_triggerdef(t.oid, true) as definition,
    pg_get_userbyid(p.proowner) as function_owner,
    p.prosecdef as function_security_definer,
    p.proconfig as function_config
  from pg_trigger as t
  join pg_class as c on c.oid = t.tgrelid
  join pg_namespace as n on n.oid = c.relnamespace
  join pg_proc as p on p.oid = t.tgfoid
  join pg_namespace as function_schema on function_schema.oid = p.pronamespace
  where not t.tgisinternal
    and ((n.nspname = 'public' and c.relname in ('profiles', 'organizations'))
      or (n.nspname = 'auth' and c.relname = 'users'))
),
all_triggers as (
  select
    coalesce(e.schema_name, a.schema_name) as schema_name,
    coalesce(e.table_name, a.table_name) as table_name,
    coalesce(e.trigger_name, a.trigger_name) as trigger_name,
    e.function_name as expected_function,
    a.function_name as actual_function,
    a.enabled_state,
    a.definition,
    a.function_owner,
    a.function_security_definer,
    a.function_config,
    e.trigger_name is not null as expected,
    a.trigger_name is not null as present
  from expected as e
  full join actual as a using (schema_name, table_name, trigger_name)
),
target_presence as (
  select n.nspname as schema_name, c.relname as table_name
  from pg_class as c
  join pg_namespace as n on n.oid = c.relnamespace
  where (n.nspname = 'public' and c.relname in ('profiles', 'organizations'))
     or (n.nspname = 'auth' and c.relname = 'users')
)
select
  t.schema_name,
  t.table_name,
  t.trigger_name,
  t.expected_function,
  t.actual_function,
  t.enabled_state,
  t.definition,
  t.function_owner,
  t.function_security_definer,
  t.function_config,
  case
    when tp.table_name is null then 'NOT CHECKED - MISSING TABLE'
    when not t.expected then 'UNEXPECTED TRIGGER - REVIEW'
    when not t.present then 'MISSING EXPECTED TRIGGER'
    when t.actual_function is distinct from t.expected_function then 'FUNCTION MISMATCH'
    when t.enabled_state is distinct from 'O' then 'TRIGGER ENABLEMENT MISMATCH'
    else 'PRESENT - VERIFY DEFINITION'
  end as result
from all_triggers as t
left join target_presence as tp using (schema_name, table_name)
order by t.schema_name, t.table_name, t.trigger_name;

-- 15. Effective table privileges for client roles
-- Healthy before 0002: compare with the baseline grants in 0001. After 0002,
-- authenticated cannot directly modify organization_members or org_roles.
-- TRUNCATE is separate from DELETE and is not protected by RLS. Any effective
-- TRUNCATE privilege for anon/authenticated on an application table is a
-- deployment blocker; inspect explicit grants and inherited roles in section
-- Do not revoke anything based on this report alone. Missing roles/tables
-- produce NOT CHECKED. The foundation grants no TRUNCATE to these roles; this
-- check does not imply that the live database is vulnerable.
select
  requested.role_name,
  requested.table_name,
  role_row.oid is not null as role_exists,
  relation.oid is not null as table_exists,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'SELECT') end as can_select,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'INSERT') end as can_insert,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'UPDATE') end as can_update,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'DELETE') end as can_delete,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'TRUNCATE') end as can_truncate,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'REFERENCES') end as can_reference,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'TRIGGER') end as can_create_trigger,
  case when role_row.oid is null or relation.oid is null
    then 'NOT CHECKED - MISSING ROLE OR TABLE' else 'CHECKED' end as result,
  case
    when role_row.oid is null or relation.oid is null
      then 'NOT CHECKED - MISSING ROLE OR TABLE'
    when has_table_privilege(role_row.oid, relation.oid, 'TRUNCATE')
      then 'DEPLOYMENT BLOCKER - EFFECTIVE TRUNCATE; NOT PROTECTED BY RLS'
    else 'NO EFFECTIVE TRUNCATE FOR THIS ROLE/TABLE'
  end as truncate_assessment
from (
  values
    ('anon', 'profiles'),
    ('anon', 'organizations'),
    ('anon', 'org_roles'),
    ('anon', 'organization_members'),
    ('authenticated', 'profiles'),
    ('authenticated', 'organizations'),
    ('authenticated', 'org_roles'),
    ('authenticated', 'organization_members')
) as requested(role_name, table_name)
left join pg_roles as role_row on role_row.rolname = requested.role_name
left join pg_class as relation
  on relation.relname = requested.table_name
 and relation.relnamespace = (select oid from pg_namespace where nspname = 'public')
 and relation.relkind in ('r', 'p')
order by requested.role_name, requested.table_name;

-- 16. Explicit table ACL entries, including PUBLIC
-- Healthy after 0002: authenticated has no direct INSERT/UPDATE/DELETE
-- grants on org_roles or organization_members. PUBLIC should have no
-- unintended application-table privileges. If this returns no rows, compare
-- with sections 4 and 15; absent tables are NOT CHECKED, not privilege-free.
-- TRUNCATE is separate from DELETE and bypasses RLS. PUBLIC/anon/authenticated
-- grants are deployment blockers; investigate other grantees and membership/
-- inheritance before deployment. Table-owner privileges are reported but are
-- not, by themselves, evidence of client access. Do not modify grants here.
select
  c.relname as table_name,
  case
    when acl.grantee = 0 then 'PUBLIC'
    else coalesce(grantee_role.rolname, acl.grantee::text)
  end as grantee,
  acl.privilege_type,
  acl.is_grantable,
  case
    when acl.privilege_type <> 'TRUNCATE' then 'NOT A TRUNCATE GRANT'
    when acl.grantee = 0
      or grantee_role.rolname in ('anon', 'authenticated')
      then 'DEPLOYMENT BLOCKER - TRUNCATE GRANTED TO PUBLIC/CLIENT ROLE'
    when acl.grantee = c.relowner
      then 'TABLE OWNER PRIVILEGE - VERIFY OWNER IS TRUSTED'
    else 'REVIEW REQUIRED - CHECK ROLE LOGIN/INHERITANCE; BLOCK IF UNTRUSTED'
  end as truncate_assessment
from pg_class as c
join pg_namespace as n on n.oid = c.relnamespace
cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) as acl
left join pg_roles as grantee_role on grantee_role.oid = acl.grantee
where n.nspname = 'public'
  and c.relkind in ('r', 'p')
  and c.relname in ('profiles', 'organizations', 'org_roles', 'organization_members')
order by c.relname, grantee, acl.privilege_type;

-- 17. Explicit column ACL entries
-- Lists every actual column in the four foundation tables, including explicit
-- PUBLIC grants. Table-level/inherited privileges are evaluated in section 18.
-- Missing tables are emitted as NOT CHECKED rows.
with expected_tables(table_name) as (
  values
    ('profiles'),
    ('organizations'),
    ('org_roles'),
    ('organization_members')
)
select
  e.table_name,
  a.attname as column_name,
  t.oid is not null as table_exists,
  a.attname is not null as column_exists,
  coalesce(acl.explicit_column_acl, 'NO EXPLICIT COLUMN ACL') as explicit_column_acl,
  case
    when t.oid is null then 'NOT CHECKED - MISSING TABLE'
    when a.attname is null then 'NOT CHECKED - NO VISIBLE COLUMNS'
    else 'CHECKED'
  end as result
from expected_tables as e
left join pg_namespace as n on n.nspname = 'public'
left join pg_class as t
  on t.relnamespace = n.oid
 and t.relname = e.table_name
 and t.relkind in ('r', 'p')
left join pg_attribute as a
  on a.attrelid = t.oid
 and a.attnum > 0
 and not a.attisdropped
left join lateral (
  select string_agg(
      case
        when acl.grantee = 0 then 'PUBLIC'
        else coalesce(grantee_role.rolname, acl.grantee::text)
      end || ':' || acl.privilege_type
        || case when acl.is_grantable then ' (grantable)' else '' end,
      ', ' order by acl.grantee, acl.privilege_type
    ) as explicit_column_acl
  from aclexplode(a.attacl) as acl
  left join pg_roles as grantee_role on grantee_role.oid = acl.grantee
) as acl on true
order by e.table_name, a.attnum;

-- 18. Effective column privileges
-- Checks every actual column on the four foundation tables for anon and
-- authenticated. Effective column checks include table-level and inherited
-- grants; table privileges and explicit ACLs are shown separately. Missing
-- roles/tables are NOT CHECKED rather than treated as denied.
select
  requested.role_name,
  requested.table_name,
  attribute.attname as column_name,
  role_row.oid is not null as role_exists,
  relation.oid is not null as table_exists,
  attribute.attname is not null as column_exists,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'SELECT') end as table_can_select,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'INSERT') end as table_can_insert,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'UPDATE') end as table_can_update,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'DELETE') end as table_can_delete,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'TRUNCATE') end as table_can_truncate,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'REFERENCES') end as table_can_reference,
  case when role_row.oid is not null and relation.oid is not null
    then has_table_privilege(role_row.oid, relation.oid, 'TRIGGER') end as table_can_create_trigger,
  case when role_row.oid is not null and relation.oid is not null and attribute.attname is not null
    then has_column_privilege(role_row.oid, relation.oid, attribute.attname, 'SELECT') end as column_can_select,
  case when role_row.oid is not null and relation.oid is not null and attribute.attname is not null
    then has_column_privilege(role_row.oid, relation.oid, attribute.attname, 'INSERT') end as column_can_insert,
  case when role_row.oid is not null and relation.oid is not null and attribute.attname is not null
    then has_column_privilege(role_row.oid, relation.oid, attribute.attname, 'UPDATE') end as column_can_update,
  case when role_row.oid is not null and relation.oid is not null and attribute.attname is not null
    then has_column_privilege(role_row.oid, relation.oid, attribute.attname, 'REFERENCES') end as column_can_reference,
  case
    when role_row.oid is null then 'NOT CHECKED - MISSING ROLE'
    when relation.oid is null then 'NOT CHECKED - MISSING TABLE'
    when attribute.attname is null then 'NOT CHECKED - MISSING COLUMN'
    else 'CHECKED'
  end as result
from (
  values
    ('anon', 'profiles'),
    ('anon', 'organizations'),
    ('anon', 'org_roles'),
    ('anon', 'organization_members'),
    ('authenticated', 'profiles'),
    ('authenticated', 'organizations'),
    ('authenticated', 'org_roles'),
    ('authenticated', 'organization_members')
) as requested(role_name, table_name)
left join pg_roles as role_row on role_row.rolname = requested.role_name
left join pg_class as relation
  on relation.relname = requested.table_name
 and relation.relnamespace = (select oid from pg_namespace where nspname = 'public')
 and relation.relkind in ('r', 'p')
left join pg_attribute as attribute
  on attribute.attrelid = relation.oid
 and attribute.attnum > 0
 and not attribute.attisdropped
order by requested.role_name, requested.table_name, attribute.attnum;

-- 19. Expected role invariants, one result row per organization
-- Prerequisites: first run Section 4. Execute only if every listed column is
-- MATCH and visible; otherwise skip and record NOT CHECKED. Zero output rows
-- must be checked against organization counts, not treated as healthy.
-- Required: public.organizations(id, name); public.org_roles(id, org_id, name,
-- permissions, is_system); public.organization_members(id, org_id, role_id,
-- status).
-- Healthy: exactly one system role named Owner with exactly ['*']; exactly one
-- system Administrator role with the three foundation permissions; and at
-- least one active membership using the expected Owner role. More than one
-- active Owner membership is reported for review but is not itself a duplicate
-- Owner-role definition.
select
  o.id as organization_id,
  o.name as organization_name,
  count(distinct r.id) filter (
    where r.is_system and r.name = 'Owner' and r.permissions = array['*']::text[]
  ) as expected_owner_role_count,
  count(distinct r.id) filter (
    where r.is_system and r.name = 'Owner'
  ) as system_roles_named_owner,
  count(distinct r.id) filter (
    where r.is_system and r.permissions @> array['*']::text[]
  ) as system_wildcard_role_count,
  count(distinct r.id) filter (
    where r.is_system and r.name = 'Administrator'
  ) as system_administrator_role_count,
  count(distinct r.id) filter (
    where r.is_system
      and r.name = 'Administrator'
      and cardinality(r.permissions) = 3
      and r.permissions @> array['org.manage','members.manage','roles.manage']::text[]
  ) as expected_administrator_role_count,
  count(distinct m.id) filter (
    where m.status = 'active'
      and r.is_system
      and r.name = 'Owner'
      and r.permissions = array['*']::text[]
  ) as active_members_on_expected_owner_role
from public.organizations as o
left join public.org_roles as r on r.org_id = o.id
left join public.organization_members as m
  on m.org_id = o.id and m.role_id = r.id
group by o.id, o.name
order by o.name, o.id;

-- 20. Roles with wildcard or baseline privileged permissions
-- These are REVIEW REQUIRED, not automatic violations: migration 0002 allows
-- an actual Owner to assign baseline privileged permissions to custom roles.
-- This query cannot establish historical Owner authorization. First run
-- Section 4; execute only if every listed column is MATCH and visible.
-- Otherwise skip and record NOT CHECKED.
-- Required: public.org_roles(org_id, id, name, is_system, permissions);
-- public.organizations(id, name).
select
  r.org_id,
  o.name as organization_name,
  r.id as role_id,
  r.name as role_name,
  r.is_system,
  r.permissions,
  'REVIEW REQUIRED - verify authorization and intended role scope' as classification,
  case
    when '*' = any(r.permissions) and not (r.is_system and r.name = 'Owner')
      then 'WILDCARD OUTSIDE SYSTEM OWNER'
    when r.permissions && array['org.manage','members.manage','roles.manage']::text[]
      and not (r.is_system and (r.name = 'Owner' or r.name = 'Administrator'))
      then 'CUSTOM/UNEXPECTED ROLE HAS BASELINE PRIVILEGE'
    else 'SYSTEM ROLE PERMISSIONS - COMPARE WITH FOUNDATION'
  end as reason
from public.org_roles as r
join public.organizations as o on o.id = r.org_id
where '*' = any(r.permissions)
   or r.permissions && array['org.manage','members.manage','roles.manage']::text[]
order by o.name, r.name, r.id;

-- 21. Role references that are missing or cross-organization
-- A non-null role_id should resolve to a role in the same org. First run
-- Section 4; execute only if every listed column is MATCH and visible.
-- Otherwise skip and record NOT CHECKED. No rows is meaningful only after
-- confirming all prerequisites.
-- Required: public.organization_members(id, org_id, user_id, role_id);
-- public.org_roles(id, org_id).
select
  m.id as membership_id,
  m.org_id as membership_org_id,
  m.role_id,
  r.org_id as role_org_id,
  case
    when r.id is null then 'MISSING ROLE'
    when r.org_id <> m.org_id then 'CROSS-ORGANIZATION ROLE'
  end as issue
from public.organization_members as m
left join public.org_roles as r on r.id = m.role_id
where m.role_id is not null
  and (r.id is null or r.org_id <> m.org_id)
order by m.org_id, m.user_id;

-- 22. Membership status/data shape
-- Findings are REVIEW REQUIRED, not confirmed violations. A retained role on
-- a removed row is only a review item. First run Section 4; execute only if
-- every listed column is MATCH and visible. Otherwise skip and record NOT CHECKED.
-- Required: public.organization_members(id, org_id, user_id, status, role_id,
-- joined_at); public.org_roles(name, is_system, permissions).
select
  m.id as membership_id,
  m.org_id,
  m.status,
  m.role_id,
  m.joined_at,
  'REVIEW REQUIRED - inspect row and migration history' as classification,
  case
    when m.status is null then 'NULL MEMBERSHIP STATUS'
    when m.status = 'pending' and (m.role_id is not null or m.joined_at is not null)
      then 'PENDING ROW HAS ROLE OR JOINED DATE'
    when m.status = 'active' and (m.role_id is null or m.joined_at is null)
      then 'ACTIVE ROW MISSING ROLE OR JOINED DATE'
    when m.status = 'active'
      and r.permissions @> array['*']::text[]
      and not r.is_system
      then 'ACTIVE MEMBER HAS NON-SYSTEM WILDCARD ROLE'
    when m.status = 'active'
      and r.is_system
      and r.permissions @> array['*']::text[]
      and r.name <> 'Owner'
      then 'ACTIVE MEMBER HAS UNEXPECTED SYSTEM WILDCARD ROLE'
    when m.status = 'active'
      and r.is_system
      and r.name = 'Owner'
      and r.permissions <> array['*']::text[]
      then 'SYSTEM OWNER ROLE HAS UNEXPECTED PERMISSIONS'
    when m.status = 'removed' and m.role_id is not null
      then 'REVIEW ITEM - REMOVED ROW RETAINS ROLE'
    when m.status not in ('pending', 'active', 'removed')
      then 'UNKNOWN STATUS'
  end as issue
from public.organization_members as m
left join public.org_roles as r on r.id = m.role_id
where
  (m.status = 'pending' and (m.role_id is not null or m.joined_at is not null))
  or (m.status = 'active' and (m.role_id is null or m.joined_at is null))
  or (
    m.status = 'active'
    and r.permissions @> array['*']::text[]
    and not r.is_system
  )
  or (
    m.status = 'active'
    and r.is_system
    and r.permissions @> array['*']::text[]
    and r.name <> 'Owner'
  )
  or (
    m.status = 'active'
    and r.is_system
    and r.name = 'Owner'
    and r.permissions <> array['*']::text[]
  )
  or (m.status = 'removed' and m.role_id is not null)
  or m.status is null
  or m.status not in ('pending', 'active', 'removed')
order by m.org_id, m.status, m.user_id;

-- 23. Organization status data
-- First run Section 4; execute only if public.organizations.status is MATCH and
-- visible. Otherwise skip and record NOT CHECKED. If there are no organizations,
-- an empty result is not an invariant pass.
-- Required: public.organizations(status).
select status, count(*) as organization_count
from public.organizations
group by status
order by status;

-- 24. Membership counts by organization and status
-- First run Section 4; execute only if every listed column is MATCH and visible.
-- Otherwise skip and record NOT CHECKED. The outer-join placeholder is
-- explicitly distinct from a stored NULL membership status.
-- Required: public.organizations(id, name); public.organization_members(id,
-- org_id, status, role_id).
select
  o.id as organization_id,
  o.name as organization_name,
  case
    when m.id is null then '(NO MEMBERSHIP ROW)'
    when m.status is null then '(NULL STORED STATUS)'
    else m.status
  end as membership_status,
  count(m.id) as membership_count,
  count(m.id) filter (where m.role_id is null) as null_role_count,
  count(m.id) filter (where m.status is null) as null_stored_status_count
from public.organizations as o
left join public.organization_members as m on m.org_id = o.id
group by o.id, o.name,
  case
    when m.id is null then '(NO MEMBERSHIP ROW)'
    when m.status is null then '(NULL STORED STATUS)'
    else m.status
  end
order by o.name, membership_status;

-- 25. Phase 3.1 schema-footprint summary
-- The first result checks foundation sentinel tables/functions; sections 4-24
-- inspect the broader schema. Missing sentinels are reported rather than
-- causing errors. A fingerprint is never proof of migration history and must
-- never be used to justify blindly rerunning 0002. TRUNCATE is a separate
-- privilege, bypasses RLS, and is not revoked by 0002; any effective anon,
-- authenticated, or PUBLIC grant on membership/role tables is a deployment
-- blocker. Investigate explicit grants and inheritance in sections 15-16.
-- 0001 explicitly grants no TRUNCATE to anon, authenticated, or PUBLIC;
-- default ACLs/live grants must still be inspected. This query reports only
-- and never revokes privileges.
with foundation_objects(object_type, object_name, is_present) as (
  select 'table', v.object_name,
    exists (
      select 1
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v.object_name
        and c.relkind in ('r', 'p')
    )
  from (values
    ('profiles'),
    ('organizations'),
    ('org_roles'),
    ('organization_members')
  ) as v(object_name)
  union all
  select 'function', v.signature,
    exists (
      select 1
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.oid = to_regprocedure('public.' || v.signature)
        and p.prokind = 'f'
    )
  from (values
    ('is_platform_admin()'),
    ('is_org_member(uuid)'),
    ('has_org_permission(uuid,text)'),
    ('shares_org_with(uuid)'),
    ('create_organization(text,text,text)'),
    ('set_organization_status(uuid,text)')
  ) as v(signature)
)
select
  object_type,
  object_name,
  is_present,
  case when is_present then 'PRESENT' else 'MISSING FOUNDATION SENTINEL' end as result
from foundation_objects
order by object_type, object_name;

with expected_phase3_functions(signature) as (
  values
    ('is_org_owner(uuid)'),
    ('request_to_join_organization(uuid)'),
    ('create_org_role(uuid,text,text[])'),
    ('update_org_role(uuid,text,text[])'),
    ('delete_org_role(uuid)'),
    ('approve_membership_request(uuid,uuid)'),
    ('reject_membership_request(uuid)'),
    ('assign_org_member_role(uuid,uuid)'),
    ('remove_org_member(uuid)'),
    ('leave_organization(uuid)'),
    ('cancel_membership_request(uuid)'),
    ('transfer_organization_ownership(uuid,uuid)')
),
phase3_functions as (
  select
    expected.signature,
    p.oid is not null and p.prokind = 'f' as is_present,
    case
      when p.oid is null or p.prokind <> 'f'
        or anon_role.oid is null or authenticated_role.oid is null
        then null
      else
        has_function_privilege(authenticated_role.oid, p.oid, 'EXECUTE')
        and not has_function_privilege(anon_role.oid, p.oid, 'EXECUTE')
        and not exists (
          select 1
          from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as acl
          where acl.grantee = 0 and acl.privilege_type = 'EXECUTE'
        )
    end as acl_matches
  from expected_phase3_functions as expected
  left join pg_proc as p
    on p.oid = to_regprocedure('public.' || expected.signature)
   and p.prokind = 'f'
  left join pg_roles as anon_role on anon_role.rolname = 'anon'
  left join pg_roles as authenticated_role on authenticated_role.rolname = 'authenticated'
),
phase3_function_counts as (
  select
    count(*) as expected_count,
    count(*) filter (where is_present) as present_count,
    count(*) filter (where acl_matches) as acl_match_count
  from phase3_functions
),
foundation_objects(object_type, object_name, is_present) as (
  select 'table', v.object_name,
    exists (
      select 1
      from pg_class as c
      join pg_namespace as n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = v.object_name
        and c.relkind in ('r', 'p')
    )
  from (values
    ('profiles'),
    ('organizations'),
    ('org_roles'),
    ('organization_members')
  ) as v(object_name)
  union all
  select 'function', v.signature,
    exists (
      select 1
      from pg_proc as p
      join pg_namespace as n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.oid = to_regprocedure('public.' || v.signature)
        and p.prokind = 'f'
    )
  from (values
    ('is_platform_admin()'),
    ('is_org_member(uuid)'),
    ('has_org_permission(uuid,text)'),
    ('shares_org_with(uuid)'),
    ('create_organization(text,text,text)'),
    ('set_organization_status(uuid,text)')
  ) as v(signature)
),
foundation_missing as (
  select count(*) as missing_count
  from foundation_objects
  where not is_present
),
roles_and_tables as (
  select
    (select oid from pg_roles where rolname = 'anon') as anon_role_oid,
    (select oid from pg_roles where rolname = 'authenticated') as authenticated_role_oid,
    (select c.oid
     from pg_class as c
     join pg_namespace as n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'organization_members'
       and c.relkind in ('r', 'p')) as members_table_oid,
    (select c.oid
     from pg_class as c
     join pg_namespace as n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'org_roles'
       and c.relkind in ('r', 'p')) as roles_table_oid
),
write_grants as (
  select
    anon_role_oid,
    authenticated_role_oid,
    members_table_oid,
    roles_table_oid,
    case
      when anon_role_oid is null
        or authenticated_role_oid is null
        or members_table_oid is null
        or roles_table_oid is null
        then null
      else
        exists (
          select 1
          from pg_class as c
          cross join lateral aclexplode(
            coalesce(c.relacl, acldefault('r', c.relowner))
          ) as acl
          where c.oid in (members_table_oid, roles_table_oid)
            and acl.grantee = 0
            and acl.privilege_type = 'TRUNCATE'
        )
        or (
          anon_role_oid is not null
          and (
            has_table_privilege(anon_role_oid, members_table_oid, 'TRUNCATE')
            or has_table_privilege(anon_role_oid, roles_table_oid, 'TRUNCATE')
          )
        )
        or (
          authenticated_role_oid is not null
          and (
            has_table_privilege(authenticated_role_oid, members_table_oid, 'TRUNCATE')
            or has_table_privilege(authenticated_role_oid, roles_table_oid, 'TRUNCATE')
          )
        )
    end as phase3_truncate_privilege_present,
    case
      when anon_role_oid is not null
       and authenticated_role_oid is not null
       and members_table_oid is not null
       and roles_table_oid is not null
      then not (
        has_table_privilege(authenticated_role_oid, members_table_oid, 'INSERT')
        or has_table_privilege(authenticated_role_oid, members_table_oid, 'UPDATE')
        or has_table_privilege(authenticated_role_oid, members_table_oid, 'DELETE')
        or has_table_privilege(authenticated_role_oid, members_table_oid, 'TRUNCATE')
        or has_table_privilege(authenticated_role_oid, roles_table_oid, 'INSERT')
        or has_table_privilege(authenticated_role_oid, roles_table_oid, 'UPDATE')
        or has_table_privilege(authenticated_role_oid, roles_table_oid, 'DELETE')
        or has_table_privilege(authenticated_role_oid, roles_table_oid, 'TRUNCATE')
        or exists (
          select 1
          from pg_attribute as a
          where a.attrelid in (members_table_oid, roles_table_oid)
            and a.attnum > 0
            and not a.attisdropped
            and (
              has_column_privilege(authenticated_role_oid, a.attrelid, a.attname, 'INSERT')
              or has_column_privilege(authenticated_role_oid, a.attrelid, a.attname, 'UPDATE')
            )
        )
        or not (
          not has_table_privilege(anon_role_oid, members_table_oid, 'INSERT')
          and not has_table_privilege(anon_role_oid, members_table_oid, 'UPDATE')
          and not has_table_privilege(anon_role_oid, members_table_oid, 'DELETE')
          and not has_table_privilege(anon_role_oid, members_table_oid, 'TRUNCATE')
          and not has_table_privilege(anon_role_oid, roles_table_oid, 'INSERT')
          and not has_table_privilege(anon_role_oid, roles_table_oid, 'UPDATE')
          and not has_table_privilege(anon_role_oid, roles_table_oid, 'DELETE')
          and not has_table_privilege(anon_role_oid, roles_table_oid, 'TRUNCATE')
        )
        or exists (
          select 1
          from pg_attribute as a
          where a.attrelid in (members_table_oid, roles_table_oid)
            and a.attnum > 0
            and not a.attisdropped
            and (
              has_column_privilege(anon_role_oid, a.attrelid, a.attname, 'INSERT')
              or has_column_privilege(anon_role_oid, a.attrelid, a.attname, 'UPDATE')
            )
        )
        or exists (
          select 1
          from pg_class as c
          cross join lateral aclexplode(
            coalesce(c.relacl, acldefault('r', c.relowner))
          ) as acl
          where c.oid in (members_table_oid, roles_table_oid)
            and acl.grantee = 0
            and acl.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
        )
        or exists (
          select 1
          from pg_attribute as a
          cross join lateral aclexplode(a.attacl) as acl
          where a.attrelid in (members_table_oid, roles_table_oid)
            and a.attnum > 0
            and not a.attisdropped
            and acl.grantee = 0
            and acl.privilege_type in ('INSERT', 'UPDATE')
        )
      )
    end as phase3_write_grants_revoked,
    case
      when anon_role_oid is not null
       and authenticated_role_oid is not null
       and members_table_oid is not null
       and roles_table_oid is not null
      then (
        has_table_privilege(authenticated_role_oid, members_table_oid, 'INSERT')
        and has_table_privilege(authenticated_role_oid, members_table_oid, 'UPDATE')
        and has_table_privilege(authenticated_role_oid, members_table_oid, 'DELETE')
        and not has_table_privilege(authenticated_role_oid, members_table_oid, 'TRUNCATE')
        and has_table_privilege(authenticated_role_oid, roles_table_oid, 'INSERT')
        and has_table_privilege(authenticated_role_oid, roles_table_oid, 'UPDATE')
        and has_table_privilege(authenticated_role_oid, roles_table_oid, 'DELETE')
        and not has_table_privilege(authenticated_role_oid, roles_table_oid, 'TRUNCATE')
        and not has_table_privilege(anon_role_oid, members_table_oid, 'INSERT')
        and not has_table_privilege(anon_role_oid, members_table_oid, 'UPDATE')
        and not has_table_privilege(anon_role_oid, members_table_oid, 'DELETE')
        and not has_table_privilege(anon_role_oid, members_table_oid, 'TRUNCATE')
        and not has_table_privilege(anon_role_oid, roles_table_oid, 'INSERT')
        and not has_table_privilege(anon_role_oid, roles_table_oid, 'UPDATE')
        and not has_table_privilege(anon_role_oid, roles_table_oid, 'DELETE')
        and not has_table_privilege(anon_role_oid, roles_table_oid, 'TRUNCATE')
        and not exists (
          select 1
          from pg_attribute as a
          where a.attrelid in (members_table_oid, roles_table_oid)
            and a.attnum > 0
            and not a.attisdropped
            and (
              has_column_privilege(anon_role_oid, a.attrelid, a.attname, 'INSERT')
              or has_column_privilege(anon_role_oid, a.attrelid, a.attname, 'UPDATE')
            )
        )
        and not exists (
          select 1
          from pg_class as c
          cross join lateral aclexplode(
            coalesce(c.relacl, acldefault('r', c.relowner))
          ) as acl
          where c.oid in (members_table_oid, roles_table_oid)
            and acl.grantee = 0
            and acl.privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
        )
        and not exists (
          select 1
          from pg_attribute as a
          cross join lateral aclexplode(a.attacl) as acl
          where a.attrelid in (members_table_oid, roles_table_oid)
            and a.attnum > 0
            and not a.attisdropped
            and acl.grantee = 0
            and acl.privilege_type in ('INSERT', 'UPDATE')
        )
      )
    end as foundation_write_grants_present
  from roles_and_tables
),
policy_fingerprint as (
  select
    count(*) filter (where p.policyname in (
      'profiles: read own, co-members, or admin',
      'profiles: update own',
      'organizations: approved are discoverable',
      'organizations: members, creator and admins can read',
      'org_roles: members read',
      'members: read own row, org members, managers, admins'
    )) as common_policy_count,
    count(*) filter (where p.policyname in (
      'members: request to join an approved org',
      'members: managers update members',
      'members: managers remove, people cancel own pending request',
      'org_roles: managers create custom roles',
      'org_roles: managers edit custom roles',
      'org_roles: managers delete custom roles'
    )) as foundation_write_policy_count,
    count(*) filter (
      where p.policyname = 'organizations: managers update details'
    ) as organization_detail_policy_count,
    count(*) filter (where p.policyname in (
      'profiles: read own, co-members, or admin',
      'profiles: update own',
      'organizations: approved are discoverable',
      'organizations: members, creator and admins can read',
      'organizations: managers update details',
      'org_roles: members read',
      'members: read own row, org members, managers, admins'
    )) as phase3_expected_policy_count,
    count(*) filter (where p.policyname not in (
      'profiles: read own, co-members, or admin',
      'profiles: update own',
      'organizations: approved are discoverable',
      'organizations: members, creator and admins can read',
      'organizations: managers update details',
      'org_roles: members read',
      'members: read own row, org members, managers, admins'
    )) as phase3_unexpected_policy_count,
    count(*) filter (where p.policyname not in (
      'profiles: read own, co-members, or admin',
      'profiles: update own',
      'organizations: approved are discoverable',
      'organizations: members, creator and admins can read',
      'organizations: managers update details',
      'org_roles: members read',
      'org_roles: managers create custom roles',
      'org_roles: managers edit custom roles',
      'org_roles: managers delete custom roles',
      'members: read own row, org members, managers, admins',
      'members: request to join an approved org',
      'members: managers update members',
      'members: managers remove, people cancel own pending request'
    )) as foundation_unexpected_policy_count
  from pg_policies as p
  where p.schemaname = 'public'
    and p.tablename in ('profiles', 'organizations', 'org_roles', 'organization_members')
)
select
  fc.expected_count as expected_phase3_function_count,
  fc.present_count as present_phase3_function_count,
  fc.acl_match_count as phase3_rpc_acl_match_count,
  pf.common_policy_count,
  pf.foundation_write_policy_count,
  pf.organization_detail_policy_count,
  pf.phase3_expected_policy_count,
  pf.phase3_unexpected_policy_count,
  pf.foundation_unexpected_policy_count,
  wg.anon_role_oid is not null as anon_role_exists,
  wg.authenticated_role_oid is not null as authenticated_role_exists,
  wg.members_table_oid is not null as organization_members_table_exists,
  wg.roles_table_oid is not null as org_roles_table_exists,
  wg.phase3_truncate_privilege_present,
  wg.phase3_write_grants_revoked,
  wg.foundation_write_grants_present,
  case
    when wg.phase3_truncate_privilege_present is true
      then 'DEPLOYMENT BLOCKER - EFFECTIVE TRUNCATE ON MEMBERSHIP/ROLE TABLES; CHECK GRANTS AND INHERITANCE'
    when fm.missing_count > 0 then 'NOT CHECKED - MISSING FOUNDATION SENTINELS'
    when wg.authenticated_role_oid is null
      or wg.anon_role_oid is null
      or wg.members_table_oid is null
      or wg.roles_table_oid is null
      then 'NOT CHECKED - MISSING ROLE OR TABLE'
    when fc.present_count = fc.expected_count
      and fc.acl_match_count = fc.expected_count
      and pf.common_policy_count = 6
      and pf.phase3_expected_policy_count = 7
      and pf.phase3_unexpected_policy_count = 0
      and pf.foundation_write_policy_count = 0
      and pf.organization_detail_policy_count = 1
      and wg.phase3_write_grants_revoked
      then 'COMPLETE CHECKED SENTINEL FINGERPRINT - FUNCTION/POLICY DEFINITIONS AND HISTORY STILL REQUIRE REVIEW'
    when fc.present_count = 0
      and pf.common_policy_count = 6
      and pf.foundation_write_policy_count = 6
      and pf.organization_detail_policy_count = 1
      and pf.foundation_unexpected_policy_count = 0
      and wg.foundation_write_grants_present
      then 'FOUNDATION-SHAPED ON CHECKED OBJECTS ONLY - PARTIAL FUNCTION REPLACEMENTS CANNOT BE EXCLUDED'
    else 'MIXED OR PARTIAL FINGERPRINT - STOP; DO NOT RERUN 0002'
  end as fingerprint_result,
  'A schema fingerprint cannot establish migration execution history.' as limitation
from phase3_function_counts as fc
cross join foundation_missing as fm
cross join policy_fingerprint as pf
cross join write_grants as wg;
