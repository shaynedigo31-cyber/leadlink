-- ============================================================================
-- LEADLINK Phase 3.1: Controlled Rollback Script
-- Target: Returns schema to 0001 foundation state if Phase 3.1 fails or needs reversal.
-- DO NOT RUN UNLESS AUTHORIZED FOR ROLLBACK.
-- ============================================================================

BEGIN;

-- 1. Restore Foundation Direct-Write Policies on organization_members
drop policy if exists "members: request to join an approved org" on public.organization_members;
drop policy if exists "members: managers update members" on public.organization_members;
drop policy if exists "members: managers remove, people cancel own pending request" on public.organization_members;

create policy "members: request to join an approved org" on public.organization_members
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and role_id is null
    and joined_at is null
    and exists (select 1 from public.organizations o where o.id = org_id and o.status = 'approved')
  );

create policy "members: managers update members" on public.organization_members
  for update to authenticated
  using (public.has_org_permission(org_id, 'members.manage'))
  with check (
    public.has_org_permission(org_id, 'members.manage')
    and (
      role_id is null
      or exists (
        select 1 from public.org_roles r
        where r.id = role_id and r.org_id = organization_members.org_id
          and (not (r.permissions @> array['*']::text[]) or public.has_org_permission(organization_members.org_id, '*'))
      )
    )
  );

create policy "members: managers remove, people cancel own pending request" on public.organization_members
  for delete to authenticated
  using (
    public.has_org_permission(org_id, 'members.manage')
    or (user_id = auth.uid() and status = 'pending')
  );

-- 2. Restore Foundation Direct-Write Policies on org_roles
drop policy if exists "org_roles: managers create custom roles" on public.org_roles;
drop policy if exists "org_roles: managers edit custom roles" on public.org_roles;
drop policy if exists "org_roles: managers delete custom roles" on public.org_roles;

create policy "org_roles: managers create custom roles" on public.org_roles
  for insert to authenticated
  with check (public.has_org_permission(org_id, 'roles.manage') and is_system = false and not (permissions @> array['*']::text[]));

create policy "org_roles: managers edit custom roles" on public.org_roles
  for update to authenticated
  using (public.has_org_permission(org_id, 'roles.manage') and is_system = false)
  with check (public.has_org_permission(org_id, 'roles.manage') and is_system = false and not (permissions @> array['*']::text[]));

create policy "org_roles: managers delete custom roles" on public.org_roles
  for delete to authenticated
  using (public.has_org_permission(org_id, 'roles.manage') and is_system = false);

-- 3. Restore Foundation organizations update policy
drop policy if exists "organizations: managers update details" on public.organizations;
create policy "organizations: managers update details" on public.organizations
  for update to authenticated
  using (public.has_org_permission(id, 'org.manage') or public.is_platform_admin())
  with check (public.has_org_permission(id, 'org.manage') or public.is_platform_admin());

-- 4. Restore Foundation Table Write Grants
grant select, insert, update, delete on public.org_roles to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;

-- 5. Drop Phase 3 RPC Functions
drop function if exists public.transfer_organization_ownership(uuid, uuid);
drop function if exists public.cancel_membership_request(uuid);
drop function if exists public.leave_organization(uuid);
drop function if exists public.remove_org_member(uuid);
drop function if exists public.set_org_member_position(uuid, text);
drop function if exists public.assign_org_member_role(uuid, uuid);
drop function if exists public.reject_membership_request(uuid);
drop function if exists public.approve_membership_request(uuid, uuid);
drop function if exists public.delete_org_role(uuid);
drop function if exists public.update_org_role(uuid, text, text[]);
drop function if exists public.create_org_role(uuid, text, text[]);
drop function if exists public.request_to_join_organization(uuid);
drop function if exists public.is_org_owner(uuid);

-- 6. Restore 0001 versions of helper functions (foundation definitions without approved org filter)
create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  )
$$;

create or replace function public.has_org_permission(p_org uuid, p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members m
    join public.org_roles r on r.id = m.role_id
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
      and (r.permissions @> array['*']::text[] or r.permissions @> array[p_perm]::text[])
  )
$$;

create or replace function public.shares_org_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b on b.org_id = a.org_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user and b.status = 'active'
  )
$$;

grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_permission(uuid, text) to authenticated;
grant execute on function public.shares_org_with(uuid) to authenticated;

-- 7. Restore 0001 version of set_organization_status
create or replace function public.set_organization_status(p_org uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can change organization status';
  end if;
  if p_status not in ('pending','approved','rejected','suspended') then
    raise exception 'Invalid status';
  end if;
  update public.organizations set status = p_status where id = p_org;
end $$;

grant execute on function public.set_organization_status(uuid, text) to authenticated;

COMMIT;
