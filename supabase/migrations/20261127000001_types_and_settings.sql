-- CUAgain Phase 3, migration 1 of 7: shared types, settings and helper triggers.
--
-- How access control works in this project (read this once, it applies to every file):
--   1. Every table has Row Level Security (RLS) switched on. With no policy, nobody can touch a row.
--   2. Supabase gives the API roles (anon, authenticated) full access to every new table by default,
--      so each table below first REVOKES everything and then GRANTS only what the app needs.
--   3. Anything a normal user must not do directly (change their role, approve a claim, create a
--      notification) has no grant at all. It happens only inside a SECURITY DEFINER function that
--      checks who is calling.

-- ---------- Types ----------

create type public.app_role as enum ('student', 'staff', 'teacher', 'admin', 'super_admin');
create type public.user_type as enum ('student', 'staff', 'teacher');
create type public.account_status as enum ('active', 'suspended');
create type public.report_type as enum ('lost', 'found');
create type public.report_status as enum ('open', 'under_review', 'claimed', 'completed');
create type public.claim_status as enum (
  'pending', 'under_review', 'more_info_required', 'approved', 'rejected', 'completed', 'cancelled'
);
create type public.message_request_status as enum ('pending', 'accepted', 'declined');
create type public.log_category as enum ('user', 'report', 'claim', 'communication', 'administrator', 'security', 'system');
create type public.error_severity as enum ('info', 'warning', 'error', 'critical');
create type public.error_resolution as enum ('open', 'investigating', 'resolved', 'ignored');

-- ---------- Shared trigger: keep updated_at honest ----------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ---------- Settings ----------
-- A tiny key/value table for rules that must be changeable without redeploying the app.
-- Only super admins can read or change it. Database triggers read it internally.

create table public.app_settings (
  key text primary key,
  value text,
  description text,
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value, description) values
  (
    'allowed_email_domain',
    null,
    'Approved school email domain, for example g.cu.edu.ph (no @). While empty, any domain is accepted at registration. Set it once the university confirms the exact domain.'
  );

alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;
grant select on public.app_settings to authenticated;
grant update (value) on public.app_settings to authenticated;
-- Policies are added in migration 2, after the role helper functions exist.
