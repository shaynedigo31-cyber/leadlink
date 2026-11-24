-- LEADLINK 0005: read-only helper functions for the screens (already applied by hand in the SQL Editor).
create or replace function public.get_my_memberships()
returns table (id uuid, org_id uuid, org_name text, org_status text, member_status text,
               role_name text, position_title text, permissions text[])
language sql stable security definer set search_path = '' as $$
  select m.id, m.org_id, o.name, o.status, m.status, r.name, m.position_title,
         coalesce(r.permissions, '{}'::text[])
  from public.organization_members m
  join public.organizations o on o.id = m.org_id
  left join public.org_roles r on r.id = m.role_id and r.org_id = m.org_id
  where m.user_id = auth.uid() and m.status <> 'removed'
  order by o.name
$$;

create or replace function public.list_org_members(p_org uuid)
returns table (member_id uuid, user_id uuid, full_name text, status text, role_id uuid,
               role_name text, position_title text, joined_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_manage boolean;
begin
  if not (public.is_org_member(p_org) or public.is_platform_admin()) then
    raise exception 'Not allowed';
  end if;
  v_manage := public.has_org_permission(p_org, 'members.manage') or public.is_platform_admin();
  return query
    select m.id, m.user_id, p.full_name, m.status, m.role_id, r.name, m.position_title, m.joined_at
    from public.organization_members m
    join public.profiles p on p.id = m.user_id
    left join public.org_roles r on r.id = m.role_id and r.org_id = m.org_id
    where m.org_id = p_org and m.status <> 'removed' and (m.status = 'active' or v_manage)
    order by (m.status = 'active') asc, p.full_name;
end $$;

create or replace function public.admin_list_organizations()
returns table (id uuid, name text, description text, status text, created_at timestamptz,
               creator_name text, member_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Not allowed';
  end if;
  return query
    select o.id, o.name, o.description, o.status, o.created_at, p.full_name,
           (select count(*) from public.organization_members m where m.org_id = o.id and m.status = 'active')
    from public.organizations o
    join public.profiles p on p.id = o.created_by
    order by o.created_at desc;
end $$;

revoke all on function public.get_my_memberships(), public.list_org_members(uuid), public.admin_list_organizations()
  from public, anon;
grant execute on function public.get_my_memberships(), public.list_org_members(uuid), public.admin_list_organizations()
  to authenticated;
