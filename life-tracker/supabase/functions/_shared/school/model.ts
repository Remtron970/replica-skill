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

export interface MappedSchool {
  courses: MappedCourse[];
  categories: MappedCategory[];
  items: MappedItem[];
}

/** Fetches a URL and returns parsed JSON (following pagination where the platform uses it). */
export type FetchJson = (url: string) => Promise<unknown>;

export function dateOnly(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
