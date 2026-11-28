-- CUAgain Phase 6, migration 10: communication safety, notifications and the email queue.
--
-- What this adds
--   * Blocking, abuse reports, and anti-spam limits for messages and the community chat.
--   * In-app notifications for requests, messages, new reports and new claims.
--   * A queue of emails (email_outbox) that a server-side function sends through Brevo. The in-app
--     notification always exists first, so nothing is lost when an email fails.
--   * Per-person email preferences.
--   * Live updates (Realtime) for messages, community chat and notifications.

-- ---------- Blocking ----------

create table public.user_blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint user_blocks_not_self check (blocker_id <> blocked_id)
);

create index user_blocks_blocked_idx on public.user_blocks (blocked_id);

alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from anon, authenticated;
grant select, insert, delete on public.user_blocks to authenticated;

-- You can see and manage only your own list. The blocked person cannot see that they were blocked.
create policy user_blocks_select on public.user_blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy user_blocks_insert on public.user_blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()) and (select public.is_active_user()));
create policy user_blocks_delete on public.user_blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- True if either person has blocked the other. Internal: used by the rules below.
create function public.are_blocked(p_a uuid, p_b uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  )
$$;

revoke all on function public.are_blocked(uuid, uuid) from public, anon, authenticated;

-- ---------- Rules for message requests ----------

create function public.guard_message_request()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_pending integer;
begin
  if public.are_blocked(new.requester_id, new.recipient_id) then
    raise exception 'You cannot message this person.' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.profile_private p where p.id = new.recipient_id and p.status = 'active'
  ) then
    raise exception 'This person cannot receive messages right now.' using errcode = '23514';
  end if;

  if exists (
    select 1 from public.conversation_members a
      join public.conversation_members b on b.conversation_id = a.conversation_id
     where a.user_id = new.requester_id and b.user_id = new.recipient_id
  ) then
    raise exception 'You already have a conversation with this person.' using errcode = '23514';
  end if;

  select count(*) into v_pending from public.message_requests r
   where r.requester_id = new.requester_id and r.status = 'pending';
  if v_pending >= 10 then
    raise exception 'You have too many requests waiting for an answer.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_message_request() from public, anon, authenticated;

create trigger message_requests_guard
  before insert on public.message_requests
  for each row execute function public.guard_message_request();

-- ---------- Rules for private messages and the community chat ----------

create function public.guard_private_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_recent integer;
begin
  if exists (
    select 1 from public.conversation_members m
     where m.conversation_id = new.conversation_id
       and m.user_id <> new.sender_id
       and public.are_blocked(new.sender_id, m.user_id)
  ) then
    raise exception 'You cannot send messages in this conversation.' using errcode = '23514';
  end if;

  select count(*) into v_recent from public.messages x
   where x.sender_id = new.sender_id and x.created_at > now() - interval '1 minute';
  if v_recent >= 30 then
    raise exception 'You are sending messages too quickly. Please wait a moment.' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_private_message() from public, anon, authenticated;

create trigger messages_guard
  before insert on public.messages
  for each row execute function public.guard_private_message();

create function public.guard_community_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_recent integer;
begin
  select count(*) into v_recent from public.community_messages x
   where x.author_id = new.author_id and x.created_at > now() - interval '1 minute';
  if v_recent >= 8 then
    raise exception 'You are posting too quickly. Please wait a moment.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_community_message() from public, anon, authenticated;

create trigger community_messages_guard
  before insert on public.community_messages
  for each row execute function public.guard_community_message();

-- ---------- Conversations list (one query: who, last message, unread count) ----------
-- Runs with the caller's permissions, so it can only ever return the caller's own conversations.

create function public.list_my_conversations()
returns table (
  conversation_id uuid,
  report_id uuid,
  other_user_id uuid,
  other_username text,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid,
  unread_count integer,
  i_blocked boolean
)
language sql stable security invoker
set search_path = ''
as $$
  select
    c.id,
    c.report_id,
    o.user_id,
    p.username,
    lm.body,
    c.last_message_at,
    lm.sender_id,
    (select count(*)::integer from public.messages x
      where x.conversation_id = c.id and x.sender_id <> me.user_id and x.created_at > me.last_read_at),
    exists (select 1 from public.user_blocks b where b.blocker_id = me.user_id and b.blocked_id = o.user_id)
  from public.conversation_members me
  join public.conversations c on c.id = me.conversation_id
  join public.conversation_members o on o.conversation_id = c.id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id
  left join lateral (
    select m.body, m.sender_id from public.messages m
     where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where me.user_id = (select auth.uid())
  order by c.last_message_at desc
$$;

revoke all on function public.list_my_conversations() from public, anon, authenticated;
grant execute on function public.list_my_conversations() to authenticated;

-- ---------- Abuse reports ----------

create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('community_message', 'private_message', 'user')),
  target_id uuid not null,
  target_user_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'scam', 'other')),
  details text check (details is null or char_length(details) <= 500),
  -- A copy of the reported message, kept so administrators can act even if the author deletes it.
  snapshot text check (snapshot is null or char_length(snapshot) <= 2000),
  status text not null default 'open' check (status in ('open', 'dismissed', 'actioned')),
  handled_by uuid references public.profiles (id) on delete set null,
  handled_note text check (handled_note is null or char_length(handled_note) <= 500),
  handled_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index abuse_reports_once_idx on public.abuse_reports (reporter_id, kind, target_id);
create index abuse_reports_status_idx on public.abuse_reports (status, created_at);

alter table public.abuse_reports enable row level security;
revoke all on public.abuse_reports from anon, authenticated;
grant select on public.abuse_reports to authenticated;

create policy abuse_reports_select on public.abuse_reports
  for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

-- Reporting is the one case where an administrator may see a private message: the person who
-- received it chooses to share that single message. Nothing else in the conversation is exposed.
create function public.report_abuse(
  p_kind text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target_user uuid;
  v_snapshot text;
  v_id uuid;
  v_admin record;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'Your account cannot do this.' using errcode = '42501';
  end if;

  if p_kind = 'community_message' then
    select m.author_id, m.body into v_target_user, v_snapshot
      from public.community_messages m where m.id = p_target_id and not m.is_removed;
  elsif p_kind = 'private_message' then
    select m.sender_id, m.body into v_target_user, v_snapshot
      from public.messages m
     where m.id = p_target_id and public.is_conversation_member(m.conversation_id);
  elsif p_kind = 'user' then
    select p.id into v_target_user from public.profiles p where p.id = p_target_id;
  else
    raise exception 'That cannot be reported.' using errcode = '23514';
  end if;

  if v_target_user is null then
    raise exception 'Nothing to report was found.' using errcode = 'P0002';
  end if;
  if v_target_user = v_uid then
    raise exception 'You cannot report yourself.' using errcode = '23514';
  end if;

  begin
    insert into public.abuse_reports (reporter_id, kind, target_id, target_user_id, reason, details, snapshot)
    values (v_uid, p_kind, p_target_id, v_target_user, p_reason, nullif(btrim(p_details), ''), v_snapshot)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'You already reported this.' using errcode = '23514';
  end;

  perform public.write_activity_log(v_uid, 'communication', 'abuse_reported', 'abuse_report', v_id,
                                    jsonb_build_object('kind', p_kind, 'reason', p_reason));

  for v_admin in
    select p.id from public.profile_private p
     where p.role in ('admin', 'super_admin') and p.status = 'active' and p.id <> v_uid
  loop
    insert into public.notifications (user_id, type, title, body, link)
    values (v_admin.id, 'abuse_report', 'New abuse report', 'Someone reported a ' || replace(p_kind, '_', ' ') || '.', '/admin/abuse');
  end loop;

  return v_id;
end;
$$;

create function public.admin_resolve_abuse_report(p_report_id uuid, p_status text, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_note text := nullif(btrim(p_note), '');
begin
  if v_uid is null or not public.is_admin() then
    raise exception 'Only an administrator can handle abuse reports.' using errcode = '42501';
  end if;
  if p_status not in ('dismissed', 'actioned') then
    raise exception 'That is not a valid outcome.' using errcode = '23514';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'The note is too long (500 characters at most).' using errcode = '23514';
  end if;

  update public.abuse_reports
     set status = p_status, handled_by = v_uid, handled_note = v_note, handled_at = now()
   where id = p_report_id and status = 'open';

  if not found then
    raise exception 'This report was not found or has already been handled.' using errcode = 'P0002';
  end if;

  perform public.write_activity_log(v_uid, 'communication', 'abuse_report_' || p_status, 'abuse_report', p_report_id, '{}'::jsonb);
end;
$$;

revoke all on function public.report_abuse(text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.admin_resolve_abuse_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_abuse(text, uuid, text, text) to authenticated;
grant execute on function public.admin_resolve_abuse_report(uuid, text, text) to authenticated;

-- ---------- Accepting a request now tells the requester ----------

create or replace function public.respond_to_message_request(p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_req public.message_requests%rowtype;
  v_conv uuid;
  v_name text;
begin
  if (select auth.uid()) is null or not public.is_active_user() then
    raise exception 'You cannot respond to requests right now.' using errcode = '42501';
  end if;

  select * into v_req from public.message_requests
   where id = p_request_id and recipient_id = (select auth.uid()) and status = 'pending'
   for update;

  if not found then
    raise exception 'Request not found.' using errcode = 'P0002';
  end if;

  if not p_accept then
    update public.message_requests set status = 'declined', responded_at = now() where id = p_request_id;
    return null;
  end if;

  if public.are_blocked(v_req.requester_id, v_req.recipient_id) then
    raise exception 'You cannot message this person.' using errcode = '23514';
  end if;

  insert into public.conversations (report_id) values (v_req.report_id) returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id)
    values (v_conv, v_req.requester_id), (v_conv, v_req.recipient_id);

  -- The opening message should not create a "new message" alert for the person who just accepted.
  perform set_config('cuagain.skip_message_notify', '1', true);
  insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, v_req.requester_id, v_req.intro_message);
  perform set_config('cuagain.skip_message_notify', '', true);

  update public.message_requests set status = 'accepted', responded_at = now() where id = p_request_id;

  select p.username into v_name from public.profiles p where p.id = v_req.recipient_id;
  insert into public.notifications (user_id, type, title, body, link)
  values (v_req.requester_id, 'message_request_accepted', 'Your message request was accepted',
          left(coalesce(v_name, 'Someone') || ' accepted your request.', 200), '/messages/' || v_conv);

  return v_conv;
end;
$$;

-- ---------- In-app notifications for messages ----------

create function public.notify_message_request()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  select p.username into v_name from public.profiles p where p.id = new.requester_id;
  insert into public.notifications (user_id, type, title, body, link)
  values (new.recipient_id, 'message_request', 'New message request',
          left(coalesce(v_name, 'Someone') || ' would like to message you.', 200), '/messages?tab=requests');
  return new;
end;
$$;

revoke all on function public.notify_message_request() from public, anon, authenticated;

create trigger message_requests_notify
  after insert on public.message_requests
  for each row execute function public.notify_message_request();

create function public.notify_new_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_name text;
  v_member record;
  v_link text := '/messages/' || new.conversation_id;
begin
  if coalesce(current_setting('cuagain.skip_message_notify', true), '') = '1' then
    return new;
  end if;

  select p.username into v_name from public.profiles p where p.id = new.sender_id;

  for v_member in
    select m.user_id from public.conversation_members m
     where m.conversation_id = new.conversation_id and m.user_id <> new.sender_id
  loop
    -- One alert per conversation until it is read, so a busy chat does not flood the list or inbox.
    update public.notifications n
       set created_at = now(), title = left('New message from ' || coalesce(v_name, 'someone'), 120)
     where n.user_id = v_member.user_id and n.type = 'new_message' and n.link = v_link and not n.is_read;

    if not found then
      insert into public.notifications (user_id, type, title, body, link)
      values (v_member.user_id, 'new_message', left('New message from ' || coalesce(v_name, 'someone'), 120),
              'Open the conversation to read it.', v_link);
    end if;
  end loop;

  return new;
end;
$$;

revoke all on function public.notify_new_message() from public, anon, authenticated;

create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- ---------- In-app notifications for reports and claims ----------

create function public.notify_report_submitted()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, type, title, body, link)
  values (new.reporter_id, 'report_submitted', 'Report submitted', left(new.title, 200), '/reports/' || new.id);
  return new;
end;
$$;

revoke all on function public.notify_report_submitted() from public, anon, authenticated;

create trigger reports_notify_submitted
  after insert on public.reports
  for each row execute function public.notify_report_submitted();

-- Same function as before, plus: the finder is told that someone claimed their item.
create or replace function public.record_claim_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_title text;
  v_item text;
  v_finder uuid;
  v_admin record;
begin
  select r.title, r.reporter_id into v_item, v_finder from public.reports r where r.id = new.report_id;

  if tg_op = 'INSERT' then
    insert into public.claim_events (claim_id, actor_id, from_status, to_status)
    values (new.id, new.claimant_id, null, new.status);

    if v_finder is not null and v_finder <> new.claimant_id then
      insert into public.notifications (user_id, type, title, body, link)
      values (v_finder, 'claim_received', 'Someone claimed an item you found',
              left(coalesce(v_item, 'An item'), 200), '/reports/' || new.report_id);
    end if;

    for v_admin in
      select p.id from public.profile_private p
       where p.role in ('admin', 'super_admin') and p.status = 'active'
         and p.id <> new.claimant_id and p.id is distinct from v_finder
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

    if old.status = 'more_info_required' and new.status = 'pending' and new.reviewer_id is not null then
      insert into public.notifications (user_id, type, title, body, link)
      values (new.reviewer_id, 'claim_resubmitted', 'A claimant sent more information',
              left(coalesce(v_item, 'An item'), 200), '/admin/claims/' || new.id);
    end if;
  end if;

  return new;
end;
$$;

-- ---------- Email preferences and the email queue ----------

create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- Reports, claims and returned items. On unless the person turns it off.
  email_updates boolean not null default true,
  -- Message requests and new private messages. Off unless the person turns it on.
  email_messages boolean not null default false,
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;

create policy notification_preferences_select on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy notification_preferences_insert on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy notification_preferences_update on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  template text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_error text check (last_error is null or char_length(last_error) <= 500),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index email_outbox_pending_idx on public.email_outbox (created_at) where status = 'pending';

-- Only the server-side sender (service role) and administrators who monitor delivery can see it.
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;
grant select on public.email_outbox to authenticated;
grant select, update on public.email_outbox to service_role;

create policy email_outbox_admin_select on public.email_outbox
  for select to authenticated using ((select public.is_admin()));

-- Decides, for every new notification, whether an email should follow.
create function public.enqueue_notification_email()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_updates constant text[] := array[
    'report_submitted', 'claim_received', 'claim_submitted', 'claim_resubmitted',
    'claim_approved', 'claim_rejected', 'claim_more_info_required', 'claim_completed', 'item_returned'
  ];
  v_messages constant text[] := array['message_request', 'message_request_accepted', 'new_message'];
  v_prefs public.notification_preferences%rowtype;
  v_wanted boolean := false;
begin
  select * into v_prefs from public.notification_preferences p where p.user_id = new.user_id;

  if new.type = any (v_updates) then
    v_wanted := coalesce(v_prefs.email_updates, true);
  elsif new.type = any (v_messages) then
    v_wanted := coalesce(v_prefs.email_messages, false);
  end if;

  if v_wanted and exists (
    select 1 from public.profile_private p where p.id = new.user_id and p.status = 'active'
  ) then
    insert into public.email_outbox (notification_id, user_id, template) values (new.id, new.user_id, new.type);
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_notification_email() from public, anon, authenticated;

create trigger notifications_enqueue_email
  after insert on public.notifications
  for each row execute function public.enqueue_notification_email();

-- ---------- Live updates ----------
-- Realtime sends a change only to people whose Row Level Security allows them to read that row.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.community_messages, public.notifications;
  end if;
end $$;
