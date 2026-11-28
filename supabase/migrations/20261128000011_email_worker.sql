-- Phase 6: a narrow, server-only door for the email worker.
-- The worker (an Edge Function using the service-role key) must not be able to read whole tables
-- such as profile_private. It may only call this function, which hands out a small batch of
-- pending emails together with the few fields needed to write each one.

create function public.claim_pending_emails(p_limit integer default 20)
returns table (
  outbox_id uuid,
  template text,
  attempts integer,
  to_email text,
  to_name text,
  title text,
  body text,
  link text
)
language plpgsql security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select o.id
      from public.email_outbox o
     where o.status = 'pending' and o.attempts < 5
     order by o.created_at
     limit least(greatest(coalesce(p_limit, 20), 1), 50)
       for update skip locked
  ),
  bumped as (
    update public.email_outbox o
       set attempts = o.attempts + 1
      from picked
     where o.id = picked.id
    returning o.id, o.notification_id, o.user_id, o.template, o.attempts
  )
  select b.id, b.template, b.attempts, pp.email, p.username, n.title, n.body, n.link
    from bumped b
    join public.notifications n on n.id = b.notification_id
    join public.profile_private pp on pp.id = b.user_id
    join public.profiles p on p.id = b.user_id;
end;
$$;

revoke all on function public.claim_pending_emails(integer) from public, anon, authenticated;
grant execute on function public.claim_pending_emails(integer) to service_role;
