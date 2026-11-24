-- ============================================================================
-- LEADLINK 0004 Rollback Script
-- Target: Safely removes 0004 additions (activity_logs, organization_invitations,
-- user_notifications, and preferences) without affecting foundation tables.
-- ============================================================================

BEGIN;

-- 1. Drop 0004 Triggers and Trigger Functions
drop trigger if exists on_role_activity on public.org_roles;
drop function if exists public.trg_log_role_events();

drop trigger if exists on_organization_activity on public.organizations;
drop function if exists public.trg_log_organization_events();

drop trigger if exists on_member_status_change on public.organization_members;
drop function if exists public.trg_log_member_status_change();

drop trigger if exists on_invitation_activity on public.organization_invitations;
drop function if exists public.trg_log_invitation_events();

-- 2. Drop 0004 RPC Functions
drop function if exists public.mark_all_notifications_read();
drop function if exists public.cancel_organization_invitation(uuid);
drop function if exists public.respond_to_invitation(uuid, text);
drop function if exists public.create_organization_invitation(uuid, text, uuid);
drop function if exists public.log_org_activity(uuid, text, text, text, jsonb);
drop function if exists public.set_org_member_position(uuid, text);

-- 3. Drop 0004 Tables
drop table if exists public.user_notifications cascade;
drop table if exists public.organization_invitations cascade;
drop table if exists public.activity_logs cascade;

-- 4. Remove Preferences Column from Profiles
alter table public.profiles drop column if exists preferences;

COMMIT;
