import { cleanText, safeHttps, validDate, type RawArticle } from "./model.ts";

/** GNews: local stories for your city (the free plan allows 100 requests a day). */
export function gnewsSearchUrl(apiKey: string, query: string): string {
  const p = new URLSearchParams({ q: query, lang: "en", country: "us", max: "10", sortby: "publishedAt", apikey: apiKey });
  return `https://gnews.io/api/v4/search?${p}`;
}

interface GNewsArticle {
  title?: string;
  description?: string;
  url?: string;
  image?: string;
  publishedAt?: string;
  source?: { name?: string };
}

export function mapGnews(json: unknown): RawArticle[] {
  const list = ((json as { articles?: GNewsArticle[] })?.articles ?? []) as GNewsArticle[];
  return list.flatMap((a) => {
    const url = safeHttps(a.url);
    const publishedAt = validDate(a.publishedAt);
    const title = cleanText(a.title, 300);
    const sourceName = cleanText(a.source?.name, 100);
    if (!url || !publishedAt || !title || !sourceName) return [];
    return [{ provider: "gnews" as const, category: "local" as const, title, summary: cleanText(a.description, 600) || null, sourceName, url, imageUrl: safeHttps(a.image), publishedAt, isLive: false }];
  });
}
