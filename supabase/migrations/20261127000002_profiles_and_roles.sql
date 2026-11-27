-- CUAgain Phase 3, migration 2 of 7: profiles, roles, avatars and the registration trigger.
--
-- Why two profile tables?
--   RLS decides which ROWS a user can see, never which columns. The roadmap wants username, avatar
--   and user type to be visible to other users, but student ID and school email to stay private.
--   So public fields live in `profiles` (any signed-in user can read) and private fields live in
--   `profile_private` (only the owner and administrators can read).
--
-- Roles live in `profile_private.role`. No API role can write that column. The only ways to change
-- it are set_user_role() below (super admins only) or the SQL editor.

-- ---------- Avatars ----------

create table public.avatars (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[a-z0-9-]{1,40}$'),
  label text not null check (char_length(label) between 1 and 60),
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Profiles (public) ----------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_.]{3,20}$'),
  user_type public.user_type not null,
  avatar_id uuid references public.avatars (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Usernames are unique regardless of capitalisation: "Fritz" and "fritz" are the same name.
create unique index profiles_username_lower_key on public.profiles (lower(username));

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------- Profiles (private) ----------

create table public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  student_id text not null unique check (student_id ~ '^[0-9]{7}$'),
  email text not null,
  role public.app_role not null default 'student',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profile_private_role_idx on public.profile_private (role);

create trigger profile_private_set_updated_at
  before update on public.profile_private
  for each row execute function public.set_updated_at();

-- ---------- Role helpers ----------
-- SECURITY DEFINER so they can read profile_private from inside RLS policies without causing
-- a policy to call itself. search_path is pinned so nobody can hijack them with a look-alike table.

create function public.current_user_role()
returns public.app_role
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profile_private p where p.id = (select auth.uid())
$$;

create function public.is_active_user()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.status = 'active' from public.profile_private p where p.id = (select auth.uid())),
    false
  )
$$;

create function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role in ('admin', 'super_admin') and p.status = 'active'
       from public.profile_private p where p.id = (select auth.uid())),
    false
  )
$$;

create function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.role = 'super_admin' and p.status = 'active'
       from public.profile_private p where p.id = (select auth.uid())),
    false
  )
$$;

revoke all on function public.current_user_role() from public, anon, authenticated;
revoke all on function public.is_active_user() from public, anon, authenticated;
revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.is_super_admin() from public, anon, authenticated;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_super_admin() to authenticated;

-- ---------- Activity log writer ----------
-- The activity_logs table is created in migration 6. This function is only called from other
-- SECURITY DEFINER functions, so it is not exposed to the API at all.

create function public.write_activity_log(
  p_actor uuid,
  p_category public.log_category,
  p_action text,
  p_target_type text default null,
  p_target_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.activity_logs (actor_id, category, action, target_type, target_id, metadata)
  values (p_actor, p_category, p_action, p_target_type, p_target_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

revoke all on function public.write_activity_log(uuid, public.log_category, text, text, uuid, jsonb)
  from public, anon, authenticated;

-- ---------- Registration rules, enforced by the database ----------
-- The browser also checks these, but anyone can skip the browser and call the Auth API directly.
-- So the real rules live here. If any rule fails, the whole sign-up is rolled back.

create function public.assert_valid_school_email(p_email text, p_student_id text)
returns void
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_domain text;
begin
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+$' then
    raise exception 'Registration rejected: a valid school email is required.' using errcode = '23514';
  end if;

  if split_part(v_email, '@', 1) <> p_student_id then
    raise exception 'Registration rejected: the email must start with the student ID.' using errcode = '23514';
  end if;

  select s.value into v_domain from public.app_settings s where s.key = 'allowed_email_domain';
  v_domain := lower(btrim(coalesce(v_domain, '')));

  if v_domain <> '' and split_part(v_email, '@', 2) <> v_domain then
    raise exception 'Registration rejected: use your school email address (@%).', v_domain using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.assert_valid_school_email(text, text) from public, anon, authenticated;

create function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := btrim(coalesce(v_meta ->> 'username', ''));
  v_student_id text := btrim(coalesce(v_meta ->> 'student_id', ''));
  v_type_text text := lower(btrim(coalesce(v_meta ->> 'user_type', '')));
  v_user_type public.user_type;
begin
  if v_username !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'Registration rejected: invalid username.' using errcode = '23514';
  end if;

  if v_student_id !~ '^[0-9]{7}$' then
    raise exception 'Registration rejected: the student ID must be exactly seven digits.' using errcode = '23514';
  end if;

  if v_type_text not in ('student', 'staff', 'teacher') then
    raise exception 'Registration rejected: invalid user type.' using errcode = '23514';
  end if;
  v_user_type := v_type_text::public.user_type;

  perform public.assert_valid_school_email(new.email, v_student_id);

  insert into public.profiles (id, username, user_type)
  values (new.id, v_username, v_user_type);

  -- The role comes from the chosen user type and NOTHING else. A "role" field in the sign-up
  -- data is ignored, so nobody can register themselves as an administrator.
  insert into public.profile_private (id, student_id, email, role)
  values (new.id, v_student_id, lower(btrim(new.email)), v_type_text::public.app_role);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep the private copy of the email in step when someone changes their email, and apply the
-- same rules so the change cannot be used to slip past the student ID or domain check.
create function public.handle_user_email_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_student_id text;
begin
  select p.student_id into v_student_id from public.profile_private p where p.id = new.id;

  if v_student_id is not null then
    perform public.assert_valid_school_email(new.email, v_student_id);
    update public.profile_private set email = lower(btrim(new.email)) where id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.handle_user_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------- Role and account management (administrators only) ----------

create function public.set_user_role(target_user uuid, new_role public.app_role)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old public.app_role;
  v_other_super_admins integer;
begin
  if (select auth.uid()) is null or not public.is_super_admin() then
    raise exception 'Only a super admin can change roles.' using errcode = '42501';
  end if;

  select p.role into v_old from public.profile_private p where p.id = target_user for update;
  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  if v_old = new_role then
    return;
  end if;

  if v_old = 'super_admin' then
    select count(*) into v_other_super_admins
      from public.profile_private p
     where p.role = 'super_admin' and p.status = 'active' and p.id <> target_user;

    if v_other_super_admins = 0 then
      raise exception 'There must always be at least one active super admin.' using errcode = '23514';
    end if;
  end if;

  update public.profile_private set role = new_role where id = target_user;

  perform public.write_activity_log(
    (select auth.uid()), 'administrator', 'role_changed', 'user', target_user,
    jsonb_build_object('from', v_old, 'to', new_role)
  );
end;
$$;

create function public.set_account_status(target_user uuid, new_status public.account_status)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_target_role public.app_role;
  v_old public.account_status;
begin
  if (select auth.uid()) is null or not public.is_admin() then
    raise exception 'Only an administrator can suspend or restore accounts.' using errcode = '42501';
  end if;

  if target_user = (select auth.uid()) then
    raise exception 'You cannot change the status of your own account.' using errcode = '42501';
  end if;

  select p.role, p.status into v_target_role, v_old
    from public.profile_private p where p.id = target_user for update;
  if not found then
    raise exception 'User not found.' using errcode = 'P0002';
  end if;

  -- Administrators can manage ordinary users. Only a super admin can touch another administrator.
  if v_target_role in ('admin', 'super_admin') and not public.is_super_admin() then
    raise exception 'Only a super admin can change the status of an administrator.' using errcode = '42501';
  end if;

  if v_old = new_status then
    return;
  end if;

  update public.profile_private set status = new_status where id = target_user;

  perform public.write_activity_log(
    (select auth.uid()), 'administrator',
    case new_status when 'suspended' then 'account_suspended' else 'account_restored' end,
    'user', target_user, jsonb_build_object('from', v_old, 'to', new_status)
  );
end;
$$;

revoke all on function public.set_user_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.set_account_status(uuid, public.account_status) from public, anon, authenticated;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
grant execute on function public.set_account_status(uuid, public.account_status) to authenticated;

-- ---------- Privileges and policies ----------

alter table public.avatars enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

revoke all on public.avatars from anon, authenticated;
revoke all on public.profiles from anon, authenticated;
revoke all on public.profile_private from anon, authenticated;

-- avatars: everyone signed in can see the active choices; only administrators manage them.
grant select, insert, update, delete on public.avatars to authenticated;

create policy avatars_select on public.avatars
  for select to authenticated
  using (is_active or (select public.is_admin()));

create policy avatars_admin_insert on public.avatars
  for insert to authenticated
  with check ((select public.is_admin()));

create policy avatars_admin_update on public.avatars
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy avatars_admin_delete on public.avatars
  for delete to authenticated
  using ((select public.is_admin()));

-- profiles: any signed-in user can read the public fields. A user can edit only their own username
-- and avatar. The column grant below is what stops them touching user_type or id.
grant select on public.profiles to authenticated;
grant update (username, avatar_id) on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) and (select public.is_active_user()))
  with check (
    id = (select auth.uid())
    and (avatar_id is null or exists (select 1 from public.avatars a where a.id = avatar_id and a.is_active))
  );

-- profile_private: read-only for the API. The owner sees their own row, administrators see all.
-- There is deliberately no insert, update or delete grant, so no browser request can change a role.
grant select on public.profile_private to authenticated;

create policy profile_private_select on public.profile_private
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

-- app_settings (created in migration 1): super admins only.
create policy app_settings_select on public.app_settings
  for select to authenticated
  using ((select public.is_super_admin()));

create policy app_settings_update on public.app_settings
  for update to authenticated
  using ((select public.is_super_admin()))
  with check ((select public.is_super_admin()));
