-- LEADLINK 0004: Persistent Activity Logs, Organization Invitations, Notifications & User Preferences.
-- Forward migration to be applied after 0002 and 0003.

BEGIN;

-- ============ 1. ACTIVITY LOGS ============
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (char_length(action) between 2 and 120),
  category text not null check (category in ('membership','role','ownership','governance','settings','position')),
  details text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists activity_logs_org_created_idx
  on public.activity_logs (org_id, created_at desc);

alter table public.activity_logs enable row level security;

-- Client roles cannot directly modify activity logs (tamper-proof audit trail)
revoke all on public.activity_logs from public, anon, authenticated;
grant select on public.activity_logs to authenticated;

drop policy if exists "activity_logs: members and admin can read" on public.activity_logs;
create policy "activity_logs: members and admin can read" on public.activity_logs
  for select to authenticated
  using (public.is_org_member(org_id) or public.is_platform_admin());

create or replace function public.log_org_activity(
  p_org uuid,
  p_action text,
  p_category text,
  p_details text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_log_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  -- Only managers or platform admins can explicitly log manual governance notes
  if not (
    public.has_org_permission(p_org, 'members.manage')
    or public.has_org_permission(p_org, 'org.manage')
    or public.is_platform_admin()
  ) then
    raise exception 'You do not have permission to record governance logs for this organization';
  end if;

  insert into public.activity_logs (org_id, actor_id, action, category, details, metadata)
  values (
    p_org,
    auth.uid(),
    btrim(p_action),
    p_category,
    btrim(p_details),
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_log_id;

  return v_log_id;
end;
$$;

-- Revoke direct execution of log_org_activity to ensure client roles cannot forge activity records.
-- Activity records are generated strictly by internal database triggers and trusted RPC operations.
revoke all on function public.log_org_activity(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Automatic audit triggers: logs every organization, membership, and role mutation securely
create or replace function public.trg_log_organization_events()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_logs (org_id, actor_id, action, category, details)
    values (new.id, auth.uid(), 'Organization Created', 'governance', 'Organization registered: ' || new.name);
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      insert into public.activity_logs (org_id, actor_id, action, category, details)
      values (new.id, auth.uid(), 'Organization Status Changed', 'governance', 'Status transitioned from ' || old.status || ' to ' || new.status);
    end if;
    if old.name is distinct from new.name
       or old.description is distinct from new.description then
      insert into public.activity_logs (org_id, actor_id, action, category, details)
      values (new.id, auth.uid(), 'Organization Details Updated', 'settings', 'Organization name or description was updated');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_organization_activity on public.organizations;
create trigger on_organization_activity
  after insert or update on public.organizations
  for each row execute function public.trg_log_organization_events();

create or replace function public.trg_log_member_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old_is_owner boolean;
  v_new_is_owner boolean;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    insert into public.activity_logs (org_id, actor_id, action, category, details)
    values (new.org_id, auth.uid(), 'Join Request Submitted', 'membership', 'Membership application submitted');
  elsif tg_op = 'UPDATE' then
    if old.status is distinct from new.status then
      insert into public.activity_logs (org_id, actor_id, action, category, details)
      values (
        new.org_id,
        auth.uid(),
        case
          when old.status = 'pending' and new.status = 'active' and auth.uid() = new.user_id then 'Membership Activated via Invitation'
          when old.status = 'pending' and new.status = 'active' then 'Membership Approved'
          when old.status = 'pending' and new.status = 'removed' then 'Membership Rejected'
          when old.status = 'active' and new.status = 'removed' and auth.uid() = old.user_id then 'Member Left Organization'
          when old.status = 'active' and new.status = 'removed' then 'Member Removed'
          else 'Membership Status Changed'
        end,
        'membership',
        'Status transitioned from ' || old.status || ' to ' || new.status
      );
    end if;

    if old.role_id is distinct from new.role_id then
      select exists (
        select 1 from public.org_roles r
        where r.id = old.role_id and r.org_id = old.org_id
          and r.is_system and r.permissions @> array['*']::text[]
      ) into v_old_is_owner;
      select exists (
        select 1 from public.org_roles r
        where r.id = new.role_id and r.org_id = new.org_id
          and r.is_system and r.permissions @> array['*']::text[]
      ) into v_new_is_owner;

      if v_new_is_owner then
        insert into public.activity_logs (org_id, actor_id, action, category, details)
        values (new.org_id, auth.uid(), 'Organization Ownership Transferred', 'ownership', 'Ownership was transferred to an active member');
      elsif not v_old_is_owner then
        insert into public.activity_logs (org_id, actor_id, action, category, details)
        values (
          new.org_id,
          auth.uid(),
          case when old.role_id is null then 'Member Role Assigned' else 'Member Role Reassigned' end,
          'role',
          'Member role was updated'
        );
      end if;
    end if;

    if old.position_title is distinct from new.position_title then
      insert into public.activity_logs (org_id, actor_id, action, category, details)
      values (
        new.org_id,
        auth.uid(),
        'Member Position Assigned',
        'position',
        'Position set to: ' || coalesce(new.position_title, 'None')
      );
    end if;
  elsif tg_op = 'DELETE' and old.status = 'pending' then
    insert into public.activity_logs (org_id, actor_id, action, category, details)
    values (old.org_id, auth.uid(), 'Join Request Cancelled', 'membership', 'Pending membership application withdrawn');
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_member_status_change on public.organization_members;
create trigger on_member_status_change
  after insert or update or delete on public.organization_members
  for each row execute function public.trg_log_member_status_change();

create or replace function public.trg_log_role_events()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' and not new.is_system then
    insert into public.activity_logs (org_id, actor_id, action, category, details)
    values (new.org_id, auth.uid(), 'Custom Role Created', 'role', 'Role "' || new.name || '" created');
  elsif tg_op = 'UPDATE' and not new.is_system then
    insert into public.activity_logs (org_id, actor_id, action, category, details)
    values (new.org_id, auth.uid(), 'Custom Role Updated', 'role', 'Role "' || new.name || '" updated');
  elsif tg_op = 'DELETE' and not old.is_system then
    insert into public.activity_logs (org_id, actor_id, action, category, details)
    values (old.org_id, auth.uid(), 'Custom Role Deleted', 'role', 'Role "' || old.name || '" deleted');
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_role_activity on public.org_roles;
create trigger on_role_activity
  after insert or update or delete on public.org_roles
  for each row execute function public.trg_log_role_events();

revoke all on function public.trg_log_organization_events() from public, anon, authenticated;
revoke all on function public.trg_log_member_status_change() from public, anon, authenticated;
revoke all on function public.trg_log_role_events() from public, anon, authenticated;

-- ============ 2. ORGANIZATION INVITATIONS ============
create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invited_email text not null check (invited_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  role_id uuid not null references public.org_roles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create index if not exists org_invitations_org_idx on public.organization_invitations (org_id);
create index if not exists org_invitations_email_idx on public.organization_invitations (lower(invited_email));
create unique index if not exists unique_pending_org_invitation
  on public.organization_invitations (org_id, lower(invited_email))
  where status = 'pending';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_invitations_role_same_org_fkey'
      and conrelid = 'public.organization_invitations'::regclass
  ) then
    alter table public.organization_invitations
      add constraint organization_invitations_role_same_org_fkey
      foreign key (org_id, role_id)
      references public.org_roles (org_id, id) on delete cascade;
  end if;
end;
$$;

alter table public.organization_invitations enable row level security;

revoke all on public.organization_invitations from public, anon, authenticated;
grant select on public.organization_invitations to authenticated;

drop policy if exists "invitations: managers and invitees can read" on public.organization_invitations;
create policy "invitations: managers and invitees can read" on public.organization_invitations
  for select to authenticated
  using (
    public.has_org_permission(org_id, 'members.manage')
    or exists (
      select 1 from auth.users u
      where u.id = auth.uid() and lower(u.email) = lower(invited_email)
    )
    or public.is_platform_admin()
  );

create or replace function public.trg_log_invitation_events()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_action text;
  v_details text;
begin
  if tg_op = 'INSERT' then
    v_action := 'Invitation Issued';
    v_details := 'Invitation created';
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    v_action := case new.status
      when 'accepted' then 'Invitation Accepted'
      when 'declined' then 'Invitation Declined'
      when 'cancelled' then 'Invitation Cancelled'
      when 'expired' then 'Invitation Expired'
      else 'Invitation Status Changed'
    end;
    v_details := 'Invitation status changed to ' || new.status;
  else
    return coalesce(new, old);
  end if;

  insert into public.activity_logs (org_id, actor_id, action, category, details)
  values (
    case when tg_op = 'DELETE' then old.org_id else new.org_id end,
    auth.uid(),
    v_action,
    'membership',
    v_details
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists on_invitation_activity on public.organization_invitations;
create trigger on_invitation_activity
  after insert or update on public.organization_invitations
  for each row execute function public.trg_log_invitation_events();

revoke all on function public.trg_log_invitation_events() from public, anon, authenticated;

create or replace function public.create_organization_invitation(
  p_org uuid,
  p_email text,
  p_role uuid
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role_org uuid;
  v_permissions text[];
  v_clean_email text;
  v_invitation_id uuid;
  v_existing_user uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  perform 1 from public.organizations o
  where o.id = p_org and o.status = 'approved'
  for update;
  if not found then
    raise exception 'Invitations can only be sent for approved organizations';
  end if;

  if not public.has_org_permission(p_org, 'members.manage') then
    raise exception 'You do not have permission to invite members';
  end if;

  v_clean_email := lower(btrim(p_email));
  if v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then
    raise exception 'Invalid email address';
  end if;

  select r.org_id, r.permissions into v_role_org, v_permissions
  from public.org_roles r where r.id = p_role;
  if not found or v_role_org <> p_org then
    raise exception 'Role must belong to this organization';
  end if;

  if v_permissions @> array['*']::text[] then
    raise exception 'Ownership cannot be granted via invitation';
  end if;

  if v_permissions && array['org.manage','members.manage','roles.manage']::text[]
     and not public.is_org_owner(p_org) then
    raise exception 'Only an organization Owner can invite members to privileged roles';
  end if;

  -- Check if user is already an active member
  select u.id into v_existing_user from auth.users u where lower(u.email) = v_clean_email;
  if v_existing_user is not null and exists (
    select 1 from public.organization_members m
    where m.org_id = p_org and m.user_id = v_existing_user and m.status = 'active'
  ) then
    raise exception 'User is already an active member of this organization';
  end if;

  update public.organization_invitations
  set status = 'expired'
  where org_id = p_org
    and lower(invited_email) = v_clean_email
    and status = 'pending'
    and expires_at <= now();

  insert into public.organization_invitations (org_id, invited_email, role_id, invited_by)
  values (p_org, v_clean_email, p_role, auth.uid())
  returning id into v_invitation_id;

  return v_invitation_id;
end;
$$;

drop function if exists public.respond_to_invitation(uuid, text);
create or replace function public.respond_to_invitation(
  p_invitation uuid,
  p_action text
)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_email text;
  v_role uuid;
  v_status text;
  v_caller_email text;
  v_expires_at timestamptz;
  v_member_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if p_action is null or p_action not in ('accept','decline') then
    raise exception 'Action must be accept or decline';
  end if;

  select i.org_id, lower(i.invited_email) into v_org, v_email
  from public.organization_invitations i
  where i.id = p_invitation;
  if not found then
    raise exception 'Invitation not found';
  end if;

  select lower(u.email) into v_caller_email from auth.users u where u.id = auth.uid();
  if v_caller_email is null then
    raise exception 'Authenticated user email is unavailable';
  end if;
  if v_email is distinct from v_caller_email then
    raise exception 'This invitation was addressed to a different email';
  end if;

  perform 1 from public.organizations o
  where o.id = v_org
  for update;
  if not found then
    raise exception 'Organization not found';
  end if;

  select i.org_id, lower(i.invited_email), i.role_id, i.status, i.expires_at
  into v_org, v_email, v_role, v_status, v_expires_at
  from public.organization_invitations i
  where i.id = p_invitation
  for update;

  if not found then
    raise exception 'Invitation not found';
  end if;

  if v_email is distinct from v_caller_email then
    raise exception 'This invitation was addressed to a different email';
  end if;

  if v_status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;

  if v_expires_at <= now() then
    update public.organization_invitations set status = 'expired' where id = p_invitation;
    return 'expired';
  end if;

  if p_action = 'accept' then
    perform 1 from public.organizations o
    where o.id = v_org and o.status = 'approved'
    for update;
    if not found then
      raise exception 'Invitations can only be accepted for approved organizations';
    end if;

    -- Verify role still belongs to org and is valid
    if not exists (
      select 1 from public.org_roles r
      where r.id = v_role and r.org_id = v_org
        and not (r.permissions @> array['*']::text[])
    ) then
      raise exception 'Invited role is no longer valid or contains prohibited wildcard permissions';
    end if;
    insert into public.organization_members as member (org_id, user_id, role_id, status, joined_at)
    values (v_org, auth.uid(), v_role, 'active', now())
    on conflict (org_id, user_id) do update
    set role_id = excluded.role_id, status = 'active', joined_at = excluded.joined_at
    where member.status <> 'active'
    returning member.id into v_member_id;

    if not found then
      raise exception 'User is already an active member of this organization';
    end if;

    update public.organization_invitations set status = 'accepted' where id = p_invitation;

    return 'accepted';
  else
    update public.organization_invitations set status = 'declined' where id = p_invitation;
    return 'declined';
  end if;
end;
$$;

create or replace function public.cancel_organization_invitation(p_invitation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select org_id, status into v_org, v_status
  from public.organization_invitations
  where id = p_invitation
  for update;
  if not found then
    raise exception 'Invitation not found';
  end if;
  if v_status <> 'pending' then
    raise exception 'Invitation is no longer pending';
  end if;

  if not public.has_org_permission(v_org, 'members.manage') then
    raise exception 'You do not have permission to cancel invitations';
  end if;

  update public.organization_invitations
  set status = 'cancelled'
  where id = p_invitation;
end;
$$;

revoke all on function public.create_organization_invitation(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.create_organization_invitation(uuid, text, uuid) to authenticated;

revoke all on function public.respond_to_invitation(uuid, text) from public, anon, authenticated;
grant execute on function public.respond_to_invitation(uuid, text) to authenticated;

revoke all on function public.cancel_organization_invitation(uuid) from public, anon, authenticated;
grant execute on function public.cancel_organization_invitation(uuid) to authenticated;

-- ============ 3. USER NOTIFICATIONS ============
create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  org_id uuid references public.organizations(id) on delete set null,
  title text not null,
  message text not null,
  type text not null default 'info' check (type in ('info','success','warning','alert')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_created_idx
  on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;

revoke all on public.user_notifications from public, anon, authenticated;
grant select, delete on public.user_notifications to authenticated;
grant update (is_read) on public.user_notifications to authenticated;

drop policy if exists "notifications: read own" on public.user_notifications;
create policy "notifications: read own" on public.user_notifications
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "notifications: update own read status" on public.user_notifications;
create policy "notifications: update own read status" on public.user_notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "notifications: delete own" on public.user_notifications;
create policy "notifications: delete own" on public.user_notifications
  for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.mark_all_notifications_read()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update public.user_notifications
  set is_read = true
  where user_id = auth.uid() and is_read = false;
end;
$$;

revoke all on function public.mark_all_notifications_read() from public, anon, authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;

-- ============ 4. USER PROFILE PREFERENCES ============
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'preferences'
  ) then
    alter table public.profiles
      add column preferences jsonb not null default '{"email_notifications": true, "theme": "system"}'::jsonb
      check (jsonb_typeof(preferences) = 'object');
  end if;
end; $$;

grant update (preferences) on public.profiles to authenticated;

-- ============ 5. FORWARD DELIVERY OF POSITION ASSIGNMENT RPC ============
-- Delivers set_org_member_position forward-compatibly in case 0002 was previously executed without it
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

revoke all on function public.set_org_member_position(uuid, text) from public, anon, authenticated;
grant execute on function public.set_org_member_position(uuid, text) to authenticated;

COMMIT;
