
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
- Unit: 265 tests (Guardian/GNews/RSS reading incl. Google News outlet names,
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
