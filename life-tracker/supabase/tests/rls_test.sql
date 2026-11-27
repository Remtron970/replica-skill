-- Run by run_local.sh. Any failed check raises an exception and stops the run.
\set ON_ERROR_STOP on
\set QUIET on
\pset tuples_only on

-- Two users sign up.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

do $$ begin
  assert (select count(*) from public.profiles) = 2, 'profile auto-created for each new user';
  assert (select theme from public.profiles limit 1) = 'system', 'defaults applied';
  assert (select prefs_updated_at from public.profiles limit 1) = 'epoch'::timestamptz, 'new profile never changed';
  raise notice 'PASS signup creates profiles with defaults';
end $$;

-- Act as user A.
create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

select pg_temp.act_as('11111111-1111-1111-1111-111111111111');

do $$ begin
  assert (select count(*) from public.profiles) = 1, 'A sees only own profile';
  assert (select id from public.profiles) = '11111111-1111-1111-1111-111111111111', 'and it is A';
  raise notice 'PASS user sees only their own profile';
end $$;

do $$
declare n int;
begin
  update public.profiles set display_name = 'Hacker' where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  assert n = 0, 'A cannot update B';
  raise notice 'PASS user cannot change someone else''s profile';
end $$;

do $$
declare before timestamptz; after timestamptz;
begin
  select updated_at into before from public.profiles;
  perform pg_sleep(0.01);
  update public.profiles set display_name = 'Sam', theme = 'dark', nav_pins = array['health','news'],
    dashboard_layout = '[{"id":"stats","visible":true}]';
  select updated_at into after from public.profiles;
  assert after > before, 'updated_at bumped';
  assert (select display_name from public.profiles) = 'Sam', 'own update saved';
  raise notice 'PASS user can update own preferences; updated_at maintained';
end $$;

do $$ begin
  begin
    insert into public.profiles (id) values ('22222222-2222-2222-2222-222222222222');
    assert false, 'should not insert for another user';
  exception when insufficient_privilege or unique_violation then null; end;
  raise notice 'PASS user cannot create a profile for someone else';
end $$;

-- Validation (each must be rejected).
do $$
declare bad text[] := array[
  $q$update public.profiles set theme = 'neon'$q$,
  $q$update public.profiles set nav_pins = array['bogus']$q$,
  $q$update public.profiles set nav_pins = array['news','health','email','ai']$q$,
  $q$update public.profiles set nav_pins = array[]::text[]$q$,
  $q$update public.profiles set display_name = repeat('x', 41)$q$,
  $q$update public.profiles set dashboard_layout = '{"not":"array"}'$q$];
  q text;
begin
  foreach q in array bad loop
    begin
      execute q;
      raise exception 'accepted invalid value: %', q;
    exception when check_violation then null;
    end;
  end loop;
  raise notice 'PASS invalid preferences are rejected by the database';
end $$;

do $$ begin
  begin
    delete from public.profiles;
    assert false, 'delete should be denied';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS profiles cannot be deleted directly';
end $$;

reset role;

-- Anonymous visitors see nothing and cannot delete accounts.
set role anon;
do $$ begin
  begin
    perform count(*) from public.profiles;
    assert false, 'anon should not read profiles';
  exception when insufficient_privilege then null; end;
  begin
    perform public.delete_my_account();
    assert false, 'anon should not delete accounts';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS signed-out visitors cannot read profiles or delete accounts';
end $$;
reset role;

-- User A deletes their account: A's data is gone, B is untouched.
select pg_temp.act_as('11111111-1111-1111-1111-111111111111');
select public.delete_my_account();
reset role;
do $$ begin
  assert not exists (select 1 from auth.users where id = '11111111-1111-1111-1111-111111111111'), 'A auth user removed';
  assert not exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'), 'A profile removed';
  assert exists (select 1 from public.profiles where id = '22222222-2222-2222-2222-222222222222'), 'B untouched';
  raise notice 'PASS delete account removes only that user''s data';
end $$;

do $$ begin raise notice 'ALL DATABASE CHECKS PASSED'; end $$;
