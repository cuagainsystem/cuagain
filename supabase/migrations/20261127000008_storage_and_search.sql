-- CUAgain Phase 4, migration 8: report photo storage and search.
--
-- Photos
--   Files live in a PRIVATE storage bucket called "item-images". Nobody can fetch a file by
--   guessing its address. The app asks for a short-lived signed link, and Storage only agrees if
--   the signed-in user may see the matching row in `item_images`. That row is already protected
--   by the rules from migration 3 (public photos for everyone, ID photos only for the owner and
--   administrators), so file access can never be more open than the data.
--   File names follow  <user id>/<report id>/<random>.<ext>  and a user can only upload into
--   their own <user id> folder.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-images', 'item-images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy item_images_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'item-images'
    and (
      -- The uploader can always see their own files. Without this they could not clean up a
      -- failed upload, because a delete also needs permission to see the row.
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.item_images i where i.storage_path = name)
    )
  );

create policy item_images_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'item-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  );

-- The uploader can remove their own files (for example when a report is deleted). So can administrators.
create policy item_images_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'item-images'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );

-- ---------- Labels: match the roadmap wording ----------

update public.categories set label = 'Identification', examples = 'IDs and school cards' where slug = 'identification';
update public.categories set label = 'Personal belongings', examples = 'Umbrellas and water bottles' where slug = 'personal-belongings';
update public.categories set examples = 'Phones, chargers, laptops' where slug = 'electronics';
update public.categories set examples = 'Watches, jewelry, bags' where slug = 'accessories';
update public.categories set examples = 'Notebooks, pens, calculators' where slug = 'school-supplies';
update public.categories set examples = 'Jackets and uniforms' where slug = 'clothing';

-- ---------- Search ----------
-- Trigram indexes make "contains this text" searches fast even with many reports.

create extension if not exists pg_trgm with schema extensions;

create index reports_title_trgm_idx on public.reports using gin (title extensions.gin_trgm_ops);
create index reports_description_trgm_idx on public.reports using gin (description extensions.gin_trgm_ops);
create index reports_location_trgm_idx on public.reports using gin (location extensions.gin_trgm_ops);

-- One function does keyword search, filtering, sorting and paging. It runs as the CALLER
-- (security invoker), so the reports access rules apply: hidden reports never appear for
-- people who are not allowed to see them. All values are parameters, never pasted into SQL,
-- and % or _ typed by a user are treated as plain characters.
create function public.search_reports(
  p_query text default null,
  p_type public.report_type default null,
  p_category_id uuid default null,
  p_location text default null,
  p_from date default null,
  p_to date default null,
  p_status public.report_status default null,
  p_mine boolean default false,
  p_sort text default 'newest',
  p_limit integer default 12,
  p_offset integer default 0
)
returns table (
  id uuid,
  reporter_id uuid,
  type public.report_type,
  title text,
  category_id uuid,
  category_slug text,
  location text,
  occurred_on date,
  status public.report_status,
  handed_to_office boolean,
  is_hidden boolean,
  created_at timestamptz,
  image_path text,
  total_count bigint
)
language sql stable security invoker
set search_path = ''
as $$
  with params as (
    select
      case when btrim(coalesce(p_query, '')) = '' then null
           else '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%' end as q,
      case when btrim(coalesce(p_location, '')) = '' then null
           else '%' || replace(replace(replace(btrim(p_location), '\', '\\'), '%', '\%'), '_', '\_') || '%' end as loc
  )
  select
    r.id, r.reporter_id, r.type, r.title, r.category_id, c.slug, r.location, r.occurred_on,
    r.status, r.handed_to_office, r.is_hidden, r.created_at,
    (select i.storage_path
       from public.item_images i
      where i.report_id = r.id and i.is_public
      order by i.is_primary desc, i.created_at
      limit 1),
    count(*) over ()
  from public.reports r
  join public.categories c on c.id = r.category_id
  cross join params
  where (params.q is null or r.title ilike params.q or r.description ilike params.q)
    and (params.loc is null or r.location ilike params.loc)
    and (p_type is null or r.type = p_type)
    and (p_category_id is null or r.category_id = p_category_id)
    and (p_status is null or r.status = p_status)
    and (p_from is null or r.occurred_on >= p_from)
    and (p_to is null or r.occurred_on <= p_to)
    and (not coalesce(p_mine, false) or r.reporter_id = (select auth.uid()))
  order by
    case when p_sort = 'relevance' and params.q is not null
         then (case when r.title ilike params.q then 0 else 1 end) end asc nulls last,
    case when p_sort = 'date' then r.occurred_on end desc nulls last,
    r.created_at desc
  limit greatest(least(coalesce(p_limit, 12), 50), 1)
  offset greatest(coalesce(p_offset, 0), 0)
$$;

revoke all on function public.search_reports(text, public.report_type, uuid, text, date, date, public.report_status, boolean, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.search_reports(text, public.report_type, uuid, text, date, date, public.report_status, boolean, text, integer, integer)
  to authenticated;
