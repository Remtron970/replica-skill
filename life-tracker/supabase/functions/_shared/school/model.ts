/** What a school platform's data becomes in Life Tracker, before ids are assigned. */

export interface MappedCourse {
  externalId: string;
  name: string;
  teacher: string;
  room: string;
  gradingMode: "points" | "weighted";
}

export interface MappedCategory {
  externalId: string;
  courseExternalId: string;
  name: string;
  /** Percent of the course grade (0–100). */
  weight: number;
  sort: number;
}

export interface MappedItem {
  externalId: string;
  courseExternalId: string;
  categoryExternalId: string | null;
  title: string;
  earned: number | null;
  possible: number | null;
  gradedOn: string | null; // YYYY-MM-DD
  dueOn: string | null;
  excused: boolean;
  missing: boolean;
}

/** Something to do, with a due date (graded or not). */
export interface MappedAssignment {
  externalId: string;
  courseExternalId: string;
  title: string;
  description: string;
  dueAt: string | null; // ISO timestamp
  dueHasTime: boolean;
  url: string | null;
  /** Turned in (or excused) according to the platform. */
  submitted: boolean;
}

export interface MappedSchool {
  courses: MappedCourse[];
  categories: MappedCategory[];
  items: MappedItem[];
  assignments: MappedAssignment[];
}

/** Plain text from an HTML description, trimmed to fit. */
export function plainText(html: unknown, max = 2000): string {
  return String(html ?? "")
    .replace(/<(br|\/p|\/div|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max);
}

/** Only keep https links (the database rejects anything else). */
export const safeUrl = (u: unknown) => (typeof u === "string" && /^https:\/\//.test(u) && u.length <= 500 ? u : null);

/** Fetches a URL and returns parsed JSON (following pagination where the platform uses it). */
export type FetchJson = (url: string) => Promise<unknown>;

export function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
