\set ON_ERROR_STOP on
\set QUIET on
insert into auth.users (id, email) values ('efefefef-1111-1111-1111-111111111111', 'n@example.com');
create or replace function pg_temp.act_as(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  execute 'set role authenticated';
end $$;
-- Server side: a refresh writes articles.
insert into public.news_regions (region_key, label) values ('world', 'World');
insert into public.news_articles (id, region_key, provider, category, title, source_name, url, published_at)
values (repeat('a', 32), 'world', 'guardian', 'world', 'A headline', 'The Guardian', 'https://www.theguardian.com/x', now());

do $$
declare bad text[] := array[
  $q$insert into public.news_articles (id, region_key, provider, category, title, source_name, url, published_at) values (repeat('b', 32), 'world', 'guardian', 'world', 'x', 'y', 'javascript:alert(1)', now())$q$,
  $q$insert into public.news_articles (id, region_key, provider, category, title, source_name, url, published_at) values (repeat('c', 32), 'world', 'guardian', 'gossip', 'x', 'y', 'https://a.b', now())$q$,
  $q$insert into public.news_regions (region_key, label) values ('Bad Key!', 'x')$q$];
  q text;
begin
  foreach q in array bad loop
    begin
      execute q;
      raise exception 'accepted invalid row: %', q;
    exception when check_violation then null;
    end;
  end loop;
  raise notice 'PASS only safe links and known categories are stored';
end $$;

select pg_temp.act_as('efefefef-1111-1111-1111-111111111111') \gset
do $$ begin
  assert (select count(*) from public.news_articles) = 1, 'signed-in users read the shared cache';
  begin
    insert into public.news_articles (id, region_key, provider, category, title, source_name, url, published_at) values (repeat('d', 32), 'world', 'rss', 'world', 'Fake', 'Me', 'https://evil.example', now());
    assert false, 'users must not add articles';
  exception when insufficient_privilege then null; end;
  begin
    update public.news_articles set title = 'Changed';
    assert false, 'users must not change articles';
  exception when insufficient_privilege then null; end;
  begin
    update public.news_regions set last_refreshed_at = null;
    assert false, 'users must not reset the refresh timer';
  exception when insufficient_privilege then null; end;
  update public.profiles set news_settings = '{"tempUnit":"f"}' where id = 'efefefef-1111-1111-1111-111111111111';
  raise notice 'PASS news is read-only for users; settings are their own';
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform count(*) from public.news_articles;
    assert false, 'signed-out visitors must not read the cache';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS signed-out visitors can''t use the news cache';
end $$;
reset role;
do $$ begin raise notice 'ALL NEWS CHECKS PASSED'; end $$;
