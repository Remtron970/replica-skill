# Progress Log

## Phase 1 — Planning & architecture (2026-11-27)
**Completed:** technology selection, architecture, auth/security plan,
integration feasibility review, database design, navigation model, design
system spec, 12-phase roadmap, external setup checklist.

**Files:** `README.md`, `PROGRESS.md`, `docs/ARCHITECTURE.md`,
`docs/INTEGRATIONS.md`, `docs/DATABASE.md`, `docs/DESIGN_SYSTEM.md`,
`docs/ROADMAP.md`, `docs/SETUP_CHECKLIST.md`.

**Works:** documentation only — no application code yet (by design).

**Open questions:**
1. Where should the code live long-term (dedicated `life-tracker` repo recommended)?
2. Which school platform(s) does your school use?
3. Personal Gmail or school Google account?
4. Fixed weekly schedule or rotating (A/B / block) days?
5. Will you have access to a Mac (for the optional native iOS app)?

**Next step:** Phase 2 — design system and main interface, on approval.

## Preview app (2026-11-27, requested before Phase 2)
**Built:** `apps/web` — Vite + React 19 + TypeScript + Tailwind 4 + Motion.
App shell (desktop sidebar, tablet rail, phone tab bar + "More" sheet), routes
for all 11 sections, Home (live date/clock/greeting, stat cards in honest
"Not connected" state, schedule and briefing placeholders), Settings (name,
light/dark/system theme, choose pinned phone tabs — saved on this device),
lightbulb app icon (SVG + PNG set), web manifest for Add to Home Screen.

**Verified:** type-check and production build pass; Playwright on iPhone 15
and 1440 px desktop: all routes render, 404 page works, cards/tabs/sidebar/More
navigate, settings persist across reload, no console errors, no horizontal
scroll on phone.

**Not yet:** backend, sign-in, real data, service worker/offline, push — per roadmap.

## Phase 2 — Design system & main interface (2026-11-27)
**Completed**
- Component library in `src/components/ui/`: Button, IconButton, Spinner, Card,
  IconChip, SectionCard (with source/sync footer + DEMO badge), Badge, Chip,
  TextField, Select, Switch, SegmentedControl, Dialog, Sheet (focus trap,
  Escape, drag-to-dismiss), Toast notifications, EmptyState, ErrorState,
  Skeleton/SkeletonCard, ListRow, ProgressBar, ProgressRing, AnimatedNumber,
  Countdown, SyncStatus, PageHeader/SectionTitle.
- Charts in `src/components/charts/`: TrendChart (line/area), BarSeries, Donut —
  themed by tokens, animated, with screen-reader summaries.
- Motion system (`src/lib/motion.ts`): shared springs, page transitions with
  exit animation, stagger; honors iPhone "Reduce Motion".
- Accessibility: contrast-safe token set (brand-ink / brand-strong), skip link,
  focus rings, labeled landmarks, focus-trapped overlays.
- PWA: service worker (offline app shell), generated manifest, update prompt,
  install helper (iPhone steps / Chrome-Edge install button), self-hosted Inter.
- Living design-system gallery (`/#/design`), linked from Settings.
- Home and section screens rebuilt on the new components.

**Verified**: `npm test` 78 unit tests pass (incl. WCAG contrast for every token
pair, both themes); `npm run smoke` 46 checks pass — all routes on iPhone + desktop,
axe-core WCAG 2.1 AA scan with zero serious/critical issues in light and dark,
navigation, settings persistence, dialog focus/Escape, toasts, service worker,
app opens and navigates with the network off.

**Known issues / notes**
- Main JS bundle is ~535 kB (173 kB gzipped); charts load separately. Will be
  revisited when real screens are added.
- "Ready to work offline" toast appears once on first visit.
- Lighthouse itself wasn't run; axe-core covers the accessibility checks and the
  smoke test covers installability/offline directly.
- Install on iPhone requires the app to be hosted over HTTPS (Phase 3 sets up hosting).

**Next step:** Phase 3 — Supabase project, sign-in, Home dashboard with real data model.

## Phase 3 — Home dashboard, sign-in & sync (2026-11-27)
**Completed**
- Database (`supabase/migrations/20261127000000_profiles.sql`): `profiles` with
  validated preferences, Row Level Security (owner-only), auto-create on sign-up,
  `updated_at` trigger, `delete_my_account()`.
- Sign-in with an emailed 6-digit code (`src/lib/auth.tsx`), optional Google
  button (off until configured), sign out, friendly error messages.
- Preference sync (`src/lib/prefs.tsx`, `src/lib/sync.ts`): name, theme, phone
  tabs, Home layout and demo mode follow you across devices; saved locally first,
  pushed when signed in, retried when back online; last change wins.
- Account page: status, export my data (JSON), delete account / clear device
  (typed confirmation).
- Home: live greeting + clock; stat cards (animated); Today's schedule with
  current-class indicator, progress, countdown to next class and timeline;
  Important list (overdue, due soon, important email, new grades, developing
  news, today's events); Daily briefing card + full view with suggested
  priorities and an explicit "Unavailable data" list; Customize Home (reorder,
  hide, reset — synced).
- Demo mode: labeled sample data generated around the current time, off by
  default, DEMO badges on every card; live mode never shows invented numbers.
- Setup guides: `docs/SETUP_SUPABASE.md`, `docs/DEPLOY.md`.

**Verified**
- Database: 9 checks on local PostgreSQL 16 (`supabase/tests/run_local.sh`) —
  users see/change only their own profile, invalid values rejected, anonymous
  access denied, account deletion removes only that user. Mutation-tested: a
  deliberately broken policy makes the suite fail.
- Unit: 101 tests (schedule/current-class/next-class incl. weekends, GPA,
  sync merge rules, demo data, Important ordering, briefing content, contrast).
- End-to-end: 81 checks, including Home at a fixed time (Biology "happening now"
  at 50%), customize persists after reload, export/clear data, accessibility
  scans, and sign-in → sync → delete account against a **simulated** Supabase API.

**Waiting for you**
- Create the Supabase project (docs/SETUP_SUPABASE.md). Real sign-in emails and
  cross-device sync have not been tested against a live Supabase project yet.
- Hosting (docs/DEPLOY.md) is needed to install on iPhone.

**Known issues / notes**
- Briefing text is template-based (labeled "Preview"); AI-written briefings are Phase 11.
- GPA here is unweighted on a standard scale; configurable scales and weighted GPA are Phase 4.
- Stat-card numbers count up when scrolled into view.

**Next step:** Phase 4 — Academics (grade entry, GPA calculator, what-if, Classroom/Canvas framework).

## Phase 4 — Academics (2026-11-27)
**Completed**
- Local-first data engine (`src/lib/store/`): collections saved on the device,
  synced per record with Supabase (newest edit wins, soft deletes, offline queue,
  retries, uploads before sign-out, clears an account's data on sign-out).
- Database: `terms`, `grading_scales`, `courses`, `grade_categories`,
  `grade_items`, `past_courses` with RLS and the `sync_row_guard` trigger;
  `integrations`, `integration_tokens` (unreadable through the API), `sync_runs`.
- Grade math (`src/features/academics/grades.ts`): points, weighted categories
  (re-normalized when a category is empty), "Portal %" mode, missing = 0,
  excused ignored, extra credit; three preset scales + custom scales; weighted /
  unweighted GPA with editable honors/AP/IB/dual bonuses; term and cumulative
  GPA (past terms); grade history and 2-week trend; "What do I need?" solver.
- Screens: Academics overview (GPA tiles, class cards with sparkline, trend and
  missing badges, class comparison chart, past terms, terms, GPA settings);
  class page (grade, what-if mode with projected grade and GPA, what-do-I-need,
  categories, history chart, grade list with add/edit/delete); spreadsheet import
  (paste or CSV file; PowerSchool/Infinite Campus copy-paste; preview, duplicate
  skipping, row-level errors).
- Home shows the real GPA, average and new grades; the briefing includes them.
- School connections: Canvas (access token) and Google Classroom (OAuth) — server
  functions `school-connect-canvas`, `google-classroom-auth`, `school-sync`;
  shared mapping/sync code in `supabase/functions/_shared/`; Settings card with
  connect / sync now / disconnect; guide `docs/SETUP_SCHOOL.md`.
- Fixed along the way: bottom sheets only drag from their handle (forms inside
  scroll properly on iPhone); a header button made Academics wider than the phone
  screen; the overflow test now compares with the physical screen width;
  secondary screens load on demand (main bundle 860 → 587 kB).

**Verified**
- Database: 21 checks on PostgreSQL 16 (owner-only access, newest-edit-wins
  trigger, owner can't change, validation, tokens unreadable, connect only via
  server, sync updates keep the user's class settings).
- Unit: 165 tests (sync engine with two simulated devices, grade math with
  hand-worked numbers, CSV parsing/planning, Canvas & Classroom mapping from
  documented response shapes, sync planning, encryption, OAuth state, full sync
  run with fake database/server incl. pagination and revoked access).
- End-to-end: 113 checks incl. a full Academics walkthrough, accessibility scans,
  and cross-device sync / Canvas connect / sync / disconnect against a simulated
  Supabase. Type-checked: app and Edge Functions (Deno type shim).

**Not verified yet (needs your accounts)**
- Edge Functions haven't run on Supabase; Canvas and Google Classroom haven't
  been tried with real accounts. The mapping follows the platforms' documented
  API shapes, so the first real sync may reveal differences to fix.

**Next step:** Phase 5 — Schedule & assignments.
