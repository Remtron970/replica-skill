-- Life Tracker — Phase 4: connections to outside services (school platforms first).
--
-- integrations        what's connected and its status — the user can read and disconnect
-- integration_tokens  encrypted credentials — NO access for users at all; only the
--                     server functions (service role) can read or write them
-- sync_runs           history of each sync, for "last synced" and troubleshooting

create table public.integrations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  provider       text not null check (provider in ('canvas', 'google_classroom')),
  status         text not null default 'connected' check (status in ('connected', 'error', 'expired', 'blocked', 'disconnected')),
  account_label  text not null default '' check (char_length(account_label) <= 200),
  settings       jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  last_sync_at   timestamptz,
  last_error     text check (char_length(last_error) <= 500),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (user_id, provider)
);

create trigger integrations_set_updated_at
  before update on public.integrations
  for each row execute function public.set_updated_at();

alter table public.integrations enable row level security;

create policy "integrations: owner can read"
  on public.integrations for select to authenticated
  using ((select auth.uid()) = user_id);

-- Users may only switch a connection off; connecting goes through a server function.
create policy "integrations: owner can disconnect"
  on public.integrations for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id and status = 'disconnected');

revoke all on public.integrations from anon, authenticated;
grant select on public.integrations to authenticated;
grant update (status) on public.integrations to authenticated;

create table public.integration_tokens (
  integration_id uuid primary key references public.integrations (id) on delete cascade,
  -- AES-256-GCM ciphertext and IV (base64); the key lives only in server secrets.
  secret_enc     text not null,
  iv             text not null,
  refresh_enc    text,
  refresh_iv     text,
  expires_at     timestamptz,
  updated_at     timestamptz not null default now()
);

alter table public.integration_tokens enable row level security;
-- No policies on purpose: users can't read tokens, even their own.
revoke all on public.integration_tokens from anon, authenticated;

create table public.sync_runs (
  id             uuid primary key default gen_random_uuid(),
  integration_id uuid not null references public.integrations (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running' check (status in ('running', 'ok', 'error')),
  items_upserted integer not null default 0,
  error          text check (char_length(error) <= 500)
);

alter table public.sync_runs enable row level security;
create policy "sync_runs: owner can read"
  on public.sync_runs for select to authenticated
  using ((select auth.uid()) = user_id);
revoke all on public.sync_runs from anon, authenticated;
grant select on public.sync_runs to authenticated;

create index sync_runs_integration_idx on public.sync_runs (integration_id, started_at desc);
