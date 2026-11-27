import type { Course, GradeCategory, GradeItem, GradingScale, PastCourse, Term } from "../../features/academics/types";
import { Collection, type Source, type SyncRecord } from "./collection";
import type { CollectionBinding } from "./engine";

/**
 * Every synced collection, its Supabase table, and how fields map between the
 * app (camelCase) and the database (snake_case). Order matters for sync only
 * in that parents are uploaded first, which keeps other devices tidy.
 */

type FieldMap<T> = { [K in Exclude<keyof T, keyof SyncRecord>]-?: string };

function binding<T extends SyncRecord>(
  collection: Collection<T>,
  table: string,
  fields: FieldMap<T>,
  /** Postgres numeric columns, which can arrive as strings; converted to numbers. */
  numeric: (keyof T)[] = [],
): CollectionBinding<T> {
  const entries = Object.entries(fields) as [keyof T, string][];
  return {
    collection,
    table,
    toRow: (r, userId) => {
      const row: Record<string, unknown> = {
        id: r.id,
        user_id: userId,
        client_updated_at: new Date(r.clientUpdatedAt).toISOString(),
        deleted: r.deleted,
        source: r.source,
        external_id: r.externalId ?? null,
      };
      for (const [k, col] of entries) row[col] = r[k] ?? null;
      return row;
    },
    fromRow: (row) => {
      const r = {
        id: row.id as string,
        clientUpdatedAt: Date.parse(row.client_updated_at as string),
        deleted: row.deleted === true,
        source: row.source as Source,
        externalId: (row.external_id as string | null) ?? null,
      } as Record<string, unknown>;
      for (const [k, col] of entries) {
        const v = row[col];
        r[k as string] = numeric.includes(k) && typeof v === "string" ? Number(v) : v;
      }
      return r as unknown as T;
    },
  };
}

export const store = {
  terms: new Collection<Term>("terms"),
  scales: new Collection<GradingScale>("grading_scales"),
  courses: new Collection<Course>("courses"),
  categories: new Collection<GradeCategory>("grade_categories"),
  items: new Collection<GradeItem>("grade_items"),
  pastCourses: new Collection<PastCourse>("past_courses"),
};

export const bindings = [
  binding(store.terms, "terms", { name: "name", startsOn: "starts_on", endsOn: "ends_on", isCurrent: "is_current" }),
  binding(store.scales, "grading_scales", { name: "name", bands: "bands" }),
  binding(store.courses, "courses", {
    termId: "term_id",
    name: "name",
    teacher: "teacher",
    room: "room",
    color: "color",
    credits: "credits",
    level: "level",
    gradingMode: "grading_mode",
    manualPercent: "manual_percent",
    scaleId: "scale_id",
    archived: "archived",
  }, ["credits", "manualPercent"]),
  binding(store.categories, "grade_categories", { courseId: "course_id", name: "name", weight: "weight", sort: "sort" }, ["weight", "sort"]),
  binding(store.items, "grade_items", {
    courseId: "course_id",
    categoryId: "category_id",
    title: "title",
    earned: "earned",
    possible: "possible",
    gradedOn: "graded_on",
    dueOn: "due_on",
    excused: "excused",
    missing: "missing",
    notes: "notes",
  }, ["earned", "possible"]),
  binding(store.pastCourses, "past_courses", { termName: "term_name", name: "name", credits: "credits", level: "level", letter: "letter", points: "points" }, ["credits", "points"]),
] as unknown as CollectionBinding<SyncRecord>[];

export const allCollections = Object.values(store) as Collection<SyncRecord>[];
