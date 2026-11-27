-- CUAgain Phase 3, migration 4 of 7: ownership claims and private claim evidence.
--
-- Phase 3 creates the tables and the rules about who can see and create claims. The review
-- workflow itself (approve, reject, request more information, confirm handover) is built in
-- Phase 5 as administrator-only functions. Until then, nobody can change a claim's status.

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  explanation text not null check (char_length(btrim(explanation)) between 10 and 2000),
  status public.claim_status not null default 'pending',
  reviewer_id uuid references public.profiles (id) on delete set null,
  -- Visible to the claimant, so keep it to the decision and next steps.
  decision_note text,
  reviewed_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  handover_confirmed_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Business rule: users cannot review or complete their own claims.
  constraint claims_reviewer_not_claimant check (reviewer_id is null or reviewer_id <> claimant_id),
  constraint claims_handover_not_claimant check (handover_confirmed_by is null or handover_confirmed_by <> claimant_id)
);

-- One live claim per person per item. A rejected or cancelled claim does not block a new one.
create unique index claims_one_active_per_person_idx
  on public.claims (report_id, claimant_id)
  where status not in ('rejected', 'cancelled');

create index claims_report_idx on public.claims (report_id);
create index claims_claimant_idx on public.claims (claimant_id);
create index claims_status_idx on public.claims (status);

create trigger claims_set_updated_at
  before update on public.claims
  for each row execute function public.set_updated_at();

create function public.validate_new_claim()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
begin
  select * into v_report from public.reports r where r.id = new.report_id;

  if not found or v_report.is_hidden then
    raise exception 'This item is not available to claim.' using errcode = '23514';
  end if;

  if v_report.type <> 'found' then
    raise exception 'Only found items can be claimed.' using errcode = '23514';
  end if;

  if v_report.reporter_id = new.claimant_id then
    raise exception 'You cannot claim an item you reported yourself.' using errcode = '23514';
  end if;

  -- A completed item must not stay open to competing claims. An already-claimed one is closed too.
  if v_report.status not in ('open', 'under_review') then
    raise exception 'This item is no longer available to claim.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_new_claim() from public, anon, authenticated;

create trigger claims_validate_new
  before insert on public.claims
  for each row execute function public.validate_new_claim();

alter table public.claims enable row level security;
revoke all on public.claims from anon, authenticated;
grant select, insert on public.claims to authenticated;
-- A claimant may add detail to their explanation while the claim is still open. Nothing else is editable.
grant update (explanation) on public.claims to authenticated;

-- Only the claimant and administrators can see a claim. The person who reported the found item
-- cannot: that keeps ownership evidence away from anyone who could use it to impersonate the owner.
create policy claims_select on public.claims
  for select to authenticated
  using (claimant_id = (select auth.uid()) or (select public.is_admin()));

create policy claims_insert on public.claims
  for insert to authenticated
  with check (
    claimant_id = (select auth.uid())
    and (select public.is_active_user())
    and status = 'pending'
    and reviewer_id is null
    and decision_note is null
    and reviewed_at is null
    and approved_at is null
    and completed_at is null
    and cancelled_at is null
    and handover_confirmed_by is null
  );

create policy claims_update_own on public.claims
  for update to authenticated
  using (
    claimant_id = (select auth.uid())
    and status in ('pending', 'more_info_required')
    and (select public.is_active_user())
  )
  with check (claimant_id = (select auth.uid()));

-- A claimant can withdraw their own claim.
create function public.cancel_my_claim(p_claim_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_status public.claim_status;
begin
  select c.status into v_status
    from public.claims c
   where c.id = p_claim_id and c.claimant_id = (select auth.uid())
   for update;

  if not found then
    raise exception 'Claim not found.' using errcode = 'P0002';
  end if;

  if v_status not in ('pending', 'under_review', 'more_info_required') then
    raise exception 'This claim can no longer be cancelled.' using errcode = '23514';
  end if;

  update public.claims set status = 'cancelled', cancelled_at = now() where id = p_claim_id;

  perform public.write_activity_log(
    (select auth.uid()), 'claim', 'claim_cancelled', 'claim', p_claim_id,
    jsonb_build_object('from', v_status)
  );
end;
$$;

revoke all on function public.cancel_my_claim(uuid) from public, anon, authenticated;
grant execute on function public.cancel_my_claim(uuid) to authenticated;

-- ---------- Claim evidence (private) ----------

create table public.claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique check (char_length(storage_path) between 1 and 500),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  description text check (description is null or char_length(description) <= 500),
  created_at timestamptz not null default now()
);

create index claim_evidence_claim_idx on public.claim_evidence (claim_id);

alter table public.claim_evidence enable row level security;
revoke all on public.claim_evidence from anon, authenticated;
grant select, insert, delete on public.claim_evidence to authenticated;

-- The inner "from claims" is filtered by the claims policy, so evidence is visible only to the
-- claimant and administrators.
create policy claim_evidence_select on public.claim_evidence
  for select to authenticated
  using (exists (select 1 from public.claims c where c.id = claim_id));

create policy claim_evidence_insert on public.claim_evidence
  for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and (select public.is_active_user())
    and exists (
      select 1 from public.claims c
       where c.id = claim_id
         and c.claimant_id = (select auth.uid())
         and c.status in ('pending', 'more_info_required')
    )
  );

create policy claim_evidence_delete on public.claim_evidence
  for delete to authenticated
  using (
    uploaded_by = (select auth.uid())
    and exists (
      select 1 from public.claims c
       where c.id = claim_id and c.status in ('pending', 'more_info_required')
    )
  );
