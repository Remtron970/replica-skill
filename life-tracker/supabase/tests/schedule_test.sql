\set ON_ERROR_STOP on
\set QUIET on
insert into auth.users (id, email) values ('aaaaaaaa-1111-1111-1111-111111111111', 'h@example.com'), ('bbbbbbbb-1111-1111-1111-111111111111', 'i@example.com');
create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
select pg_temp.act_as('aaaaaaaa-1111-1111-1111-111111111111') \gset

do $$ begin
  insert into public.day_types (id, client_updated_at, name, short) values ('cccccccc-0000-0000-0000-000000000001', now(), 'A day', 'A');
  insert into public.schedule_blocks (id, client_updated_at, day_type_id, title, start_time, end_time) values (gen_random_uuid(), now(), 'cccccccc-0000-0000-0000-000000000001', 'Biology', '08:00', '09:30');
  insert into public.schedule_exceptions (id, client_updated_at, date, kind, note) values (gen_random_uuid(), now(), '2026-11-26', 'no_school', 'Thanksgiving');
  insert into public.assignments (id, client_updated_at, title, due_at, url, reminder_minutes) values ('dddddddd-0000-0000-0000-000000000001', now(), 'Lab report', '2026-11-28 04:59+00', 'https://school.instructure.com/courses/1/assignments/2', 1440);
  update public.profiles set schedule_settings = '{"rotation": ["cccccccc-0000-0000-0000-000000000001"]}' where id = 'aaaaaaaa-1111-1111-1111-111111111111';
  raise notice 'PASS schedule, days off, assignments and schedule settings can be saved';
end $$;

do $$
declare bad text[] := array[
  $q$insert into public.schedule_blocks (id, client_updated_at, day_type_id, title, start_time, end_time) values (gen_random_uuid(), now(), gen_random_uuid(), 'X', '8:00', '09:00')$q$,
  $q$insert into public.schedule_blocks (id, client_updated_at, day_type_id, title, start_time, end_time) values (gen_random_uuid(), now(), gen_random_uuid(), 'X', '10:00', '09:00')$q$,
  $q$insert into public.schedule_blocks (id, client_updated_at, day_type_id, title, start_time, end_time) values (gen_random_uuid(), now(), gen_random_uuid(), 'X', '25:00', '26:00')$q$,
  $q$insert into public.schedule_exceptions (id, client_updated_at, date, kind) values (gen_random_uuid(), now(), '2026-12-01', 'day_type')$q$,
  $q$insert into public.assignments (id, client_updated_at, title, url) values (gen_random_uuid(), now(), 'X', 'javascript:alert(1)')$q$,
  $q$insert into public.assignments (id, client_updated_at, title, url) values (gen_random_uuid(), now(), 'X', 'http://insecure.example.com')$q$,
  $q$insert into public.assignments (id, client_updated_at, title, priority) values (gen_random_uuid(), now(), 'X', 'urgent')$q$,
  $q$insert into public.assignments (id, client_updated_at, title, reminder_minutes) values (gen_random_uuid(), now(), 'X', 1)$q$,
  $q$insert into public.assignments (id, client_updated_at, title) values (gen_random_uuid(), now(), '')$q$,
  $q$update public.profiles set schedule_settings = '[]'$q$];
  q text;
begin
  foreach q in array bad loop
    begin
      execute q;
      raise exception 'accepted invalid row: %', q;
    exception when check_violation then null;
    end;
  end loop;
  raise notice 'PASS bad times, unsafe links and invalid values are rejected';
end $$;

reset role;
select pg_temp.act_as('bbbbbbbb-1111-1111-1111-111111111111') \gset
do $$ begin
  assert (select count(*) from public.assignments) + (select count(*) from public.day_types) + (select count(*) from public.schedule_blocks) + (select count(*) from public.schedule_exceptions) = 0, 'I sees none of H''s data';
  begin
    insert into public.assignments (id, client_updated_at, title) values ('dddddddd-0000-0000-0000-000000000001', '2030-01-01', 'Hijack')
    on conflict (id) do update set title = excluded.title, client_updated_at = excluded.client_updated_at;
    assert false, 'must not overwrite';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS other accounts can''t see or change someone''s schedule or assignments';
end $$;
reset role;
do $$ begin raise notice 'ALL SCHEDULE CHECKS PASSED'; end $$;
