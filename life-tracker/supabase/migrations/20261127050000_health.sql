-- Life Tracker — Phase 7: health (steps, activity, optional weight).
-- Data arrives from an iPhone Shortcut (Apple Health) through the
-- health-ingest function, or is entered by hand. Private to the user.

create table public.health_daily (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at  timestamptz not null,
  updated_at         timestamptz not null default now(),
  deleted            boolean not null default false,
  -- shortcut = from Apple Health via the Shortcut; manual = typed in
  source             text not null default 'manual' check (source in ('shortcut', 'manual', 'demo')),
  external_id        text check (char_length(external_id) <= 200),
  day                date not null,
  steps              integer check (steps between 0 and 200000),
  distance_km        numeric(7, 3) check (distance_km between 0 and 400),
  active_energy_kcal numeric(7, 1) check (active_energy_kcal between 0 and 20000),
  exercise_minutes   integer check (exercise_minutes between 0 and 1440)
);

create table public.weight_entries (
  id                 uuid primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at  timestamptz not null,
  updated_at         timestamptz not null default now(),
  deleted            boolean not null default false,
  source             text not null default 'manual' check (source in ('shortcut', 'manual', 'demo')),
  external_id        text check (char_length(external_id) <= 200),
  measured_at        timestamptz not null,
  weight_kg          numeric(6, 2) not null check (weight_kg between 20 and 400)
);

select public.enable_sync('public.health_daily');
select public.enable_sync('public.weight_entries');
create index health_daily_day_idx on public.health_daily (user_id, day);
create index weight_entries_at_idx on public.weight_entries (user_id, measured_at);

-- Personal keys for the Shortcut. Only a SHA-256 hash is stored; the key itself
-- is shown once. Users can see that a key exists and revoke it, nothing more.
create table public.health_ingest_tokens (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  token_hash   text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.health_ingest_tokens enable row level security;
create policy "health_ingest_tokens: owner can see" on public.health_ingest_tokens for select to authenticated using ((select auth.uid()) = user_id);
create policy "health_ingest_tokens: owner can revoke" on public.health_ingest_tokens for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.health_ingest_tokens from anon, authenticated;
grant select (id, created_at, last_used_at), delete on public.health_ingest_tokens to authenticated;

alter table public.profiles
  add column health_settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(health_settings) = 'object');
