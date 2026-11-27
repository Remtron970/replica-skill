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
