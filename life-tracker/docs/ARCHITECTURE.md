# Life Tracker — Technical Architecture

Status: **Phase 1 (planning) — approved design, no application code yet.**

This document is the source of truth for how Life Tracker is built. Later
phases must follow it; any change to a decision here gets recorded in the
"Decision log" at the bottom.

---

## 1. What we are building

One personal app ("command center") that runs:

| Where | How | Notes |
|---|---|---|
| iPhone | Installed from Safari to the Home Screen (PWA) | Full app, offline shell, push notifications (iOS 16.4+) |
| iPhone (optional, later) | Native iOS shell via Capacitor | Only needed for direct Apple HealthKit / Apple Calendar access |
| Desktop | Any modern browser; also installable in Chrome/Edge | Same codebase, sidebar layout |

All three share **one TypeScript codebase** and **one backend**.

---

## 2. Technology stack (selected)

| Layer | Choice | Why |
|---|---|---|
| UI framework | **React 19 + TypeScript** | Huge ecosystem, strict typing, works identically in browser and inside a Capacitor iOS shell |
| Build tool | **Vite** (SPA) | Produces a static bundle. A static bundle can be shipped *inside* the native iOS app (works offline, passes App Store review better than a remote-URL wrapper). See note on Next.js below |
| Routing | **React Router** | Nested routes for the 11 sections, URL deep links for notifications |
| Styling | **Tailwind CSS** + CSS variables for design tokens | Fast, consistent, easy light/dark theming |
| Components | Headless primitives (**Radix UI**) styled with our tokens | Accessible dialogs, sheets, menus, tabs without fighting a foreign look |
| Animation | **Framer Motion** (`motion`) | Page transitions, shared-element card expansion, animated numbers; respects `prefers-reduced-motion` |
| Charts | **Recharts** (animated SVG) | Grade history, steps, weight, productivity |
| Server state | **TanStack Query** + persisted cache in IndexedDB | Loading/error states, background refresh, offline reads |
| Local state | **Zustand** | UI prefs (dashboard order, theme) |
| Forms / validation | **React Hook Form + Zod** | Same Zod schemas validate on client and in Edge Functions |
| PWA | **vite-plugin-pwa (Workbox)** | Service worker, offline shell, install manifest, web push |
| Backend | **Supabase** | Postgres + Auth + Row Level Security + Edge Functions + scheduled jobs + storage in one managed service with a free tier |
| Server code | **Supabase Edge Functions (Deno, TypeScript)** | OAuth callbacks, sync jobs, AI calls, push sending. All secrets live here, never in the browser |
| Scheduling | **pg_cron + pg_net** inside Supabase | Morning briefing, weekly recap, periodic syncs |
| AI | **Anthropic Claude API** via the official `@anthropic-ai/sdk`, called only from Edge Functions | Tool use lets the assistant query *your* data instead of guessing |
| Native iOS (optional) | **Capacitor 7** + a HealthKit plugin + EventKit | Wraps the same Vite build; adds native permissions |
| Hosting (web) | **Vercel** or **Cloudflare Pages** (static) | Free HTTPS hosting, preview deploys from GitHub |
| Testing | **Vitest** (logic), **React Testing Library**, **Playwright** (end-to-end, mobile + desktop viewports) | "Test as you go" rule |

### Why not Next.js?
You suggested Next.js; I'm choosing Vite + React instead, for one clear reason:
the native iOS shell (needed for HealthKit) must bundle static files. Next.js's
server features (API routes, server components) cannot run inside an iPhone app,
so we would end up maintaining **two** backends (Next.js server + Supabase). With
Vite, the frontend is purely static and **all** server logic lives in Supabase
Edge Functions — one backend, used identically by web, PWA and native. Everything
else you asked for (React, TypeScript, Tailwind, Framer Motion, Supabase) is kept.

---

## 3. System overview

```
 ┌──────────────────────────── Clients ─────────────────────────────┐
 │  iPhone PWA (Safari)   Desktop browser   [Optional] iOS native   │
 │        └────────── same React/Vite bundle ──────────┘    │       │
 │   IndexedDB cache + offline outbox            HealthKit/EventKit │
 └──────────────┬───────────────────────────────────────────┬───────┘
                │ HTTPS (Supabase JS client, user JWT)       │
 ┌──────────────▼───────────────── Supabase ─────────────────▼──────┐
 │ Auth (Apple / Google / email link)                                │
 │ Postgres + Row Level Security (every row owned by user_id)        │
 │ Edge Functions:                                                   │
 │   oauth-start / oauth-callback  (Google, Canvas)                  │
 │   sync-classroom  sync-canvas  sync-gmail  sync-gcal  sync-news   │
 │   health-ingest (Shortcuts / native app)                          │
 │   ai-chat  ai-summarize-email  build-briefing  build-weekly       │
 │   notify (Web Push / APNs)                                        │
 │ pg_cron: schedules the sync + briefing functions                  │
 │ Secrets: OAuth client secrets, Anthropic key, VAPID key, AES key  │
 └──────┬───────────┬────────────┬─────────────┬────────────┬───────┘
        ▼           ▼            ▼             ▼            ▼
   Google APIs   Canvas API   News APIs    Anthropic    Web Push / APNs
 (Classroom,    (school's     (Guardian,   Claude API
  Gmail, Cal)    instance)     GNews, NWS,
                               Open-Meteo)
```

### Data flow rules
1. **The browser never sees a third-party secret or refresh token.** It only
   holds its own Supabase session.
2. **Sync runs server-side** (scheduled + on demand when you pull-to-refresh).
   Results are written to Postgres; the UI reads Postgres.
3. **Every synced row records `source` and `synced_at`.** The UI shows a
   "Synced 5 min ago · Google Classroom" footer on each card, and a clear
   **DEMO** badge on sample data.
4. **Failure falls back visibly.** If a sync fails, the last good data stays,
   the card shows "Couldn't refresh — last updated 3 h ago", and the
   integration's status in Settings shows the error.

---

## 4. Authentication & security

### App sign-in (Supabase Auth)
- **Sign in with Apple** (best on iPhone), **Google**, and **email magic link**.
- Sessions use short-lived JWTs + refresh tokens, stored by the Supabase client.
- Optional: Face ID / passcode app lock (native shell only; PWA uses a PIN).

### Connecting accounts (OAuth 2.0)
App sign-in and data connections are **separate**. Signing in with Google does
not grant Gmail access; you connect Gmail explicitly in Settings and see the
exact scopes requested.

```
Settings → "Connect Gmail"
  → Edge Function oauth-start: creates state + PKCE verifier, redirects to Google
  → You approve on Google's own page (Life Tracker never sees your password)
  → Google → oauth-callback: verifies state, exchanges code for tokens
  → refresh token encrypted (AES-256-GCM, key in Edge secrets) → integration_tokens
  → first sync starts; status = "connected"
```

### Protections
- **Row Level Security on every user table**: `user_id = auth.uid()`.
- `integration_tokens` has **no client-readable policy**; only Edge Functions
  (service role) can read it.
- **Least privilege scopes**, all read-only by default (e.g. `gmail.readonly`
  makes sending/deleting email technically impossible, not just "not done").
- HTTPS everywhere; HSTS on hosting; strict Content-Security-Policy.
- Input validation with Zod on every Edge Function.
- AI access is **opt-in per section** (Settings → Privacy → "What the assistant
  can see").
- **Data export** (JSON + CSV zip) and **delete account** (cascades all rows,
  revokes OAuth tokens at Google/Canvas) in Settings.
- Health and weight data are never sent to the AI unless you enable that toggle.

---

## 5. Offline & sync behavior

| Situation | Behavior |
|---|---|
| Open app offline | Service worker serves the app shell; TanStack Query shows cached data with an "Offline — showing data from 8:14 AM" banner |
| Edit offline (task, grade, event) | Saved to an IndexedDB **outbox**, shown immediately, replayed when online |
| Conflicts | Last-write-wins using `updated_at`; synced items from external sources are read-only except local fields (e.g. your own priority on an imported assignment) |
| Background | PWAs can't run background sync on iOS reliably, so syncing is server-driven (pg_cron) — data is fresh when you open the app |

All timestamps are stored in UTC; your time zone is saved in your profile and
used for "today", class countdowns and the 7 AM briefing.

---

## 6. Navigation model

11 sections. A phone bottom bar can't fit 11 icons legibly, so:

- **Mobile:** bottom bar with 5 slots — **Home · Academics · Assignments ·
  AI · More**. "More" opens a sheet with the other sections. You can choose
  which 4 sections are pinned (Settings → Appearance).
- **Desktop (≥1024 px):** collapsible left sidebar listing all 11 sections,
  grouped: *Today* (Home, Schedule, Calendar), *School* (Academics,
  Assignments), *Life* (Email, Health, News, Productivity), *Assistant* (AI),
  Settings at the bottom.
- **Tablet (768–1023 px):** icon-only rail.
- Every section has a URL (`/academics`, `/assignments/:id`, …) so
  notifications open the right screen directly.

---

## 7. AI design (Life Tracker AI)

- Runs in the `ai-chat` Edge Function with the Anthropic TypeScript SDK.
- **Model:** `claude-opus-5-5` for the assistant (best reasoning for "what
  should I prioritize?" across many data sources). `claude-haiku-5-5` for
  high-volume, simple jobs (per-email summaries and categorization) to keep
  cost low. Both are configurable.
- **Tool use, not data dumping.** The assistant gets tools such as
  `get_schedule(date)`, `list_assignments(range, status)`, `get_grades()`,
  `get_email_digest(date)`, `get_health_summary(range)`, `get_news(top)`,
  `list_tasks()`, `get_integration_status()`. Each tool queries Postgres **as
  you** (RLS applies) and only for sections you've allowed.
- **Grounding rules in the system prompt:** answer only from tool results; if a
  tool reports a section as not connected or empty, say so; cite which section
  and sync time the answer came from.
- Streaming responses to the chat UI; conversation history stored in
  `ai_messages`.
- Hosting the loop: we run the tool loop ourselves in the Edge Function (the
  SDK's tool runner). Anthropic also offers hosted "Managed Agents", but our
  tools are simple database reads that must run next to our database, so a
  self-hosted loop is simpler and keeps your data path short.
- Briefings and weekly recaps are generated by the same tools, so the
  briefing can never mention data the app doesn't actually have.

---

## 8. Automation & notifications

| Job | Schedule (pg_cron) | Function |
|---|---|---|
| School sync (Classroom/Canvas) | every 60 min, 6 AM–11 PM local | `sync-classroom`, `sync-canvas` |
| Gmail sync | every 30 min | `sync-gmail` → `ai-summarize-email` for new mail |
| Google Calendar sync | every 30 min | `sync-gcal` |
| News refresh | every 30 min (shared per region, not per user) | `sync-news` |
| Morning briefing | every 15 min, picks users whose local time = their briefing time (default 7:00) | `build-briefing` |
| Weekly recap | Sunday at the user's chosen time | `build-weekly` |
| Deadline / class alerts | every 5 min | `notify` scans upcoming items vs preferences |

Notifications are written to a `notifications` table first (the in-app inbox),
then delivered by **Web Push** (PWA) or **APNs** (native shell), respecting
categories, priority, quiet hours and a per-category rate limit
("at most 1 news alert per 3 hours").

---

## 9. Repository layout (planned)

```
life-tracker/
  apps/web/                 React + Vite app
    src/app/                routes, layouts, providers
    src/features/<section>/ one folder per section (home, academics, …)
    src/components/ui/      design-system components
    src/lib/                supabase client, query keys, gpa math, dates
    public/icons/           app icons (PNG, all iOS sizes)
  supabase/
    migrations/             SQL schema + RLS policies
    functions/<name>/       Edge Functions
    seed/demo.sql           demo data (flagged source = 'demo')
  ios/                      Capacitor native project (Phase 7, optional)
  packages/shared/          Zod schemas + types shared by app and functions
  docs/                     this documentation
  tests/e2e/                Playwright
```

---

## 10. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-27 | Vite SPA instead of Next.js | Static bundle needed for native iOS shell; single backend |
| 2026-11-27 | Supabase for DB/Auth/Functions/Cron | One managed service, RLS, free tier, Postgres |
| 2026-11-27 | PWA first, native shell optional | Works on iPhone immediately with no Apple developer fees; native added only for HealthKit/Apple Calendar |
| 2026-11-27 | iOS Shortcuts as the no-cost HealthKit bridge | Lets steps/weight reach the app without a native app (see INTEGRATIONS.md) |
| 2026-11-27 | No password-based school scraping | PowerSchool / Infinite Campus have no student-authorized API; manual entry and CSV import instead |
| 2026-11-27 | Read-only OAuth scopes | Makes "never send/delete email" a technical guarantee |
