# Set up News and weather

**Works with no setup:** pick your city in **News**. The weather (Open-Meteo)
and official alerts (U.S. National Weather Service) load straight from the
services, which are free and need no key. Only the city (name and its map
point) is saved, never your own location.

**Headlines** come through Life Tracker's server so API keys stay private and
the free limits are shared, not used up per device. That needs cloud sync
(`SETUP_SUPABASE.md`, including migration `20261128000000_news.sql`).

## Part A — Deploy the function (needed for headlines)
From the `life-tracker` folder:
```bash
supabase functions deploy news-refresh
```
With nothing else set, headlines come from free feeds: **BBC News** (world),
**NPR** (U.S.) and a **Google News** search for your city (local). That's enough
to try it.

## Part B — Optional keys for more coverage
Add these as Edge Function secrets (Supabase → Edge Functions → Secrets). Never
paste them into the app or into chat.

| Secret | Get it at | Adds | Free plan |
|---|---|---|---|
| `GUARDIAN_API_KEY` | open-platform.theguardian.com → "Register developer key" | World, U.S., politics, business, technology, science, health, sports and culture from The Guardian, with **live blog** flags | 500 requests a day |
| `GNEWS_API_KEY` | gnews.io → sign up | More local stories for your city, from local outlets | 100 requests a day |

Life Tracker refreshes each place at most every 30 minutes, when the app is
opened: at most 48 requests a day per key. GNews is used only for your city, to
stay under its limit.

## How stories are labeled
- **Reported by N outlets** — the same story (similar headline within 24 hours)
  from N different outlets. It counts outlets; it does **not** mean a story is
  confirmed.
- **Developing** — the outlet itself marks it live (e.g. a Guardian live blog
  still being updated, or a headline starting "LIVE:"/"BREAKING:").
- **Breaking** — developing *and* reported by 2+ outlets within the last hour.
- Every story links to the original article. Google News links open through
  news.google.com, which forwards to the outlet.
- Hide an outlet with **Hide** on a story; bring it back in News → Settings.

## What's stored
Shared, public news only: headline, short summary, outlet, link, picture link
and time, for 3 days. Signed-in users can read it; nobody can change it through
the app. Your settings (city, °F/°C, sections, hidden outlets) are in your
profile.

## Troubleshooting
| Problem | Fix |
|---|---|
| "Headlines need cloud sync" | Sign in (Settings → Account). |
| Empty after Refresh | Deploy `news-refresh` (Part A). |
| "Some sources didn't answer: …" | That outlet was down or rejected the key; the others still show. Check the key's spelling in Secrets. |
| Weather won't load | Check your connection; the weather services are called directly from your device. |
| No weather alerts outside the U.S. | Alerts come from the U.S. National Weather Service only. |
