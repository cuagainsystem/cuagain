-- CUAgain Phase 3, migration 3 of 7: categories, lost and found reports, report images.

-- ---------- Categories ----------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  label text not null check (char_length(label) between 1 and 60),
  examples text,
  -- Photos of items in a restricted category (for example IDs) are never shown to the public.
  restricts_public_image boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;
revoke all on public.categories from anon, authenticated;
grant select, insert, update, delete on public.categories to authenticated;

create policy categories_select on public.categories
  for select to authenticated
  using (is_active or (select public.is_admin()));

create policy categories_admin_insert on public.categories
  for insert to authenticated with check ((select public.is_admin()));
create policy categories_admin_update on public.categories
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy categories_admin_delete on public.categories
  for delete to authenticated using ((select public.is_admin()));

-- ---------- Reports ----------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  type public.report_type not null,
  title text not null check (char_length(btrim(title)) between 3 and 120),
  category_id uuid not null references public.categories (id),
  description text not null check (char_length(btrim(description)) between 10 and 2000),
  identifying_characteristics text check (identifying_characteristics is null or char_length(identifying_characteristics) <= 1000),
  location text not null check (char_length(btrim(location)) between 2 and 160),
  -- The date the item was lost or found.
  occurred_on date not null,
  status public.report_status not null default 'open',
  -- Set by administrators when moderating. Hidden reports stay visible to their owner and to admins.
  is_hidden boolean not null default false,
  moderation_note text,
  -- Found reports only: has the physical item been handed to the designated office?
  handed_to_office boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reports_handover_only_for_found check (type = 'found' or handed_to_office = false)
);

create index reports_browse_idx on public.reports (type, status, created_at desc);
create index reports_category_idx on public.reports (category_id);
create index reports_reporter_idx on public.reports (reporter_id);
create index reports_occurred_on_idx on public.reports (occurred_on);

create trigger reports_set_updated_at
  before update on public.reports
  for each row execute function public.set_updated_at();

-- Rules that CHECK constraints cannot express (they involve other tables or today's date).
create function public.validate_report()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_active boolean;
begin
  -- A report cannot describe an event in the future. One day of slack covers time zone differences.
  if new.occurred_on > current_date + 1 then
    raise exception 'The date cannot be in the future.' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' or new.category_id is distinct from old.category_id then
    select c.is_active into v_active from public.categories c where c.id = new.category_id;
    if v_active is distinct from true then
      raise exception 'Choose an available category.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_report() from public, anon, authenticated;

create trigger reports_validate
  before insert or update on public.reports
  for each row execute function public.validate_report();

alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, insert, delete on public.reports to authenticated;
-- Owners can edit only these descriptive columns. status, is_hidden, reporter_id, type and the
-- moderation fields are not in this list, so a browser request cannot change them.
grant update (title, category_id, description, identifying_characteristics, location, occurred_on, handed_to_office)
  on public.reports to authenticated;

create policy reports_select on public.reports
  for select to authenticated
  using (not is_hidden or reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy reports_insert on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select public.is_active_user())
    and status = 'open'
    and not is_hidden
    and moderation_note is null
    and resolved_at is null
  );

-- Owners may edit their report only while it is still open.
create policy reports_update_own on public.reports
  for update to authenticated
  using (reporter_id = (select auth.uid()) and status = 'open' and (select public.is_active_user()))
  with check (reporter_id = (select auth.uid()) and status = 'open');

create policy reports_delete on public.reports
  for delete to authenticated
  using ((reporter_id = (select auth.uid()) and status = 'open') or (select public.is_admin()));

-- Administrator actions on reports.
create function public.admin_set_report_status(p_report_id uuid, p_status public.report_status)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old public.report_status;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only an administrator can change a report status.' using errcode = '42501';
  end if;

  select r.status into v_old from public.reports r where r.id = p_report_id for update;
  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;

  if v_old = p_status then
    return;
  end if;

  update public.reports
     set status = p_status,
         resolved_at = case when p_status = 'completed' then now() else null end
   where id = p_report_id;

  perform public.write_activity_log(
    (select auth.uid()), 'report', 'status_changed', 'report', p_report_id,
    jsonb_build_object('from', v_old, 'to', p_status)
  );
end;
$$;

create function public.admin_set_report_hidden(p_report_id uuid, p_hidden boolean, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only an administrator can moderate a report.' using errcode = '42501';
  end if;

  update public.reports
     set is_hidden = p_hidden,
         moderation_note = case when p_hidden then nullif(btrim(p_note), '') else null end
   where id = p_report_id;

  if not found then
    raise exception 'Report not found.' using errcode = 'P0002';
  end if;

  perform public.write_activity_log(
    (select auth.uid()), 'report',
    case when p_hidden then 'report_hidden' else 'report_unhidden' end,
    'report', p_report_id, '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_set_report_status(uuid, public.report_status) from public, anon, authenticated;
revoke all on function public.admin_set_report_hidden(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_set_report_status(uuid, public.report_status) to authenticated;
grant execute on function public.admin_set_report_hidden(uuid, boolean, text) to authenticated;

-- ---------- Report images ----------
-- Only the storage PATH and metadata are stored here. The files themselves go in Supabase Storage,
-- whose own access rules are added in Phase 4 together with the upload screens.

create table public.item_images (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  is_primary boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index item_images_report_idx on public.item_images (report_id);
create unique index item_images_one_primary_idx on public.item_images (report_id) where is_primary;

create function public.prepare_item_image()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_restricted boolean;
  v_count integer;
begin
  select c.restricts_public_image into v_restricted
    from public.reports r join public.categories c on c.id = r.category_id
   where r.id = new.report_id;

  -- Photos in a restricted category (for example IDs) can never be made public, whatever the request says.
  if coalesce(v_restricted, false) then
    new.is_public := false;
  end if;

  select count(*) into v_count from public.item_images i where i.report_id = new.report_id;
  if v_count >= 5 then
    raise exception 'A report can have at most 5 photos.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_item_image() from public, anon, authenticated;

create trigger item_images_prepare
  before insert on public.item_images
  for each row execute function public.prepare_item_image();

alter table public.item_images enable row level security;
revoke all on public.item_images from anon, authenticated;
grant select, insert, delete on public.item_images to authenticated;

-- The inner "from reports" is itself filtered by the reports policy, so an image is never
-- visible when its report is not. Non-public images are limited to the report owner and admins.
create policy item_images_select on public.item_images
  for select to authenticated
  using (
    exists (select 1 from public.reports r where r.id = report_id)
    and (
      is_public
      or exists (select 1 from public.reports r where r.id = report_id and r.reporter_id = (select auth.uid()))
      or (select public.is_admin())
    )
  );

create policy item_images_insert on public.item_images
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (select public.is_active_user())
    and exists (
      select 1 from public.reports r
       where r.id = report_id and r.reporter_id = (select auth.uid()) and r.status = 'open'
    )
  );

create policy item_images_delete on public.item_images
  for delete to authenticated
  using (uploaded_by = (select auth.uid()) or (select public.is_admin()));
