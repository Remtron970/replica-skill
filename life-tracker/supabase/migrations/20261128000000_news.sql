-- Life Tracker — Phase 8: news (shared, read-only cache) and news settings.
-- Articles are public news, cached once per region for everyone, written only
-- by the news-refresh function. Users can read them; nobody can write them
-- through the app.

create table public.news_regions (
  region_key        text primary key check (region_key ~ '^[a-z0-9-]{2,80}$'),
  label             text not null check (char_length(label) <= 120),
  query             text check (char_length(query) <= 120),
  last_refreshed_at timestamptz,
  last_error        text check (char_length(last_error) <= 500),
  -- Set while a refresh is running so two refreshes don't overlap.
  refreshing_since  timestamptz
);

create table public.news_articles (
  id            text primary key check (id ~ '^[0-9a-f]{32}$'),
  region_key    text not null references public.news_regions (region_key) on delete cascade,
  provider      text not null check (provider in ('guardian', 'gnews', 'rss')),
  category      text not null check (category in ('world', 'us', 'politics', 'business', 'technology', 'science', 'health', 'sports', 'entertainment', 'local')),
  title         text not null check (char_length(title) between 1 and 400),
  summary       text check (char_length(summary) <= 1000),
  source_name   text not null check (char_length(source_name) <= 120),
  url           text not null check (url ~ '^https://' and char_length(url) <= 2000),
  image_url     text check (image_url ~ '^https://' and char_length(image_url) <= 2000),
  published_at  timestamptz not null,
  fetched_at    timestamptz not null default now(),
  -- The source itself marks it live/breaking (e.g. a Guardian live blog that is
  -- still being updated). "Reported by N outlets" is worked out in the app.
  is_live       boolean not null default false
);
create index news_articles_region_time_idx on public.news_articles (region_key, published_at desc);

alter table public.news_regions enable row level security;
alter table public.news_articles enable row level security;
create policy "news_regions: signed-in users can read" on public.news_regions for select to authenticated using (true);
create policy "news_articles: signed-in users can read" on public.news_articles for select to authenticated using (true);
revoke all on public.news_regions, public.news_articles from anon, authenticated;
grant select on public.news_regions, public.news_articles to authenticated;

alter table public.profiles
  add column news_settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(news_settings) = 'object');
