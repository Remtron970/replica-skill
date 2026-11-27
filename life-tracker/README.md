# LIFE TRACKER

One app. Everything happening in my life.

A personal command center for grades, schedule, assignments, email, health,
news, calendar, productivity and an AI assistant — for iPhone (installable)
and desktop browsers.

## Status

| Phase | State |
|---|---|
| 1. Planning & architecture | ✅ Complete |
| 2. Design system & main interface | ✅ Complete |
| 3. Home dashboard, sign-in, sync | ✅ Complete — cloud sync waiting for your Supabase project |
| 4. Academics | ✅ Complete — Canvas/Classroom connections waiting for setup |
| 5. Schedule & assignments | ✅ Complete |
| 6. Email recap | ✅ Complete — Gmail and AI waiting for setup; Paste works now |
| 7–12 | Not started |

## Documentation
- [Architecture](docs/ARCHITECTURE.md) — stack, system design, security, offline, AI
- [Integrations](docs/INTEGRATIONS.md) — every data source, what works and what can't
- [Database](docs/DATABASE.md) — tables and data lifecycle
- [Design system](docs/DESIGN_SYSTEM.md) — brand, colors, type, motion, components
- [Roadmap](docs/ROADMAP.md) — the 12 phases and their acceptance criteria
- [Setup checklist](docs/SETUP_CHECKLIST.md) — accounts and keys, by phase
- [Set up cloud sync (Supabase)](docs/SETUP_SUPABASE.md) · [Connect your school](docs/SETUP_SCHOOL.md) · [Email recap](docs/SETUP_EMAIL.md) · [Deploy & install on iPhone](docs/DEPLOY.md)
- [Progress log](PROGRESS.md)

## Run the preview app

```bash
cd apps/web
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run icons      # re-render PNG icons from public/icon.svg
npm test           # unit tests (incl. color-contrast guard)
npm run smoke      # end-to-end + accessibility + simulated cloud-sync checks
../../supabase/tests/run_local.sh   # database privacy-rule tests (needs PostgreSQL)
npx tsc -p ../../supabase/functions # type-check the server functions
```
