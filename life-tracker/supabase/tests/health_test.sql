\set ON_ERROR_STOP on
\set QUIET on
insert into auth.users (id, email) values ('abababab-1111-1111-1111-111111111111', 'l@example.com'), ('cdcdcdcd-1111-1111-1111-111111111111', 'm@example.com');
create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
-- Server (owner) side: a key for L and a day from the Shortcut.
insert into public.health_ingest_tokens (user_id, token_hash) values ('abababab-1111-1111-1111-111111111111', repeat('a', 64));
insert into public.health_daily (id, user_id, client_updated_at, source, external_id, day, steps, distance_km)
values (gen_random_uuid(), 'abababab-1111-1111-1111-111111111111', now(), 'shortcut', 'shortcut:2026-11-25', '2026-11-25', 8421, 6.2);

select pg_temp.act_as('abababab-1111-1111-1111-111111111111') \gset
do $$ begin
  assert (select steps from public.health_daily) = 8421, 'owner sees steps';
  insert into public.health_daily (id, client_updated_at, day, steps) values (gen_random_uuid(), now(), '2026-11-24', 5000);
  insert into public.weight_entries (id, client_updated_at, measured_at, weight_kg) values (gen_random_uuid(), now(), now(), 61.5);
  assert (select count(*) from public.health_ingest_tokens) = 1, 'owner sees that a key exists';
  begin
    perform token_hash from public.health_ingest_tokens;
    assert false, 'key hash must not be readable';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.health_ingest_tokens (user_id, token_hash) values ('abababab-1111-1111-1111-111111111111', repeat('b', 64));
    assert false, 'keys are only created by the server';
  exception when insufficient_privilege then null; end;
  delete from public.health_ingest_tokens;
  assert (select count(*) from public.health_ingest_tokens) = 0, 'owner can revoke';
  raise notice 'PASS health data is private; keys can be seen and revoked but not read or forged';
end $$;

do $$
declare bad text[] := array[
  $q$insert into public.health_daily (id, client_updated_at, day, steps) values (gen_random_uuid(), now(), '2026-11-23', -5)$q$,
  $q$insert into public.health_daily (id, client_updated_at, day, steps) values (gen_random_uuid(), now(), '2026-11-23', 500000)$q$,
  $q$insert into public.health_daily (id, client_updated_at, day, exercise_minutes) values (gen_random_uuid(), now(), '2026-11-23', 2000)$q$,
  $q$insert into public.weight_entries (id, client_updated_at, measured_at, weight_kg) values (gen_random_uuid(), now(), now(), 5)$q$,
  $q$insert into public.health_daily (id, client_updated_at, day, source) values (gen_random_uuid(), now(), '2026-11-23', 'fitbit')$q$];
  q text;
begin
  foreach q in array bad loop
    begin
      execute q;
      raise exception 'accepted invalid row: %', q;
    exception when check_violation then null;
    end;
  end loop;
  raise notice 'PASS impossible health values are rejected';
end $$;
reset role;
select pg_temp.act_as('cdcdcdcd-1111-1111-1111-111111111111') \gset
do $$ begin
  assert (select count(*) from public.health_daily) + (select count(*) from public.weight_entries) = 0, 'M sees none of L''s health data';
  raise notice 'PASS nobody else can see your health data';
end $$;
reset role;
do $$ begin raise notice 'ALL HEALTH CHECKS PASSED'; end $$;
