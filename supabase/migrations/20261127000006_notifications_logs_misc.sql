-- CUAgain Phase 3, migration 6 of 7: notifications, logs, watchlist and feedback.

-- ---------- Notifications ----------
-- Users can read and mark their own. Nobody can create one from the browser: they are created by
-- database functions or server-side code (service role) only.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (char_length(type) between 1 and 60),
  title text not null check (char_length(title) between 1 and 120),
  body text check (body is null or char_length(body) <= 500),
  link text check (link is null or (link like '/%' and link not like '//%')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

create policy notifications_select on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notifications_delete_own on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- Activity logs ----------
-- Written only by write_activity_log (inside definer functions) or the service role.
-- Only administrators can read. Nobody can edit or delete from the API.

create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  category public.log_category not null,
  action text not null check (char_length(action) between 1 and 80),
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_category_idx on public.activity_logs (category, created_at desc);

alter table public.activity_logs enable row level security;
revoke all on public.activity_logs from anon, authenticated;
grant select on public.activity_logs to authenticated;

create policy activity_logs_admin_select on public.activity_logs
  for select to authenticated using ((select public.is_admin()));

-- ---------- Error logs ----------

create table public.error_logs (
  id uuid primary key default gen_random_uuid(),
  severity public.error_severity not null default 'error',
  source text not null check (char_length(source) between 1 and 80),
  message text not null check (char_length(message) <= 2000),
  context jsonb not null default '{}'::jsonb,
  resolution public.error_resolution not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index error_logs_created_idx on public.error_logs (created_at desc);

alter table public.error_logs enable row level security;
revoke all on public.error_logs from anon, authenticated;
grant select on public.error_logs to authenticated;
grant update (resolution, resolved_at) on public.error_logs to authenticated;

create policy error_logs_admin_select on public.error_logs
  for select to authenticated using ((select public.is_admin()));
create policy error_logs_admin_update on public.error_logs
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------- Watchlist ----------
-- A user can follow a lost-item search by category so they are told about new matching found items.

create table public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  report_id uuid references public.reports (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint watchlist_has_target check (category_id is not null or report_id is not null)
);

create unique index watchlist_unique_category_idx on public.watchlist (user_id, category_id) where report_id is null;
create unique index watchlist_unique_report_idx on public.watchlist (user_id, report_id) where report_id is not null;

alter table public.watchlist enable row level security;
revoke all on public.watchlist from anon, authenticated;
grant select, insert, delete on public.watchlist to authenticated;

create policy watchlist_select on public.watchlist
  for select to authenticated using (user_id = (select auth.uid()));
create policy watchlist_insert on public.watchlist
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select public.is_active_user()));
create policy watchlist_delete on public.watchlist
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------- Feedback ----------
-- Only after the user's own claim is completed, one per claim.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.claims (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;
grant select, insert on public.feedback to authenticated;

create policy feedback_select on public.feedback
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy feedback_insert on public.feedback
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.is_active_user())
    and exists (
      select 1 from public.claims c
       where c.id = claim_id and c.claimant_id = (select auth.uid()) and c.status = 'completed'
    )
  );
