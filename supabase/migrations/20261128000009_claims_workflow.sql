-- CUAgain Phase 5, migration 9: the claim review and handover workflow.
--
-- Claim life cycle
--   pending -> under_review -> approved -> completed          (happy path)
--   pending / under_review -> more_info_required -> pending     (claimant answers and resubmits)
--   pending / under_review / more_info_required / approved -> rejected   (administrator)
--   pending / under_review / more_info_required / approved -> cancelled  (claimant withdraws)
--
-- Rules enforced here, in the database, not in the screens:
--   * Only an administrator can review a claim, and never their own.
--   * Approval is not the same as handover: "completed" needs a second, separate administrator action.
--   * Every status change is written to claim_events (who, when, from, to, note) and the activity log.
--   * When an item is handed over, the report is closed and every other open claim on it is rejected.
--   * Evidence files live in a private bucket and are readable only by the claimant and administrators.

-- ---------- Safety: file paths must belong to the row that points at them ----------
-- Storage access is decided by "does a visible row point at this path". Without this check, someone
-- could create a row of their own that points at another person's file path and read it.

create or replace function public.prepare_item_image()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_restricted boolean;
  v_count integer;
begin
  if new.storage_path not like new.uploaded_by::text || '/' || new.report_id::text || '/%' then
    raise exception 'The photo location is not valid.' using errcode = '23514';
  end if;

  select c.restricts_public_image into v_restricted
    from public.reports r join public.categories c on c.id = r.category_id
   where r.id = new.report_id;

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

create function public.prepare_claim_evidence()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if new.storage_path not like new.uploaded_by::text || '/' || new.claim_id::text || '/%' then
    raise exception 'The file location is not valid.' using errcode = '23514';
  end if;

  select count(*) into v_count from public.claim_evidence e where e.claim_id = new.claim_id;
  if v_count >= 5 then
    raise exception 'A claim can have at most 5 evidence files.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_claim_evidence() from public, anon, authenticated;

create trigger claim_evidence_prepare
  before insert on public.claim_evidence
  for each row execute function public.prepare_claim_evidence();

-- ---------- Claim history ----------

create table public.claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  from_status public.claim_status,
  to_status public.claim_status not null,
  note text,
  created_at timestamptz not null default now()
);

create index claim_events_claim_idx on public.claim_events (claim_id, created_at);

alter table public.claim_events enable row level security;
revoke all on public.claim_events from anon, authenticated;
grant select on public.claim_events to authenticated;

-- The inner "from claims" is filtered by the claims policy: the claimant and administrators only.
-- Nobody can write here from the API; rows are created by the trigger below.
create policy claim_events_select on public.claim_events
  for select to authenticated
  using (exists (select 1 from public.claims c where c.id = claim_id));

-- One live approved/completed claim per item.
create unique index claims_one_approved_per_report_idx
  on public.claims (report_id) where status in ('approved', 'completed');

-- ---------- Keep the report status in step with its claims ----------

create function public.sync_report_status(p_report_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_current public.report_status;
  v_target public.report_status;
begin
  select r.status into v_current from public.reports r where r.id = p_report_id for update;
  if not found or v_current = 'completed' then
    return;
  end if;

  select case
           when exists (select 1 from public.claims c where c.report_id = p_report_id and c.status = 'approved') then 'claimed'
           when exists (select 1 from public.claims c where c.report_id = p_report_id and c.status in ('under_review', 'more_info_required')) then 'under_review'
           else 'open'
         end::public.report_status
    into v_target;

  if v_target is distinct from v_current then
    update public.reports set status = v_target where id = p_report_id;
  end if;
end;
$$;

revoke all on function public.sync_report_status(uuid) from public, anon, authenticated;

-- ---------- Record history and tell people, whichever way a status changed ----------

create function public.record_claim_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_title text;
  v_item text;
  v_admin record;
begin
  select r.title into v_item from public.reports r where r.id = new.report_id;

  if tg_op = 'INSERT' then
    insert into public.claim_events (claim_id, actor_id, from_status, to_status)
    values (new.id, new.claimant_id, null, new.status);

    for v_admin in
      select p.id from public.profile_private p
       where p.role in ('admin', 'super_admin') and p.status = 'active' and p.id <> new.claimant_id
    loop
      insert into public.notifications (user_id, type, title, body, link)
      values (v_admin.id, 'claim_submitted', 'New ownership claim to review',
              left(coalesce(v_item, 'An item'), 200), '/admin/claims/' || new.id);
    end loop;
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.claim_events (claim_id, actor_id, from_status, to_status, note)
    values (
      new.id, (select auth.uid()), old.status, new.status,
      case when new.status in ('cancelled') then null else new.decision_note end
    );

    v_title := case new.status
      when 'under_review' then 'Your claim is under review'
      when 'more_info_required' then 'More information needed for your claim'
      when 'approved' then 'Your claim was approved'
      when 'rejected' then 'Your claim was not approved'
      when 'completed' then 'Handover confirmed'
      else null
    end;

    if v_title is not null then
      insert into public.notifications (user_id, type, title, body, link)
      values (
        new.claimant_id, 'claim_' || new.status::text, v_title,
        left(coalesce(v_item, 'Your item') || coalesce(': ' || nullif(btrim(new.decision_note), ''), ''), 500),
        '/claims/' || new.id
      );
    end if;

    -- The claimant answered a request for more information: tell the reviewer.
    if old.status = 'more_info_required' and new.status = 'pending' and new.reviewer_id is not null then
      insert into public.notifications (user_id, type, title, body, link)
      values (new.reviewer_id, 'claim_resubmitted', 'A claimant sent more information',
              left(coalesce(v_item, 'An item'), 200), '/admin/claims/' || new.id);
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.record_claim_change() from public, anon, authenticated;

create trigger claims_record_change
  after insert or update on public.claims
  for each row execute function public.record_claim_change();

-- ---------- Claimant actions ----------

create or replace function public.cancel_my_claim(p_claim_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.claim_status;
  v_report uuid;
begin
  select c.status, c.report_id into v_status, v_report
    from public.claims c
   where c.id = p_claim_id and c.claimant_id = (select auth.uid())
   for update;

  if not found then
    raise exception 'Claim not found.' using errcode = 'P0002';
  end if;

  if v_status not in ('pending', 'under_review', 'more_info_required', 'approved') then
    raise exception 'This claim can no longer be cancelled.' using errcode = '23514';
  end if;

  update public.claims set status = 'cancelled', cancelled_at = now() where id = p_claim_id;
  perform public.sync_report_status(v_report);

  perform public.write_activity_log(
    (select auth.uid()), 'claim', 'claim_cancelled', 'claim', p_claim_id,
    jsonb_build_object('from', v_status)
  );
end;
$$;

-- Answer a request for more information: optionally improve the explanation, then send it back for review.
create function public.resubmit_my_claim(p_claim_id uuid, p_explanation text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.claim_status;
  v_report uuid;
begin
  if not public.is_active_user() then
    raise exception 'Your account cannot do this.' using errcode = '42501';
  end if;

  select c.status, c.report_id into v_status, v_report
    from public.claims c
   where c.id = p_claim_id and c.claimant_id = (select auth.uid())
   for update;

  if not found then
    raise exception 'Claim not found.' using errcode = 'P0002';
  end if;

  if v_status <> 'more_info_required' then
    raise exception 'This claim is not waiting for more information.' using errcode = '23514';
  end if;

  update public.claims
     set status = 'pending',
         explanation = coalesce(nullif(btrim(p_explanation), ''), explanation)
   where id = p_claim_id;
  perform public.sync_report_status(v_report);

  perform public.write_activity_log(
    (select auth.uid()), 'claim', 'claim_resubmitted', 'claim', p_claim_id, '{}'::jsonb
  );
end;
$$;

-- ---------- Administrator actions ----------

-- Start a review, ask for more information, approve or reject.
create function public.admin_review_claim(
  p_claim_id uuid,
  p_decision public.claim_status,
  p_note text default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.claims%rowtype;
  v_report_status public.report_status;
  v_note text := nullif(btrim(p_note), '');
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Only an administrator can review a claim.' using errcode = '42501';
  end if;

  if p_decision not in ('under_review', 'more_info_required', 'approved', 'rejected') then
    raise exception 'That is not a review decision.' using errcode = '23514';
  end if;

  select * into v_claim from public.claims c where c.id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found.' using errcode = 'P0002';
  end if;

  if v_claim.claimant_id = v_uid then
    raise exception 'You cannot review your own claim.' using errcode = '42501';
  end if;

  if not (
       (v_claim.status = 'pending' and p_decision in ('under_review', 'more_info_required', 'approved', 'rejected'))
    or (v_claim.status = 'under_review' and p_decision in ('more_info_required', 'approved', 'rejected'))
    or (v_claim.status = 'more_info_required' and p_decision = 'rejected')
    or (v_claim.status = 'approved' and p_decision = 'rejected')
  ) then
    raise exception 'This claim cannot move to that status from where it is now.' using errcode = '23514';
  end if;

  if p_decision <> 'under_review' and (v_note is null or char_length(v_note) < 3) then
    raise exception 'Please write a short note for the claimant.' using errcode = '23514';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'The note is too long (1000 characters at most).' using errcode = '23514';
  end if;

  if p_decision = 'approved' then
    select r.status into v_report_status from public.reports r where r.id = v_claim.report_id for update;
    if v_report_status not in ('open', 'under_review') then
      raise exception 'This item is no longer available.' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.claims c
       where c.report_id = v_claim.report_id and c.id <> v_claim.id and c.status in ('approved', 'completed')
    ) then
      raise exception 'Another claim for this item is already approved.' using errcode = '23514';
    end if;
  end if;

  update public.claims
     set status = p_decision,
         reviewer_id = v_uid,
         decision_note = coalesce(v_note, decision_note),
         reviewed_at = now(),
         approved_at = case when p_decision = 'approved' then now() else approved_at end
   where id = p_claim_id;

  perform public.sync_report_status(v_claim.report_id);

  perform public.write_activity_log(
    v_uid, 'claim', 'claim_' || p_decision::text, 'claim', p_claim_id,
    jsonb_build_object('from', v_claim.status, 'report_id', v_claim.report_id)
  );
end;
$$;

-- Confirm that the item was physically handed to its owner. This closes the report.
create function public.admin_complete_claim(p_claim_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_claim public.claims%rowtype;
  v_reporter uuid;
  v_title text;
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Only an administrator can confirm a handover.' using errcode = '42501';
  end if;

  select * into v_claim from public.claims c where c.id = p_claim_id for update;
  if not found then
    raise exception 'Claim not found.' using errcode = 'P0002';
  end if;

  if v_claim.claimant_id = v_uid then
    raise exception 'You cannot confirm the handover of your own claim.' using errcode = '42501';
  end if;

  if v_claim.status <> 'approved' then
    raise exception 'Only an approved claim can be completed.' using errcode = '23514';
  end if;

  update public.claims
     set status = 'completed',
         completed_at = now(),
         handover_confirmed_by = v_uid
   where id = p_claim_id;

  update public.reports
     set status = 'completed', resolved_at = now()
   where id = v_claim.report_id
  returning reporter_id, title into v_reporter, v_title;

  -- Nobody else can still claim this item: close the other open claims.
  update public.claims
     set status = 'rejected',
         decision_note = 'This item has been returned to its owner.',
         reviewer_id = case when claimant_id = v_uid then null else v_uid end,
         reviewed_at = now()
   where report_id = v_claim.report_id
     and id <> p_claim_id
     and status in ('pending', 'under_review', 'more_info_required');

  insert into public.notifications (user_id, type, title, body, link)
  values (v_reporter, 'item_returned', 'The item you found was returned', left(v_title, 200), '/reports/' || v_claim.report_id);

  perform public.write_activity_log(
    v_uid, 'claim', 'claim_completed', 'claim', p_claim_id,
    jsonb_build_object('report_id', v_claim.report_id)
  );
end;
$$;

revoke all on function public.cancel_my_claim(uuid) from public, anon, authenticated;
revoke all on function public.resubmit_my_claim(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_review_claim(uuid, public.claim_status, text) from public, anon, authenticated;
revoke all on function public.admin_complete_claim(uuid) from public, anon, authenticated;
grant execute on function public.cancel_my_claim(uuid) to authenticated;
grant execute on function public.resubmit_my_claim(uuid, text) to authenticated;
grant execute on function public.admin_review_claim(uuid, public.claim_status, text) to authenticated;
grant execute on function public.admin_complete_claim(uuid) to authenticated;

-- ---------- A finder cannot delete a report that has live claims ----------
-- Otherwise deleting the report would silently destroy someone's claim and its history.

create function public.report_has_live_claims(p_report_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  -- Answers only for the report's own finder (and administrators), so this cannot be used to
  -- find out whether somebody else's report has claims.
  select exists (
    select 1 from public.claims c
      join public.reports r on r.id = c.report_id
     where c.report_id = p_report_id
       and c.status not in ('rejected', 'cancelled')
       and (r.reporter_id = (select auth.uid()) or public.is_admin())
  )
$$;

revoke all on function public.report_has_live_claims(uuid) from public, anon, authenticated;
grant execute on function public.report_has_live_claims(uuid) to authenticated;

drop policy reports_delete on public.reports;
create policy reports_delete on public.reports
  for delete to authenticated
  using (
    (reporter_id = (select auth.uid()) and status = 'open' and not (select public.report_has_live_claims(id)))
    or (select public.is_admin())
  );

-- ---------- Private storage for claim evidence ----------
-- File names follow  <user id>/<claim id>/<random>.<ext>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claim-evidence', 'claim-evidence', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- Readable by the uploader (their own folder) and by anyone who can see the matching evidence row,
-- which is only the claimant and administrators.
create policy claim_evidence_files_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'claim-evidence'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (select 1 from public.claim_evidence e where e.storage_path = name)
    )
  );

create policy claim_evidence_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'claim-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.is_active_user())
  );

-- A file that is attached to a claim can never be deleted from the API, so evidence cannot be
-- tampered with after submission. Only leftovers of a failed upload (no matching row) can be removed.
create policy claim_evidence_files_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'claim-evidence'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.claim_evidence e where e.storage_path = name)
  );
