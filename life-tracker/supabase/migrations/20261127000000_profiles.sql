-- Life Tracker — Phase 3: user profiles, preferences and account lifecycle.
-- Every user-owned table follows the same rules (docs/DATABASE.md):
--   * Row Level Security on, rows visible only to their owner.
--   * Validation in the database, not only in the app.

-- ---------------------------------------------------------------------------
-- Shared helper: keep updated_at current on every UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per user (id = auth.users.id)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text not null default ''
                   check (char_length(display_name) <= 40),
  timezone         text not null default 'UTC'
                   check (char_length(timezone) between 1 and 64),
  theme            text not null default 'system'
                   check (theme in ('system', 'light', 'dark')),
  -- Sections pinned to the phone tab bar (Home is always first).
  nav_pins         text[] not null default array['academics', 'assignments', 'ai']
                   check (cardinality(nav_pins) between 1 and 3
                          and nav_pins <@ array['schedule', 'calendar', 'academics', 'assignments',
                                                'email', 'health', 'news', 'productivity', 'ai']),
  -- Home dashboard order + visibility: [{"id": "stats", "visible": true}, ...]
  dashboard_layout jsonb not null default '[]'::jsonb
                   check (jsonb_typeof(dashboard_layout) = 'array'
                          and jsonb_array_length(dashboard_layout) <= 20),
  demo_mode        boolean not null default false,
  briefing_time    time not null default '07:00',
  -- When the user last changed a preference on any device (last-write-wins sync).
  -- Starts at 'epoch' so settings made on a device before first sign-in win.
  prefs_updated_at timestamptz not null default 'epoch',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.profiles is 'Per-user profile and app preferences. Synced across devices.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: owner can read"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: owner can create own row"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "profiles: owner can update"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No delete policy: profiles are removed only by deleting the account.
revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;
grant select, insert, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Create a profile automatically when someone signs up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Delete my account: removes the auth user; every user-owned row cascades.
-- (Later phases also revoke third-party OAuth tokens before this runs.)
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
