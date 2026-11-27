-- Life Tracker — Phase 4: academics, on the shared sync model.
--
-- Sync model (used by every synced table from now on; see src/lib/store/):
--   id                 generated on the device, so records can be created offline
--   client_updated_at  when the user made the change (last write wins on this)
--   updated_at         when the server stored it (devices pull changes after this)
--   deleted            soft delete, so deletions reach the other devices
--   source/external_id where a row came from (manual entry, CSV, Canvas, Classroom…)
-- No foreign keys between synced tables: a device may upload a course before its
-- term; the app keeps references consistent and ignores dangling ones.

-- ---------------------------------------------------------------------------
-- Shared trigger: owner can't change, stale writes are ignored, server stamps time.
-- ---------------------------------------------------------------------------
create or replace function public.sync_row_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    if new.client_updated_at < old.client_updated_at then
      return null; -- an older edit arrived late: keep the newer one already stored
    end if;
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- Adds the sync columns, policies and trigger to a table created below.
create or replace function public.enable_sync(tbl regclass)
returns void
language plpgsql
set search_path = ''
as $$
declare
  name text := (select relname from pg_class where oid = tbl);
begin
  execute format('alter table %s enable row level security', tbl);
  execute format('create policy "%s: owner can read" on %s for select to authenticated using ((select auth.uid()) = user_id)', name, tbl);
  execute format('create policy "%s: owner can insert" on %s for insert to authenticated with check ((select auth.uid()) = user_id)', name, tbl);
  execute format('create policy "%s: owner can update" on %s for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', name, tbl);
  execute format('revoke all on %s from anon, authenticated', tbl);
  execute format('grant select, insert, update on %s to authenticated', tbl);
  execute format('create trigger %I before insert or update on %s for each row execute function public.sync_row_guard()', name || '_sync_guard', tbl);
  execute format('create index %I on %s (user_id, updated_at)', name || '_pull_idx', tbl);
  execute format('create unique index %I on %s (user_id, source, external_id) where external_id is not null', name || '_external_idx', tbl);
end;
$$;

-- Columns every synced table starts with (kept literal for readability).
-- id, user_id, client_updated_at, updated_at, deleted, source, external_id

create table public.terms (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  name              text not null check (char_length(name) between 1 and 60),
  starts_on         date,
  ends_on           date,
  is_current        boolean not null default false,
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.grading_scales (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  name              text not null check (char_length(name) between 1 and 60),
  -- [{"min": 93, "letter": "A", "points": 4.0}, ...] highest first
  bands             jsonb not null check (jsonb_typeof(bands) = 'array' and jsonb_array_length(bands) between 1 and 20)
);

create table public.courses (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  term_id           uuid,
  name              text not null check (char_length(name) between 1 and 80),
  teacher           text not null default '' check (char_length(teacher) <= 80),
  room              text not null default '' check (char_length(room) <= 40),
  color             text not null default 'purple' check (char_length(color) <= 20),
  credits           numeric(4, 2) not null default 1 check (credits >= 0 and credits <= 10),
  level             text not null default 'regular' check (level in ('regular', 'honors', 'ap', 'ib', 'dual', 'other')),
  -- points: total points · weighted: category weights · manual: the % shown in the school portal
  grading_mode      text not null default 'points' check (grading_mode in ('points', 'weighted', 'manual')),
  manual_percent    numeric(6, 2) check (manual_percent is null or (manual_percent >= 0 and manual_percent <= 200)),
  scale_id          uuid,
  archived          boolean not null default false
);

create table public.grade_categories (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  course_id         uuid not null,
  name              text not null check (char_length(name) between 1 and 60),
  weight            numeric(6, 2) not null default 0 check (weight >= 0 and weight <= 100),
  sort              integer not null default 0
);

create table public.grade_items (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  course_id         uuid not null,
  category_id       uuid,
  title             text not null check (char_length(title) between 1 and 120),
  earned            numeric(8, 2) check (earned is null or earned >= 0),
  possible          numeric(8, 2) check (possible is null or possible >= 0),
  graded_on         date,
  due_on            date,
  excused           boolean not null default false,
  missing           boolean not null default false,
  notes             text not null default '' check (char_length(notes) <= 500)
);

-- Final grades from earlier terms, for cumulative GPA.
create table public.past_courses (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  term_name         text not null check (char_length(term_name) between 1 and 60),
  name              text not null check (char_length(name) between 1 and 80),
  credits           numeric(4, 2) not null default 1 check (credits >= 0 and credits <= 10),
  level             text not null default 'regular' check (level in ('regular', 'honors', 'ap', 'ib', 'dual', 'other')),
  letter            text not null check (char_length(letter) between 1 and 4),
  points            numeric(3, 2) not null check (points >= 0 and points <= 5)
);

select public.enable_sync('public.terms');
select public.enable_sync('public.grading_scales');
select public.enable_sync('public.courses');
select public.enable_sync('public.grade_categories');
select public.enable_sync('public.grade_items');
select public.enable_sync('public.past_courses');

create index grade_items_course_idx on public.grade_items (user_id, course_id);
create index grade_categories_course_idx on public.grade_categories (user_id, course_id);

-- GPA preferences live with the other synced preferences on the profile.
alter table public.profiles
  add column academic_settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(academic_settings) = 'object');

revoke all on function public.enable_sync(regclass) from public, anon, authenticated;
