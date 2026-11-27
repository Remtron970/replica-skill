\set ON_ERROR_STOP on
\set QUIET on
insert into auth.users (id, email) values ('55555555-5555-5555-5555-555555555555', 'e@example.com'), ('66666666-6666-6666-6666-666666666666', 'f@example.com');
-- The server (service role, simulated here as the table owner) connects Canvas for E.
insert into public.integrations (id, user_id, provider, account_label) values ('77777777-7777-7777-7777-777777777777', '55555555-5555-5555-5555-555555555555', 'canvas', 'school.instructure.com');
insert into public.integration_tokens (integration_id, secret_enc, iv) values ('77777777-7777-7777-7777-777777777777', 'ciphertext', 'iv');

create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;

select pg_temp.act_as('55555555-5555-5555-5555-555555555555') \gset
do $$ begin
  assert (select count(*) from public.integrations) = 1, 'owner sees connection';
  begin
    perform * from public.integration_tokens;
    assert false, 'tokens must be unreadable';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS users can see their connections but never read stored tokens';
end $$;

do $$ begin
  begin
    update public.integrations set status = 'connected', account_label = 'spoofed';
    assert false, 'only status may change';
  exception when insufficient_privilege then null; end;
  begin
    update public.integrations set status = 'connected';
    assert false, 'cannot mark itself connected';
  exception when check_violation or insufficient_privilege then null; end;
  begin
    insert into public.integrations (provider) values ('canvas');
    assert false, 'connecting only through the server';
  exception when insufficient_privilege then null; end;
  update public.integrations set status = 'disconnected';
  assert (select status from public.integrations) = 'disconnected', 'can disconnect';
  raise notice 'PASS users can disconnect, but only the server can connect or change details';
end $$;

reset role;
select pg_temp.act_as('66666666-6666-6666-6666-666666666666') \gset
do $$ begin
  assert (select count(*) from public.integrations) = 0, 'F sees nothing of E';
  raise notice 'PASS other accounts can''t see someone''s connections';
end $$;
reset role;

delete from auth.users where id = '55555555-5555-5555-5555-555555555555';
do $$ begin
  assert not exists (select 1 from public.integration_tokens), 'tokens removed with account';
  raise notice 'PASS deleting the account deletes its stored tokens';
end $$;
-- How the school sync writes (as PostgREST upserts with merge-duplicates):
insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'g@example.com');
insert into public.courses (id, user_id, client_updated_at, source, external_id, name, color, credits, level)
values ('99999999-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '2026-11-01', 'canvas', 'canvas:course:1', 'Bio', 'green', 0.5, 'honors');
do $$ begin
  -- A later sync sends only the platform's fields: the user's color/credits/level stay.
  insert into public.courses (id, user_id, client_updated_at, source, external_id, name, teacher, room, grading_mode)
  values ('99999999-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '2026-11-27', 'canvas', 'canvas:course:1', 'Biology', 'Ms. Rivera', '', 'weighted')
  on conflict (id) do update set name = excluded.name, teacher = excluded.teacher, room = excluded.room, grading_mode = excluded.grading_mode, client_updated_at = excluded.client_updated_at;
  assert (select (name, color, credits, level, grading_mode) = ('Biology', 'green', 0.5, 'honors', 'weighted') from public.courses where id = '99999999-0000-0000-0000-000000000001'), 'user choices kept, platform fields updated';
  -- A partial "deleted" row can't go through an upsert (NOT NULL is checked first)…
  begin
    insert into public.courses (id, user_id, client_updated_at, deleted, source, external_id)
    values ('99999999-0000-0000-0000-000000000001', '88888888-8888-8888-8888-888888888888', '2026-11-28', true, 'canvas', 'canvas:course:1')
    on conflict (id) do update set deleted = excluded.deleted;
    assert false, 'expected NOT NULL failure';
  exception when not_null_violation then null; end;
  -- …so deletions use a plain update.
  update public.courses set deleted = true, client_updated_at = '2026-11-28' where id = '99999999-0000-0000-0000-000000000001';
  assert (select deleted from public.courses where id = '99999999-0000-0000-0000-000000000001'), 'deleted by update';
  raise notice 'PASS school sync keeps your class settings and removes deleted classes correctly';
end $$;

do $$ begin raise notice 'ALL INTEGRATION CHECKS PASSED'; end $$;
