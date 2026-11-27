# Life Tracker — Development Roadmap

Each phase ends with: summary, files changed, what works, what needs
configuration, known issues, and the exact next step. Next phase starts only
after your approval.

| # | Phase | Main deliverables | Done when… | Needs from you |
|---|---|---|---|---|
| 1 | **Planning & architecture** ✅ | Stack, architecture, database, integrations, design spec, roadmap, setup checklist | You approve the plan | Answers to the open questions |
| 2 | **Design system & main interface** ✅ | Vite + React + TS + Tailwind project; tokens; light/dark; lightbulb app icon (PNG set); AppShell (sidebar/rail/bottom bar + More); component library; motion system; PWA manifest + service worker; a component gallery page | App installs to iPhone Home Screen, all 11 routes open (placeholder content clearly marked), Lighthouse PWA + accessibility checks pass | Nothing (runs locally / on a free preview deploy) |
| 3 | **Home dashboard & navigation** ✅ | Supabase project + auth + profiles; Home: greeting, live clock, stat cards, today's schedule with current-class indicator and countdown, important items, briefing card layout; dashboard reordering; demo mode with DEMO badges | You can sign in, see Home with demo data, reorder sections, data persists across devices | Create a Supabase project (free) |
| 4 | **Academics** ✅ | Courses, categories, grade entry, CSV import, grade calculations, GPA (weighted/unweighted, semester, cumulative), grading scales, grade history charts, what-if calculator, integration framework + Google Classroom and Canvas sync | GPA math covered by unit tests; manual + synced classes show correctly | Google Cloud project (Classroom API); Canvas token if your school uses Canvas |
| 5 | Schedule & assignments | Weekly/rotating schedule editor, daily timeline, week view, next-class countdown; assignments with buckets (today/tomorrow/week/upcoming/overdue/completed), create/edit, deadline reminders; imported assignments | Countdown & current class correct across time zones and A/B days (tested) | — |
| 6 | Email | Gmail OAuth, incremental sync, AI categorization + summaries, daily recap, important-email detection, "open in Gmail" | New mail appears summarized within 30 min; no write scopes requested | Gmail API enabled + OAuth consent screen; Anthropic API key |
| 7 | Health | Health dashboard, steps/distance/energy/exercise/weight charts, manual entry, Shortcuts bridge + ingest token; optional Capacitor iOS shell with HealthKit | Shortcut posts today's data and the charts update | Run the provided Shortcut; optional: Mac + Xcode + Apple Developer Program |
| 8 | News | Guardian/GNews/NWS/Open-Meteo ingestion, world & local feeds, categories, breaking/developing labels, article links | Feeds refresh every 30 min; every card links to source | Free Guardian + GNews keys; your city/ZIP |
| 9 | Calendar & productivity | Day/week/month calendar merging classes + assignments + events + reminders; Google Calendar sync; ICS import; tasks, habits, goals, streaks, milestones, progress charts | Events from all sources render in one calendar; streak math tested | (Google Calendar uses the same Google project) |
| 10 | AI assistant | Chat UI with streaming; tool-based access to authorized sections; cross-section answers; "what should I prioritize"; per-section AI permissions | Assistant answers the 10 example questions from real data and says when a source isn't connected | Anthropic API key (if not already) |
| 11 | Smart automation | Morning briefing + full view, weekly recap, notification center, Web Push, deadline/class/email/news alerts, quiet hours, frequency caps | Briefing arrives at your chosen time with an "unavailable data" section | Allow notifications on iPhone |
| 12 | Final testing & deployment | Full Playwright suite (mobile + desktop), performance pass, error-handling audit, security review (RLS tests), production deploy, install guide | Every button/form/chart/integration verified; deployment guide written | Hosting account (Vercel/Cloudflare, free) |

## Scope guard rails
- No feature ships as a "fake": anything waiting on configuration shows a
  clear **Not connected — set up** state instead of pretend data.
- Demo data is opt-in, labeled, and removable in one tap.

## Ideas for later (not committed)
- Link the same class across Canvas, Classroom and StudentVUE (one class, several sources) instead of setting duplicates to 0 credits.
- Outlook / Microsoft 365 mail & calendar.
- Home Screen widgets (needs the native shell).
- Study-time tracking with a focus timer linked to assignments.
- Shared calendars with family.
