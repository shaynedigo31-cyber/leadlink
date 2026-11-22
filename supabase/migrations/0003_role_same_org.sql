-- LEADLINK 0003: make it impossible for a member to hold a role from another organization.
-- Independent of 0002; safe to run before or after it. Idempotent.

BEGIN;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'org_roles_org_id_id_key'
      and conrelid = 'public.org_roles'::regclass
  ) then
    alter table public.org_roles
      add constraint org_roles_org_id_id_key unique (org_id, id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'organization_members_role_same_org_fkey'
      and conrelid = 'public.organization_members'::regclass
  ) then
    alter table public.organization_members
      add constraint organization_members_role_same_org_fkey
      foreign key (org_id, role_id) references public.org_roles (org_id, id);
  end if;
end; $$;

COMMIT;
   