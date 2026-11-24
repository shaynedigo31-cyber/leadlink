-- LEADLINK 0003: make it impossible for a member to hold a role from another organization.
-- Independent of 0002; safe to run before or after it. Idempotent.

BEGIN;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'org_roles_org_id_id_key'
      and conrelid = 'public.org_roles'::regclass
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'org_roles_org_id_id_key'
        and conrelid = 'public.org_roles'::regclass
        and contype = 'u'
        and conkey = array[
          (select attnum from pg_attribute
           where attrelid = 'public.org_roles'::regclass and attname = 'org_id'),
          (select attnum from pg_attribute
           where attrelid = 'public.org_roles'::regclass and attname = 'id')
        ]::smallint[]
        and convalidated
        and not condeferrable
    ) then
      raise exception 'org_roles_org_id_id_key exists with an unexpected definition';
    end if;
  else
    alter table public.org_roles
      add constraint org_roles_org_id_id_key unique (org_id, id);
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'organization_members_role_same_org_fkey'
      and conrelid = 'public.organization_members'::regclass
  ) then
    if not exists (
      select 1
      from pg_constraint
      where conname = 'organization_members_role_same_org_fkey'
        and conrelid = 'public.organization_members'::regclass
        and contype = 'f'
        and conkey = array[
          (select attnum from pg_attribute
           where attrelid = 'public.organization_members'::regclass and attname = 'org_id'),
          (select attnum from pg_attribute
           where attrelid = 'public.organization_members'::regclass and attname = 'role_id')
        ]::smallint[]
        and confrelid = 'public.org_roles'::regclass
        and confkey = array[
          (select attnum from pg_attribute
           where attrelid = 'public.org_roles'::regclass and attname = 'org_id'),
          (select attnum from pg_attribute
           where attrelid = 'public.org_roles'::regclass and attname = 'id')
        ]::smallint[]
        and confmatchtype = 's'
        and confupdtype = 'a'
        and confdeltype = 'a'
        and convalidated
        and not condeferrable
    ) then
      raise exception 'organization_members_role_same_org_fkey exists with an unexpected definition';
    end if;
  else
    alter table public.organization_members
      add constraint organization_members_role_same_org_fkey
      foreign key (org_id, role_id) references public.org_roles (org_id, id);
  end if;
end; $$;

COMMIT;
   