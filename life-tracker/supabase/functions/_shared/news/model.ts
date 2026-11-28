/** News shared by the news-refresh function and the app (pure, no Deno globals). */

export const CATEGORIES = ["world", "us", "politics", "business", "technology", "science", "health", "sports", "entertainment", "local"] as const;
export type Category = (typeof CATEGORIES)[number];
export type Provider = "guardian" | "gnews" | "rss";

/** An article as read from a provider, before it's stored. */
export interface RawArticle {
  provider: Provider;
  category: Category;
  title: string;
  summary: string | null;
  sourceName: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string; // ISO
  isLive: boolean;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", mdash: "—", ndash: "–", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : "";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** Text from HTML-ish content: tags removed, entities decoded, whitespace collapsed, length capped. */
export function cleanText(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  let t = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  t = decodeEntities(t); // feeds often escape their HTML once
  t = t.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ");
  t = decodeEntities(t).replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

export function safeHttps(u: unknown): string | null {
  if (typeof u !== "string") return null;
  try {
    const url = new URL(decodeEntities(u.trim()));
    return url.protocol === "https:" && url.href.length <= 2000 ? url.href : null;
  } catch {
    return null;
  }
}

export function validDate(s: unknown): string | null {
  if (typeof s !== "string" && typeof s !== "number") return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Keep only well-formed articles; drop future-dated and very old ones. */
export function keepValid(list: (RawArticle | null)[], now: Date, maxAgeHours = 72): RawArticle[] {
  const t = now.getTime();
  return list.filter((a): a is RawArticle => {
    if (!a || !a.title || !a.url || !a.sourceName) return false;
    const p = Date.parse(a.publishedAt);
    return p <= t + 10 * 60_000 && t - p <= maxAgeHours * 3_600_000;
  });
}

/** Region key for a place, e.g. "us-colorado-grand-junction". */
export function regionKeyFor(country: string, admin: string, name: string): string {
  const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return [country, admin, name].map(slug).filter(Boolean).join("-").slice(0, 80);
}
export const REGION_KEY_RE = /^[a-z0-9-]{2,80}$/;
