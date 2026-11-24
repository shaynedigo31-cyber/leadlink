-- LEADLINK Phase 2 foundation: profiles, organizations, roles, memberships + RLS.
-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- STATUS: written, not yet run or tested.

-- ============ TABLES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Roles hold permissions. Titles (President, Treasurer...) are kept separate in organization_members.position_title.
create table public.org_roles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  permissions text[] not null default '{}',
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  unique (org_id, name)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_id uuid references public.org_roles(id),
  position_title text,
  status text not null default 'pending' check (status in ('pending','active','removed')),
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);
create index organization_members_org_idx on public.organization_members (org_id);
create index org_roles_org_idx on public.org_roles (org_id);

-- ============ TRIGGERS ============
create function public.set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger organizations_updated before update on public.organizations
  for each row execute function public.set_updated_at();

-- Create a profile automatically when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ HELPER FUNCTIONS (used by policies) ============
create function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_platform_admin from public.profiles p where p.id = auth.uid()), false)
$$;

create function public.is_org_member(p_org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
  )
$$;

create function public.has_org_permission(p_org uuid, p_perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members m
    join public.org_roles r on r.id = m.role_id
    where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active'
      and (r.permissions @> array['*']::text[] or r.permissions @> array[p_perm]::text[])
  )
$$;

create function public.shares_org_with(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.organization_members a
    join public.organization_members b on b.org_id = a.org_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = p_user and b.status = 'active'
  )
$$;

-- ============ RPC FUNCTIONS (the only way to create orgs / change org status) ============
create function public.create_organization(p_name text, p_slug text, p_description text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_owner_role uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.organizations (name, slug, description, created_by)
  values (trim(p_name), p_slug, nullif(trim(coalesce(p_description, '')), ''), auth.uid())
  returning id into v_org;

  insert into public.org_roles (org_id, name, permissions, is_system) values
    (v_org, 'Administrator', array['org.manage','members.manage','roles.manage'], true),
    (v_org, 'Officer', '{}', true),
    (v_org, 'Adviser', '{}', true),
    (v_org, 'Member', '{}', true);

  insert into public.org_roles (org_id, name, permissions, is_system)
  values (v_org, 'Owner', array['*'], true)
  returning id into v_owner_role;

  insert into public.organization_members (org_id, user_id, role_id, position_title, status, joined_at)
  values (v_org, auth.uid(), v_owner_role, 'Founder', 'active', now());

  return v_org;
end; $$;

create function public.set_organization_status(p_org uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only platform administrators can change organization status';
  end if;
  if p_status not in ('pending','approved','rejected','suspended') then
    raise exception 'Invalid status';
  end if;
  update public.organizations set status = p_status where id = p_org;
end; $$;

-- ============ PERMISSIONS (grants) ============
revoke all on public.profiles, public.organizations, public.org_roles, public.organization_members from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

grant select on public.organizations to authenticated;
grant update (name, description) on public.organizations to authenticated;

grant select, insert, update, delete on public.org_roles to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_permission(uuid, text) to authenticated;
grant execute on function public.shares_org_with(uuid) to authenticated;
grant execute on function public.create_organization(text, text, text) to authenticated;
grant execute on function public.set_organization_status(uuid, text) to authenticated;

-- ============ ROW LEVEL SECURITY ============
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.org_roles enable row level security;
alter table public.organization_members enable row level security;

-- profiles
create policy "profiles: read own, co-members, or admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_org_with(id) or public.is_platform_admin());

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- organizations
create policy "organizations: approved are discoverable" on public.organizations
  for select to authenticated using (status = 'approved');

create policy "organizations: members, creator and admins can read" on public.organizations
  for select to authenticated
  using (public.is_org_member(id) or created_by = auth.uid() or public.is_platform_admin());

create policy "organizations: managers update details" on public.organizations
  for update to authenticated
  using (public.has_org_permission(id, 'org.manage') or public.is_platform_admin())
  with check (public.has_org_permission(id, 'org.manage') or public.is_platform_admin());

-- org_roles
create policy "org_roles: members read" on public.org_roles
  for select to authenticated
  using (public.is_org_member(org_id) or public.is_platform_admin());

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

-- organization_members
create policy "members: read own row, org members, managers, admins" on public.organization_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_member(org_id)
    or public.has_org_permission(org_id, 'members.manage')
    or public.is_platform_admin()
  );

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
