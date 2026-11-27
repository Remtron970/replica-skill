-- Sync-model tests for the academics tables. Run by run_local.sh after rls_test.sql.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'c@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'd@example.com');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

select pg_temp.act_as('33333333-3333-3333-3333-333333333333');

-- Create a course offline-style (client id, client timestamp, no user_id sent).
insert into public.courses (id, client_updated_at, name, level)
values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-11-27 10:00+00', 'Biology', 'honors');

do $$ begin
  assert (select user_id from public.courses) = '33333333-3333-3333-3333-333333333333', 'user_id defaults to the signed-in user';
  assert (select updated_at from public.courses) > now() - interval '1 minute', 'server stamps updated_at';
  raise notice 'PASS rows created on a device are owned by the signed-in user';
end $$;

-- Newer edit wins; an older edit arriving later is ignored.
do $$
declare first_seen timestamptz;
begin
  insert into public.courses (id, client_updated_at, name) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-11-27 12:00+00', 'Biology Honors')
  on conflict (id) do update set name = excluded.name, client_updated_at = excluded.client_updated_at;
  select updated_at into first_seen from public.courses;
  insert into public.courses (id, client_updated_at, name) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-11-27 11:00+00', 'Old offline edit')
  on conflict (id) do update set name = excluded.name, client_updated_at = excluded.client_updated_at;
  assert (select name from public.courses) = 'Biology Honors', 'stale edit ignored';
  assert (select updated_at from public.courses) = first_seen, 'ignored edit does not look like a change';
  raise notice 'PASS newest edit wins; a late-arriving older edit is ignored';
end $$;

-- Soft delete propagates like any other change.
do $$ begin
  update public.courses set deleted = true, client_updated_at = '2026-11-27 13:00+00';
  assert (select deleted from public.courses), 'soft delete stored';
  raise notice 'PASS deletions are recorded so other devices can apply them';
end $$;

-- Owner cannot be changed.
do $$ begin
  update public.courses set user_id = '44444444-4444-4444-4444-444444444444', client_updated_at = '2026-11-27 14:00+00';
  assert (select count(*) from public.courses) = 1, 'still visible to owner';
  raise notice 'PASS a row cannot be handed to another account';
end $$;

-- Validation.
do $$
declare bad text[] := array[
  $q$insert into public.courses (id, client_updated_at, name, level) values (gen_random_uuid(), now(), 'X', 'super')$q$,
  $q$insert into public.courses (id, client_updated_at, name) values (gen_random_uuid(), now(), '')$q$,
  $q$insert into public.courses (id, client_updated_at, name, credits) values (gen_random_uuid(), now(), 'X', -1)$q$,
  $q$insert into public.grade_items (id, client_updated_at, course_id, title, earned) values (gen_random_uuid(), now(), gen_random_uuid(), 'Quiz', -5)$q$,
  $q$insert into public.grade_categories (id, client_updated_at, course_id, name, weight) values (gen_random_uuid(), now(), gen_random_uuid(), 'Tests', 150)$q$,
  $q$insert into public.grading_scales (id, client_updated_at, name, bands) values (gen_random_uuid(), now(), 'Bad', '{}')$q$,
  $q$insert into public.terms (id, client_updated_at, name, starts_on, ends_on) values (gen_random_uuid(), now(), 'Fall', '2026-12-01', '2026-09-01')$q$,
  $q$insert into public.past_courses (id, client_updated_at, term_name, name, letter, points) values (gen_random_uuid(), now(), 'Spring', 'Art', 'A', 9)$q$];
  q text;
begin
  foreach q in array bad loop
    begin
      execute q;
      raise exception 'accepted invalid row: %', q;
    exception when check_violation or not_null_violation then null;
    end;
  end loop;
  raise notice 'PASS invalid academic data is rejected';
end $$;

reset role;
select pg_temp.act_as('44444444-4444-4444-4444-444444444444');

-- D cannot see or overwrite C's course, even by reusing its id.
do $$ begin
  assert (select count(*) from public.courses) = 0, 'D sees none of C''s rows';
  begin
    insert into public.courses (id, client_updated_at, name) values ('aaaaaaaa-0000-0000-0000-000000000001', '2030-01-01', 'Hijacked')
    on conflict (id) do update set name = excluded.name, client_updated_at = excluded.client_updated_at;
    assert false, 'upsert over another user''s row must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.grade_items (id, user_id, client_updated_at, course_id, title) values (gen_random_uuid(), '33333333-3333-3333-3333-333333333333', now(), gen_random_uuid(), 'Planted');
    assert false, 'insert for another user must fail';
  exception when insufficient_privilege then null;
  end;
  raise notice 'PASS other accounts cannot read, overwrite or plant rows';
end $$;

reset role;
do $$ begin
  assert (select name from public.courses where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Biology Honors', 'C''s row untouched';
end $$;

-- Deleting the account removes academic data too.
select pg_temp.act_as('33333333-3333-3333-3333-333333333333');
select public.delete_my_account();
reset role;
do $$ begin
  assert not exists (select 1 from public.courses where user_id = '33333333-3333-3333-3333-333333333333'), 'courses removed with account';
  raise notice 'PASS deleting the account removes its academic data';
end $$;

do $$ begin raise notice 'ALL SYNC CHECKS PASSED'; end $$;
