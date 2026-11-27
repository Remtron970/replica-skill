# Life Tracker — Integrations Plan

Honest status of every data source: how we connect, what works, and what can't
work. Feasibility key: ✅ official API available to you · ⚠️ works with
conditions · ❌ not available to individual students (manual fallback).

---

## School platforms

### Google Classroom ✅ / ⚠️
- **How:** Google OAuth, Classroom API.
- **Scopes (read-only):** `classroom.courses.readonly`,
  `classroom.coursework.me.readonly`, `classroom.announcements.readonly`,
  `classroom.rosters.readonly` (teacher names).
- **Gives us:** courses, teachers, assignments with due dates, your submission
  state (turned in / missing / late), assigned grades, announcements.
- **Condition:** your school's Google Workspace admin may block third-party
  apps for student accounts. If so, the connect screen will say "Blocked by
  your school administrator" and we fall back to manual entry.
- **Note:** Classroom has grades per assignment but no official "class
  percentage"; we compute it from points (or category weights you set).

### Canvas ✅ / ⚠️
- **How (preferred):** Canvas OAuth2 — requires a *developer key* issued by your
  school's Canvas admin. Most schools won't issue one for a personal app.
- **How (practical):** a **personal access token** you generate in Canvas
  (Account → Settings → "+ New Access Token"). This is Canvas's official
  mechanism, not your password; you can revoke it anytime. Stored encrypted
  server-side. Some schools disable token creation.
- **Gives us:** courses, current score/grade per course, assignments, due dates,
  submissions, assignment-group weights, announcements.

### PowerSchool ❌
- PowerSchool's API requires a plugin installed by the **district**; there is
  no student-authorized API. The only way around this is logging in with your
  password and scraping, which you've ruled out and which can break school
  policy. **Fallback:** manual grade entry + CSV import (copy from the portal).
- If your district ever offers a supported export or API, the framework
  (`integrations` table + a `sync-powerschool` function) is ready for it.

### Infinite Campus ❌
- Same situation: its data APIs (OneRoster) are district-level only.
  **Fallback:** manual entry + CSV import.

---

## Email

### Gmail ✅ / ⚠️
- **How:** Google OAuth, Gmail API, scope **`gmail.readonly`** only.
  Life Tracker *cannot* send, delete, archive or label mail.
- **Sync:** incremental via Gmail `history` IDs every 30 minutes.
- **Stored:** sender, subject, date, labels, a short snippet, the AI summary
  and category. **Full bodies are not stored**; they're fetched on demand when
  you open an email, and "Open in Gmail" deep-links to the original.
  Email rows older than 30 days are purged (configurable).
- **AI:** each new email → `claude-haiku-5-5` returns structured JSON:
  `{category, summary, has_deadline, deadline_at, needs_reply, is_school, importance}`.
- **Important condition — Google verification:** `gmail.readonly` is a
  *restricted* scope. A public app needs Google's security review. For **your
  personal use** we don't need that: your Google Cloud project stays private and
  you add yourself as a user.
  - In "Testing" publishing status, Google **expires refresh tokens after 7
    days** → you'd reconnect weekly. To avoid it, switch the app to
    "In production" without verification: you'll see an "unverified app"
    warning once when connecting (expected — it's your own app), and it's
    limited to 100 users.
- **School accounts:** your school may block Gmail API access for student
  accounts. Personal Gmail always works.

### Other providers (later)
Outlook / Microsoft 365 via Microsoft Graph (`Mail.Read`) uses the same pattern;
planned as an optional add-on after Gmail is solid.

---

## Calendar

### Google Calendar ✅
- Google OAuth, `calendar.readonly` (read) — and optionally `calendar.events`
  if you want events created in Life Tracker to appear in Google Calendar
  (we'll ask before enabling).

### Apple Calendar (iCloud) ⚠️
- No web API. Options:
  1. **Native shell (EventKit):** reads the iPhone's calendars with the standard
     iOS permission prompt — best experience.
  2. **Subscribe by ICS link:** if you share a calendar publicly in iCloud, paste
     its link; we read it (read-only).
- We will not ask for your Apple ID password.

---

## Health

### Apple HealthKit — the real constraint
A website (including an installed PWA) **cannot read Apple Health**. Only a
native iOS app with the HealthKit entitlement can. Two routes:

| Route | Cost / requirements | Experience |
|---|---|---|
| **A. iOS Shortcuts bridge** ✅ built (Phase 7, setup: [SETUP_HEALTH.md](SETUP_HEALTH.md)) | Free; iPhone only | A Shortcut we provide reads today's steps, distance, active energy, exercise minutes and (optionally) weight, then POSTs them to `health-ingest` with your personal ingest token. A daily Personal Automation (e.g. 9 PM, "Run Immediately") plus manual runs any time. |
| **B. Native Capacitor app** | Mac with Xcode + **Apple Developer Program ($99/yr)**; free provisioning profiles expire every 7 days | Standard Health permission sheet; syncs whenever you open the app; history backfill |

Health data is shown neutrally (no judgments, no calorie-shaming), stored only
in your rows, excluded from the AI unless you allow it, and deletable in one
tap. **Manual entry** always works.

---

## News

| Source | Use | Key needed |
|---|---|---|
| **The Guardian Open Platform** | World, tech, science, business, politics, sports; good "live"/developing flags | Free developer key |
| **GNews** (or NewsData.io) | Broad headline coverage + local search by city/region | Free tier key (limited daily requests) |
| **National Weather Service API** (US) | Official weather alerts for your area | None |
| **Open-Meteo** | Weather forecast for the Home card | None |
| Curated RSS (AP, BBC, NPR, local outlets you choose) | Extra reputable coverage | None |

- Articles are cached **server-side per region**, refreshed every 30 min, so
  free-tier limits aren't exhausted.
- Every article shows headline, summary, **source**, publish time and a link to
  the original.
- **"Developing" vs "Reported":** we label a story *Developing* when the source
  marks it live/breaking or only one outlet has it. We do **not** claim to
  verify facts; the app says "Reported by 3 sources" rather than "confirmed".
- **Breaking alerts** fire only when a story is flagged breaking by a source
  *and* appears in 2+ reputable outlets within an hour, capped by your
  notification settings.
- **Location:** you type a city or ZIP (or optionally allow one-time GPS). We
  store only the city/region, never a precise location history.

---

## AI

- **Anthropic Claude API**, key stored as an Edge Function secret.
- Models: `claude-opus-5-5` (assistant, briefings), `claude-haiku-5-5`
  (email triage). Swappable via config.
- Data sent to the API is only what the tools return for your question.
  Review Anthropic's current commercial data-use terms when you create the key.

---

## Push notifications

- **PWA:** Web Push with VAPID keys. On iPhone this works only after adding the
  app to the Home Screen (iOS 16.4+), and you must tap "Allow" from inside the app.
- **Native shell:** APNs (needs the Apple Developer Program).
