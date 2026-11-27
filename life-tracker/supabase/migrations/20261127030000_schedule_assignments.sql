-- Life Tracker — Phase 5: block schedule and assignments (same sync model as academics).

create table public.day_types (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  name              text not null check (char_length(name) between 1 and 40),
  short             text not null default '' check (char_length(short) <= 6),
  sort              integer not null default 0
);

create table public.schedule_blocks (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  day_type_id       uuid not null,
  course_id         uuid,
  title             text not null check (char_length(title) between 1 and 80),
  room              text not null default '' check (char_length(room) <= 40),
  teacher           text not null default '' check (char_length(teacher) <= 80),
  start_time        text not null check (start_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  end_time          text not null check (end_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  check (end_time > start_time)
);

create table public.schedule_exceptions (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  date              date not null,
  kind              text not null check (kind in ('no_school', 'day_type')),
  day_type_id       uuid,
  note              text not null default '' check (char_length(note) <= 80),
  check (kind = 'no_school' or day_type_id is not null)
);

create table public.assignments (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  source            text not null default 'manual' check (source in ('manual', 'csv', 'canvas', 'google_classroom', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  course_id         uuid,
  title             text not null check (char_length(title) between 1 and 160),
  description       text not null default '' check (char_length(description) <= 2000),
  due_at            timestamptz,
  -- false = only a date is known (shown as "due Friday"; treated as 11:59 PM)
  due_has_time      boolean not null default true,
  priority          text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  -- the student's own progress
  status            text not null default 'todo' check (status in ('todo', 'doing', 'done')),
  completed_at      timestamptz,
  -- turned in, according to the school platform
  submitted         boolean not null default false,
  url               text check (url is null or (url ~ '^https://' and char_length(url) <= 500)),
  -- minutes before the due time to remind (null = no reminder)
  reminder_minutes  integer check (reminder_minutes is null or reminder_minutes between 5 and 20160)
);

select public.enable_sync('public.day_types');
select public.enable_sync('public.schedule_blocks');
select public.enable_sync('public.schedule_exceptions');
select public.enable_sync('public.assignments');

create index assignments_due_idx on public.assignments (user_id, due_at);

alter table public.profiles
  add column schedule_settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(schedule_settings) = 'object');
