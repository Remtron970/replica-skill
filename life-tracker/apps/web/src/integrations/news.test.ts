import { describe, expect, it } from "vitest";
import { mapGnews } from "../../../../supabase/functions/_shared/news/gnews.ts";
import { guardianUrl, mapGuardian } from "../../../../supabase/functions/_shared/news/guardian.ts";
import { cleanText, regionKeyFor } from "../../../../supabase/functions/_shared/news/model.ts";
import { localFeedUrl, parseRss } from "../../../../supabase/functions/_shared/news/rss.ts";
import { refreshRegion, regionFromSettings, WORLD } from "../../../../supabase/functions/_shared/news/runNewsRefresh.ts";
import { fakeDb } from "./fakeDb";

const NOW = new Date("2026-11-28T15:00:00Z");

// Shapes follow each provider's documented responses.
const guardianJson = {
  response: {
    status: "ok",
    results: [
      { type: "liveblog", sectionId: "world", webTitle: "Summit talks – live updates", webUrl: "https://www.theguardian.com/world/live/2026/nov/28/summit", webPublicationDate: "2026-11-28T14:10:00Z", fields: { trailText: "<p>Leaders meet for a <strong>second</strong> day</p>", thumbnail: "https://media.guim.co.uk/x/500.jpg", liveBloggingNow: "true" } },
      { type: "liveblog", sectionId: "sport", webTitle: "Yesterday's match – as it happened", webUrl: "https://www.theguardian.com/sport/live/2026/nov/27/match", webPublicationDate: "2026-11-27T21:00:00Z", fields: { liveBloggingNow: "false" } },
      { type: "article", sectionId: "technology", webTitle: "New chip announced", webUrl: "https://www.theguardian.com/technology/2026/nov/28/chip", webPublicationDate: "2026-11-28T12:00:00Z", fields: { trailText: "Faster &amp; cheaper" } },
      { type: "article", sectionId: "world", webTitle: "Bad link", webUrl: "javascript:alert(1)", webPublicationDate: "2026-11-28T12:00:00Z" },
    ],
  },
};
const gnewsJson = {
  totalArticles: 2,
  articles: [
    { title: "City council approves river trail extension", description: "The council voted 5-2 on Wednesday.", url: "https://www.gjsentinel.com/news/western_colorado/trail", image: "https://www.gjsentinel.com/img.jpg", publishedAt: "2026-11-28T13:00:00Z", source: { name: "The Daily Sentinel", url: "https://www.gjsentinel.com" } },
    { title: "No source", url: "https://example.com/a", publishedAt: "2026-11-28T13:00:00Z", source: {} },
  ],
};
const bbcRss = `<?xml version="1.0" encoding="UTF-8"?><rss xmlns:media="http://search.yahoo.com/mrss/" version="2.0"><channel><title>BBC News</title>
<item><title><![CDATA[Leaders meet for second day of summit]]></title><description><![CDATA[Talks continue on trade.]]></description><link>https://www.bbc.co.uk/news/articles/abc</link><guid isPermaLink="false">https://www.bbc.co.uk/news/articles/abc#0</guid><pubDate>Sat, 28 Nov 2026 14:30:00 GMT</pubDate><media:thumbnail width="240" height="135" url="https://ichef.bbci.co.uk/x.jpg"/></item>
<item><title>Future item</title><link>https://www.bbc.co.uk/news/f</link><pubDate>Sun, 29 Nov 2026 14:30:00 GMT</pubDate></item>
</channel></rss>`;
const googleRss = `<rss version="2.0"><channel><title>"Grand Junction" Colorado - Google News</title>
<item><title>Snow expected on the Grand Mesa this weekend - KJCT8</title><link>https://news.google.com/rss/articles/CBMiabc?oc=5</link><guid isPermaLink="false">CBMiabc</guid><pubDate>Sat, 28 Nov 2026 12:00:00 GMT</pubDate><description>&lt;a href="https://news.google.com/rss/articles/CBMiabc?oc=5"&gt;Snow expected&lt;/a&gt;&amp;nbsp;&amp;nbsp;&lt;font color="#6f6f6f"&gt;KJCT8&lt;/font&gt;</description><source url="https://www.kjct8.com">KJCT8</source></item>
</channel></rss>`;

describe("news providers", () => {
  it("Guardian: maps sections, cleans text, marks only blogs that are live right now", () => {
    expect(guardianUrl("K")).toContain("show-fields=trailText%2Cthumbnail%2CliveBloggingNow");
    const a = mapGuardian(guardianJson);
    expect(a).toHaveLength(3);
    expect(a[0]).toMatchObject({ category: "world", isLive: true, summary: "Leaders meet for a second day", sourceName: "The Guardian", imageUrl: "https://media.guim.co.uk/x/500.jpg" });
    expect(a[1]).toMatchObject({ category: "sports", isLive: false });
    expect(a[2]).toMatchObject({ category: "technology", summary: "Faster & cheaper" });
    expect(mapGuardian({ message: "Invalid authentication credentials" })).toEqual([]);
  });

  it("GNews: local articles with their real outlet; incomplete ones dropped", () => {
    expect(mapGnews(gnewsJson)).toEqual([expect.objectContaining({ category: "local", sourceName: "The Daily Sentinel", title: "City council approves river trail extension" })]);
  });

  it("RSS: reads CDATA, thumbnails, and Google News outlet names", () => {
    const bbc = parseRss(bbcRss, { source: "BBC News", category: "world" });
    expect(bbc[0]).toMatchObject({ title: "Leaders meet for second day of summit", summary: "Talks continue on trade.", url: "https://www.bbc.co.uk/news/articles/abc", imageUrl: "https://ichef.bbci.co.uk/x.jpg", publishedAt: "2026-11-28T14:30:00.000Z" });
    const g = parseRss(googleRss, { source: "Google News", category: "local" });
    expect(g[0]).toMatchObject({ title: "Snow expected on the Grand Mesa this weekend", sourceName: "KJCT8", summary: null, category: "local" });
    expect(localFeedUrl('"Grand Junction" Colorado')).toBe("https://news.google.com/rss/search?q=%22Grand+Junction%22+Colorado&hl=en-US&gl=US&ceid=US%3Aen");
  });

  it("text and region helpers", () => {
    expect(cleanText("<p>A &amp;amp; B</p><script>x()</script>", 100)).toBe("A & B");
    expect(cleanText("x".repeat(20), 10)).toHaveLength(10);
    expect(regionKeyFor("US", "Colorado", "Grand Junction")).toBe("us-colorado-grand-junction");
    expect(regionFromSettings({ location: { regionKey: "us-colorado-grand-junction", label: "Grand Junction, CO", query: '"Grand Junction" Colorado' } })).toEqual({ key: "us-colorado-grand-junction", label: "Grand Junction, CO", query: '"Grand Junction" Colorado' });
    expect(regionFromSettings({ location: { regionKey: "Bad Key", query: "x" } })).toBeNull();
    expect(regionFromSettings({ location: { regionKey: "world", query: "x" } })).toBeNull();
  });
});

function fakeFetch(map: Record<string, { status?: number; body: unknown }>) {
  const seen: string[] = [];
  const f = async (url: string) => {
    seen.push(url);
    const hit = Object.entries(map).find(([k]) => url.startsWith(k));
    if (!hit) return new Response("nope", { status: 404 });
    const { status = 200, body } = hit[1];
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  };
  return { f, seen };
}

describe("news refresh", () => {
  const world = { "https://content.guardianapis.com/": { body: guardianJson }, "https://feeds.bbci.co.uk/": { body: bbcRss }, "https://feeds.npr.org/": { status: 503, body: "down" } };

  it("stores articles from every source that answers and notes the ones that didn't", async () => {
    const { db, tables } = fakeDb({ news_regions: [], news_articles: [] });
    const { f, seen } = fakeFetch(world);
    const r = await refreshRegion(WORLD, { db, fetch: f, now: NOW, keys: { guardian: "K" } });
    expect(r).toMatchObject({ status: "refreshed", saved: 4, problems: ["NPR: HTTP 503"] });
    expect(seen).toHaveLength(3);
    expect(tables.news_articles.map((a) => a.source_name).sort()).toEqual(["BBC News", "The Guardian", "The Guardian", "The Guardian"]); // the 27 Nov sport blog is kept (within 3 days); future item dropped
    expect(tables.news_articles.every((a) => /^[0-9a-f]{32}$/.test(String(a.id)))).toBe(true);
    expect(tables.news_regions[0]).toMatchObject({ region_key: "world", last_refreshed_at: NOW.toISOString(), refreshing_since: null, last_error: "NPR: HTTP 503" });
  });

  it("works with no API keys (free feeds only) and doesn't refresh again within 30 minutes", async () => {
    const { db } = fakeDb({ news_regions: [], news_articles: [] });
    const { f, seen } = fakeFetch(world);
    await refreshRegion(WORLD, { db, fetch: f, now: NOW, keys: {} });
    expect(seen.some((u) => u.includes("guardianapis"))).toBe(false);
    const again = await refreshRegion(WORLD, { db, fetch: f, now: new Date(NOW.getTime() + 10 * 60_000), keys: {} });
    expect(again.status).toBe("fresh");
    expect(seen).toHaveLength(2);
  });

  it("local: GNews plus Google News for the city, duplicates and old articles removed", async () => {
    const old = { id: "f".repeat(32), region_key: "us-colorado-grand-junction", published_at: "2026-11-20T00:00:00.000Z" };
    const { db, tables } = fakeDb({ news_regions: [], news_articles: [old] });
    const { f, seen } = fakeFetch({ "https://gnews.io/": { body: gnewsJson }, "https://news.google.com/": { body: googleRss } });
    const r = await refreshRegion({ key: "us-colorado-grand-junction", label: "Grand Junction, CO", query: '"Grand Junction" Colorado' }, { db, fetch: f, now: NOW, keys: { gnews: "G" } });
    expect(r).toMatchObject({ status: "refreshed", saved: 2, problems: [] });
    expect(seen[0]).toContain("q=%22Grand+Junction%22+Colorado");
    expect(tables.news_articles.map((a) => a.source_name).sort()).toEqual(["KJCT8", "The Daily Sentinel"]);
  });

  it("if every source fails, keeps the old articles and lets the next open try again", async () => {
    const { db, tables } = fakeDb({ news_regions: [], news_articles: [] });
    const { f } = fakeFetch({});
    const r = await refreshRegion(WORLD, { db, fetch: f, now: NOW, keys: {} });
    expect(r.status).toBe("failed");
    expect(tables.news_regions[0].last_refreshed_at).toBeUndefined();
    expect(String(tables.news_regions[0].last_error)).toContain("BBC News: HTTP 404");
  });
});
