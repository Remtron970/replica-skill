\set ON_ERROR_STOP on
\set QUIET on
insert into auth.users (id, email) values ('eeeeeeee-1111-1111-1111-111111111111', 'j@example.com'), ('ffffffff-1111-1111-1111-111111111111', 'k@example.com');
create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

-- The server (table owner here) stores a synced Gmail message for J.
insert into public.integrations (user_id, provider, account_label) values ('eeeeeeee-1111-1111-1111-111111111111', 'gmail', 'j@district.org');
insert into public.emails (id, user_id, client_updated_at, source, external_id, from_name, subject, received_at, category, summary, summary_source, importance, web_url)
values ('eeeeeeee-0000-0000-0000-000000000001', 'eeeeeeee-1111-1111-1111-111111111111', now(), 'gmail', '18c1', 'Ms. Rivera', 'Field trip', now(), 'school', 'Return the form by Friday.', 'ai', 2, 'https://mail.google.com/mail/?authuser=j%40district.org#all/18c1');

select pg_temp.act_as('eeeeeeee-1111-1111-1111-111111111111') \gset
do $$ begin
  assert (select count(*) from public.emails) = 1, 'owner sees the email';
  update public.emails set dismissed = true, client_updated_at = now() + interval '1 second';
  insert into public.emails (id, client_updated_at, from_name, subject, received_at, summary) values (gen_random_uuid(), now(), 'Coach', 'Practice moved', now(), 'Practice is at 4 today.');
  raise notice 'PASS emails can be read, dismissed and pasted in';
end $$;

do $$
declare bad text[] := array[
  $q$insert into public.emails (id, client_updated_at, received_at, category) values (gen_random_uuid(), now(), now(), 'spam')$q$,
  $q$insert into public.emails (id, client_updated_at, received_at, importance) values (gen_random_uuid(), now(), now(), 5)$q$,
  $q$insert into public.emails (id, client_updated_at, received_at, web_url) values (gen_random_uuid(), now(), now(), 'javascript:alert(1)')$q$,
  $q$insert into public.emails (id, client_updated_at, received_at, summary) values (gen_random_uuid(), now(), now(), repeat('x', 401))$q$,
  $q$insert into public.emails (id, client_updated_at, received_at, source) values (gen_random_uuid(), now(), now(), 'canvas')$q$];
  q text;
begin
  foreach q in array bad loop
    begin
      execute q;
      raise exception 'accepted invalid row: %', q;
    exception when check_violation then null;
    end;
  end loop;
  raise notice 'PASS invalid email rows are rejected';
end $$;

reset role;
select pg_temp.act_as('ffffffff-1111-1111-1111-111111111111') \gset
do $$ begin
  assert (select count(*) from public.emails) = 0, 'K sees none of J''s email';
  raise notice 'PASS nobody else can read your email summaries';
end $$;
reset role;
do $$ begin raise notice 'ALL EMAIL CHECKS PASSED'; end $$;
