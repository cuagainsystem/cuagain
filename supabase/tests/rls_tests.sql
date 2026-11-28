-- CUAgain Phase 3: access-control test suite.
--
-- Every test pretends to be a real user by switching to the "authenticated" (or "anon") database
-- role and setting the user id, exactly like a request through the Supabase API. Each test says
-- what should happen, including attempts that must be REFUSED. All changes are rolled back at the
-- end, so the script is safe to run repeatedly.
--
-- Run it with:  supabase/tests/run.sh

\set ON_ERROR_STOP on
begin;

create schema t;
grant usage on schema t to public;
create table t.results (name text, ok boolean);
grant all on t.results to public;

create function t.as_user(p uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p)::text, true);
  set local role authenticated;
end $$;

create function t.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end $$;

create function t.back() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create function t.ok(p_name text, p_cond boolean) returns void language plpgsql as $$
begin
  insert into t.results values (p_name, coalesce(p_cond, false));
  if not coalesce(p_cond, false) then raise notice 'FAIL: %', p_name; end if;
end $$;

-- The statement must be refused. If p_state is given, the error code must match.
create function t.err(p_name text, p_sql text, p_state text default null) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    insert into t.results values (p_name, false);
    raise notice 'FAIL (was allowed): %', p_name;
  exception when others then
    if p_state is null or sqlstate = p_state then
      insert into t.results values (p_name, true);
    else
      insert into t.results values (p_name, false);
      raise notice 'FAIL (wrong error %: %): %', sqlstate, sqlerrm, p_name;
    end if;
  end;
end $$;

-- The statement must succeed.
create function t.works(p_name text, p_sql text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
    insert into t.results values (p_name, true);
  exception when others then
    insert into t.results values (p_name, false);
    raise notice 'FAIL (% : %): %', sqlstate, sqlerrm, p_name;
  end;
end $$;

create function t.rows(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute 'select count(*) from (' || p_sql || ') q' into n;
  return n;
end $$;

create function t.affected(p_sql text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end $$;

create function t.mkreport(p_id uuid, p_reporter uuid, p_type text, p_slug text) returns void language plpgsql as $$
begin
  perform t.as_user(p_reporter);
  insert into public.reports (id, reporter_id, type, title, category_id, description, location, occurred_on)
  values (p_id, p_reporter, p_type::public.report_type, 'Test item ' || p_slug,
          (select id from public.categories where slug = p_slug),
          'A description that is long enough.', 'Library', current_date);
  perform t.back();
end $$;

-- ===================================================================================
-- 1. Registration rules (database trigger on auth.users)
-- ===================================================================================
do $$
declare
  v_ins text := $q$insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), %L, %L::jsonb)$q$;
begin
  perform t.back();

  perform t.works('register: valid student',
    format(v_ins, '2024001@school.test', '{"username":"alice","student_id":"2024001","user_type":"student"}'));
  perform t.works('register: valid student 2',
    format(v_ins, '2024002@school.test', '{"username":"bob","student_id":"2024002","user_type":"student"}'));
  perform t.works('register: valid staff',
    format(v_ins, '2024003@school.test', '{"username":"carol","student_id":"2024003","user_type":"staff"}'));
  perform t.works('register: valid teacher',
    format(v_ins, '2024004@school.test', '{"username":"dave","student_id":"2024004","user_type":"teacher"}'));
  perform t.works('register: valid student 5',
    format(v_ins, '2024005@school.test', '{"username":"admin_one","student_id":"2024005","user_type":"student"}'));
  perform t.works('register: valid student 6',
    format(v_ins, '2024006@school.test', '{"username":"super_one","student_id":"2024006","user_type":"student"}'));

  -- Sneaking a role in through sign-up data must have no effect.
  perform t.works('register: role in metadata is accepted but ignored',
    format(v_ins, '2024007@school.test', '{"username":"eve","student_id":"2024007","user_type":"student","role":"super_admin"}'));
  perform t.ok('register: sneaked role did not apply',
    (select role = 'student' from public.profile_private where student_id = '2024007'));
  perform t.ok('register: role follows chosen user type (staff)',
    (select role = 'staff' from public.profile_private where student_id = '2024003'));

  perform t.works('register: the app sends the user type capitalised, which is accepted',
    format(v_ins, '2024018@school.test', '{"username":"cap_type","student_id":"2024018","user_type":"Teacher"}'));
  perform t.ok('register: capitalised type stored correctly',
    (select role = 'teacher' from public.profile_private where student_id = '2024018'));

  perform t.err('register: student ID with 6 digits',
    format(v_ins, '202400@school.test', '{"username":"x_six","student_id":"202400","user_type":"student"}'));
  perform t.err('register: student ID with letters',
    format(v_ins, 'abcdefg@school.test', '{"username":"x_letters","student_id":"abcdefg","user_type":"student"}'));
  perform t.err('register: email prefix does not match student ID',
    format(v_ins, '2024999@school.test', '{"username":"x_mismatch","student_id":"2024008","user_type":"student"}'));
  perform t.err('register: user type admin is refused',
    format(v_ins, '2024009@school.test', '{"username":"x_admin","student_id":"2024009","user_type":"admin"}'));
  perform t.err('register: user type missing',
    format(v_ins, '2024010@school.test', '{"username":"x_notype","student_id":"2024010"}'));
  perform t.err('register: username too short',
    format(v_ins, '2024011@school.test', '{"username":"ab","student_id":"2024011","user_type":"student"}'));
  perform t.err('register: username with illegal characters',
    format(v_ins, '2024012@school.test', '{"username":"bad name!","student_id":"2024012","user_type":"student"}'));
  perform t.err('register: duplicate username, different case',
    format(v_ins, '2024013@school.test', '{"username":"ALICE","student_id":"2024013","user_type":"student"}'));
  perform t.err('register: duplicate student ID',
    format(v_ins, '2024001@other.test', '{"username":"x_dupid","student_id":"2024001","user_type":"student"}'));
  perform t.err('register: no metadata at all',
    format(v_ins, '2024014@school.test', '{}'));

  -- Domain enforcement: off until the university confirms the domain, then on.
  update public.app_settings set value = 'g.cu.edu.ph' where key = 'allowed_email_domain';
  perform t.err('domain on: wrong domain refused',
    format(v_ins, '2024015@gmail.com', '{"username":"x_gmail","student_id":"2024015","user_type":"student"}'));
  perform t.works('domain on: right domain accepted',
    format(v_ins, '2024016@g.cu.edu.ph', '{"username":"x_good_dom","student_id":"2024016","user_type":"student"}'));
  update public.app_settings set value = null where key = 'allowed_email_domain';
  perform t.works('domain off: any domain accepted',
    format(v_ins, '2024017@gmail.com', '{"username":"x_any_dom","student_id":"2024017","user_type":"student"}'));

  perform t.ok('register: every account got a public profile and a private record',
    (select count(*) from public.profiles) = (select count(*) from public.profile_private));

  -- Test accounts. Admin roles can only be granted by direct database access (the bootstrap step).
  update public.profile_private set role = 'admin' where student_id = '2024005';
  update public.profile_private set role = 'super_admin' where student_id = '2024006';
end $$;

-- Fixed ids for the people below.
create function t.u(p_student_id text) returns uuid language sql stable as
  $$ select id from public.profile_private where student_id = p_student_id $$;

-- ===================================================================================
-- 2. Profiles, private data, roles
-- ===================================================================================
do $$
declare alice uuid := t.u('2024001'); bob uuid := t.u('2024002'); carol uuid := t.u('2024003');
        dave uuid := t.u('2024004'); adm uuid := t.u('2024005'); sup uuid := t.u('2024006');
begin
  perform t.as_user(alice);
  perform t.ok('profiles: a signed-in user can see other public profiles', t.rows('select 1 from public.profiles') >= 6);
  perform t.ok('private: a user sees exactly one private record (their own)', t.rows('select 1 from public.profile_private') = 1);
  perform t.ok('private: the one record is their own',
    (select student_id from public.profile_private) = '2024001');
  perform t.ok('profile: current_user_role is student', public.current_user_role() = 'student');
  perform t.ok('profile: update own username works', t.affected($q$update public.profiles set username = 'alice_new' where id = auth.uid()$q$) = 1);
  perform t.ok('profile: update someone else changes nothing',
    t.affected(format($q$update public.profiles set username = 'hijack' where id = %L$q$, bob)) = 0);
  perform t.err('profile: cannot change user type', $q$update public.profiles set user_type = 'staff' where id = auth.uid()$q$, '42501');
  perform t.err('profile: cannot change own id', format($q$update public.profiles set id = %L where id = auth.uid()$q$, bob), '42501');
  perform t.err('profile: cannot insert a profile directly', format($q$insert into public.profiles (id, username, user_type) values (gen_random_uuid(), 'ghost', 'student')$q$), '42501');
  perform t.err('profile: cannot delete a profile', $q$delete from public.profiles where id = auth.uid()$q$, '42501');
  perform t.err('roles: cannot update own role directly', $q$update public.profile_private set role = 'admin' where id = auth.uid()$q$, '42501');
  perform t.err('roles: cannot update own status directly', $q$update public.profile_private set status = 'active' where id = auth.uid()$q$, '42501');
  perform t.err('roles: cannot edit own student ID', $q$update public.profile_private set student_id = '1234567' where id = auth.uid()$q$, '42501');
  perform t.err('roles: cannot insert a private record', format($q$insert into public.profile_private (id, student_id, email, role) values (%L, '9999999', 'x@y.z', 'super_admin')$q$, alice));
  perform t.err('roles: set_user_role refused for a student', format($q$select public.set_user_role(%L, 'admin')$q$, alice), '42501');
  perform t.err('roles: set_account_status refused for a student', format($q$select public.set_account_status(%L, 'suspended')$q$, bob), '42501');
  perform t.ok('settings: a student sees no app settings', t.rows('select 1 from public.app_settings') = 0);
  perform t.ok('settings: a student cannot change app settings',
    t.affected($q$update public.app_settings set value = 'evil.test'$q$) = 0);
  perform t.ok('avatars: a student can list active avatars', t.rows('select 1 from public.avatars where is_active') = 8);
  perform t.err('avatars: a student cannot add avatars', $q$insert into public.avatars (key, label) values ('x','x')$q$, '42501');
  perform t.back();

  -- avatar selection
  perform t.as_user(alice);
  perform t.works('profile: choose an active avatar',
    $q$update public.profiles set avatar_id = (select id from public.avatars where key = 'avatar-2') where id = auth.uid()$q$);
  perform t.back();

  -- admin (not super)
  perform t.as_user(adm);
  perform t.ok('admin: sees every private record', t.rows('select 1 from public.profile_private') >= 8);
  perform t.ok('admin: current_user_role is admin', public.current_user_role() = 'admin');
  perform t.err('admin: cannot grant roles (super admin only)', format($q$select public.set_user_role(%L, 'admin')$q$, bob), '42501');
  perform t.ok('admin: cannot read app settings', t.rows('select 1 from public.app_settings') = 0);
  perform t.err('admin: cannot suspend a super admin', format($q$select public.set_account_status(%L, 'suspended')$q$, sup), '42501');
  perform t.err('admin: cannot suspend themselves', format($q$select public.set_account_status(%L, 'suspended')$q$, adm), '42501');
  perform t.works('admin: can suspend a normal user', format($q$select public.set_account_status(%L, 'suspended')$q$, carol));
  perform t.back();

  -- suspended user
  perform t.as_user(carol);
  perform t.ok('suspended: is_active_user is false', public.is_active_user() = false);
  perform t.ok('suspended: cannot edit own profile', t.affected($q$update public.profiles set username = 'carol_x' where id = auth.uid()$q$) = 0);
  perform t.err('suspended: cannot post in community chat', format($q$insert into public.community_messages (author_id, body) values (%L, 'hello')$q$, carol), '42501');
  perform t.err('suspended: cannot create a report',
    format($q$insert into public.reports (reporter_id, type, title, category_id, description, location, occurred_on)
      values (%L, 'lost', 'Blue bottle', (select id from public.categories limit 1), 'Long enough description.', 'Gate', current_date)$q$, carol), '42501');
  perform t.back();

  perform t.as_user(adm);
  perform t.works('admin: can reactivate a user', format($q$select public.set_account_status(%L, 'active')$q$, carol));
  perform t.back();

  -- super admin
  perform t.as_user(sup);
  perform t.ok('super admin: can read app settings', t.rows('select 1 from public.app_settings') = 1);
  perform t.ok('super admin: can change the email domain',
    t.affected($q$update public.app_settings set value = 'g.cu.edu.ph' where key = 'allowed_email_domain'$q$) = 1);
  perform t.works('super admin: can promote a user to admin', format($q$select public.set_user_role(%L, 'admin')$q$, dave));
  perform t.ok('super admin: promotion took effect', (select role from public.profile_private where id = dave) = 'admin');
  perform t.works('super admin: can demote them again', format($q$select public.set_user_role(%L, 'staff')$q$, dave));
  perform t.err('super admin: cannot remove the last super admin', format($q$select public.set_user_role(%L, 'student')$q$, sup));
  perform t.back();
  update public.app_settings set value = null where key = 'allowed_email_domain';

  -- Role changes and suspensions were recorded in the activity log.
  perform t.ok('log: role and status changes were logged',
    (select count(*) from public.activity_logs where category in ('user','administrator','security')) >= 3);

  -- anonymous visitors
  perform t.as_anon();
  perform t.err('anon: cannot read profiles', 'select * from public.profiles', '42501');
  perform t.err('anon: cannot read private records', 'select * from public.profile_private', '42501');
  perform t.err('anon: cannot call role helper', 'select public.current_user_role()', '42501');
  perform t.back();
end $$;

-- ===================================================================================
-- 3. Reports and images
-- ===================================================================================
do $$
declare alice uuid := t.u('2024001'); bob uuid := t.u('2024002'); carol uuid := t.u('2024003');
        adm uuid := t.u('2024005');
begin
  perform t.mkreport('b0000000-0000-0000-0000-000000000001', alice, 'lost', 'electronics');
  perform t.mkreport('b0000000-0000-0000-0000-000000000002', bob, 'found', 'electronics');
  perform t.mkreport('b0000000-0000-0000-0000-000000000003', alice, 'found', 'electronics');
  perform t.mkreport('b0000000-0000-0000-0000-000000000004', alice, 'found', 'identification');
  perform t.mkreport('b0000000-0000-0000-0000-000000000005', bob, 'found', 'clothing');

  perform t.as_user(bob);
  perform t.ok('reports: everyone signed in can browse reports', t.rows('select 1 from public.reports') = 5);
  perform t.err('reports: cannot file a report as someone else',
    format($q$insert into public.reports (reporter_id, type, title, category_id, description, location, occurred_on)
      values (%L, 'lost', 'Fake', (select id from public.categories limit 1), 'Long enough description.', 'Gate', current_date)$q$, alice), '42501');
  perform t.err('reports: cannot file a report that starts completed',
    format($q$insert into public.reports (reporter_id, type, title, category_id, description, location, occurred_on, status)
      values (%L, 'lost', 'Sneaky', (select id from public.categories limit 1), 'Long enough description.', 'Gate', current_date, 'completed')$q$, bob), '42501');
  perform t.err('reports: cannot file a report dated in the future',
    format($q$insert into public.reports (reporter_id, type, title, category_id, description, location, occurred_on)
      values (%L, 'lost', 'Future', (select id from public.categories limit 1), 'Long enough description.', 'Gate', current_date + 10)$q$, bob), '23514');
  perform t.err('reports: title too short is refused',
    format($q$insert into public.reports (reporter_id, type, title, category_id, description, location, occurred_on)
      values (%L, 'lost', 'ab', (select id from public.categories limit 1), 'Long enough description.', 'Gate', current_date)$q$, bob), '23514');
  perform t.err('reports: a lost report cannot be marked handed to office',
    format($q$insert into public.reports (reporter_id, type, title, category_id, description, location, occurred_on, handed_to_office)
      values (%L, 'lost', 'Handed', (select id from public.categories limit 1), 'Long enough description.', 'Gate', current_date, true)$q$, bob), '23514');
  perform t.ok('reports: cannot edit someone else''s report',
    t.affected($q$update public.reports set title = 'Hijacked' where id = 'b0000000-0000-0000-0000-000000000001'$q$) = 0);
  perform t.ok('reports: cannot delete someone else''s report',
    t.affected($q$delete from public.reports where id = 'b0000000-0000-0000-0000-000000000001'$q$) = 0);
  perform t.back();

  perform t.as_user(alice);
  perform t.ok('reports: owner can edit own open report',
    t.affected($q$update public.reports set title = 'Updated title' where id = 'b0000000-0000-0000-0000-000000000001'$q$) = 1);
  perform t.err('reports: owner cannot change status', $q$update public.reports set status = 'completed' where id = 'b0000000-0000-0000-0000-000000000001'$q$, '42501');
  perform t.err('reports: owner cannot unhide or hide', $q$update public.reports set is_hidden = true where id = 'b0000000-0000-0000-0000-000000000001'$q$, '42501');
  perform t.err('reports: owner cannot change report type', $q$update public.reports set type = 'found' where id = 'b0000000-0000-0000-0000-000000000001'$q$, '42501');
  perform t.err('reports: owner cannot transfer ownership', format($q$update public.reports set reporter_id = %L where id = 'b0000000-0000-0000-0000-000000000001'$q$, bob), '42501');
  perform t.err('reports: owner cannot call admin status function', $q$select public.admin_set_report_status('b0000000-0000-0000-0000-000000000001', 'completed')$q$, '42501');
  perform t.err('reports: owner cannot call admin hide function', $q$select public.admin_set_report_hidden('b0000000-0000-0000-0000-000000000001', true)$q$, '42501');
  perform t.back();

  -- Moderation: hidden reports disappear for everyone except the owner and admins.
  perform t.as_user(adm);
  perform t.works('admin: can hide a report', $q$select public.admin_set_report_hidden('b0000000-0000-0000-0000-000000000005', true, 'Spam')$q$);
  perform t.ok('admin: still sees a hidden report', t.rows($q$select 1 from public.reports where id = 'b0000000-0000-0000-0000-000000000005'$q$) = 1);
  perform t.back();
  perform t.as_user(alice);
  perform t.ok('hidden: other users cannot see it', t.rows($q$select 1 from public.reports where id = 'b0000000-0000-0000-0000-000000000005'$q$) = 0);
  perform t.back();
  perform t.as_user(bob);
  perform t.ok('hidden: the owner still sees it', t.rows($q$select 1 from public.reports where id = 'b0000000-0000-0000-0000-000000000005'$q$) = 1);
  perform t.back();
  perform t.as_user(carol);
  perform t.err('hidden: a hidden item cannot be claimed',
    $q$insert into public.claims (report_id, claimant_id, explanation) values ('b0000000-0000-0000-0000-000000000005', auth.uid(), 'This is mine, here is why.')$q$);
  perform t.back();
  perform t.as_user(adm);
  perform t.works('admin: can unhide a report', $q$select public.admin_set_report_hidden('b0000000-0000-0000-0000-000000000005', false)$q$);
  perform t.back();

  -- Images
  perform t.as_user(alice);
  perform t.works('images: owner adds a photo',
    $q$insert into public.item_images (report_id, uploaded_by, storage_path, mime_type, size_bytes) values ('b0000000-0000-0000-0000-000000000003', auth.uid(), auth.uid()::text || '/b0000000-0000-0000-0000-000000000003/1.jpg', 'image/jpeg', 1000)$q$);
  perform t.works('images: owner adds a photo to an ID report, asking for it to be public',
    $q$insert into public.item_images (report_id, uploaded_by, storage_path, mime_type, size_bytes, is_public) values ('b0000000-0000-0000-0000-000000000004', auth.uid(), auth.uid()::text || '/b0000000-0000-0000-0000-000000000004/id.jpg', 'image/jpeg', 1000, true)$q$);
  perform t.err('images: wrong file type refused',
    $q$insert into public.item_images (report_id, uploaded_by, storage_path, mime_type, size_bytes) values ('b0000000-0000-0000-0000-000000000003', auth.uid(), auth.uid()::text || '/b0000000-0000-0000-0000-000000000003/x.exe', 'application/x-msdownload', 1000)$q$, '23514');
  perform t.err('images: file over 5 MB refused',
    $q$insert into public.item_images (report_id, uploaded_by, storage_path, mime_type, size_bytes) values ('b0000000-0000-0000-0000-000000000003', auth.uid(), auth.uid()::text || '/b0000000-0000-0000-0000-000000000003/big.jpg', 'image/jpeg', 6000000)$q$, '23514');
  perform t.works('images: photos 2 to 5',
    $q$insert into public.item_images (report_id, uploaded_by, storage_path, mime_type, size_bytes)
       select 'b0000000-0000-0000-0000-000000000003', auth.uid(), auth.uid()::text || '/b0000000-0000-0000-0000-000000000003/n' || g || '.jpg', 'image/jpeg', 1000 from generate_series(2, 5) g$q$);
  perform t.err('images: a sixth photo is refused',
    $q$insert into public.item_images (report_id, uploaded_by, storage_path, mime_type, size_bytes) values ('b0000000-0000-0000-0000-000000000003', auth.uid(), auth.uid()::text || '/b0000000-0000-0000-0000-000000000003/6.jpg', 'image/jpeg', 1000)$q$, '23514');
  perform t.ok('images: the owner sees their ID photo', t.rows($q$select 1 from public.item_images where report_id = 'b0000000-0000-0000-0000-000000000004'$q$) = 1);
  perform t.back();

  perform t.as_user(bob);
  perform t.ok('images: others see public photos', t.rows($q$select 1 from public.item_images where report_id = 'b0000000-0000-0000-0000-000000000003'$q$) = 5);
  perform t.ok('images: others NEVER see photos of IDs', t.rows($q$select 1 from public.item_images where report_id = 'b0000000-0000-0000-0000-000000000004'$q$) = 0);
  perform t.err('images: cannot attach a photo to someone else''s report',
    $q$insert into public.item_images (report_id, uploaded_by, storage_path, mime_type, size_bytes) values ('b0000000-0000-0000-0000-000000000001', auth.uid(), auth.uid()::text || '/b0000000-0000-0000-0000-000000000001/1.jpg', 'image/jpeg', 1000)$q$, '42501');
  perform t.ok('images: cannot delete someone else''s photo',
    t.affected($q$delete from public.item_images where report_id = 'b0000000-0000-0000-0000-000000000003'$q$) = 0);
  perform t.back();

  perform t.as_user(adm);
  perform t.ok('images: admin sees ID photos', t.rows($q$select 1 from public.item_images where report_id = 'b0000000-0000-0000-0000-000000000004'$q$) = 1);
  perform t.back();

  perform t.ok('images: ID photo was forced to private by the database',
    (select not is_public from public.item_images where storage_path like '%/b0000000-0000-0000-0000-000000000004/id.jpg'));

  -- Categories
  perform t.as_user(alice);
  perform t.ok('categories: users see active categories', t.rows('select 1 from public.categories') = 7);
  perform t.err('categories: users cannot add categories', $q$insert into public.categories (slug, label) values ('hacked', 'Hacked')$q$, '42501');
  perform t.ok('categories: users cannot edit categories', t.affected($q$update public.categories set label = 'x'$q$) = 0);
  perform t.back();

  -- Admin status change, then owner can no longer edit.
  perform t.as_user(adm);
  perform t.works('admin: can move a report to under review', $q$select public.admin_set_report_status('b0000000-0000-0000-0000-000000000001', 'under_review')$q$);
  perform t.back();
  perform t.as_user(alice);
  perform t.ok('reports: owner cannot edit once it is under review',
    t.affected($q$update public.reports set title = 'Late edit' where id = 'b0000000-0000-0000-0000-000000000001'$q$) = 0);
  perform t.ok('reports: owner cannot delete once it is under review',
    t.affected($q$delete from public.reports where id = 'b0000000-0000-0000-0000-000000000001'$q$) = 0);
  perform t.back();

  perform t.as_anon();
  perform t.err('anon: cannot read reports', 'select * from public.reports', '42501');
  perform t.err('anon: cannot read images', 'select * from public.item_images', '42501');
  perform t.back();
end $$;

-- ===================================================================================
-- 4. Claims, evidence, feedback
-- ===================================================================================
do $$
declare alice uuid := t.u('2024001'); bob uuid := t.u('2024002'); carol uuid := t.u('2024003');
        dave uuid := t.u('2024004'); adm uuid := t.u('2024005');
begin
  perform t.as_user(alice);
  perform t.works('claims: claim someone else''s found item',
    $q$insert into public.claims (id, report_id, claimant_id, explanation) values ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002', auth.uid(), 'It has a green case and a crack.')$q$);
  perform t.err('claims: cannot claim own found item',
    $q$insert into public.claims (report_id, claimant_id, explanation) values ('b0000000-0000-0000-0000-000000000003', auth.uid(), 'It is mine, I found it.')$q$, '23514');
  perform t.err('claims: cannot claim a lost report',
    $q$insert into public.claims (report_id, claimant_id, explanation) values ('b0000000-0000-0000-0000-000000000001', auth.uid(), 'This should not be possible.')$q$, '23514');
  perform t.err('claims: cannot claim the same item twice',
    $q$insert into public.claims (report_id, claimant_id, explanation) values ('b0000000-0000-0000-0000-000000000002', auth.uid(), 'Trying a second time here.')$q$, '23505');
  perform t.err('claims: cannot file a claim as someone else',
    format($q$insert into public.claims (report_id, claimant_id, explanation) values ('b0000000-0000-0000-0000-000000000003', %L, 'Pretending to be bob.')$q$, bob), '42501');
  perform t.err('claims: cannot file an already-approved claim',
    $q$insert into public.claims (report_id, claimant_id, explanation, status) values ('b0000000-0000-0000-0000-000000000005', auth.uid(), 'Skipping the review step.', 'approved')$q$, '42501');
  perform t.err('claims: claimant cannot change status', $q$update public.claims set status = 'approved' where id = 'c0000000-0000-0000-0000-000000000001'$q$, '42501');
  perform t.err('claims: claimant cannot set a reviewer', format($q$update public.claims set reviewer_id = %L where id = 'c0000000-0000-0000-0000-000000000001'$q$, adm), '42501');
  perform t.ok('claims: claimant can add detail to the explanation',
    t.affected($q$update public.claims set explanation = 'It has a green case, a crack and a sticker.' where id = 'c0000000-0000-0000-0000-000000000001'$q$) = 1);
  perform t.works('evidence: claimant attaches evidence',
    $q$insert into public.claim_evidence (claim_id, uploaded_by, storage_path, mime_type, size_bytes) values ('c0000000-0000-0000-0000-000000000001', auth.uid(), auth.uid()::text || '/c0000000-0000-0000-0000-000000000001/1.jpg', 'image/jpeg', 2000)$q$);
  perform t.err('evidence: file type restricted',
    $q$insert into public.claim_evidence (claim_id, uploaded_by, storage_path, mime_type, size_bytes) values ('c0000000-0000-0000-0000-000000000001', auth.uid(), auth.uid()::text || '/c0000000-0000-0000-0000-000000000001/2.zip', 'application/zip', 2000)$q$, '23514');
  perform t.back();

  perform t.as_user(carol);
  perform t.works('claims: a second person can claim the same item',
    $q$insert into public.claims (id, report_id, claimant_id, explanation) values ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', auth.uid(), 'Mine, I can describe the inside.')$q$);
  perform t.ok('claims: a claimant sees only their own claims', t.rows('select 1 from public.claims') = 1);
  perform t.ok('evidence: others cannot see claim evidence', t.rows('select 1 from public.claim_evidence') = 0);
  perform t.err('evidence: cannot attach evidence to someone else''s claim',
    $q$insert into public.claim_evidence (claim_id, uploaded_by, storage_path, mime_type, size_bytes) values ('c0000000-0000-0000-0000-000000000001', auth.uid(), auth.uid()::text || '/c0000000-0000-0000-0000-000000000001/c.jpg', 'image/jpeg', 2000)$q$, '42501');
  perform t.ok('claims: cannot edit someone else''s claim',
    t.affected($q$update public.claims set explanation = 'Taking over this claim.' where id = 'c0000000-0000-0000-0000-000000000001'$q$) = 0);
  perform t.ok('claims: cannot delete a claim', true);
  perform t.err('claims: delete is not allowed at all', $q$delete from public.claims$q$, '42501');
  perform t.back();

  perform t.as_user(bob);
  perform t.ok('claims: the finder cannot see claims on their own item', t.rows('select 1 from public.claims') = 0);
  perform t.ok('evidence: the finder cannot see evidence', t.rows('select 1 from public.claim_evidence') = 0);
  perform t.back();

  perform t.as_user(dave);
  perform t.ok('claims: an uninvolved user sees no claims', t.rows('select 1 from public.claims') = 0);
  perform t.back();

  perform t.as_user(adm);
  perform t.ok('claims: admin sees all claims', t.rows('select 1 from public.claims') = 2);
  perform t.ok('evidence: admin sees evidence', t.rows('select 1 from public.claim_evidence') = 1);
  perform t.back();

  -- Withdrawing a claim
  perform t.as_user(bob);
  perform t.err('claims: cannot cancel someone else''s claim', $q$select public.cancel_my_claim('c0000000-0000-0000-0000-000000000001')$q$, 'P0002');
  perform t.back();
  perform t.as_user(alice);
  perform t.works('claims: claimant can cancel own claim', $q$select public.cancel_my_claim('c0000000-0000-0000-0000-000000000001')$q$);
  perform t.err('claims: cannot cancel twice', $q$select public.cancel_my_claim('c0000000-0000-0000-0000-000000000001')$q$, '23514');
  perform t.ok('claims: cannot edit a cancelled claim',
    t.affected($q$update public.claims set explanation = 'Edit after cancelling it.' where id = 'c0000000-0000-0000-0000-000000000001'$q$) = 0);
  perform t.works('claims: can claim again after cancelling',
    $q$insert into public.claims (id, report_id, claimant_id, explanation) values ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', auth.uid(), 'Claiming again with more detail.')$q$);
  perform t.back();

  -- A completed item cannot be claimed.
  perform t.as_user(adm);
  perform t.works('admin: can complete a report', $q$select public.admin_set_report_status('b0000000-0000-0000-0000-000000000003', 'completed')$q$);
  perform t.back();
  perform t.as_user(bob);
  perform t.err('claims: a completed item cannot be claimed',
    $q$insert into public.claims (report_id, claimant_id, explanation) values ('b0000000-0000-0000-0000-000000000003', auth.uid(), 'Late claim on a closed item.')$q$, '23514');
  perform t.back();

  -- Feedback
  perform t.as_user(alice);
  perform t.err('feedback: not allowed before the claim is completed',
    $q$insert into public.feedback (claim_id, user_id, rating) values ('c0000000-0000-0000-0000-000000000003', auth.uid(), 5)$q$, '42501');
  perform t.back();
  update public.claims set status = 'completed', completed_at = now() where id = 'c0000000-0000-0000-0000-000000000003';
  perform t.as_user(alice);
  perform t.works('feedback: allowed after the claim is completed',
    $q$insert into public.feedback (claim_id, user_id, rating, comment) values ('c0000000-0000-0000-0000-000000000003', auth.uid(), 5, 'Quick and easy.')$q$);
  perform t.err('feedback: only one per claim',
    $q$insert into public.feedback (claim_id, user_id, rating) values ('c0000000-0000-0000-0000-000000000003', auth.uid(), 4)$q$, '23505');
  perform t.err('feedback: rating must be 1 to 5',
    $q$insert into public.feedback (claim_id, user_id, rating) values ('c0000000-0000-0000-0000-000000000002', auth.uid(), 9)$q$);
  perform t.back();
  perform t.as_user(carol);
  perform t.err('feedback: cannot leave feedback on someone else''s claim',
    $q$insert into public.feedback (claim_id, user_id, rating) values ('c0000000-0000-0000-0000-000000000003', auth.uid(), 1)$q$, '42501');
  perform t.ok('feedback: others cannot read it', t.rows('select 1 from public.feedback') = 0);
  perform t.back();
  perform t.as_user(adm);
  perform t.ok('feedback: admin can read it', t.rows('select 1 from public.feedback') = 1);
  perform t.back();

  perform t.as_anon();
  perform t.err('anon: cannot read claims', 'select * from public.claims', '42501');
  perform t.err('anon: cannot read evidence', 'select * from public.claim_evidence', '42501');
  perform t.back();
end $$;

-- ===================================================================================
-- 4b. Claim review and handover workflow (Phase 5)
-- ===================================================================================
do $$
declare alice uuid := t.u('2024001'); bob uuid := t.u('2024002'); carol uuid := t.u('2024003');
        dave uuid := t.u('2024004'); adm uuid := t.u('2024005');
        f1 uuid := 'd0000000-0000-0000-0000-000000000001'; f2 uuid := 'd0000000-0000-0000-0000-000000000002';
        v_ev text;
begin
  delete from public.notifications;
  perform t.mkreport(f1, bob, 'found', 'electronics');
  perform t.mkreport(f2, bob, 'found', 'electronics');

  perform t.as_user(alice);
  perform t.works('flow: alice claims item 1',
    $q$insert into public.claims (id, report_id, claimant_id, explanation) values ('e0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', auth.uid(), 'Green case with a crack on the corner.')$q$);
  perform t.ok('flow: the claim starts with one history entry', t.rows($q$select 1 from public.claim_events where claim_id = 'e0000000-0000-0000-0000-000000000001'$q$) = 1);
  perform t.err('flow: history cannot be written from the app', format($q$insert into public.claim_events (claim_id, to_status) values ('e0000000-0000-0000-0000-000000000001', 'approved')$q$), '42501');
  perform t.err('flow: alice cannot approve her own claim', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000001', 'approved', 'Approving myself')$q$, '42501');
  perform t.err('flow: alice cannot complete her own claim', $q$select public.admin_complete_claim('e0000000-0000-0000-0000-000000000001')$q$, '42501');
  perform t.back();

  perform t.as_user(carol);
  perform t.works('flow: carol also claims item 1',
    $q$insert into public.claims (id, report_id, claimant_id, explanation) values ('e0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', auth.uid(), 'It has my name sticker under the lid.')$q$);
  perform t.back();
  perform t.as_user(dave);
  perform t.works('flow: dave claims item 1 too',
    $q$insert into public.claims (id, report_id, claimant_id, explanation) values ('e0000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000001', auth.uid(), 'Mine, I know the lock screen picture.')$q$);
  perform t.works('flow: dave claims item 2',
    $q$insert into public.claims (id, report_id, claimant_id, explanation) values ('e0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', auth.uid(), 'Black charger with a blue tape on it.')$q$);
  perform t.back();

  perform t.ok('flow: a new claim does not lock the report', (select status = 'open' from public.reports where id = f1));

  perform t.as_user(bob);
  perform t.ok('flow: the finder cannot delete an item that has claims',
    t.affected($q$delete from public.reports where id = 'd0000000-0000-0000-0000-000000000002'$q$) = 0);
  perform t.ok('flow: the finder sees no claims or history', t.rows('select 1 from public.claims') = 0 and t.rows('select 1 from public.claim_events') = 0);
  perform t.err('flow: the finder cannot review claims', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000001', 'approved', 'I am the finder')$q$, '42501');
  perform t.back();

  perform t.as_user(adm);
  perform t.ok('flow: administrators are told about new claims', t.rows($q$select 1 from public.notifications where type = 'claim_submitted'$q$) = 4);
  perform t.works('flow: admin files a claim of their own', $q$insert into public.claims (id, report_id, claimant_id, explanation) values ('e0000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', auth.uid(), 'Testing the own-claim rule here.')$q$);
  perform t.err('flow: admin cannot review their own claim', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000004', 'approved', 'Looks good to me')$q$, '42501');
  perform t.err('flow: admin cannot hand over their own claim', $q$select public.admin_complete_claim('e0000000-0000-0000-0000-000000000004')$q$, '42501');
  perform t.err('flow: a pending claim cannot be completed', $q$select public.admin_complete_claim('e0000000-0000-0000-0000-000000000005')$q$, '23514');
  perform t.err('flow: approving needs a note', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000001', 'approved')$q$, '23514');
  perform t.err('flow: cancelled is not a review decision', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000001', 'cancelled', 'No')$q$, '23514');
  perform t.err('flow: unknown claim', $q$select public.admin_review_claim('e0000000-0000-0000-0000-0000000000ff', 'under_review')$q$, 'P0002');
  perform t.works('flow: admin starts the review', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000001', 'under_review')$q$);
  perform t.back();
  perform t.ok('flow: starting a review marks the item under review', (select status = 'under_review' from public.reports where id = f1));

  perform t.as_user(alice);
  perform t.ok('flow: the claimant is told the review started', t.rows($q$select 1 from public.notifications where type = 'claim_under_review'$q$) = 1);
  perform t.back();

  perform t.as_user(adm);
  perform t.works('flow: admin approves', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000001', 'approved', 'Bring your school ID to the guidance office.')$q$);
  perform t.err('flow: a second claim cannot be approved for the same item', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000002', 'approved', 'Also fine')$q$, '23514');
  perform t.works('flow: admin rejects the other claim', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000002', 'rejected', 'The sticker does not match.')$q$);
  perform t.err('flow: a rejected claim cannot be approved again', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000002', 'approved', 'Changed my mind')$q$, '23514');
  perform t.back();
  perform t.ok('flow: approval marks the item as claimed, not returned', (select status = 'claimed' and resolved_at is null from public.reports where id = f1));
  perform t.ok('flow: the claim records reviewer and approval time',
    (select reviewer_id = adm and approved_at is not null and completed_at is null from public.claims where id = 'e0000000-0000-0000-0000-000000000001'));

  perform t.as_user(dave);
  perform t.err('flow: an item that is already claimed cannot get new claims',
    $q$insert into public.claims (report_id, claimant_id, explanation) values ('d0000000-0000-0000-0000-000000000001', auth.uid(), 'Trying again after approval.')$q$, '23514');
  perform t.back();

  -- Handover
  perform t.as_user(alice);
  perform t.err('flow: the claimant cannot confirm her own handover', $q$select public.admin_complete_claim('e0000000-0000-0000-0000-000000000001')$q$, '42501');
  perform t.ok('flow: the claimant sees the decision note and history',
    (select decision_note from public.claims where id = 'e0000000-0000-0000-0000-000000000001') like 'Bring your school ID%'
    and t.rows($q$select 1 from public.claim_events where claim_id = 'e0000000-0000-0000-0000-000000000001'$q$) = 3);
  perform t.back();
  perform t.as_user(adm);
  perform t.works('flow: admin confirms the handover', $q$select public.admin_complete_claim('e0000000-0000-0000-0000-000000000001')$q$);
  perform t.err('flow: handover cannot be confirmed twice', $q$select public.admin_complete_claim('e0000000-0000-0000-0000-000000000001')$q$, '23514');
  perform t.back();
  perform t.ok('flow: handover closes the report', (select status = 'completed' and resolved_at is not null from public.reports where id = f1));
  perform t.ok('flow: handover records who confirmed it',
    (select status = 'completed' and handover_confirmed_by = adm and completed_at is not null from public.claims where id = 'e0000000-0000-0000-0000-000000000001'));
  perform t.ok('flow: other open claims on the item are closed automatically',
    (select status = 'rejected' and decision_note like '%returned to its owner%' from public.claims where id = 'e0000000-0000-0000-0000-000000000005'));
  perform t.as_user(dave);
  perform t.ok('flow: the other claimant is told', t.rows($q$select 1 from public.notifications where type = 'claim_rejected'$q$) = 1);
  perform t.back();
  perform t.as_user(bob);
  perform t.ok('flow: the finder is told the item was returned', t.rows($q$select 1 from public.notifications where type = 'item_returned'$q$) = 1);
  perform t.back();
  perform t.as_user(carol);
  perform t.ok('flow: nobody else sees another person''s history', t.rows($q$select 1 from public.claim_events where claim_id = 'e0000000-0000-0000-0000-000000000001'$q$) = 0);
  perform t.back();
  perform t.as_user(adm);
  perform t.ok('flow: the audit log records the review steps', t.rows($q$select 1 from public.activity_logs where action in ('claim_under_review', 'claim_approved', 'claim_completed', 'claim_rejected')$q$) >= 3);
  perform t.back();

  -- More information, resubmitting and withdrawing (item 2)
  perform t.as_user(adm);
  perform t.works('flow: admin asks for more information', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000003', 'more_info_required', 'Please send a photo of the receipt.')$q$);
  perform t.back();
  perform t.ok('flow: asking for information keeps the item under review', (select status = 'under_review' from public.reports where id = f2));

  perform t.as_user(dave);
  perform t.ok('flow: the claimant sees what is being asked', (select decision_note from public.claims where id = 'e0000000-0000-0000-0000-000000000003') like 'Please send%');
  perform t.err('flow: evidence file path must be in the claimant''s own claim folder',
    format($q$insert into public.claim_evidence (claim_id, uploaded_by, storage_path, mime_type, size_bytes) values ('e0000000-0000-0000-0000-000000000003', auth.uid(), %L, 'image/jpeg', 2000)$q$, alice::text || '/e0000000-0000-0000-0000-000000000001/1.jpg'), '23514');
  v_ev := dave::text || '/e0000000-0000-0000-0000-000000000003/';
  perform t.works('flow: evidence can be added when more information is requested',
    format($q$insert into public.claim_evidence (claim_id, uploaded_by, storage_path, mime_type, size_bytes) select 'e0000000-0000-0000-0000-000000000003', auth.uid(), %L || g || '.pdf', 'application/pdf', 5000 from generate_series(1, 5) g$q$, v_ev));
  perform t.err('flow: a claim can have at most five files',
    format($q$insert into public.claim_evidence (claim_id, uploaded_by, storage_path, mime_type, size_bytes) values ('e0000000-0000-0000-0000-000000000003', auth.uid(), %L, 'image/jpeg', 2000)$q$, v_ev || '6.jpg'), '23514');
  perform t.err('flow: cannot resubmit someone else''s claim', $q$select public.resubmit_my_claim('e0000000-0000-0000-0000-000000000001')$q$, 'P0002');
  perform t.err('flow: an explanation that is too short is refused', $q$select public.resubmit_my_claim('e0000000-0000-0000-0000-000000000003', 'short')$q$, '23514');
  perform t.works('flow: claimant resubmits', $q$select public.resubmit_my_claim('e0000000-0000-0000-0000-000000000003', 'Receipt attached, the charger is a 65W model.')$q$);
  perform t.err('flow: resubmitting twice is refused', $q$select public.resubmit_my_claim('e0000000-0000-0000-0000-000000000003')$q$, '23514');
  perform t.ok('flow: resubmitting sends the claim back to pending', (select status = 'pending' and explanation like 'Receipt attached%' from public.claims where id = 'e0000000-0000-0000-0000-000000000003'));
  perform t.back();
  perform t.as_user(adm);
  perform t.ok('flow: the reviewer is told about the answer', t.rows($q$select 1 from public.notifications where type = 'claim_resubmitted'$q$) = 1);
  perform t.works('flow: admin approves item 2', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000003', 'approved', 'Collect at the guidance office.')$q$);
  perform t.back();

  delete from public.claim_evidence where storage_path = v_ev || '5.pdf';
  perform t.as_user(dave);
  perform t.err('evidence: cannot add evidence after approval',
    format($q$insert into public.claim_evidence (claim_id, uploaded_by, storage_path, mime_type, size_bytes) values ('e0000000-0000-0000-0000-000000000003', auth.uid(), %L, 'image/jpeg', 2000)$q$, v_ev || 'late.jpg'), '42501');
  perform t.works('flow: claimant withdraws an approved claim', $q$select public.cancel_my_claim('e0000000-0000-0000-0000-000000000003')$q$);
  perform t.back();
  perform t.ok('flow: withdrawing reopens the item', (select status = 'open' from public.reports where id = f2));

  -- Evidence files
  insert into storage.buckets (id, name, public) values ('claim-evidence', 'claim-evidence', false) on conflict do nothing;
  perform t.as_user(dave);
  perform t.works('files: claimant uploads evidence into their own folder',
    format($q$insert into storage.objects (bucket_id, name) values ('claim-evidence', %L)$q$, v_ev || '1.pdf'));
  perform t.works('files: and a leftover with no record',
    format($q$insert into storage.objects (bucket_id, name) values ('claim-evidence', %L)$q$, v_ev || 'leftover.pdf'));
  perform t.err('files: cannot upload into someone else''s evidence folder',
    format($q$insert into storage.objects (bucket_id, name) values ('claim-evidence', %L)$q$, alice::text || '/x/1.pdf'), '42501');
  perform t.ok('files: attached evidence cannot be deleted from the app',
    t.affected(format($q$delete from storage.objects where name = %L$q$, v_ev || '1.pdf')) = 0);
  perform t.ok('files: a failed upload leftover can be removed',
    t.affected(format($q$delete from storage.objects where name = %L$q$, v_ev || 'leftover.pdf')) = 1);
  perform t.back();
  perform t.as_user(carol);
  perform t.ok('files: other users cannot open evidence', t.rows(format($q$select 1 from storage.objects where name = %L$q$, v_ev || '1.pdf')) = 0);
  perform t.back();
  perform t.as_user(adm);
  perform t.ok('files: administrators can open evidence', t.rows(format($q$select 1 from storage.objects where name = %L$q$, v_ev || '1.pdf')) = 1);
  perform t.back();

  -- A photo row cannot point at somebody else's file.
  perform t.as_user(bob);
  perform t.err('images: a photo row cannot point at another person''s file',
    format($q$insert into public.item_images (report_id, uploaded_by, storage_path, mime_type, size_bytes) values (%L, auth.uid(), %L, 'image/jpeg', 1000)$q$, f2, alice::text || '/b0000000-0000-0000-0000-000000000004/id.jpg'), '23514');
  perform t.back();

  perform t.as_anon();
  perform t.err('anon: cannot read claim history', 'select * from public.claim_events', '42501');
  perform t.err('anon: cannot review claims', $q$select public.admin_review_claim('e0000000-0000-0000-0000-000000000001', 'approved', 'x')$q$, '42501');
  perform t.back();

  -- Leave the shared fixtures as they were for the sections that follow.
  delete from public.reports where id in (f1, f2);
  delete from storage.objects where bucket_id = 'claim-evidence';
  delete from public.notifications;
end $$;

-- ===================================================================================
-- 5. Messaging and community chat
-- ===================================================================================
do $$
declare alice uuid := t.u('2024001'); bob uuid := t.u('2024002'); carol uuid := t.u('2024003');
        adm uuid := t.u('2024005'); v_req uuid; v_conv uuid;
begin
  perform t.as_user(alice);
  perform t.works('request: ask to message someone',
    format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (%L, %L, 'Hi, I think that is my phone.')$q$, alice, bob));
  perform t.err('request: duplicate pending request refused',
    format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (%L, %L, 'Hello again.')$q$, alice, bob), '23505');
  perform t.err('request: cannot message yourself',
    format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (%L, %L, 'Talking to myself.')$q$, alice, alice), '23514');
  perform t.err('request: cannot send as someone else',
    format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (%L, %L, 'Pretending.')$q$, carol, bob), '42501');
  perform t.err('request: cannot create an already accepted request',
    format($q$insert into public.message_requests (requester_id, recipient_id, intro_message, status) values (%L, %L, 'Skipping.', 'accepted')$q$, alice, carol), '42501');
  perform t.back();

  select id into v_req from public.message_requests limit 1;

  perform t.as_user(carol);
  perform t.ok('request: a third person cannot see it', t.rows('select 1 from public.message_requests') = 0);
  perform t.err('request: a third person cannot answer it', format($q$select public.respond_to_message_request(%L, true)$q$, v_req), 'P0002');
  perform t.back();

  perform t.as_user(alice);
  perform t.err('request: the sender cannot accept their own request', format($q$select public.respond_to_message_request(%L, true)$q$, v_req), 'P0002');
  perform t.ok('messages: no conversation exists before acceptance', t.rows('select 1 from public.conversations') = 0);
  perform t.back();

  perform t.as_user(bob);
  perform t.ok('request: the recipient sees it', t.rows('select 1 from public.message_requests') = 1);
  perform t.back();
  perform t.as_user(bob);
  v_conv := public.respond_to_message_request(v_req, true);
  perform t.ok('request: accepting creates a conversation', v_conv is not null);
  perform t.err('request: cannot answer twice', format($q$select public.respond_to_message_request(%L, true)$q$, v_req), 'P0002');
  perform t.ok('messages: recipient sees the intro message', t.rows(format($q$select 1 from public.messages where conversation_id = %L$q$, v_conv)) = 1);
  perform t.works('messages: recipient replies', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'Yes, describe it please.')$q$, v_conv));
  perform t.err('messages: cannot send as someone else', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, %L, 'Impersonating.')$q$, v_conv, alice), '42501');
  perform t.err('messages: cannot edit a message', $q$update public.messages set body = 'changed'$q$, '42501');
  perform t.err('messages: cannot delete a message', $q$delete from public.messages$q$, '42501');
  perform t.ok('conversation: can mark as read', t.affected(format($q$update public.conversation_members set last_read_at = now() where conversation_id = %L and user_id = auth.uid()$q$, v_conv)) = 1);
  perform t.back();

  perform t.as_user(carol);
  perform t.ok('messages: an outsider sees no messages', t.rows('select 1 from public.messages') = 0);
  perform t.ok('messages: an outsider sees no conversations', t.rows('select 1 from public.conversations') = 0);
  perform t.ok('messages: an outsider sees no members', t.rows('select 1 from public.conversation_members') = 0);
  perform t.err('messages: an outsider cannot post in it', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'Butting in.')$q$, v_conv), '42501');
  perform t.back();

  perform t.as_user(adm);
  perform t.ok('messages: even administrators cannot read private chats', t.rows('select 1 from public.messages') = 0);
  perform t.back();

  -- Declining
  perform t.as_user(carol);
  perform t.works('request: second request',
    format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (%L, %L, 'Hello there.')$q$, carol, alice));
  perform t.back();
  perform t.as_user(alice);
  perform t.works('request: decline', format($q$select public.respond_to_message_request((select id from public.message_requests where requester_id = %L), false)$q$, carol));
  perform t.ok('request: declining creates no conversation', t.rows('select 1 from public.conversations') = 1);
  perform t.back();

  -- Community chat
  perform t.as_user(alice);
  perform t.works('community: post a message', $q$insert into public.community_messages (id, author_id, body) values ('d0000000-0000-0000-0000-000000000001', auth.uid(), 'Found a umbrella near the gym.')$q$);
  perform t.err('community: cannot post as someone else', format($q$insert into public.community_messages (author_id, body) values (%L, 'Fake')$q$, bob), '42501');
  perform t.err('community: cannot edit a post', $q$update public.community_messages set body = 'edited'$q$, '42501');
  perform t.err('community: cannot remove a post as a normal user', $q$select public.admin_remove_community_message('d0000000-0000-0000-0000-000000000001')$q$, '42501');
  perform t.back();
  perform t.as_user(bob);
  perform t.ok('community: others can read it', t.rows('select 1 from public.community_messages') = 1);
  perform t.back();
  perform t.as_user(adm);
  perform t.works('community: admin removes a post', $q$select public.admin_remove_community_message('d0000000-0000-0000-0000-000000000001')$q$);
  perform t.back();
  perform t.as_user(bob);
  perform t.ok('community: removed post is hidden from users', t.rows('select 1 from public.community_messages') = 0);
  perform t.back();
  perform t.as_anon();
  perform t.err('anon: cannot read community chat', 'select * from public.community_messages', '42501');
  perform t.err('anon: cannot read messages', 'select * from public.messages', '42501');
  perform t.back();
end $$;

-- ===================================================================================
-- 5b. Communication safety, notifications and the email queue (Phase 6)
-- ===================================================================================
do $$
declare alice uuid := t.u('2024001'); bob uuid := t.u('2024002'); carol uuid := t.u('2024003');
        dave uuid := t.u('2024004'); adm uuid := t.u('2024005');
        v_req uuid; v_conv uuid; v_cm uuid; v_pm uuid; v_report uuid; v_dave_name text;
        f1 uuid := 'f0000000-0000-0000-0000-000000000001';
        f2 uuid := 'f0000000-0000-0000-0000-000000000002';
begin
  delete from public.notifications;
  select username into v_dave_name from public.profiles where id = dave;

  -- Blocking
  perform t.as_user(carol);
  perform t.works('block: carol blocks dave', format($q$insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), %L)$q$, dave));
  perform t.err('block: cannot block as someone else', format($q$insert into public.user_blocks (blocker_id, blocked_id) values (%L, %L)$q$, bob, alice), '42501');
  perform t.err('block: cannot block yourself', $q$insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), auth.uid())$q$, '23514');
  perform t.err('block: the blocker cannot send a request either', format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (auth.uid(), %L, 'Hello')$q$, dave), '23514');
  perform t.back();
  perform t.as_user(dave);
  perform t.ok('block: the blocked person cannot see the block', t.rows('select 1 from public.user_blocks') = 0);
  perform t.err('block: a blocked person cannot send a request', format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (auth.uid(), %L, 'Please talk to me')$q$, carol), '23514');
  perform t.back();
  perform t.as_user(carol);
  perform t.works('block: unblock', format($q$delete from public.user_blocks where blocked_id = %L$q$, dave));
  perform t.back();

  -- Request, notification, accept
  perform t.as_user(dave);
  perform t.works('request: dave asks carol', format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (auth.uid(), %L, 'Hi, is the blue bottle yours?')$q$, carol));
  perform t.back();
  perform t.as_user(carol);
  perform t.ok('notify: the recipient is told about the request', t.rows($q$select 1 from public.notifications where type = 'message_request' and link = '/messages?tab=requests'$q$) = 1);
  select id into v_req from public.message_requests where requester_id = dave and recipient_id = carol;
  v_conv := public.respond_to_message_request(v_req, true);
  perform t.back();
  perform t.as_user(dave);
  perform t.ok('notify: the requester is told it was accepted', t.rows($q$select 1 from public.notifications where type = 'message_request_accepted'$q$) = 1);
  perform t.ok('notify: the opening message creates no message alert', t.rows($q$select 1 from public.notifications where type = 'new_message'$q$) = 0);
  perform t.err('request: no second request when a conversation already exists', format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (auth.uid(), %L, 'Again?')$q$, carol), '23514');
  perform t.works('messages: dave writes', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'Are you there?')$q$, v_conv));
  perform t.works('messages: dave writes again', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'It is blue with a dent.')$q$, v_conv));
  perform t.back();
  -- A test runs in one transaction, so every timestamp would be identical. Spread them out.
  update public.conversation_members set last_read_at = now() - interval '1 hour' where conversation_id = v_conv;
  update public.messages set created_at = now() - interval '30 minutes' where conversation_id = v_conv and body = 'Hi, is the blue bottle yours?';
  update public.messages set created_at = now() - interval '20 minutes' where conversation_id = v_conv and body = 'Are you there?';
  update public.messages set created_at = now() - interval '10 minutes' where conversation_id = v_conv and body = 'It is blue with a dent.';
  update public.conversations set last_message_at = now() - interval '10 minutes' where id = v_conv;

  perform t.as_user(carol);
  perform t.ok('notify: one alert per conversation until read', t.rows($q$select 1 from public.notifications where type = 'new_message'$q$) = 1);
  perform t.ok('notify: the alert does not reveal the message', (select body from public.notifications where type = 'new_message') = 'Open the conversation to read it.');
  perform t.ok('conversations: list shows who, last message and unread count',
    (select other_username = v_dave_name and unread_count = 3 and last_message = 'It is blue with a dent.' and not i_blocked
       from public.list_my_conversations() where conversation_id = v_conv));
  perform t.works('conversations: marking read', format($q$update public.conversation_members set last_read_at = now() where conversation_id = %L and user_id = auth.uid()$q$, v_conv));
  perform t.ok('conversations: unread count drops to zero', (select unread_count from public.list_my_conversations() where conversation_id = v_conv) = 0);
  perform t.works('notify: read the alert', $q$update public.notifications set is_read = true where type = 'new_message'$q$);
  perform t.back();
  perform t.as_user(dave);
  perform t.works('messages: dave writes after it was read', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'Hello?')$q$, v_conv));
  perform t.back();
  perform t.as_user(carol);
  perform t.ok('notify: a new alert once the old one was read', t.rows($q$select 1 from public.notifications where type = 'new_message'$q$) = 2);
  perform t.back();
  perform t.as_user(bob);
  perform t.ok('conversations: others do not see this conversation', t.rows(format($q$select 1 from public.list_my_conversations() where other_username = %L$q$, v_dave_name)) = 0);
  perform t.back();

  -- Blocking inside a conversation
  perform t.as_user(carol);
  perform t.works('block: carol blocks dave mid-conversation', format($q$insert into public.user_blocks (blocker_id, blocked_id) values (auth.uid(), %L)$q$, dave));
  perform t.ok('block: the list shows the block', (select i_blocked from public.list_my_conversations() where conversation_id = v_conv));
  perform t.err('block: the blocker cannot send either', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'Wait')$q$, v_conv), '23514');
  perform t.back();
  perform t.as_user(dave);
  perform t.err('block: the blocked person cannot send', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'Please')$q$, v_conv), '23514');
  perform t.back();
  perform t.as_user(carol);
  perform t.works('block: unblock again', format($q$delete from public.user_blocks where blocked_id = %L$q$, dave));
  perform t.back();

  -- Suspended people cannot receive requests
  update public.profile_private set status = 'suspended' where id = bob;
  perform t.as_user(dave);
  perform t.err('request: a suspended person cannot be asked', format($q$insert into public.message_requests (requester_id, recipient_id, intro_message) values (auth.uid(), %L, 'Hello')$q$, bob), '23514');
  perform t.back();
  update public.profile_private set status = 'active' where id = bob;

  -- Speed limits
  perform t.as_user(dave);
  perform t.works('limit: bursts of private messages are fine up to the limit', format($q$insert into public.messages (conversation_id, sender_id, body) select %L, auth.uid(), 'msg ' || g from generate_series(1, 29) g$q$, v_conv));
  perform t.err('limit: the next one is refused', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'too many')$q$, v_conv), '23514');
  perform t.works('limit: eight community posts are fine', $q$insert into public.community_messages (author_id, body) select auth.uid(), 'post ' || g from generate_series(1, 8) g$q$);
  perform t.err('limit: the ninth community post is refused', $q$insert into public.community_messages (author_id, body) values (auth.uid(), 'spam')$q$, '23514');
  perform t.back();

  -- Abuse reports
  select id into v_cm from public.community_messages where author_id = dave order by created_at limit 1;
  select id into v_pm from public.messages where conversation_id = v_conv and sender_id = dave order by created_at limit 1;

  perform t.as_user(alice);
  perform t.works('abuse: report a community message', format($q$select public.report_abuse('community_message', %L, 'spam', 'Posting repeatedly')$q$, v_cm));
  perform t.err('abuse: the same report twice is refused', format($q$select public.report_abuse('community_message', %L, 'spam')$q$, v_cm), '23514');
  perform t.err('abuse: a message that does not exist', $q$select public.report_abuse('community_message', gen_random_uuid(), 'spam')$q$, 'P0002');
  perform t.err('abuse: a private message from a chat you are not in', format($q$select public.report_abuse('private_message', %L, 'harassment')$q$, v_pm), 'P0002');
  perform t.err('abuse: unknown kind', format($q$select public.report_abuse('everything', %L, 'spam')$q$, v_cm), '23514');
  perform t.err('abuse: unknown reason', format($q$select public.report_abuse('user', %L, 'because')$q$, dave), '23514');
  perform t.err('abuse: you cannot report yourself', format($q$select public.report_abuse('user', %L, 'spam')$q$, alice), '23514');
  perform t.works('abuse: report a person', format($q$select public.report_abuse('user', %L, 'scam')$q$, dave));
  perform t.err('abuse: no direct inserts', format($q$insert into public.abuse_reports (reporter_id, kind, target_id, target_user_id, reason) values (auth.uid(), 'user', %L, %L, 'spam')$q$, dave, dave), '42501');
  perform t.ok('abuse: reporter sees their own reports', t.rows('select 1 from public.abuse_reports') = 2);
  perform t.back();
  perform t.as_user(carol);
  perform t.works('abuse: report a private message you received', format($q$select public.report_abuse('private_message', %L, 'harassment', 'Keeps messaging me')$q$, v_pm));
  perform t.back();
  perform t.as_user(dave);
  perform t.ok('abuse: the reported person cannot see reports', t.rows('select 1 from public.abuse_reports') = 0);
  perform t.back();
  perform t.as_user(bob);
  perform t.ok('abuse: other users cannot see reports', t.rows('select 1 from public.abuse_reports') = 0);
  perform t.err('abuse: other users cannot resolve reports', $q$select public.admin_resolve_abuse_report(gen_random_uuid(), 'dismissed')$q$, '42501');
  perform t.back();
  perform t.as_user(adm);
  perform t.ok('abuse: administrators see all reports', t.rows('select 1 from public.abuse_reports') = 3);
  perform t.ok('abuse: the reported private message is kept as a snapshot', (select snapshot from public.abuse_reports where kind = 'private_message') = 'Hi, is the blue bottle yours?');
  perform t.ok('abuse: administrators still cannot read private chats', t.rows('select 1 from public.messages') = 0);
  perform t.ok('abuse: administrators are notified', t.rows($q$select 1 from public.notifications where type = 'abuse_report' and link = '/admin/abuse'$q$) = 3);
  select id into v_report from public.abuse_reports where kind = 'user';
  perform t.err('abuse: invalid outcome', format($q$select public.admin_resolve_abuse_report(%L, 'deleted')$q$, v_report), '23514');
  perform t.works('abuse: admin dismisses a report', format($q$select public.admin_resolve_abuse_report(%L, 'dismissed', 'No evidence')$q$, v_report));
  perform t.err('abuse: a handled report cannot be handled again', format($q$select public.admin_resolve_abuse_report(%L, 'actioned')$q$, v_report), 'P0002');
  perform t.ok('abuse: outcome and handler are recorded', (select status = 'dismissed' and handled_by = adm and handled_note = 'No evidence' and handled_at is not null from public.abuse_reports where id = v_report));
  perform t.back();
  perform t.as_anon();
  perform t.err('anon: cannot report abuse', format($q$select public.report_abuse('user', %L, 'spam')$q$, dave), '42501');
  perform t.err('anon: cannot read blocks', 'select * from public.user_blocks', '42501');
  perform t.back();

  -- Email preferences and queue
  delete from public.email_outbox;
  perform t.as_user(dave);
  perform t.works('prefs: dave saves preferences', $q$insert into public.notification_preferences (user_id, email_updates, email_messages) values (auth.uid(), false, true)$q$);
  perform t.err('prefs: cannot save for someone else', format($q$insert into public.notification_preferences (user_id) values (%L)$q$, alice), '42501');
  perform t.back();
  perform t.as_user(alice);
  perform t.ok('prefs: others cannot read them', t.rows('select 1 from public.notification_preferences') = 0);
  perform t.ok('queue: normal users cannot read the email queue', t.rows('select 1 from public.email_outbox') = 0);
  perform t.back();

  perform t.mkreport(f1, alice, 'found', 'electronics');
  perform t.mkreport(f2, dave, 'found', 'electronics');
  perform t.ok('queue: a submitted report queues an email by default', (select count(*) from public.email_outbox where user_id = alice and template = 'report_submitted') = 1);
  perform t.ok('queue: but not when the person turned updates off', (select count(*) from public.email_outbox where user_id = dave and template = 'report_submitted') = 0);

  perform t.as_user(bob);
  perform t.works('claim: bob claims the item alice found', format($q$insert into public.claims (report_id, claimant_id, explanation) values (%L, auth.uid(), 'It is mine, it has my wallpaper.')$q$, f1));
  perform t.back();
  perform t.ok('notify: the finder is told about the claim', (select count(*) from public.notifications where user_id = alice and type = 'claim_received' and link = '/reports/' || f1) = 1);
  perform t.ok('queue: the finder is emailed about the claim', (select count(*) from public.email_outbox where user_id = alice and template = 'claim_received') = 1);
  perform t.ok('queue: carol did not opt in, so her message alerts send no email',
    (select count(*) from public.email_outbox where user_id = carol) = 0);

  perform t.as_user(dave);
  perform t.works('conversations: dave marks read', format($q$update public.conversation_members set last_read_at = now() where conversation_id = %L and user_id = auth.uid()$q$, v_conv));
  perform t.works('notify: dave reads his alerts', $q$update public.notifications set is_read = true where type in ('new_message', 'message_request_accepted')$q$);
  perform t.back();
  perform t.as_user(carol);
  perform t.works('limit: carol replies', format($q$insert into public.messages (conversation_id, sender_id, body) values (%L, auth.uid(), 'Yes it is mine.')$q$, v_conv));
  perform t.back();
  perform t.ok('queue: dave opted in, so a reply queues a message email', (select count(*) from public.email_outbox where user_id = dave and template = 'new_message') = 1);
  perform t.ok('queue: the in-app alert exists whatever happens to the email', (select count(*) from public.notifications where user_id = dave and type = 'new_message' and not is_read) = 1);
  perform t.as_user(adm);
  perform t.ok('queue: administrators can monitor the email queue', t.rows('select 1 from public.email_outbox') >= 3);
  perform t.back();
  perform t.as_user(alice);
  perform t.err('queue: normal users cannot change the queue', $q$update public.email_outbox set status = 'sent'$q$, '42501');
  perform t.back();

  -- The email worker's door: service role only, small batches, attempts are counted.
  perform t.as_user(alice);
  perform t.err('worker: normal users cannot claim emails', 'select * from public.claim_pending_emails(5)', '42501');
  perform t.back();
  perform t.as_anon();
  perform t.err('worker: anon cannot claim emails', 'select * from public.claim_pending_emails(5)', '42501');
  perform t.back();
  set local role service_role;
  perform t.ok('worker: claims pending emails with address and text', (select count(*) from public.claim_pending_emails(50) c where c.to_email like '%@%' and c.title <> '') >= 3);
  perform t.ok('worker: a claimed email has its attempt counted', (select min(attempts) from public.email_outbox where status = 'pending') = 1);
  reset role;
  update public.email_outbox set attempts = 5;
  set local role service_role;
  perform t.ok('worker: gives up after five attempts', (select count(*) from public.claim_pending_emails(50)) = 0);
  reset role;

  -- Leave the shared fixtures as they were for the sections that follow.
  delete from public.reports where id in (f1, f2);
  delete from public.conversations where id = v_conv;
  delete from public.message_requests where requester_id = dave or recipient_id = dave;
  delete from public.user_blocks;
  delete from public.abuse_reports;
  delete from public.community_messages where author_id in (dave, carol);
  delete from public.notification_preferences;
  delete from public.email_outbox;
  delete from public.notifications;
end $$;

-- ===================================================================================
-- 6. Notifications, logs, watchlist
-- ===================================================================================
do $$
declare alice uuid := t.u('2024001'); bob uuid := t.u('2024002'); adm uuid := t.u('2024005');
begin
  delete from public.notifications;
  insert into public.notifications (user_id, type, title) values (alice, 'claim', 'For alice'), (bob, 'claim', 'For bob');
  insert into public.error_logs (source, message) values ('test', 'Something broke');

  perform t.as_user(alice);
  perform t.ok('notifications: a user sees only their own', t.rows('select 1 from public.notifications') = 1);
  perform t.err('notifications: a user cannot create one',
    format($q$insert into public.notifications (user_id, type, title) values (%L, 'x', 'Fake alert')$q$, alice), '42501');
  perform t.ok('notifications: can mark own as read', t.affected($q$update public.notifications set is_read = true$q$) = 1);
  perform t.err('notifications: cannot edit the text', $q$update public.notifications set title = 'changed'$q$, '42501');
  perform t.ok('notifications: cannot touch another user''s',
    t.affected(format($q$update public.notifications set is_read = true where user_id = %L$q$, bob)) = 0);
  perform t.ok('logs: a normal user sees no activity logs', t.rows('select 1 from public.activity_logs') = 0);
  perform t.err('logs: a user cannot write activity logs', $q$insert into public.activity_logs (category, action) values ('user', 'forged')$q$, '42501');
  perform t.err('logs: a user cannot erase activity logs', $q$delete from public.activity_logs$q$, '42501');
  perform t.err('logs: write_activity_log is not callable', $q$select public.write_activity_log(null, 'user', 'forged')$q$, '42501');
  perform t.ok('logs: a normal user sees no error logs', t.rows('select 1 from public.error_logs') = 0);
  perform t.works('watchlist: follow a category',
    $q$insert into public.watchlist (user_id, category_id) values (auth.uid(), (select id from public.categories where slug = 'electronics'))$q$);
  perform t.err('watchlist: cannot follow for someone else',
    format($q$insert into public.watchlist (user_id, category_id) values (%L, (select id from public.categories where slug = 'clothing'))$q$, bob), '42501');
  perform t.back();

  perform t.as_user(bob);
  perform t.ok('watchlist: others cannot see it', t.rows('select 1 from public.watchlist') = 0);
  perform t.back();

  perform t.as_user(adm);
  perform t.ok('logs: admin can read activity logs', t.rows('select 1 from public.activity_logs') > 0);
  perform t.ok('logs: admin can read error logs', t.rows('select 1 from public.error_logs') = 1);
  perform t.err('logs: not even admin can erase activity logs', $q$delete from public.activity_logs$q$, '42501');
  perform t.err('logs: not even admin can forge activity logs', $q$insert into public.activity_logs (category, action) values ('user', 'forged')$q$, '42501');
  perform t.ok('notifications: admin does not see other people''s', t.rows('select 1 from public.notifications') = 0);
  perform t.back();

  perform t.as_anon();
  perform t.err('anon: cannot read notifications', 'select * from public.notifications', '42501');
  perform t.err('anon: cannot read activity logs', 'select * from public.activity_logs', '42501');
  perform t.back();
end $$;

-- ===================================================================================
-- 6b. Search and photo files (Phase 4)
-- ===================================================================================
do $$
declare alice uuid := t.u('2024001'); bob uuid := t.u('2024002'); carol uuid := t.u('2024003'); adm uuid := t.u('2024005');
        v_pub text; v_idp text; v_orph text;
        v_elec uuid := (select id from public.categories where slug = 'electronics');
begin
  v_pub := alice::text || '/b0000000-0000-0000-0000-000000000003/1.jpg';
  v_idp := alice::text || '/b0000000-0000-0000-0000-000000000004/id.jpg';
  v_orph := carol::text || '/orphan.jpg';
  perform t.as_user(bob);
  perform t.ok('search: no filters returns every visible report', t.rows('select 1 from public.search_reports(p_limit => 50)') = 5);
  perform t.ok('search: keyword matches the title', t.rows($q$select 1 from public.search_reports('clothing')$q$) = 1);
  perform t.ok('search: keyword matching ignores capitals', t.rows($q$select 1 from public.search_reports('CLOTHING')$q$) = 1);
  perform t.ok('search: keyword also searches the description', t.rows($q$select 1 from public.search_reports('long enough', p_limit => 50)$q$) = 5);
  perform t.ok('search: a typed percent sign is not a wildcard', t.rows($q$select 1 from public.search_reports('%')$q$) = 0);
  perform t.ok('search: a typed underscore is not a wildcard', t.rows($q$select 1 from public.search_reports('_')$q$) = 0);
  perform t.ok('search: SQL injection attempt finds nothing', t.rows($q$select 1 from public.search_reports($s$'; drop table public.reports; --$s$)$q$) = 0);
  perform t.ok('search: reports table still exists after the injection attempt', to_regclass('public.reports') is not null);
  perform t.ok('search: filter by type', t.rows($q$select 1 from public.search_reports(p_type => 'found', p_limit => 50)$q$) = 4);
  perform t.ok('search: filter by status', t.rows($q$select 1 from public.search_reports(p_status => 'completed')$q$) = 1);
  perform t.ok('search: filter by category', t.rows(format($q$select 1 from public.search_reports(p_category_id => %L, p_limit => 50)$q$, v_elec)) = 3);
  perform t.ok('search: filter by location', t.rows($q$select 1 from public.search_reports(p_location => 'lib', p_limit => 50)$q$) = 5);
  perform t.ok('search: location with no match', t.rows($q$select 1 from public.search_reports(p_location => 'zzz')$q$) = 0);
  perform t.ok('search: date range excludes future dates', t.rows($q$select 1 from public.search_reports(p_from => current_date + 5)$q$) = 0);
  perform t.ok('search: date range includes today', t.rows($q$select 1 from public.search_reports(p_from => current_date, p_to => current_date, p_limit => 50)$q$) = 5);
  perform t.ok('search: mine shows only my reports', t.rows($q$select 1 from public.search_reports(p_mine => true, p_limit => 50)$q$) = 2);
  perform t.ok('search: page size is respected', t.rows($q$select 1 from public.search_reports(p_limit => 2)$q$) = 2);
  perform t.ok('search: total count covers all pages', (select max(total_count) from public.search_reports(p_limit => 2)) = 5);
  perform t.ok('search: second page works', t.rows($q$select 1 from public.search_reports(p_limit => 2, p_offset => 4)$q$) = 1);
  perform t.ok('search: page size is capped at 50', t.rows($q$select 1 from public.search_reports(p_limit => 100000)$q$) <= 50);
  perform t.ok('search: public photo path is returned',
    (select image_path from public.search_reports(p_category_id => v_elec, p_type => 'found', p_limit => 50) where id = 'b0000000-0000-0000-0000-000000000003') = v_pub);
  perform t.ok('search: ID photo path is never returned',
    (select image_path from public.search_reports(p_limit => 50) where id = 'b0000000-0000-0000-0000-000000000004') is null);
  perform t.back();

  perform t.as_user(alice);
  perform t.ok('search: not even the owner gets their ID photo in listings',
    (select image_path from public.search_reports(p_limit => 50) where id = 'b0000000-0000-0000-0000-000000000004') is null);
  perform t.ok('search: mine shows the owner their own', t.rows($q$select 1 from public.search_reports(p_mine => true, p_limit => 50)$q$) = 3);
  perform t.back();

  perform t.as_user(adm);
  perform t.works('search: admin hides a report', $q$select public.admin_set_report_hidden('b0000000-0000-0000-0000-000000000005', true)$q$);
  perform t.back();
  perform t.as_user(alice);
  perform t.ok('search: hidden reports are left out for other users', t.rows('select 1 from public.search_reports(p_limit => 50)') = 4);
  perform t.back();
  perform t.as_user(bob);
  perform t.ok('search: hidden reports still show for their owner', t.rows('select 1 from public.search_reports(p_limit => 50)') = 5);
  perform t.back();
  perform t.as_user(adm);
  perform t.works('search: admin unhides it', $q$select public.admin_set_report_hidden('b0000000-0000-0000-0000-000000000005', false)$q$);
  perform t.back();

  perform t.as_anon();
  perform t.err('anon: cannot search reports', 'select * from public.search_reports()', '42501');
  perform t.back();

  -- Photo files
  insert into storage.buckets (id, name, public) values ('item-images', 'item-images', false) on conflict do nothing;
  insert into storage.objects (bucket_id, name) values
    ('item-images', v_pub), ('item-images', v_idp), ('item-images', v_orph);
  insert into storage.objects (bucket_id, name) values ('item-images', alice::text || '/mine.jpg');

  perform t.as_user(bob);
  perform t.ok('files: others can open a public photo', t.rows(format($q$select 1 from storage.objects where name = %L$q$, v_pub)) = 1);
  perform t.ok('files: others can NOT open an ID photo', t.rows(format($q$select 1 from storage.objects where name = %L$q$, v_idp)) = 0);
  perform t.ok('files: a file with no database record is not readable by others', t.rows(format($q$select 1 from storage.objects where name = %L$q$, v_orph)) = 0);
  perform t.works('files: upload into your own folder',
    format($q$insert into storage.objects (bucket_id, name) values ('item-images', %L)$q$, bob::text || '/r5/new.jpg'));
  perform t.err('files: cannot upload into someone else''s folder',
    format($q$insert into storage.objects (bucket_id, name) values ('item-images', %L)$q$, alice::text || '/r1/evil.jpg'), '42501');
  perform t.err('files: cannot upload to another bucket',
    format($q$insert into storage.objects (bucket_id, name) values ('other', %L)$q$, bob::text || '/x.jpg'));
  perform t.ok('files: cannot delete someone else''s file',
    t.affected(format($q$delete from storage.objects where name = %L$q$, alice::text || '/mine.jpg')) = 0);
  perform t.back();

  perform t.as_user(alice);
  perform t.ok('files: the owner can open their ID photo', t.rows(format($q$select 1 from storage.objects where name = %L$q$, v_idp)) = 1);
  perform t.ok('files: owner can delete their own file',
    t.affected(format($q$delete from storage.objects where name = %L$q$, alice::text || '/mine.jpg')) = 1);
  perform t.back();

  perform t.as_user(adm);
  perform t.ok('files: admin can open an ID photo', t.rows(format($q$select 1 from storage.objects where name = %L$q$, v_idp)) = 1);
  perform t.back();

  perform t.as_anon();
  perform t.ok('anon: cannot see any files', t.rows('select 1 from storage.objects') = 0);
  perform t.back();
end $$;

-- ===================================================================================
-- 7. Structural guarantees
-- ===================================================================================
do $$
declare v_missing text;
begin
  perform t.back();

  select string_agg(c.relname, ', ') into v_missing
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  perform t.ok('structure: row level security is ON for every table (missing: ' || coalesce(v_missing, 'none') || ')', v_missing is null);

  perform t.ok('structure: anonymous visitors hold no table privileges',
    (select count(*) from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public') = 0);

  perform t.ok('structure: anonymous visitors cannot run any function',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')) = 0);

  select string_agg(p.proname, ', ' order by p.proname) into v_missing
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname not in (
       'current_user_role', 'is_active_user', 'is_admin', 'is_super_admin',
       'set_user_role', 'set_account_status',
       'admin_set_report_status', 'admin_set_report_hidden',
       'cancel_my_claim', 'resubmit_my_claim', 'admin_review_claim', 'admin_complete_claim',
       'report_has_live_claims', 'list_my_conversations', 'report_abuse', 'admin_resolve_abuse_report',
       'is_conversation_member', 'respond_to_message_request',
       'admin_remove_community_message', 'search_reports');
  perform t.ok('structure: signed-in users can run only the approved functions (extra: ' || coalesce(v_missing, 'none') || ')', v_missing is null);

  perform t.ok('structure: no signed-in user can delete rows from a log table',
    not has_table_privilege('authenticated', 'public.activity_logs', 'delete')
    and not has_table_privilege('authenticated', 'public.activity_logs', 'insert')
    and not has_table_privilege('authenticated', 'public.activity_logs', 'update'));

  perform t.ok('structure: nobody can write role or status columns',
    not has_column_privilege('authenticated', 'public.profile_private', 'role', 'update')
    and not has_column_privilege('authenticated', 'public.profile_private', 'status', 'update')
    and not has_table_privilege('authenticated', 'public.profile_private', 'insert'));
end $$;

-- ===================================================================================
-- Summary
-- ===================================================================================
select count(*) filter (where ok) as passed, count(*) filter (where not ok) as failed, count(*) as total from t.results;

do $$
begin
  if exists (select 1 from t.results where not ok) then
    raise exception '% test(s) failed', (select count(*) from t.results where not ok);
  end if;
end $$;

rollback;
