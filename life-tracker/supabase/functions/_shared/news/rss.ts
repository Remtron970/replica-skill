import { cleanText, safeHttps, validDate, type Category, type RawArticle } from "./model.ts";

/** Free feeds that need no key. Local news comes from a Google News search for your city. */
export const WORLD_FEEDS: { url: string; source: string; category: Category }[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC News", category: "world" },
  { url: "https://feeds.npr.org/1001/rss.xml", source: "NPR", category: "us" },
];

export function localFeedUrl(query: string): string {
  const p = new URLSearchParams({ q: query, hl: "en-US", gl: "US", ceid: "US:en" });
  return `https://news.google.com/rss/search?${p}`;
}

const tag = (block: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
  return m ? m[1] : null;
};
const attr = (block: string, name: string, a: string) => {
  const m = new RegExp(`<${name}\\s[^>]*\\b${a}\\s*=\\s*"([^"]*)"`, "i").exec(block);
  return m ? m[1] : null;
};

/**
 * Reads RSS 2.0 items. For Google News, titles look like "Headline - Outlet"
 * and the outlet is in <source>; that outlet is used as the source name.
 */
export function parseRss(xml: string, opts: { source: string; category: Category; max?: number }): RawArticle[] {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, opts.max ?? 30).flatMap((it) => {
    const outlet = cleanText(tag(it, "source"), 100);
    let title = cleanText(tag(it, "title"), 300);
    if (outlet && title.endsWith(` - ${outlet}`)) title = title.slice(0, -(outlet.length + 3)).trim();
    const url = safeHttps(cleanText(tag(it, "link"), 2000)) ?? safeHttps(cleanText(tag(it, "guid"), 2000));
    const publishedAt = validDate(cleanText(tag(it, "pubDate"), 100) || cleanText(tag(it, "dc:date"), 100));
    if (!title || !url || !publishedAt) return [];
    const desc = cleanText(tag(it, "description"), 600);
    const image = safeHttps(attr(it, "media:thumbnail", "url") ?? attr(it, "media:content", "url") ?? (/type="image\//i.test(it) ? attr(it, "enclosure", "url") : null));
    return [{
      provider: "rss" as const,
      category: opts.category,
      title,
      // Google News descriptions just repeat the headline and outlet.
      summary: desc && !outlet ? desc : null,
      sourceName: outlet || opts.source,
      url,
      imageUrl: image,
      publishedAt,
      isLive: /^\s*(live|breaking)\s*[:|–-]/i.test(title),
    }];
  });
}
