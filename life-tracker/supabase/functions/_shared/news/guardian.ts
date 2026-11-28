import { cleanText, safeHttps, validDate, type Category, type RawArticle } from "./model.ts";

/** The Guardian Open Platform: one request for the newest stories across main sections. */
export const GUARDIAN_SECTIONS = ["world", "us-news", "politics", "business", "technology", "science", "environment", "society", "sport", "football", "film", "music", "culture", "tv-and-radio", "books", "games"];

export function guardianUrl(apiKey: string): string {
  const p = new URLSearchParams({ section: GUARDIAN_SECTIONS.join("|"), "order-by": "newest", "page-size": "50", "show-fields": "trailText,thumbnail,liveBloggingNow", "api-key": apiKey });
  return `https://content.guardianapis.com/search?${p}`;
}

const SECTION_CATEGORY: Record<string, Category> = {
  world: "world",
  "us-news": "us",
  politics: "politics",
  business: "business",
  money: "business",
  technology: "technology",
  science: "science",
  environment: "science",
  society: "health",
  sport: "sports",
  football: "sports",
  film: "entertainment",
  music: "entertainment",
  culture: "entertainment",
  "tv-and-radio": "entertainment",
  books: "entertainment",
  games: "entertainment",
};

interface GuardianResult {
  type?: string;
  sectionId?: string;
  webTitle?: string;
  webUrl?: string;
  webPublicationDate?: string;
  fields?: { trailText?: string; thumbnail?: string; liveBloggingNow?: string };
}

export function mapGuardian(json: unknown): RawArticle[] {
  const results = ((json as { response?: { results?: GuardianResult[] } })?.response?.results ?? []) as GuardianResult[];
  return results.flatMap((r) => {
    const url = safeHttps(r.webUrl);
    const publishedAt = validDate(r.webPublicationDate);
    const title = cleanText(r.webTitle, 300);
    if (!url || !publishedAt || !title) return [];
    return [{
      provider: "guardian" as const,
      category: SECTION_CATEGORY[r.sectionId ?? ""] ?? "world",
      title,
      summary: cleanText(r.fields?.trailText, 600) || null,
      sourceName: "The Guardian",
      url,
      imageUrl: safeHttps(r.fields?.thumbnail),
      publishedAt,
      isLive: r.type === "liveblog" && r.fields?.liveBloggingNow === "true",
    }];
  });
}
