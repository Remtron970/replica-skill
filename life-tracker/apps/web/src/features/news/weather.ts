/**
 * Weather and official alerts, fetched straight from the app (both services are
 * free, need no key and allow browser requests): Open-Meteo for the forecast and
 * city search, the US National Weather Service for alerts.
 */
import { regionKeyFor } from "../../../../../supabase/functions/_shared/news/model.ts";

export interface Place {
  label: string; // "Grand Junction, Colorado"
  lat: number;
  lon: number;
  country: string; // "US"
  regionKey: string;
  /** Search words for local news. */
  query: string;
  timezone: string | null;
}

export type TempUnit = "f" | "c";

export interface Weather {
  current: { temp: number; feelsLike: number; code: number; wind: number; isDay: boolean };
  days: { date: string; code: number; hi: number; lo: number; precipChance: number | null }[];
  unit: TempUnit;
  fetchedAt: number;
}

export interface Alert {
  id: string;
  event: string;
  headline: string;
  severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown";
  /** Warnings are the most urgent kind of NWS alert. */
  isWarning: boolean;
  starts: string | null;
  ends: string | null;
  area: string;
  description: string;
  instruction: string | null;
}

const round = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.round(n) : NaN);

export function geocodeUrl(name: string) {
  return `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name: name.trim(), count: "6", language: "en", format: "json" })}`;
}

interface GeoResult {
  name?: string;
  latitude?: number;
  longitude?: number;
  country_code?: string;
  admin1?: string;
  timezone?: string;
  feature_code?: string;
}

export function parseGeocode(json: unknown): Place[] {
  const list = ((json as { results?: GeoResult[] })?.results ?? []) as GeoResult[];
  const out: Place[] = [];
  for (const r of list) {
    if (!r.name || typeof r.latitude !== "number" || typeof r.longitude !== "number") continue;
    const country = (r.country_code ?? "").toUpperCase();
    const admin = r.admin1 ?? "";
    const key = regionKeyFor(country || "xx", admin, r.name);
    if (out.some((p) => p.regionKey === key)) continue;
    out.push({
      label: [r.name, admin || country].filter(Boolean).join(", "),
      lat: Math.round(r.latitude * 10000) / 10000,
      lon: Math.round(r.longitude * 10000) / 10000,
      country,
      regionKey: key,
      query: admin ? `"${r.name}" ${admin}` : `"${r.name}"`,
      timezone: r.timezone ?? null,
    });
  }
  return out;
}

export function forecastUrl(p: Pick<Place, "lat" | "lon">, unit: TempUnit) {
  return `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
    latitude: String(p.lat),
    longitude: String(p.lon),
    current: "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    temperature_unit: unit === "f" ? "fahrenheit" : "celsius",
    wind_speed_unit: unit === "f" ? "mph" : "kmh",
    timezone: "auto",
    forecast_days: "5",
  })}`;
}

export function parseForecast(json: unknown, unit: TempUnit, now = Date.now()): Weather | null {
  const j = json as { current?: Record<string, number>; daily?: Record<string, (number | string | null)[]> };
  const c = j?.current;
  if (!c || !Number.isFinite(round(c.temperature_2m))) return null;
  const d = j.daily ?? {};
  const dates = (d.time ?? []) as string[];
  return {
    current: { temp: round(c.temperature_2m), feelsLike: round(c.apparent_temperature ?? c.temperature_2m), code: round(c.weather_code), wind: round(c.wind_speed_10m), isDay: c.is_day !== 0 },
    days: dates.map((date, i) => ({
      date,
      code: round(d.weather_code?.[i]),
      hi: round(d.temperature_2m_max?.[i]),
      lo: round(d.temperature_2m_min?.[i]),
      precipChance: typeof d.precipitation_probability_max?.[i] === "number" ? (d.precipitation_probability_max[i] as number) : null,
    })).filter((x) => Number.isFinite(x.hi) && Number.isFinite(x.lo)),
    unit,
    fetchedAt: now,
  };
}

export function alertsUrl(p: Pick<Place, "lat" | "lon">) {
  return `https://api.weather.gov/alerts/active?point=${p.lat},${p.lon}`;
}

interface NwsFeature {
  id?: string;
  properties?: { id?: string; event?: string; headline?: string; severity?: string; onset?: string; effective?: string; ends?: string; expires?: string; areaDesc?: string; description?: string; instruction?: string | null; status?: string; messageType?: string };
}

const SEVERITY_RANK = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 } as const;

export function parseAlerts(json: unknown): Alert[] {
  const feats = ((json as { features?: NwsFeature[] })?.features ?? []) as NwsFeature[];
  return feats
    .map((f) => f.properties ?? {})
    .filter((p) => p.event && p.status !== "Test" && p.messageType !== "Cancel")
    .map((p) => {
      const sev = (["Extreme", "Severe", "Moderate", "Minor"].includes(p.severity ?? "") ? p.severity : "Unknown") as Alert["severity"];
      return {
        id: String(p.id ?? p.event),
        event: String(p.event),
        headline: String(p.headline ?? p.event),
        severity: sev,
        isWarning: / warning$/i.test(String(p.event)),
        starts: p.onset ?? p.effective ?? null,
        ends: p.ends ?? p.expires ?? null,
        area: String(p.areaDesc ?? ""),
        description: String(p.description ?? "").trim(),
        instruction: p.instruction ? String(p.instruction).trim() : null,
      };
    })
    .sort((a, b) => Number(b.isWarning) - Number(a.isWarning) || SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** WMO weather codes (used by Open-Meteo) in plain words. */
export function describeCode(code: number): { label: string; kind: "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm" } {
  if (code === 0) return { label: "Clear", kind: "clear" };
  if (code === 1) return { label: "Mostly clear", kind: "clear" };
  if (code === 2) return { label: "Partly cloudy", kind: "partly" };
  if (code === 3) return { label: "Cloudy", kind: "cloudy" };
  if (code === 45 || code === 48) return { label: "Fog", kind: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", kind: "drizzle" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: code === 66 || code === 67 ? "Freezing rain" : code >= 80 ? "Showers" : "Rain", kind: "rain" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: code >= 85 ? "Snow showers" : "Snow", kind: "snow" };
  if (code >= 95) return { label: "Thunderstorms", kind: "storm" };
  return { label: "—", kind: "cloudy" };
}

type Fetcher = (url: string) => Promise<Response>;

/** Weather (and US alerts), cached on this device for 20 minutes. */
export async function loadWeather(place: Place, unit: TempUnit, opts: { fetch?: Fetcher; force?: boolean; now?: number } = {}): Promise<{ weather: Weather | null; alerts: Alert[] | null; error: string | null; cached: boolean }> {
  const f = opts.fetch ?? ((u: string) => fetch(u));
  const now = opts.now ?? Date.now();
  const cacheKey = `lt.weather.${place.regionKey}.${unit}`;
  if (!opts.force) {
    try {
      const c = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (c && now - c.weather.fetchedAt < 20 * 60_000) return { ...c, error: null, cached: true };
    } catch {
      /* no cache */
    }
  }
  const [w, a] = await Promise.allSettled([
    f(forecastUrl(place, unit)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    place.country === "US" ? f(alertsUrl(place)).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))) : Promise.resolve({ features: [] }),
  ]);
  const weather = w.status === "fulfilled" ? parseForecast(w.value, unit, now) : null;
  const alerts = a.status === "fulfilled" ? parseAlerts(a.value) : null;
  if (weather) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ weather, alerts: alerts ?? [] }));
    } catch {
      /* storage full or blocked */
    }
  }
  return { weather, alerts, error: weather ? (alerts ? null : "Weather alerts couldn't be checked.") : "Couldn't load the weather.", cached: false };
}
