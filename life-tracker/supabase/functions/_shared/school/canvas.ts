import { clip, dateOnly, type FetchJson, type MappedSchool } from "./model.ts";

/**
 * Canvas LMS (REST API v1), read-only, with a personal access token.
 * Endpoints used (Canvas API docs: Courses, Assignment Groups):
 *   GET /api/v1/courses?enrollment_state=active&include[]=teachers&include[]=term
 *   GET /api/v1/courses/:id/assignment_groups?include[]=assignments&include[]=submission
 */

interface CanvasCourse {
  id: number | string;
  name?: string;
  course_code?: string;
  apply_assignment_group_weights?: boolean;
  teachers?: { display_name?: string }[];
  access_restricted_by_date?: boolean;
}

interface CanvasSubmission {
  score?: number | null;
  excused?: boolean | null;
  missing?: boolean | null;
  graded_at?: string | null;
  workflow_state?: string;
}

interface CanvasAssignment {
  id: number | string;
  name?: string;
  points_possible?: number | null;
  due_at?: string | null;
  published?: boolean;
  omit_from_final_grade?: boolean;
  submission?: CanvasSubmission | null;
}

interface CanvasGroup {
  id: number | string;
  name?: string;
  group_weight?: number | null;
  position?: number;
  assignments?: CanvasAssignment[];
}

export function canvasApi(baseUrl: string) {
  const base = normalizeCanvasUrl(baseUrl);
  return {
    courses: `${base}/api/v1/courses?enrollment_state=active&include[]=teachers&include[]=term&per_page=100`,
    groups: (courseId: string | number) => `${base}/api/v1/courses/${encodeURIComponent(String(courseId))}/assignment_groups?include[]=assignments&include[]=submission&per_page=100`,
    self: `${base}/api/v1/users/self`,
  };
}

/** Accepts "school.instructure.com" or a full URL; only https school domains are allowed. */
export function normalizeCanvasUrl(input: string): string {
  const raw = input.trim().replace(/\/+$/, "");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:") throw new Error("Canvas address must use https");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) || /^(localhost|127\.|10\.|192\.168\.)/.test(url.hostname))
    throw new Error("That doesn't look like a Canvas address");
  return `https://${url.hostname}`;
}

export function mapCanvas(courses: CanvasCourse[], groupsByCourse: Record<string, CanvasGroup[]>): MappedSchool {
  const out: MappedSchool = { courses: [], categories: [], items: [] };
  for (const c of courses) {
    if (c.access_restricted_by_date) continue;
    const cid = `canvas:course:${c.id}`;
    out.courses.push({
      externalId: cid,
      name: clip(c.name || c.course_code || "Canvas course", 80),
      teacher: clip(c.teachers?.[0]?.display_name, 80),
      room: "",
      gradingMode: c.apply_assignment_group_weights ? "weighted" : "points",
    });
    const groups = [...(groupsByCourse[String(c.id)] ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    groups.forEach((g, i) => {
      const gid = `canvas:group:${g.id}`;
      out.categories.push({
        externalId: gid,
        courseExternalId: cid,
        name: clip(g.name || "Assignments", 60),
        weight: Math.max(0, Math.min(100, Number(g.group_weight) || 0)),
        sort: i,
      });
      for (const a of g.assignments ?? []) {
        if (a.published === false || a.omit_from_final_grade) continue;
        const s = a.submission ?? {};
        const graded = typeof s.score === "number" && s.workflow_state !== "pending_review";
        out.items.push({
          externalId: `canvas:assignment:${a.id}`,
          courseExternalId: cid,
          categoryExternalId: gid,
          title: clip(a.name || "Assignment", 120),
          earned: graded ? (s.score as number) : null,
          possible: typeof a.points_possible === "number" ? a.points_possible : null,
          gradedOn: graded ? dateOnly(s.graded_at) : null,
          dueOn: dateOnly(a.due_at),
          excused: s.excused === true,
          missing: !graded && s.missing === true,
        });
      }
    });
  }
  return out;
}

export async function fetchCanvas(baseUrl: string, fetchJson: FetchJson): Promise<MappedSchool> {
  const api = canvasApi(baseUrl);
  const courses = (await fetchJson(api.courses)) as CanvasCourse[];
  const groups: Record<string, CanvasGroup[]> = {};
  for (const c of courses) {
    if (c.access_restricted_by_date) continue;
    groups[String(c.id)] = (await fetchJson(api.groups(c.id))) as CanvasGroup[];
  }
  return mapCanvas(courses, groups);
}
