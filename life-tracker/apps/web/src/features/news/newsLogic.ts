import type { Category } from "../../../../../supabase/functions/_shared/news/model.ts";

export interface Article {
  id: string;
  regionKey: string;
  provider: string;
  category: Category;
  title: string;
  summary: string | null;
  sourceName: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string;
  isLive: boolean;
}

export interface Story {
  lead: Article;
  /** Other outlets reporting the same story. */
  others: Article[];
  sources: string[];
  /** The source marks it live, e.g. a live blog being updated. */
  developing: boolean;
  /** Live-flagged and reported by 2+ outlets within the last hour. */
  breaking: boolean;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  local: "Local",
  world: "World",
  us: "U.S.",
  politics: "Politics",
  business: "Business",
  technology: "Technology",
  science: "Science",
  health: "Health",
  sports: "Sports",
  entertainment: "Entertainment",
};

const STOP = new Set("the a an and or of to in on for with at by from as is are was were be been after over into about amid says said new news live updates update what how why who will can could than this that their his her its out up more".split(" "));

export function titleWords(t: string): Set<string> {
  return new Set(
    t
      .toLowerCase()
      .replace(/[’']s\b/g, "")
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  );
}

function similar(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared >= 3 && shared / Math.min(a.size, b.size) >= 0.5;
}

/**
 * Groups articles about the same story (similar headlines within 24 hours, from
 * different outlets). We never claim a story is verified, only how many outlets
 * reported it.
 */
export function groupStories(articles: Article[], now: Date): Story[] {
  const sorted = [...articles].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const groups: { items: Article[]; words: Set<string> }[] = [];
  for (const a of sorted) {
    const w = titleWords(a.title);
    const t = Date.parse(a.publishedAt);
    const g = groups.find((x) => Math.abs(Date.parse(x.items[0].publishedAt) - t) <= 24 * 3_600_000 && !x.items.some((i) => i.sourceName === a.sourceName) && similar(x.words, w));
    if (g) g.items.push(a);
    else groups.push({ items: [a], words: w });
  }
  const hour = now.getTime() - 3_600_000;
  return groups.map(({ items }) => {
    const lead = items.find((i) => i.summary) ?? items[0];
    const sources = [...new Set(items.map((i) => i.sourceName))];
    const developing = items.some((i) => i.isLive);
    const recentOutlets = new Set(items.filter((i) => Date.parse(i.publishedAt) >= hour).map((i) => i.sourceName));
    return { lead, others: items.filter((i) => i !== lead), sources, developing, breaking: developing && recentOutlets.size >= 2 };
  });
}

/** Stories for a feed: hide muted outlets and hidden categories; most-reported recent stories first in "top". */
export function feed(stories: Story[], opts: { category: Category | "top"; hidden: Category[]; muted: string[] }): Story[] {
  const muted = new Set(opts.muted.map((m) => m.toLowerCase()));
  const visible = stories
    .map((s) => {
      const items = [s.lead, ...s.others].filter((i) => !muted.has(i.sourceName.toLowerCase()));
      if (!items.length) return null;
      if (items.length === s.others.length + 1) return s;
      const lead = items.find((i) => i.summary) ?? items[0];
      const sources = [...new Set(items.map((i) => i.sourceName))];
      const developing = items.some((i) => i.isLive);
      // Labels depend only on the outlets still shown.
      return { ...s, lead, others: items.filter((i) => i !== lead), sources, developing, breaking: s.breaking && developing && sources.length >= 2 };
    })
    .filter((s): s is Story => !!s && !opts.hidden.includes(s.lead.category));
  if (opts.category !== "top") return visible.filter((s) => s.lead.category === opts.category || s.others.some((o) => o.category === opts.category));
  return [...visible].sort((a, b) => Number(b.breaking) - Number(a.breaking) || b.sources.length - a.sources.length || b.lead.publishedAt.localeCompare(a.lead.publishedAt));
}

export const relTime = (iso: string, now: Date) => {
  const m = Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};
