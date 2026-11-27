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
