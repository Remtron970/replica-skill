import { clip, dateOnly, type FetchJson, type MappedSchool } from "./model.ts";

/**
 * Google Classroom API v1, read-only (OAuth scopes: classroom.courses.readonly,
 * classroom.coursework.me.readonly, classroom.rosters.readonly).
 *   GET /v1/courses?studentId=me&courseStates=ACTIVE
 *   GET /v1/courses/{id}/teachers
 *   GET /v1/courses/{id}/courseWork
 *   GET /v1/courses/{id}/courseWork/-/studentSubmissions?userId=me
 * Classroom has no "missing" flag in the API; like the Classroom app, we treat
 * work as missing when it's past due and wasn't turned in.
 */

const API = "https://classroom.googleapis.com/v1";

export const CLASSROOM_SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
  "https://www.googleapis.com/auth/classroom.rosters.readonly",
];

interface GDate {
  year?: number;
  month?: number;
  day?: number;
}
interface GCourse {
  id: string;
  name?: string;
  section?: string;
  room?: string;
  gradebookSettings?: { calculationType?: string; gradeCategories?: { id: string; name?: string; weight?: number }[] };
}
interface GCourseWork {
  id: string;
  title?: string;
  maxPoints?: number;
  dueDate?: GDate;
  state?: string;
  gradeCategory?: { id?: string };
}
interface GSubmission {
  courseWorkId: string;
  state?: string;
  assignedGrade?: number;
  updateTime?: string;
}

const gdate = (d?: GDate) => (d?.year && d.month && d.day ? `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}` : null);
const NOT_TURNED_IN = new Set(["NEW", "CREATED", "RECLAIMED_BY_STUDENT"]);

export function mapClassroom(
  courses: GCourse[],
  data: Record<string, { teachers: { profile?: { name?: { fullName?: string } } }[]; work: GCourseWork[]; subs: GSubmission[] }>,
  today: string,
): MappedSchool {
  const out: MappedSchool = { courses: [], categories: [], items: [] };
  for (const c of courses) {
    const d = data[c.id] ?? { teachers: [], work: [], subs: [] };
    const cid = `classroom:course:${c.id}`;
    const weighted = c.gradebookSettings?.calculationType === "WEIGHTED_CATEGORIES";
    out.courses.push({
      externalId: cid,
      name: clip([c.name, c.section].filter(Boolean).join(" — ") || "Classroom course", 80),
      teacher: clip(d.teachers[0]?.profile?.name?.fullName, 80),
      room: clip(c.room, 40),
      gradingMode: weighted ? "weighted" : "points",
    });
    (c.gradebookSettings?.gradeCategories ?? []).forEach((g, i) => {
      out.categories.push({
        externalId: `classroom:category:${c.id}:${g.id}`,
        courseExternalId: cid,
        name: clip(g.name || "Category", 60),
        // Classroom stores weights as percent × 10,000 (e.g. 25% = 250000).
        weight: Math.max(0, Math.min(100, (g.weight ?? 0) / 10000)),
        sort: i,
      });
    });
    const subs = new Map(d.subs.map((s) => [s.courseWorkId, s]));
    for (const w of d.work) {
      if (w.state && w.state !== "PUBLISHED") continue;
      if (!(typeof w.maxPoints === "number" && w.maxPoints > 0)) continue; // ungraded work
      const s = subs.get(w.id);
      const graded = typeof s?.assignedGrade === "number";
      const due = gdate(w.dueDate);
      out.items.push({
        externalId: `classroom:work:${c.id}:${w.id}`,
        courseExternalId: cid,
        categoryExternalId: w.gradeCategory?.id ? `classroom:category:${c.id}:${w.gradeCategory.id}` : null,
        title: clip(w.title || "Assignment", 120),
        earned: graded ? (s!.assignedGrade as number) : null,
        possible: w.maxPoints,
        gradedOn: graded ? dateOnly(s!.updateTime) : null,
        dueOn: due,
        excused: false,
        missing: !graded && !!due && due < today && (!s || NOT_TURNED_IN.has(s.state ?? "NEW")),
      });
    }
  }
  return out;
}

/** `fetchJson` must send the user's Google access token and merge `nextPageToken` pages under the given key. */
export async function fetchClassroom(fetchJson: (url: string, listKey: string) => Promise<unknown[]>, today: string): Promise<MappedSchool> {
  const courses = (await fetchJson(`${API}/courses?studentId=me&courseStates=ACTIVE&pageSize=100`, "courses")) as GCourse[];
  const data: Parameters<typeof mapClassroom>[1] = {};
  for (const c of courses) {
    const id = encodeURIComponent(c.id);
    data[c.id] = {
      teachers: (await fetchJson(`${API}/courses/${id}/teachers?pageSize=10`, "teachers")) as never,
      work: (await fetchJson(`${API}/courses/${id}/courseWork?pageSize=100`, "courseWork")) as GCourseWork[],
      subs: (await fetchJson(`${API}/courses/${id}/courseWork/-/studentSubmissions?userId=me&pageSize=100`, "studentSubmissions")) as GSubmission[],
    };
  }
  return mapClassroom(courses, data, today);
}

export type { FetchJson };
