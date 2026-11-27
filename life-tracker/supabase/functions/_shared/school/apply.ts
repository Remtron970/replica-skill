import type { MappedSchool } from "./model.ts";

/**
 * Turn freshly fetched school data into database writes:
 *   - match existing rows by (source, external_id), reusing their ids
 *   - keep what the user chose on a synced class (color, credits, level, scale, term)
 *   - mark rows deleted when they disappear from the platform
 *   - never touch rows the user entered themselves (other sources)
 * Output rows use the same shape as the sync model (see migrations), so devices
 * pick them up through their normal sync.
 */

export type Source = "canvas" | "google_classroom";
type Row = Record<string, unknown> & { id: string; external_id: string | null; source: string; deleted?: boolean };

export interface Existing {
  courses: Row[];
  grade_categories: Row[];
  grade_items: Row[];
}

export interface Plan {
  /** Rows to upsert (insert, or update by id). */
  courses: Record<string, unknown>[];
  grade_categories: Record<string, unknown>[];
  grade_items: Record<string, unknown>[];
  /**
   * Ids to mark deleted with a plain UPDATE (an upsert of a partial row would
   * fail Postgres's NOT NULL checks before the conflict is detected).
   */
  deleted: { courses: string[]; grade_categories: string[]; grade_items: string[] };
}

const SAME_KEYS = ["name", "teacher", "room", "grading_mode", "course_id", "category_id", "title", "earned", "possible", "graded_on", "due_on", "excused", "missing", "weight", "sort", "deleted"];

/** True if writing `next` over `prev` would change anything the user can see. */
function changed(prev: Row | undefined, next: Record<string, unknown>) {
  if (!prev) return true;
  return SAME_KEYS.some((k) => k in next && (prev[k] ?? null) !== (next[k] ?? null) && !(typeof prev[k] === "string" && typeof next[k] === "number" && Number(prev[k]) === next[k]));
}

export function planSchoolSync(mapped: MappedSchool, existing: Existing, opts: { userId: string; source: Source; now: string; newId: () => string }): Plan {
  const { userId, source, now, newId } = opts;
  const mine = (rows: Row[]) => new Map(rows.filter((r) => r.source === source && r.external_id).map((r) => [r.external_id as string, r]));
  const ex = { courses: mine(existing.courses), cats: mine(existing.grade_categories), items: mine(existing.grade_items) };
  const base = (id: string, externalId: string) => ({ id, user_id: userId, client_updated_at: now, deleted: false, source, external_id: externalId });
  const plan: Plan = { courses: [], grade_categories: [], grade_items: [], deleted: { courses: [], grade_categories: [], grade_items: [] } };

  const courseId = new Map<string, string>();
  for (const c of mapped.courses) {
    const prev = ex.courses.get(c.externalId);
    const id = prev?.id ?? newId();
    courseId.set(c.externalId, id);
    const row = {
      ...base(id, c.externalId),
      name: c.name,
      teacher: c.teacher,
      room: c.room,
      grading_mode: c.gradingMode,
      // First time only; afterwards these belong to the user.
      ...(prev ? {} : { color: "blue", credits: 1, level: "regular", manual_percent: null, scale_id: null, term_id: null, archived: false }),
    };
    if (changed(prev, row)) plan.courses.push(row);
  }

  const catId = new Map<string, string>();
  for (const k of mapped.categories) {
    const cid = courseId.get(k.courseExternalId);
    if (!cid) continue;
    const prev = ex.cats.get(k.externalId);
    const id = prev?.id ?? newId();
    catId.set(k.externalId, id);
    const row = { ...base(id, k.externalId), course_id: cid, name: k.name, weight: k.weight, sort: k.sort };
    if (changed(prev, row)) plan.grade_categories.push(row);
  }

  for (const it of mapped.items) {
    const cid = courseId.get(it.courseExternalId);
    if (!cid) continue;
    const prev = ex.items.get(it.externalId);
    const row = {
      ...base(prev?.id ?? newId(), it.externalId),
      course_id: cid,
      category_id: it.categoryExternalId ? (catId.get(it.categoryExternalId) ?? null) : null,
      title: it.title,
      earned: it.earned,
      possible: it.possible,
      graded_on: it.gradedOn,
      due_on: it.dueOn,
      excused: it.excused,
      missing: it.missing,
      ...(prev ? {} : { notes: "" }),
    };
    if (changed(prev, row)) plan.grade_items.push(row);
  }

  // Gone from the platform → deleted here too.
  const seen = { courses: new Set(mapped.courses.map((c) => c.externalId)), cats: new Set(mapped.categories.map((c) => c.externalId)), items: new Set(mapped.items.map((i) => i.externalId)) };
  const gone = (m: Map<string, Row>, keep: Set<string>, into: string[]) => {
    for (const [ext, r] of m) if (!keep.has(ext) && !r.deleted) into.push(r.id);
  };
  gone(ex.courses, seen.courses, plan.deleted.courses);
  gone(ex.cats, seen.cats, plan.deleted.grade_categories);
  gone(ex.items, seen.items, plan.deleted.grade_items);
  return plan;
}
