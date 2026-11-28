import { describe, expect, it } from "vitest";
import { feed, groupStories, relTime, type Article } from "./newsLogic";
import { alertsUrl, describeCode, forecastUrl, loadWeather, parseAlerts, parseForecast, parseGeocode } from "./weather";

const geo = { results: [
  { id: 5423573, name: "Grand Junction", latitude: 39.06387, longitude: -108.55065, country_code: "US", admin1: "Colorado", timezone: "America/Denver" },
  { id: 1, name: "Grand Junction", latitude: 35.04, longitude: -89.19, country_code: "US", admin1: "Tennessee", timezone: "America/Chicago" },
  { id: 2, name: "Grand Junction", latitude: 39.06, longitude: -108.55, country_code: "US", admin1: "Colorado" },
] };
const forecast = {
  current: { time: "2026-11-28T08:00", temperature_2m: 38.6, apparent_temperature: 33.2, weather_code: 2, wind_speed_10m: 6.1, is_day: 1 },
  daily: { time: ["2026-11-28", "2026-11-29"], weather_code: [2, 71], temperature_2m_max: [47.8, 40.1], temperature_2m_min: [24.3, 22], precipitation_probability_max: [5, 60] },
};
const nws = { type: "FeatureCollection", features: [
  { properties: { id: "urn:a", event: "Winter Weather Advisory", headline: "Winter Weather Advisory until Sun 5 AM", severity: "Moderate", onset: "2026-11-28T17:00:00-07:00", ends: "2026-11-29T05:00:00-07:00", areaDesc: "Grand Valley", description: "Snow 2 to 4 inches.", instruction: "Slow down.", status: "Actual", messageType: "Alert" } },
  { properties: { id: "urn:b", event: "Winter Storm Warning", headline: "Winter Storm Warning", severity: "Severe", areaDesc: "Grand Mesa", description: "Heavy snow.", status: "Actual", messageType: "Update" } },
  { properties: { id: "urn:c", event: "Test Message", status: "Test", messageType: "Alert" } },
] };

describe("weather", () => {
  it("city search: readable label, news search words, de-duplicated", () => {
    const p = parseGeocode(geo);
    expect(p).toHaveLength(2);
    expect(p[0]).toEqual({ label: "Grand Junction, Colorado", lat: 39.0639, lon: -108.5506, country: "US", regionKey: "us-colorado-grand-junction", query: '"Grand Junction" Colorado', timezone: "America/Denver" });
    expect(parseGeocode({})).toEqual([]);
  });

  it("forecast in °F with daily highs, lows and chance of rain/snow", () => {
    expect(forecastUrl({ lat: 39.0639, lon: -108.5507 }, "f")).toContain("temperature_unit=fahrenheit");
    const w = parseForecast(forecast, "f", 1)!;
    expect(w.current).toEqual({ temp: 39, feelsLike: 33, code: 2, wind: 6, isDay: true });
    expect(w.days[1]).toEqual({ date: "2026-11-29", code: 71, hi: 40, lo: 22, precipChance: 60 });
    expect(describeCode(71).label).toBe("Snow");
    expect(parseForecast({ error: true }, "f")).toBeNull();
  });

  it("NWS alerts: warnings first, test messages ignored", () => {
    expect(alertsUrl({ lat: 39.0639, lon: -108.5507 })).toBe("https://api.weather.gov/alerts/active?point=39.0639,-108.5507");
    const a = parseAlerts(nws);
    expect(a.map((x) => x.event)).toEqual(["Winter Storm Warning", "Winter Weather Advisory"]);
    expect(a[0].isWarning).toBe(true);
    expect(a[1]).toMatchObject({ area: "Grand Valley", instruction: "Slow down." });
  });

  it("loads, caches for 20 minutes, and reports failures honestly", async () => {
    localStorage.clear();
    const place = parseGeocode(geo)[0];
    let calls = 0;
    const ok = async (u: string) => (calls++, new Response(JSON.stringify(u.includes("weather.gov") ? nws : forecast)));
    const first = await loadWeather(place, "f", { fetch: ok, now: 1000 });
    expect(first).toMatchObject({ error: null, cached: false });
    expect(first.alerts).toHaveLength(2);
    expect(calls).toBe(2);
    expect((await loadWeather(place, "f", { fetch: ok, now: 5 * 60_000 })).cached).toBe(true);
    expect(calls).toBe(2);
    const down = async () => new Response("x", { status: 500 });
    expect(await loadWeather(place, "f", { fetch: down, force: true })).toMatchObject({ weather: null, error: "Couldn't load the weather." });
    const noAlerts = async (u: string) => (u.includes("weather.gov") ? new Response("x", { status: 503 }) : new Response(JSON.stringify(forecast)));
    expect(await loadWeather(place, "c", { fetch: noAlerts })).toMatchObject({ alerts: null, error: "Weather alerts couldn't be checked." });
  });
});

describe("news grouping and labels", () => {
  const now = new Date("2026-11-28T15:00:00Z");
  let n = 0;
  const art = (o: Partial<Article>): Article => ({ id: `a${++n}`, regionKey: "world", provider: "rss", category: "world", title: "", summary: null, sourceName: "X", url: `https://x/${n}`, imageUrl: null, publishedAt: "2026-11-28T14:30:00Z", isLive: false, ...o });
  const list = [
    art({ title: "Leaders meet for second day of trade summit in Geneva", sourceName: "BBC News", summary: "Talks continue." }),
    art({ title: "Trade summit: leaders meet in Geneva – live updates", sourceName: "The Guardian", isLive: true, publishedAt: "2026-11-28T14:50:00Z" }),
    art({ title: "Geneva trade summit leaders meet again", sourceName: "NPR", publishedAt: "2026-11-28T10:00:00Z", category: "us" }),
    art({ title: "Leaders meet for second day of trade summit in Geneva", sourceName: "BBC News", publishedAt: "2026-11-27T10:00:00Z" }),
    art({ title: "New chip announced by chipmaker", sourceName: "The Guardian", category: "technology" }),
  ];
  const stories = groupStories(list, now);

  it("groups the same story from different outlets and counts them", () => {
    const summit = stories.find((s) => s.sources.length === 3)!;
    expect(summit.sources.sort()).toEqual(["BBC News", "NPR", "The Guardian"]);
    expect(summit.lead.summary).toBe("Talks continue.");
    expect(stories).toHaveLength(3); // same outlet's older copy stays separate
  });

  it("developing = the source marks it live; breaking also needs 2+ outlets within the hour", () => {
    const summit = stories.find((s) => s.sources.length === 3)!;
    expect(summit).toMatchObject({ developing: true, breaking: true });
    const later = groupStories(list, new Date("2026-11-28T17:00:00Z")).find((s) => s.sources.length === 3)!;
    expect(later).toMatchObject({ developing: true, breaking: false });
    expect(stories.find((s) => s.lead.title.startsWith("New chip"))).toMatchObject({ developing: false, breaking: false });
  });

  it("feeds: top orders by breaking and coverage; categories, hidden categories and muted outlets apply", () => {
    expect(feed(stories, { category: "top", hidden: [], muted: [] })[0].sources).toHaveLength(3);
    expect(feed(stories, { category: "technology", hidden: [], muted: [] })).toHaveLength(1);
    expect(feed(stories, { category: "us", hidden: [], muted: [] })).toHaveLength(1); // the summit has a U.S. outlet's story
    expect(feed(stories, { category: "top", hidden: ["technology"], muted: [] })).toHaveLength(2);
    const muted = feed(stories, { category: "top", hidden: [], muted: ["bbc news"] });
    expect(muted.flatMap((s) => s.sources)).not.toContain("BBC News");
    expect(muted).toHaveLength(2);
    const noGuardian = feed(stories, { category: "top", hidden: [], muted: ["The Guardian"] });
    expect(noGuardian.find((s) => s.lead.sourceName === "BBC News" && s.lead.publishedAt.startsWith("2026-11-28"))).toMatchObject({ developing: false, breaking: false, sources: ["BBC News", "NPR"] });
  });

  it("relative times", () => {
    expect(relTime("2026-11-28T14:30:00Z", now)).toBe("30 min ago");
    expect(relTime("2026-11-28T10:00:00Z", now)).toBe("5 hr ago");
  });
});
