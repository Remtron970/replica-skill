// @vitest-environment node
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, importKey } from "../../../../supabase/functions/_shared/crypto.ts";
import { planSchoolSync, type Existing } from "../../../../supabase/functions/_shared/school/apply.ts";
import { mapCanvas, normalizeCanvasUrl } from "../../../../supabase/functions/_shared/school/canvas.ts";
import { mapClassroom } from "../../../../supabase/functions/_shared/school/classroom.ts";
import { nextLink, runSchoolSync, saveSecret, SyncError, type Integration } from "../../../../supabase/functions/_shared/school/runSync.ts";
import { signState, verifyState } from "../../../../supabase/functions/_shared/state.ts";
import { coursePercent } from "../features/academics/grades";
import { fakeDb } from "./fakeDb";

const KEY_B64 = btoa(String.fromCharCode(...new Uint8Array(32).map((_, i) => i + 1)));

// ---- Fixtures in the shape the platforms document ----
const canvasCourses = [
  { id: 101, name: "AP Biology", apply_assignment_group_weights: true, teachers: [{ display_name: "Ms. Rivera" }] },
  { id: 102, name: "Art", apply_assignment_group_weights: false, teachers: [] },
  { id: 103, name: "Old course", access_restricted_by_date: true },
];
const canvasGroups = {
  "101": [
    {
      id: 11, name: "Tests", group_weight: 60, position: 1,
      assignments: [
        { id: 1001, name: "Unit 1 test", points_possible: 100, due_at: "2026-09-20T05:59:59Z", submission: { score: 84, graded_at: "2026-09-22T15:00:00Z", workflow_state: "graded" } },
        { id: 1002, name: "Unit 2 test", points_possible: 100, due_at: "2026-11-30T05:59:59Z", submission: { score: null, workflow_state: "unsubmitted" } },
        { id: 1003, name: "Draft", points_possible: 50, published: false },
      ],
    },
    {
      id: 12, name: "Homework", group_weight: 40, position: 2,
      assignments: [
        { id: 1004, name: "HW 1", points_possible: 10, submission: { score: 10, graded_at: "2026-09-10T12:00:00Z", workflow_state: "graded" } },
        { id: 1005, name: "HW 2", points_possible: 10, submission: { score: null, missing: true, workflow_state: "unsubmitted" } },
        { id: 1006, name: "HW 3", points_possible: 10, submission: { score: null, excused: true } },
        { id: 1007, name: "Practice", points_possible: 10, omit_from_final_grade: true, submission: { score: 2 } },
      ],
    },
  ],
  "102": [],
};

describe("Canvas", () => {
  it("accepts school addresses and rejects unsafe ones", () => {
    expect(normalizeCanvasUrl("school.instructure.com")).toBe("https://school.instructure.com");
    expect(normalizeCanvasUrl("https://canvas.district.org/courses/5/")).toBe("https://canvas.district.org");
    expect(() => normalizeCanvasUrl("http://school.instructure.com")).toThrow(/https/);
    expect(() => normalizeCanvasUrl("localhost")).toThrow();
    expect(() => normalizeCanvasUrl("192.168.0.5")).toThrow();
  });

  it("maps courses, weighted groups and submissions", () => {
    const m = mapCanvas(canvasCourses as never, canvasGroups as never);
    expect(m.courses).toEqual([
      { externalId: "canvas:course:101", name: "AP Biology", teacher: "Ms. Rivera", room: "", gradingMode: "weighted" },
      { externalId: "canvas:course:102", name: "Art", teacher: "", room: "", gradingMode: "points" },
    ]);
    expect(m.categories.map((c) => [c.name, c.weight, c.sort])).toEqual([["Tests", 60, 0], ["Homework", 40, 1]]);
    const byTitle = Object.fromEntries(m.items.map((i) => [i.title, i]));
    expect(Object.keys(byTitle)).toEqual(["Unit 1 test", "Unit 2 test", "HW 1", "HW 2", "HW 3"]); // unpublished + omitted skipped
    expect(byTitle["Unit 1 test"]).toMatchObject({ earned: 84, possible: 100, gradedOn: "2026-09-22", dueOn: "2026-09-20", missing: false });
    expect(byTitle["Unit 2 test"]).toMatchObject({ earned: null, missing: false });
    expect(byTitle["HW 2"]).toMatchObject({ earned: null, missing: true });
    expect(byTitle["HW 3"]).toMatchObject({ excused: true });
  });

  it("follows Link-header pagination", () => {
    expect(nextLink('<https://x/api/v1/courses?page=2>; rel="next", <https://x/api/v1/courses?page=5>; rel="last"')).toBe("https://x/api/v1/courses?page=2");
    expect(nextLink('<https://x/api/v1/courses?page=5>; rel="last"')).toBeNull();
    expect(nextLink(null)).toBeNull();
  });
});

describe("Google Classroom", () => {
  const courses = [
    { id: "c1", name: "Chemistry", section: "Period 3", room: "Lab 2", gradebookSettings: { calculationType: "WEIGHTED_CATEGORIES", gradeCategories: [{ id: "g1", name: "Labs", weight: 250000 }, { id: "g2", name: "Tests", weight: 750000 }] } },
    { id: "c2", name: "Health", gradebookSettings: { calculationType: "TOTAL_POINTS" } },
  ];
  const data = {
    c1: {
      teachers: [{ profile: { name: { fullName: "Dr. Novak" } } }],
      work: [
        { id: "w1", title: "Lab 1", maxPoints: 20, dueDate: { year: 2026, month: 9, day: 10 }, state: "PUBLISHED", gradeCategory: { id: "g1" } },
        { id: "w2", title: "Lab 2", maxPoints: 20, dueDate: { year: 2026, month: 9, day: 17 }, state: "PUBLISHED", gradeCategory: { id: "g1" } },
        { id: "w3", title: "Test 1", maxPoints: 100, dueDate: { year: 2026, month: 12, day: 15 }, state: "PUBLISHED", gradeCategory: { id: "g2" } },
        { id: "w4", title: "Reading (ungraded)", state: "PUBLISHED" },
        { id: "w5", title: "Draft", maxPoints: 10, state: "DRAFT" },
      ],
      subs: [
        { courseWorkId: "w1", state: "RETURNED", assignedGrade: 18, updateTime: "2026-09-12T10:00:00Z" },
        { courseWorkId: "w2", state: "CREATED" },
        { courseWorkId: "w3", state: "TURNED_IN" },
      ],
    },
  };

  it("maps weights (stored ×10,000), grades and infers missing work like Classroom does", () => {
    const m = mapClassroom(courses as never, data as never, "2026-11-27");
    expect(m.courses[0]).toEqual({ externalId: "classroom:course:c1", name: "Chemistry — Period 3", teacher: "Dr. Novak", room: "Lab 2", gradingMode: "weighted" });
    expect(m.courses[1].gradingMode).toBe("points");
    expect(m.categories.map((c) => [c.name, c.weight])).toEqual([["Labs", 25], ["Tests", 75]]);
    expect(m.items.map((i) => [i.title, i.earned, i.missing])).toEqual([
      ["Lab 1", 18, false],
      ["Lab 2", null, true], // past due, not turned in
      ["Test 1", null, false], // turned in, not graded yet
    ]);
  });

  it("produces data the grade math understands", () => {
    const m = mapClassroom(courses as never, data as never, "2026-11-27");
    const base = { clientUpdatedAt: 1, deleted: false, source: "google_classroom" as const };
    const cats = m.categories.map((c, i) => ({ ...base, id: c.externalId, courseId: c.courseExternalId, name: c.name, weight: c.weight, sort: i }));
    const items = m.items.map((it) => ({ ...base, id: it.externalId, courseId: it.courseExternalId, categoryId: it.categoryExternalId, title: it.title, earned: it.earned, possible: it.possible, gradedOn: it.gradedOn, dueOn: it.dueOn, excused: it.excused, missing: it.missing, notes: "" }));
    // Labs: 18/40 (missing counts 0) = 45%; Tests: nothing graded → Labs only = 45%
    expect(coursePercent({ id: "classroom:course:c1", gradingMode: "weighted", manualPercent: null }, cats, items).percent).toBeCloseTo(45, 10);
  });
});

describe("assignments from school platforms", () => {
  it("Canvas: every published assignment is a task, with link, plain-text description and turned-in status", () => {
    const groups = structuredClone(canvasGroups) as unknown as Record<string, { assignments: Record<string, unknown>[] }[]>;
    Object.assign(groups["101"][0].assignments[0], { html_url: "https://school.instructure.com/courses/101/assignments/1001", description: "<p>Read <b>ch. 3</b> &amp; answer</p><p>Q1–5</p>" });
    groups["101"][0].assignments[1].html_url = "javascript:alert(1)";
    const m = mapCanvas(canvasCourses as never, groups as never);
    expect(m.assignments.map((a) => [a.title, a.submitted])).toEqual([
      ["Unit 1 test", true], ["Unit 2 test", false], ["HW 1", true], ["HW 2", false], ["HW 3", true], ["Practice", false],
    ]);
    expect(m.assignments[0]).toMatchObject({ dueAt: "2026-09-20T05:59:59Z", dueHasTime: true, url: "https://school.instructure.com/courses/101/assignments/1001", description: "Read ch. 3 & answer\nQ1–5" });
    expect(m.assignments[1].url).toBeNull(); // unsafe link dropped
    expect(m.items.map((i) => i.title)).not.toContain("Practice"); // still not counted as a grade
  });

  it("Classroom: due times are UTC; date-only due dates keep their calendar date; ungraded work is still a task", () => {
    const m = mapClassroom(
      [{ id: "c1", name: "Health" }] as never,
      {
        c1: {
          teachers: [],
          work: [
            { id: "w1", title: "Essay", maxPoints: 10, dueDate: { year: 2026, month: 12, day: 2 }, dueTime: { hours: 4, minutes: 59 }, state: "PUBLISHED", alternateLink: "https://classroom.google.com/c/x/a/w1" },
            { id: "w2", title: "Read chapter", dueDate: { year: 2026, month: 12, day: 3 }, state: "PUBLISHED" },
            { id: "w3", title: "No date", state: "PUBLISHED" },
          ],
          subs: [{ courseWorkId: "w1", state: "TURNED_IN" }],
        },
      } as never,
      "2026-11-27",
    );
    expect(m.assignments.map((a) => [a.title, a.dueAt, a.dueHasTime, a.submitted])).toEqual([
      ["Essay", "2026-12-02T04:59:00.000Z", true, true],
      ["Read chapter", "2026-12-03T12:00:00.000Z", false, false],
      ["No date", null, false, false],
    ]);
    expect(m.items.map((i) => i.title)).toEqual(["Essay"]);
  });

  it("a sync keeps your priority, progress and reminder on a synced assignment", () => {
    let k = 0;
    const o = { userId: "u1", source: "canvas" as const, now: "2026-11-27T12:00:00.000Z", newId: () => `n-${++k}` };
    const first = planSchoolSync(mapCanvas(canvasCourses as never, canvasGroups as never), { courses: [], grade_categories: [], grade_items: [], assignments: [] }, o);
    expect(first.assignments[0]).toMatchObject({ priority: "normal", status: "todo", reminder_minutes: null });
    const existing: Existing = {
      courses: first.courses as never,
      grade_categories: first.grade_categories as never,
      grade_items: first.grade_items as never,
      assignments: first.assignments.map((r) => ({ ...r, priority: "high", status: "done", reminder_minutes: 60 })) as never,
    };
    const groups = structuredClone(canvasGroups) as unknown as Record<string, { assignments: Record<string, unknown>[] }[]>;
    groups["101"][0].assignments[1].due_at = "2026-12-04T05:59:59Z"; // teacher extended the deadline
    const p = planSchoolSync(mapCanvas(canvasCourses as never, groups as never), existing, o);
    expect(p.assignments).toHaveLength(1);
    expect(p.assignments[0]).toMatchObject({ title: "Unit 2 test", due_at: "2026-12-04T05:59:59Z" });
    for (const k2 of ["priority", "status", "reminder_minutes", "completed_at"]) expect(p.assignments[0]).not.toHaveProperty(k2);
  });
});

describe("server refreshes vs. changes made on a device", () => {
  it("an update is stamped just after the row's time: devices see it, but a newer device edit still wins", () => {
    const o = { userId: "u1", source: "canvas" as const, now: "2026-11-27T12:00:00.000Z", newId: () => crypto.randomUUID() };
    const first = planSchoolSync(mapCanvas(canvasCourses as never, canvasGroups as never), { courses: [], grade_categories: [], grade_items: [], assignments: [] }, o);
    const prevTs = "2026-11-20T08:00:00.123456+00:00";
    const existing: Existing = {
      courses: first.courses.map((r) => ({ ...r, client_updated_at: prevTs })) as never,
      grade_categories: first.grade_categories.map((r) => ({ ...r, client_updated_at: prevTs })) as never,
      grade_items: first.grade_items.map((r) => ({ ...r, client_updated_at: prevTs })) as never,
      assignments: first.assignments.map((r) => ({ ...r, client_updated_at: prevTs })) as never,
    };
    const groups = structuredClone(canvasGroups) as unknown as Record<string, { assignments: Record<string, unknown>[] }[]>;
    groups["101"][0].assignments[1].due_at = "2026-12-04T05:59:59Z";
    const p = planSchoolSync(mapCanvas(canvasCourses as never, groups as never), existing, { ...o, now: "2026-11-27T12:00:00.000Z" });
    const stamped = Date.parse(p.assignments[0].client_updated_at as string);
    expect(stamped).toBeGreaterThan(Date.parse(prevTs)); // devices download it
    expect(stamped).toBeLessThan(Date.parse("2026-11-21T00:00:00Z")); // an edit made on a device after Nov 20 still wins
  });
});

describe("planSchoolSync", () => {
  const mapped = mapCanvas(canvasCourses as never, canvasGroups as never);
  let n = 0;
  const opts = { userId: "u1", source: "canvas" as const, now: "2026-11-27T12:00:00.000Z", newId: () => `id-${++n}` };
  const empty: Existing = { courses: [], grade_categories: [], grade_items: [], assignments: [] };

  it("first sync creates everything with sensible defaults", () => {
    const p = planSchoolSync(mapped, empty, opts);
    expect(p.courses).toHaveLength(2);
    expect(p.courses[0]).toMatchObject({ user_id: "u1", source: "canvas", external_id: "canvas:course:101", name: "AP Biology", grading_mode: "weighted", color: "blue", credits: 1, level: "regular" });
    expect(p.grade_categories).toHaveLength(2);
    expect(p.grade_items).toHaveLength(5);
    expect(p.grade_items[0].course_id).toBe(p.courses[0].id);
    expect(p.grade_items[0].category_id).toBe(p.grade_categories[0].id);
  });

  it("a repeat sync with nothing new writes nothing; changes write only what changed; your class settings are kept", () => {
    const first = planSchoolSync(mapped, empty, opts);
    const existing: Existing = {
      courses: first.courses.map((r) => ({ ...r, color: "green", level: "ap", credits: "1.00" })) as never,
      grade_categories: first.grade_categories.map((r) => ({ ...r, weight: String(r.weight) })) as never,
      grade_items: first.grade_items as never,
      assignments: first.assignments.map((r) => ({ ...r, due_at: typeof r.due_at === "string" ? (r.due_at as string).replace("Z", "+00:00") : r.due_at })) as never,
    };
    const again = planSchoolSync(mapped, existing, opts);
    expect([again.courses.length, again.grade_categories.length, again.grade_items.length, again.assignments.length]).toEqual([0, 0, 0, 0]);

    type Groups = Record<string, { assignments: { id: number; submission?: unknown }[] }[]>;
    const groups = structuredClone(canvasGroups) as unknown as Groups;
    groups["101"][0].assignments[1].submission = { score: 91, graded_at: "2026-11-27T09:00:00Z", workflow_state: "graded" };
    groups["101"][1].assignments = groups["101"][1].assignments.filter((a) => a.id !== 1006); // HW 3 removed by teacher
    const changed = planSchoolSync(mapCanvas(canvasCourses as never, groups as never), existing, opts);
    expect(changed.grade_items.map((r) => [r.title, r.earned])).toEqual([["Unit 2 test", 91]]);
    expect(changed.grade_items[0].id).toBe(existing.grade_items.find((r) => r.title === "Unit 2 test")!.id);
    expect(changed.deleted.grade_items).toEqual([existing.grade_items.find((r) => r.title === "HW 3")!.id]);

    const renamed = planSchoolSync(mapCanvas([{ ...canvasCourses[0], name: "AP Bio" }, canvasCourses[1]] as never, canvasGroups as never), existing, opts);
    expect(renamed.courses).toHaveLength(1);
    expect(renamed.courses[0]).not.toHaveProperty("color"); // user's color/level/credits untouched
    expect(renamed.courses[0]).not.toHaveProperty("level");
  });

  it("never touches grades you entered yourself", () => {
    const existing: Existing = { courses: [{ id: "mine", source: "manual", external_id: null, name: "Biology" }] as never, grade_categories: [], grade_items: [], assignments: [] };
    const p = planSchoolSync(mapped, existing, opts);
    expect(p.deleted.courses).toEqual([]);
    expect(p.courses.some((r) => r.id === "mine")).toBe(false);
  });
});

describe("token encryption", () => {
  it("round-trips, uses a fresh IV each time, and detects tampering", async () => {
    const key = await importKey(KEY_B64);
    const a = await encrypt(key, "secret-token-123");
    const b = await encrypt(key, "secret-token-123");
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(await decrypt(key, a.ciphertext, a.iv)).toBe("secret-token-123");
    const bad = a.ciphertext.slice(0, -4) + (a.ciphertext.endsWith("AAAA") ? "BBBB" : "AAAA");
    await expect(decrypt(key, bad, a.iv)).rejects.toThrow();
    await expect(importKey(btoa("short"))).rejects.toThrow(/32 bytes/);
  });
});

describe("OAuth state", () => {
  const user = "8b0f7a52-0000-4000-8000-000000000001";
  it("accepts a genuine state and rejects forged, tampered or expired ones", async () => {
    const s = await signState("k", user, 600, 1_000_000);
    expect(await verifyState("k", s, 1_000_000)).toBe(user);
    expect(await verifyState("other-key", s, 1_000_000)).toBeNull();
    expect(await verifyState("k", s.replace(user, "8b0f7a52-0000-4000-8000-000000000002"), 1_000_000)).toBeNull();
    expect(await verifyState("k", s, 1_000_000 + 601_000)).toBeNull();
    expect(await verifyState("k", "garbage", 1_000_000)).toBeNull();
  });
});

// ---- Full run with a fake database and a fake Canvas server ----
describe("runSchoolSync (end to end with fakes)", () => {
  const integration: Integration = { id: "int1", user_id: "u1", provider: "canvas", settings: { baseUrl: "https://school.instructure.com" } };

  it("fetches every page, writes classes and grades, and records success", async () => {
    const { db, tables } = fakeDb();
    const key = await importKey(KEY_B64);
    await saveSecret(db, key, "int1", "canvas-token-abcdefghijklmnop");
    const seen: string[] = [];
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      seen.push(url);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer canvas-token-abcdefghijklmnop");
      if (url.includes("/courses?") && !url.includes("page=2"))
        return new Response(JSON.stringify([canvasCourses[0]]), { headers: { link: `<${url}&page=2>; rel="next"` } });
      if (url.includes("page=2")) return new Response(JSON.stringify([canvasCourses[1]]));
      const id = url.match(/courses\/(\d+)\/assignment_groups/)![1];
      return new Response(JSON.stringify(canvasGroups[id as "101"]));
    }) as typeof fetch;
    const changed = await runSchoolSync(integration, { db, key, fetch: fakeFetch, now: () => new Date("2026-11-27T12:00:00Z") });
    expect(changed).toBe(2 + 2 + 5 + 6); // classes, categories, grades, assignments
    expect(tables.courses.map((c) => c.name)).toEqual(["AP Biology", "Art"]);
    expect(tables.grade_items).toHaveLength(5);
    expect(tables.integrations[0]).toMatchObject({ status: "connected", last_error: null });
    expect(tables.sync_runs[0]).toMatchObject({ status: "ok", items_upserted: 15 });
    expect(tables.assignments).toHaveLength(6);
    expect(seen.filter((u) => u.includes("assignment_groups"))).toHaveLength(2);
  });

  it("marks the connection as needing reconnection when access was revoked", async () => {
    const { db, tables } = fakeDb();
    const key = await importKey(KEY_B64);
    await saveSecret(db, key, "int1", "canvas-token-abcdefghijklmnop");
    const revoked = (async () => new Response("{}", { status: 401 })) as unknown as typeof fetch;
    await expect(runSchoolSync(integration, { db, key, fetch: revoked })).rejects.toBeInstanceOf(SyncError);
    expect(tables.integrations[0]).toMatchObject({ status: "expired" });
    expect(String(tables.integrations[0].last_error)).toMatch(/Reconnect/);
    expect(tables.sync_runs[0]).toMatchObject({ status: "error" });
  });
});
