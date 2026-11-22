-- LEADLINK Phase 3.1: harden organization access, membership and role changes.
-- Apply once after 0001_foundation.sql. This migration does not modify 0001.

BEGIN;

-- Normal organization membership and permissions are valid only while the
-- organization is approved. Platform-admin access remains explicit in policies.
create or replace function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organizations o
    join public.organization_members m on m.org_id = o.id
    where o.id = p_org and o.status = 'approved'
      and m.user_id = auth.uid() and m.status = 'active'
  )
$$;

create or replace function public.has_org_permission(p_org uuid, p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organizations o
    join public.organization_members m on m.org_id = o.id
    join public.org_roles r on r.id = m.role_id and r.org_id = m.org_id
    where o.id = p_org and o.status = 'approved'
      and m.user_id = auth.uid() and m.status = 'active'
      and (r.permissions @> array['*']::text[] or r.permissions @> array[p_perm]::text[])
  )
$$;

create or replace function public.shares_org_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b on b.org_id = a.org_id
    join public.organizations o on o.id = a.org_id
    where o.status = 'approved'
      and a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user and b.status = 'active'
  )
$$;

-- Internal ownership check. Platform-admin privileges are intentionally not
-- treated as organization-owner permissions.
create or replace function public.is_org_owner(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members m
    join public.org_roles r on r.id = m.role_id and r.org_id = m.org_id
    where m.org_id = p_org and m.user_id = auth.uid()
      and m.status = 'active' and r.is_system
      and r.permissions @> array['*']::text[]
  )
$$;

-- Organization status remains platform-admin-only. A platform administrator
-- who is also the creator or an organization manager cannot approve that org.
create or replace function public.set_organization_status(p_org uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_creator uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can change organization status';
  end if;
  if p_status is null or p_status not in ('pending','approved','rejected','suspended') then
    raise exception 'Invalid status';
  end if;

  select o.created_by into v_creator
  from public.organizations o
  where o.id = p_org
  for update;
  if not found then
    raise exception 'Organization not found';
  end if;

  if p_status = 'approved' and (
    v_creator = auth.uid()
    or exists (
      select 1
      from public.organization_members m
      join public.org_roles r on r.id = m.role_id
      where m.org_id = p_org and m.user_id = auth.uid()
        and m.status = 'active'
        and (
          r.permissions @> array['*']::text[]
          or r.permissions && array['org.manage','members.manage','roles.manage']::text[]
        )
    )
  ) then
    raise exception 'Organization creators and managers cannot approve their own organization';
  end if;

  update public.organizations set status = p_status where id = p_org;
end;
$$;

-- Membership and role writes are replaced by narrowly validated RPCs below.
revoke insert, update, delete on public.organization_members from public, anon, authenticated;
revoke insert, update, delete on public.org_roles from public, anon, authenticated;

-- Ensure organizations table update is strictly column-restricted
revoke update on public.organizations from public, anon, authenticated;
grant update (name, description) on public.organizations to authenticated;

drop policy if exists "members: request to join an approved org" on public.organization_members;
drop policy if exists "members: managers update members" on public.organization_members;
drop policy if exists "members: managers remove, people cancel own pending request" on public.organization_members;
drop policy if exists "org_roles: managers create custom roles" on public.org_roles;
drop policy if exists "org_roles: managers edit custom roles" on public.org_roles;
drop policy if exists "org_roles: managers delete custom roles" on public.org_roles;
drop policy if exists "organizations: managers update details" on public.organizations;

create policy "organizations: managers update details" on public.organizations
  for update to authenticated
  using (public.has_org_permission(id, 'org.manage'))
  with check (public.has_org_permission(id, 'org.manage'));

create or replace function public.request_to_join_organization(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  perform 1 from public.organizations o
  where o.id = p_org and o.status = 'approved'
  for update;
  if not found then
    raise exception 'Organization is unavailable for membership requests';
  end if;

  select m.status into v_status
  from public.organization_members m
  where m.org_id = p_org and m.user_id = auth.uid()
  for update;
  if found then
    if v_status = 'pending' then
      raise exception 'A membership request is already pending';
    end if;
    if v_status = 'active' then
      raise exception 'You are already an active member';
    end if;
    update public.organization_members
    set role_id = null, position_title = null, status = 'pending', joined_at = null
    where org_id = p_org and user_id = auth.uid();
  else
    insert into public.organization_members (org_id, user_id, status)
    values (p_org, auth.uid(), 'pending');
  end if;
end;
$$;

-- Reject any role with a wildcard in generic role-management flows. Wildcard
-- ownership is transferred only by transfer_organization_ownership().
create or replace function public.create_org_role(p_org uuid, p_name text, p_permissions text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_permissions text[];
  v_role uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 80 then
    raise exception 'Role name must be between 2 and 80 characters';
  end if;
  if p_permissions is not null and array_position(p_permissions, null) is not null then
    raise exception 'Role permissions cannot contain null values';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_permissions, array[]::text[])) as permission(value)
    where btrim(value) = '' or char_length(btrim(value)) > 100
  ) then
    raise exception 'Role permissions must be non-empty values of at most 100 characters';
  end if;
  select coalesce(array_agg(permission order by permission), array[]::text[])
  into v_permissions
  from (
    select distinct btrim(value) as permission
    from unnest(coalesce(p_permissions, array[]::text[])) as permission(value)
  ) normalized;
  if '*' = any(v_permissions) then
    raise exception 'Wildcard permissions can only be assigned by ownership transfer';
  end if;
  perform 1 from public.organizations o where o.id = p_org for update;
  if not found then
    raise exception 'Organization not found';
  end if;
  if not public.has_org_permission(p_org, 'roles.manage') then
    raise exception 'You do not have permission to manage roles';
  end if;
  if v_permissions && array['org.manage','members.manage','roles.manage']::text[]
     and not public.is_org_owner(p_org) then
    raise exception 'Only an organization Owner can assign privileged permissions';
  end if;

  insert into public.org_roles (org_id, name, permissions, is_system)
  values (p_org, btrim(p_name), v_permissions, false)
  returning id into v_role;
  return v_role;
end;
$$;

create or replace function public.update_org_role(p_role uuid, p_name text, p_permissions text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_is_system boolean;
  v_permissions text[];
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_name is null or char_length(btrim(p_name)) < 2 or char_length(btrim(p_name)) > 80 then
    raise exception 'Role name must be between 2 and 80 characters';
  end if;
  if p_permissions is not null and array_position(p_permissions, null) is not null then
    raise exception 'Role permissions cannot contain null values';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_permissions, array[]::text[])) as permission(value)
    where btrim(value) = '' or char_length(btrim(value)) > 100
  ) then
    raise exception 'Role permissions must be non-empty values of at most 100 characters';
  end if;
  select coalesce(array_agg(permission order by permission), array[]::text[])
  into v_permissions
  from (
    select distinct btrim(value) as permission
    from unnest(coalesce(p_permissions, array[]::text[])) as permission(value)
  ) normalized;
  if '*' = any(v_permissions) then
    raise exception 'Wildcard permissions can only be assigned by ownership transfer';
  end if;

  select r.org_id into v_org from public.org_roles r where r.id = p_role;
  if not found then
    raise exception 'Role not found';
  end if;
  perform 1 from public.organizations o where o.id = v_org for update;
  select r.is_system into v_is_system
  from public.org_roles r where r.id = p_role for update;
  if not found then
    raise exception 'Role not found';
  end if;
  if v_is_system then
    raise exception 'System roles cannot be edited';
  end if;
  if not public.has_org_permission(v_org, 'roles.manage') then
    raise exception 'You do not have permission to manage roles';
  end if;
  if v_permissions && array['org.manage','members.manage','roles.manage']::text[]
     and not public.is_org_owner(v_org) then
    raise exception 'Only an organization Owner can assign privileged permissions';
  end if;

  update public.org_roles
  set name = btrim(p_name), permissions = v_permissions
  where id = p_role;
end;
$$;

create or replace function public.delete_org_role(p_role uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_is_system boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select r.org_id into v_org from public.org_roles r where r.id = p_role;
  if not found then
    raise exception 'Role not found';
  end if;
  perform 1 from public.organizations o where o.id = v_org for update;
  select r.is_system into v_is_system
  from public.org_roles r where r.id = p_role for update;
  if not found then
    raise exception 'Role not found';
  end if;
  if v_is_system then
    raise exception 'System roles cannot be deleted';
  end if;
  if not public.has_org_permission(v_org, 'roles.manage') then
    raise exception 'You do not have permission to manage roles';
  end if;
  if exists (
    select 1 from public.organization_members m where m.role_id = p_role
  ) then
    raise exception 'Reassign members before deleting this role';
  end if;
  delete from public.org_roles where id = p_role;
end;
$$;

create or replace function public.approve_membership_request(p_member uuid, p_role uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_user uuid;
  v_status text;
  v_role_org uuid;
  v_permissions text[];
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select m.org_id into v_org from public.organization_members m where m.id = p_member;
  if not found then
    raise exception 'Membership request not found';
  end if;
  perform 1 from public.organizations o where o.id = v_org for update;
  select m.user_id, m.status into v_user, v_status
  from public.organization_members m where m.id = p_member for update;
  if not found then
    raise exception 'Membership request not found';
  end if;
  if v_user = auth.uid() then
    raise exception 'You cannot approve your own membership request';
  end if;
  if v_status <> 'pending' then
    raise exception 'Membership request is no longer pending';
  end if;
  if not exists (
    select 1 from public.organizations o where o.id = v_org and o.status = 'approved'
  ) then
    raise exception 'Membership requests can only be approved for approved organizations';
  end if;
  if not public.has_org_permission(v_org, 'members.manage') then
    raise exception 'You do not have permission to manage members';
  end if;

  select r.org_id, r.permissions into v_role_org, v_permissions
  from public.org_roles r where r.id = p_role;
  if not found or v_role_org <> v_org then
    raise exception 'Assigned role must belong to this organization';
  end if;
  if v_permissions @> array['*']::text[] then
    raise exception 'Ownership must be transferred separately';
  end if;
  if v_permissions && array['org.manage','members.manage','roles.manage']::text[]
     and not public.is_org_owner(v_org) then
    raise exception 'Only an organization Owner can assign privileged permissions';
  end if;

  update public.organization_members
  set role_id = p_role, status = 'active', joined_at = now()
  where id = p_member;
end;
$$;

create or replace function public.reject_membership_request(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_user uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select m.org_id into v_org from public.organization_members m where m.id = p_member;
  if not found then
    raise exception 'Membership request not found';
  end if;
  perform 1 from public.organizations o where o.id = v_org for update;
  select m.user_id, m.status into v_user, v_status
  from public.organization_members m where m.id = p_member for update;
  if not found then
    raise exception 'Membership request not found';
  end if;
  if v_user = auth.uid() then
    raise exception 'You cannot reject your own membership request';
  end if;
  if v_status <> 'pending' then
    raise exception 'Membership request is no longer pending';
  end if;
  if not public.has_org_permission(v_org, 'members.manage') then
    raise exception 'You do not have permission to manage members';
  end if;
  update public.organization_members set status = 'removed' where id = p_member;
end;
$$;

create or replace function public.assign_org_member_role(p_member uuid, p_role uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_user uuid;
  v_status text;
  v_current_role uuid;
  v_role_org uuid;
  v_permissions text[];
  v_is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select m.org_id into v_org from public.organization_members m where m.id = p_member;
  if not found then
    raise exception 'Organization member not found';
  end if;
  perform 1 from public.organizations o where o.id = v_org for update;
  select m.user_id, m.status, m.role_id into v_user, v_status, v_current_role
  from public.organization_members m where m.id = p_member for update;
  if not found then
    raise exception 'Organization member not found';
  end if;
  if v_user = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  if v_status <> 'active' then
    raise exception 'Only active members can be assigned a role';
  end if;
  if not public.has_org_permission(v_org, 'members.manage') then
    raise exception 'You do not have permission to manage members';
  end if;

  select exists (
    select 1 from public.org_roles r
    where r.id = v_current_role and r.is_system
      and r.permissions @> array['*']::text[]
  ) into v_is_owner;
  if v_is_owner then
    raise exception 'Ownership changes must use the ownership transfer operation';
  end if;

  select r.org_id, r.permissions into v_role_org, v_permissions
  from public.org_roles r where r.id = p_role;
  if not found or v_role_org <> v_org then
    raise exception 'Assigned role must belong to this organization';
  end if;
  if v_permissions @> array['*']::text[] then
    raise exception 'Ownership must be transferred separately';
  end if;
  if v_permissions && array['org.manage','members.manage','roles.manage']::text[]
     and not public.is_org_owner(v_org) then
    raise exception 'Only an organization Owner can assign privileged permissions';
  end if;
  update public.organization_members set role_id = p_role where id = p_member;
end;
$$;

create or replace function public.set_org_member_position(p_member uuid, p_position_title text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_status text;
  v_trimmed text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select m.org_id into v_org from public.organization_members m where m.id = p_member;
  if not found then
    raise exception 'Organization member not found';
  end if;
  perform 1 from public.organizations o where o.id = v_org for update;
  select m.status into v_status
  from public.organization_members m where m.id = p_member for update;
  if not found then
    raise exception 'Organization member not found';
  end if;
  if v_status <> 'active' then
    raise exception 'Positions can only be assigned to active members';
  end if;
  if not public.has_org_permission(v_org, 'members.manage') then
    raise exception 'You do not have permission to manage members';
  end if;

  -- Protect Owner position title from non-owner alteration
  if exists (
    select 1 from public.organization_members m
    join public.org_roles r on r.id = m.role_id
    where m.id = p_member and r.is_system and r.permissions @> array['*']::text[]
  ) and not public.is_org_owner(v_org) then
    raise exception 'Only an organization Owner can change an Owner''s position title';
  end if;

  v_trimmed := nullif(btrim(p_position_title), '');
  if v_trimmed is not null and char_length(v_trimmed) > 100 then
    raise exception 'Position title must be at most 100 characters';
  end if;

  update public.organization_members
  set position_title = v_trimmed
  where id = p_member;
end;
$$;

create or replace function public.remove_org_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_user uuid;
  v_status text;
  v_role uuid;
  v_is_owner boolean;
  v_owner_count bigint;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  select m.org_id into v_org from public.organization_members m where m.id = p_member;
  if not found then
    raise exception 'Organization member not found';
  end if;
  perform 1 from public.organizations o where o.id = v_org for update;
  select m.user_id, m.status, m.role_id into v_user, v_status, v_role
  from public.organization_members m where m.id = p_member for update;
  if not found then
    raise exception 'Organization member not found';
  end if;
  if v_user = auth.uid() then
    raise exception 'Use the leave-organization operation to remove yourself';
  end if;
  if v_status = 'removed' then
    raise exception 'Organization member is already removed';
  end if;
  if not public.has_org_permission(v_org, 'members.manage') then
    raise exception 'You do not have permission to manage members';
  end if;

  select exists (
    select 1 from public.org_roles r
    where r.id = v_role and r.is_system
      and r.permissions @> array['*']::text[]
  ) into v_is_owner;
  if v_is_owner then
    if not public.is_org_owner(v_org) then
      raise exception 'Only an organization Owner can remove another Owner';
    end if;
    select count(*) into v_owner_count
    from public.organization_members m
    join public.org_roles r on r.id = m.role_id
    where m.org_id = v_org and m.status = 'active' and r.is_system
      and r.permissions @> array['*']::text[];
    if v_status = 'active' and v_owner_count <= 1 then
      raise exception 'Transfer ownership before removing the final active Owner';
    end if;
  end if;

  update public.organization_members
  set role_id = null, status = 'removed'
  where id = p_member;
end;
$$;

create or replace function public.leave_organization(p_org uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid;
  v_role uuid;
  v_owner_count bigint;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  perform 1 from public.organizations o where o.id = p_org for update;
  if not found then
    raise exception 'Organization not found';
  end if;
  select m.id, m.role_id into v_member, v_role
  from public.organization_members m
  where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  for update;
  if not found then
    raise exception 'No active membership found';
  end if;
  if exists (
    select 1 from public.org_roles r
    where r.id = v_role and r.is_system
      and r.permissions @> array['*']::text[]
  ) then
    select count(*) into v_owner_count
    from public.organization_members m
    join public.org_roles r on r.id = m.role_id
    where m.org_id = p_org and m.status = 'active' and r.is_system
      and r.permissions @> array['*']::text[];
    if v_owner_count <= 1 then
      raise exception 'Transfer ownership before leaving as the final active Owner';
    end if;
  end if;
  update public.organization_members
  set role_id = null, status = 'removed'
  where id = v_member;
end;
$$;

create or replace function public.cancel_membership_request(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from public.organization_members m
  where m.id = p_member and m.user_id = auth.uid() and m.status = 'pending';
  if not found then
    raise exception 'Pending membership request not found';
  end if;
end;
$$;

create or replace function public.transfer_organization_ownership(p_org uuid, p_new_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_owner_role uuid;
  v_admin_role uuid;
  v_target uuid;
  v_owner_roles integer;
  v_org_status text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_new_owner is null then
    raise exception 'A new Owner must be specified';
  end if;
  select o.status into v_org_status
  from public.organizations o
  where o.id = p_org
  for update;
  if not found then
    raise exception 'Organization not found';
  end if;
  if not public.is_org_owner(p_org) then
    raise exception 'Only an active organization Owner can transfer ownership';
  end if;
  if v_org_status is distinct from 'approved' then
    raise exception 'Ownership transfer requires an approved organization';
  end if;

  select count(*) into v_owner_roles
  from public.org_roles r
  where r.org_id = p_org and r.is_system
    and r.permissions @> array['*']::text[];
  if v_owner_roles <> 1 then
    raise exception 'Expected exactly one system Owner role';
  end if;
  select r.id into v_owner_role
  from public.org_roles r
  where r.org_id = p_org and r.is_system
    and r.permissions @> array['*']::text[];
  select r.id into v_admin_role
  from public.org_roles r
  where r.org_id = p_org and r.is_system and r.name = 'Administrator'
    and not (r.permissions @> array['*']::text[]);
  if not found then
    raise exception 'System Administrator role is missing';
  end if;

  select m.id into v_target
  from public.organization_members m
  where m.org_id = p_org and m.user_id = p_new_owner and m.status = 'active'
  for update;
  if not found then
    raise exception 'The new Owner must already be an active member';
  end if;

  update public.organization_members m
  set role_id = v_admin_role
  where m.org_id = p_org and m.status = 'active' and m.id <> v_target
    and exists (
      select 1 from public.org_roles r
      where r.id = m.role_id and r.is_system
        and r.permissions @> array['*']::text[]
    );
  update public.organization_members set role_id = v_owner_role where id = v_target;
end;
$$;

-- Helpers required by existing RLS policies remain callable by authenticated
-- users, but must never be executable by anonymous or public roles.
revoke all on function public.is_org_member(uuid) from public, anon, authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;

revoke all on function public.has_org_permission(uuid, text) from public, anon, authenticated;
grant execute on function public.has_org_permission(uuid, text) to authenticated;

revoke all on function public.shares_org_with(uuid) from public, anon, authenticated;
grant execute on function public.shares_org_with(uuid) to authenticated;

-- The ownership helper is internal to the SECURITY DEFINER RPCs.
revoke all on function public.is_org_owner(uuid) from public, anon, authenticated;

revoke all on function public.set_organization_status(uuid, text) from public, anon, authenticated;
grant execute on function public.set_organization_status(uuid, text) to authenticated;

revoke all on function public.create_org_role(uuid, text, text[]) from public, anon, authenticated;
revoke all on function public.request_to_join_organization(uuid) from public, anon, authenticated;
revoke all on function public.update_org_role(uuid, text, text[]) from public, anon, authenticated;
revoke all on function public.delete_org_role(uuid) from public, anon, authenticated;
revoke all on function public.approve_membership_request(uuid, uuid) from public, anon, authenticated;
revoke all on function public.reject_membership_request(uuid) from public, anon, authenticated;
revoke all on function public.assign_org_member_role(uuid, uuid) from public, anon, authenticated;
revoke all on function public.set_org_member_position(uuid, text) from public, anon, authenticated;
revoke all on function public.remove_org_member(uuid) from public, anon, authenticated;
revoke all on function public.leave_organization(uuid) from public, anon, authenticated;
revoke all on function public.cancel_membership_request(uuid) from public, anon, authenticated;
revoke all on function public.transfer_organization_ownership(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_org_role(uuid, text, text[]) to authenticated;
grant execute on function public.request_to_join_organization(uuid) to authenticated;
grant execute on function public.update_org_role(uuid, text, text[]) to authenticated;
grant execute on function public.delete_org_role(uuid) to authenticated;
grant execute on function public.approve_membership_request(uuid, uuid) to authenticated;
grant execute on function public.reject_membership_request(uuid) to authenticated;
grant execute on function public.assign_org_member_role(uuid, uuid) to authenticated;
grant execute on function public.set_org_member_position(uuid, text) to authenticated;
grant execute on function public.remove_org_member(uuid) to authenticated;
grant execute on function public.leave_organization(uuid) to authenticated;
grant execute on function public.cancel_membership_request(uuid) to authenticated;
grant execute on function public.transfer_organization_ownership(uuid, uuid) to authenticated;

COMMIT;
