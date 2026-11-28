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

## After Phase 4 — StudentVUE support (2026-11-27)
You use **Canvas, Google Classroom and StudentVUE**.
- Import now reads StudentVUE gradebook tables: "18 out of 20" scores, the
  Points column ("18.00 / 20.00", "/ 25.0000"), Not Graded, Missing and Exc.
  (Before this, "18 out of 20" would have been misread as 1820.)
- Fixed: missing/excused rows now keep their point value, so missing work counts as 0.
- Wording in Import, Settings and Academics mentions StudentVUE; class form explains
  credits 0 for duplicate copies of a class; guide Part D (StudentVUE) and
  "Using Canvas, Classroom and StudentVUE together" in docs/SETUP_SCHOOL.md.
- Verified: 167 unit tests, 113 end-to-end checks.
- Idea for later: link the same class across platforms automatically instead of using credits 0.

## Phase 5 — Schedule & assignments (2026-11-27)
Your school: **modified block** schedule; Canvas, Google Classroom, StudentVUE.

**Completed**
- Block-schedule engine (`src/features/schedule/blockSchedule.ts`): day types
  (e.g. All classes / A day / B day), fixed weekdays (Monday = all classes),
  continuous A/B rotation lined up to a real date, days off that don't use up a
  rotation day, per-date "runs as" swaps, optional term dates.
- Schedule screens: one-tap setup (Modified block / A/B / same every day), class
  times per day type with overlap warnings, "Which day is which" with a live
  "today is an A day" check; Today (current class, progress, countdown, next
  class incl. across holidays), Week, Month (tap a date: no school / runs as…).
- Assignments: Overdue / Due today / Due tomorrow / This week / Later / No due
  date / Done, filter by class, check off with undo, priority, reminders (shown
  while the app is open; phone notifications come in Phase 11), notes.
- Canvas and Google Classroom now also sync assignments (due dates incl.
  Classroom's UTC times, links, descriptions as plain text, turned-in status);
  your priority, progress and reminders are kept across syncs.
- Home: today's schedule with the day type ("A day · 4 classes"), countdown,
  assignments in stats/Important/briefing ("It's an A day: …").
- Database: `day_types`, `schedule_blocks`, `schedule_exceptions`, `assignments`,
  `profiles.schedule_settings` with RLS and validation (times, https links).

**Verified**
- Unit: 196 tests (rotation incl. holidays, weekends, backwards dates, swapped
  days, anchors on non-rotating days; buckets/due text/reminders; assignment
  mapping and sync planning).
- Database: 24 checks. End-to-end: 136 checks incl. a full modified-block setup,
  Thanksgiving off, current/next class, assignments, Home, and a reminder firing
  when the clock reaches it.

**Notes**
- Fixed: an anchor date on a Monday/weekend would have shifted the rotation by a day.
- Reminders only appear while Life Tracker is open until Phase 11 (push).

**Next step:** Phase 6 — Email (Gmail).

## Phase 6 — Email recap (2026-11-27)
You chose: **school email**, plus a **paste** fallback in case the school blocks apps.

**Completed**
- Gmail (read-only, `gmail.readonly`) through one Google sign-in function for
  Classroom and Gmail (`google-auth`); clear "Blocked by school" handling.
- `email-sync`: first 3 days, then new mail since the last check; analyzes new
  messages (max 40 per run), refreshes read status, expires summaries after the
  retention period (30 days default). Full email bodies are never stored.
- Analysis: Claude via the Anthropic SDK with structured (schema-checked) output;
  email text is passed as untrusted data; refusals/errors/bad output fall back to
  the built-in rules. Model: `claude-opus-5-5` (low effort), switch with
  `EMAIL_MODEL=claude-haiku-5-5`.
- Built-in quick summaries (same code on server and device): category, first real
  sentence, deadlines ("by Friday", "12/4", "Dec 4", "tomorrow", "next Monday"),
  reply needed, school mail (school domain or keywords), importance.
- Email screen: daily recap (yesterday), category filters, detail with AI/built-in
  label, Open in Gmail, Add to Assignments from an email's deadline, Hide;
  Paste an email (AI via server when signed in, else built-in on the device);
  settings (AI on/off, keep for 7/14/30/60 days, disconnect).
- Home: unread count, important emails in Important, email lines in the briefing.

**Verified**
- Unit: 223 tests (Gmail parsing incl. MIME/HTML/quoted replies; deadline phrases;
  rules; Claude request/validation/fallbacks with a fake client; email sync end
  to end with fake Gmail + database incl. retention and keeping a newer dismiss).
- Database: 27 checks. End-to-end: 151 checks incl. paste → summary → assignment,
  and recap / AI label / Check now / AI paste against a simulated Supabase.

**Fixed along the way**
- Server refreshes could have overwritten a not-yet-uploaded "done"/"dismiss"
  from a device (school sync too) — now stamped just after the row's own time.
- `school-sync` would have tried to run Gmail as a school platform.
- "by Friday" received on a Friday meant next week; now means today.
- After closing a sheet, focus could land on the "Skip to content" link.

**Not verified yet (needs your setup)**
- Real Gmail (and whether your school allows it) and real Claude calls — no API
  key or Google project exists yet. See docs/SETUP_EMAIL.md.

**Next step:** Phase 7 — Health.

## Phase 7 — Health (2026-11-27)
You chose the **iPhone Shortcut** route (no Mac, so no native HealthKit app).

**Completed**
- Database: `health_daily`, `weight_entries` (synced, private, range-checked),
  `health_ingest_tokens` (only a SHA-256 of the Shortcut key), `profiles.health_settings`.
- `health-token`: makes a personal key (`lth_…`, shown once; a new one turns the
  old off) or turns it off. `health-ingest`: the Shortcut's endpoint; checks the
  key, reads numbers sent as text, miles/km, pounds/kg, today or a list of days
  (≤ 60 days back), ignores impossible values and says why, keeps one row per
  day (re-sends update it), uses your time zone for "today".
- Health screen: today's steps ring vs. goal, distance / active energy /
  exercise / goal streak, source label (Apple Health vs. typed), week and month
  charts per metric with totals and daily averages (empty days stay empty),
  recent days with edit, manual entry with checks, weight history (off by
  default, neutral, no goals), connect guide with copyable address + key and the
  exact Shortcut and automation steps, settings (units, step goal, weight,
  turn off key, delete all health data).
- Home: steps today / this week in At a glance and the briefing.

**Verified**
- Unit: 238 tests (Shortcut payload parsing; merging Health + typed data;
  totals/averages/streaks; ingest end to end with a fake database incl. wrong
  keys, time zones, re-sends, clock skew, weight).
- Database: health privacy (nobody else can read your data or your key's hash;
  impossible values rejected). End-to-end: 172 checks incl. manual entry,
  charts, opt-in weight, making a key and Shortcut rows appearing on Health and
  Home against a simulated Supabase, with accessibility scans.

**Not verified yet (needs your setup)**
- A real Shortcut on your iPhone posting to a real deployed function. See
  docs/SETUP_HEALTH.md. Shortcuts' exact action names can differ slightly by iOS
  version.

**Next step:** Phase 8 — News.

## Phase 8 — News & weather (2026-11-28)
Your city: Grand Junction, Colorado (you pick it once in the app; it isn't hard-coded).

**Completed**
- Weather (Open-Meteo) and official alerts (National Weather Service), fetched
  straight from the app, no key needed: current conditions, 5-day forecast,
  °F/°C, warnings first with details and instructions. Cached 20 minutes.
- City search (Open-Meteo); only the city is saved, synced in your profile.
- `news-refresh` function and a shared, read-only news cache: world news from
  BBC News and NPR feeds (no key) plus The Guardian (optional key, with live-blog
  flags); local news from a Google News search for your city (no key) plus GNews
  (optional key). Each place refreshes at most every 30 minutes for everyone;
  articles kept 3 days; only https links stored.
- News screen: Top stories, Local and 9 sections; the same story from several
  outlets grouped ("Reported by N outlets", never "confirmed"); Developing (the
  outlet marks it live) and Breaking (live + 2 outlets within the hour); source,
  time and a link to the original on every story; hide an outlet; hide
  sections; says when a source didn't answer; works offline from the last copy.
- Home: weather leads the briefing, weather warnings first in Important,
  top headlines in the briefing, Breaking stories in Important.

**Verified**
- Unit: 256 tests (Guardian/GNews/RSS reading incl. Google News outlet names,
  refresh with a fake database and fake servers — partial outages, no keys,
  30-minute limit, cleanup; city search, forecast, alerts, caching; grouping,
  labels, filters).
- Database: news is readable by signed-in users only and can't be written or
  reset through the app; unsafe links and unknown sections are rejected.
- End-to-end: 190 checks incl. choosing Grand Junction, weather, a Winter Storm
  Warning on News and Home, °C switch, and headlines/labels/links/hiding against
  a simulated Supabase. Accessibility scans pass.

**Not verified yet**
- Real responses from the news and weather services: this build environment
  can't reach them, so tests use responses shaped like each service's
  documentation. Real headlines also need the function deployed (docs/SETUP_NEWS.md).

**Next step:** Phase 9 — Calendar & productivity.
