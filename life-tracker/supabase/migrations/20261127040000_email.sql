-- Life Tracker — Phase 6: email recap (read-only Gmail + pasted emails).
-- Only what's needed for the recap is stored: sender, subject, a short preview,
-- the summary and flags. Full email bodies are never stored.

alter table public.integrations drop constraint integrations_provider_check;
alter table public.integrations add constraint integrations_provider_check
  check (provider in ('canvas', 'google_classroom', 'gmail'));

create table public.emails (
  id                uuid primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_updated_at timestamptz not null,
  updated_at        timestamptz not null default now(),
  deleted           boolean not null default false,
  -- gmail = synced from Gmail; manual = pasted by the user
  source            text not null default 'manual' check (source in ('gmail', 'manual', 'demo')),
  external_id       text check (char_length(external_id) <= 200),
  thread_id         text check (char_length(thread_id) <= 200),
  from_name         text not null default '' check (char_length(from_name) <= 120),
  from_email        text not null default '' check (char_length(from_email) <= 200),
  subject           text not null default '' check (char_length(subject) <= 300),
  snippet           text not null default '' check (char_length(snippet) <= 300),
  received_at       timestamptz not null,
  labels            text[] not null default '{}' check (cardinality(labels) <= 30),
  unread            boolean not null default false,
  category          text not null default 'other' check (category in ('important', 'school', 'personal', 'notifications', 'other')),
  summary           text not null default '' check (char_length(summary) <= 400),
  -- ai = written by Claude; rules = built-in quick summary
  summary_source    text not null default 'rules' check (summary_source in ('ai', 'rules')),
  has_deadline      boolean not null default false,
  deadline_on       date,
  needs_reply       boolean not null default false,
  is_school         boolean not null default false,
  importance        smallint not null default 0 check (importance between 0 and 3),
  web_url           text check (web_url is null or (web_url ~ '^https://' and char_length(web_url) <= 500)),
  -- the user hid it from the recap
  dismissed         boolean not null default false
);

select public.enable_sync('public.emails');
create index emails_received_idx on public.emails (user_id, received_at desc);

alter table public.profiles
  add column email_settings jsonb not null default '{}'::jsonb
  check (jsonb_typeof(email_settings) = 'object');
