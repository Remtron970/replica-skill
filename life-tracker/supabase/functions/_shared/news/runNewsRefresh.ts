/**
 * Refreshes the shared news cache for the world and the user's city. Each region
 * refreshes at most every 30 minutes, whoever asks, which keeps free API limits
 * safe. Free of Deno globals so the tests can run it with fakes.
 */
import { gnewsSearchUrl, mapGnews } from "./gnews.ts";
import { guardianUrl, mapGuardian } from "./guardian.ts";
import { keepValid, REGION_KEY_RE, type RawArticle } from "./model.ts";
import { localFeedUrl, parseRss, WORLD_FEEDS } from "./rss.ts";

// deno-lint-ignore no-explicit-any
type Db = { from: (t: string) => any };
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface Region {
  key: string;
  label: string;
  /** Search words for local news, e.g. "Grand Junction" Colorado. Null for the world region. */
  query: string | null;
}
export const WORLD: Region = { key: "world", label: "World", query: null };

export const REFRESH_EVERY_MS = 30 * 60_000;
const BUSY_MS = 2 * 60_000;
const KEEP_DAYS = 3;

export interface RegionResult {
  region: string;
  status: "refreshed" | "fresh" | "busy" | "failed";
  saved: number;
  problems: string[];
}

export function regionFromSettings(raw: unknown): Region | null {
  const loc = (raw as { location?: { regionKey?: unknown; label?: unknown; query?: unknown } } | null)?.location;
  if (!loc || typeof loc.regionKey !== "string" || !REGION_KEY_RE.test(loc.regionKey) || loc.regionKey === "world") return null;
  const label = typeof loc.label === "string" ? loc.label.slice(0, 120) : loc.regionKey;
  const query = typeof loc.query === "string" && loc.query.trim() ? loc.query.trim().slice(0, 120) : null;
  return query ? { key: loc.regionKey, label, query } : null;
}

export async function articleId(url: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function get(fetcher: Fetch, url: string, kind: "json" | "text"): Promise<unknown> {
  const res = await fetcher(url, { headers: { "User-Agent": "LifeTracker/1.0 (personal news reader)", Accept: kind === "json" ? "application/json" : "application/rss+xml, application/xml, text/xml" }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return kind === "json" ? res.json() : res.text();
}

/** Which sources to read for a region; keys are optional (free RSS always works). */
export function plan(region: Region, keys: { guardian?: string; gnews?: string }) {
  const jobs: { name: string; run: (f: Fetch) => Promise<RawArticle[]> }[] = [];
  if (region.query === null) {
    if (keys.guardian) jobs.push({ name: "The Guardian", run: async (f) => mapGuardian(await get(f, guardianUrl(keys.guardian!), "json")) });
    for (const feed of WORLD_FEEDS) jobs.push({ name: feed.source, run: async (f) => parseRss(String(await get(f, feed.url, "text")), { source: feed.source, category: feed.category }) });
  } else {
    if (keys.gnews) jobs.push({ name: "GNews", run: async (f) => mapGnews(await get(f, gnewsSearchUrl(keys.gnews!, region.query!), "json")) });
    jobs.push({ name: "Google News (local)", run: async (f) => parseRss(String(await get(f, localFeedUrl(region.query!), "text")), { source: "Google News", category: "local" }) });
  }
  return jobs;
}

export async function refreshRegion(region: Region, deps: { db: Db; fetch: Fetch; now: Date; keys: { guardian?: string; gnews?: string } }): Promise<RegionResult> {
  const { db, now } = deps;
  const nowIso = now.toISOString();
  await db.from("news_regions").upsert({ region_key: region.key, label: region.label, query: region.query }, { onConflict: "region_key" });
  const { data: row } = await db.from("news_regions").select("last_refreshed_at, refreshing_since").eq("region_key", region.key).single();
  if (row?.last_refreshed_at && now.getTime() - Date.parse(row.last_refreshed_at) < REFRESH_EVERY_MS) return { region: region.key, status: "fresh", saved: 0, problems: [] };
  if (row?.refreshing_since && now.getTime() - Date.parse(row.refreshing_since) < BUSY_MS) return { region: region.key, status: "busy", saved: 0, problems: [] };
  await db.from("news_regions").update({ refreshing_since: nowIso }).eq("region_key", region.key);

  const jobs = plan(region, deps.keys);
  const results = await Promise.allSettled(jobs.map((j) => j.run(deps.fetch)));
  const problems: string[] = [];
  const found: RawArticle[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") found.push(...r.value);
    else problems.push(`${jobs[i].name}: ${r.reason instanceof Error ? r.reason.message : "failed"}`.slice(0, 160));
  });
  const ok = results.some((r) => r.status === "fulfilled");

  const rows = new Map<string, Record<string, unknown>>();
  for (const a of keepValid(found, now)) {
    const id = await articleId(a.url);
    if (rows.has(id)) continue;
    rows.set(id, { id, region_key: region.key, provider: a.provider, category: a.category, title: a.title, summary: a.summary, source_name: a.sourceName, url: a.url, image_url: a.imageUrl, published_at: a.publishedAt, fetched_at: nowIso, is_live: a.isLive });
  }
  if (rows.size) {
    const { error } = await db.from("news_articles").upsert([...rows.values()], { onConflict: "id" });
    if (error) problems.push("Couldn't save articles");
  }
  await db.from("news_articles").delete().eq("region_key", region.key).lt("published_at", new Date(now.getTime() - KEEP_DAYS * 86_400_000).toISOString());
  await db.from("news_regions").update({ refreshing_since: null, last_error: problems.length ? problems.join("; ").slice(0, 500) : null, ...(ok ? { last_refreshed_at: nowIso } : {}) }).eq("region_key", region.key);
  return { region: region.key, status: ok ? "refreshed" : "failed", saved: rows.size, problems };
}
