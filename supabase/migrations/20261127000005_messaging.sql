-- CUAgain Phase 3, migration 5 of 7: private messaging and the community chat.
--
-- Private chats start with a message REQUEST. Nothing is delivered to the other person's inbox
-- until they accept. Only the two people in a conversation can read it (administrators cannot).

-- ---------- Message requests ----------

create table public.message_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  report_id uuid references public.reports (id) on delete set null,
  intro_message text not null check (char_length(btrim(intro_message)) between 1 and 500),
  status public.message_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint message_requests_not_self check (requester_id <> recipient_id)
);

-- Only one waiting request per pair of people in each direction.
create unique index message_requests_one_pending_idx
  on public.message_requests (requester_id, recipient_id) where status = 'pending';
create index message_requests_recipient_idx on public.message_requests (recipient_id, status);

alter table public.message_requests enable row level security;
revoke all on public.message_requests from anon, authenticated;
grant select, insert on public.message_requests to authenticated;

create policy message_requests_select on public.message_requests
  for select to authenticated
  using (requester_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create policy message_requests_insert on public.message_requests
  for insert to authenticated
  with check (
    requester_id = (select auth.uid())
    and (select public.is_active_user())
    and status = 'pending'
    and responded_at is null
  );

-- ---------- Conversations ----------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports (id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_members_user_idx on public.conversation_members (user_id);

create function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_members m
     where m.conversation_id = p_conversation_id and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public, anon, authenticated;
grant execute on function public.is_conversation_member(uuid) to authenticated;

alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;

create policy conversations_select on public.conversations
  for select to authenticated
  using ((select public.is_conversation_member(id)));

alter table public.conversation_members enable row level security;
revoke all on public.conversation_members from anon, authenticated;
grant select on public.conversation_members to authenticated, service_role;
grant update (last_read_at) on public.conversation_members to authenticated;

create policy conversation_members_select on public.conversation_members
  for select to authenticated
  using ((select public.is_conversation_member(conversation_id)));

create policy conversation_members_update_own on public.conversation_members
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Answering a request. Accepting creates the conversation for both people.
create function public.respond_to_message_request(p_request_id uuid, p_accept boolean)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_req public.message_requests%rowtype;
  v_conv uuid;
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

  insert into public.conversations (report_id) values (v_req.report_id) returning id into v_conv;
  insert into public.conversation_members (conversation_id, user_id)
    values (v_conv, v_req.requester_id), (v_conv, v_req.recipient_id);
  insert into public.messages (conversation_id, sender_id, body)
    values (v_conv, v_req.requester_id, v_req.intro_message);

  update public.message_requests set status = 'accepted', responded_at = now() where id = p_request_id;

  return v_conv;
end;
$$;

-- ---------- Messages ----------

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);

create function public.touch_conversation()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_conversation() from public, anon, authenticated;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation();

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select, insert on public.messages to authenticated;

create policy messages_select on public.messages
  for select to authenticated
  using ((select public.is_conversation_member(conversation_id)));

create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select public.is_active_user())
    and (select public.is_conversation_member(conversation_id))
  );

revoke all on function public.respond_to_message_request(uuid, boolean) from public, anon, authenticated;
grant execute on function public.respond_to_message_request(uuid, boolean) to authenticated;

-- ---------- Community chat ----------

create table public.community_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 500),
  is_removed boolean not null default false,
  removed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index community_messages_created_idx on public.community_messages (created_at desc);

alter table public.community_messages enable row level security;
revoke all on public.community_messages from anon, authenticated;
grant select, insert on public.community_messages to authenticated;

create policy community_messages_select on public.community_messages
  for select to authenticated
  using (not is_removed or (select public.is_admin()));

create policy community_messages_insert on public.community_messages
  for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and (select public.is_active_user())
    and not is_removed
    and removed_by is null
  );

create function public.admin_remove_community_message(p_message_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only an administrator can remove a message.' using errcode = '42501';
  end if;

  update public.community_messages
     set is_removed = true, removed_by = (select auth.uid())
   where id = p_message_id;

  if not found then
    raise exception 'Message not found.' using errcode = 'P0002';
  end if;

  perform public.write_activity_log(
    (select auth.uid()), 'communication', 'community_message_removed', 'community_message', p_message_id, '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_remove_community_message(uuid) from public, anon, authenticated;
grant execute on function public.admin_remove_community_message(uuid) to authenticated;
