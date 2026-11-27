import { describe, expect, it } from "vitest";
import { DEFAULT_ACADEMIC } from "../../lib/sync";
import {
  PRESET_SCALES,
  bandFor,
  coursePercent,
  cumulativeGpa,
  gpaOf,
  gradeHistory,
  recentChange,
  resolveScale,
  scoreNeeded,
  summarizeCourses,
  termGpa,
} from "./grades";
import type { Course, GradeCategory, GradeItem, PastCourse } from "./types";

const base = { clientUpdatedAt: 1, deleted: false, source: "manual" as const };
const course = (o: Partial<Course> = {}): Course => ({
  ...base, id: "c1", termId: null, name: "Biology", teacher: "", room: "", color: "purple", credits: 1, level: "regular",
  gradingMode: "points", manualPercent: null, scaleId: null, archived: false, ...o,
});
let n = 0;
const item = (o: Partial<GradeItem>): GradeItem => ({
  ...base, id: `i${++n}`, courseId: "c1", categoryId: null, title: "x", earned: null, possible: null,
  gradedOn: null, dueOn: null, excused: false, missing: false, notes: "", ...o,
});
const cat = (id: string, weight: number, sort = 0): GradeCategory => ({ ...base, id, courseId: "c1", name: id, weight, sort });

describe("course percentage — points", () => {
  it("total earned ÷ total possible", () => {
    // (18 + 45) / (20 + 50) = 63/70 = 90%
    const r = coursePercent(course(), [], [item({ earned: 18, possible: 20 }), item({ earned: 45, possible: 50 })]);
    expect(r.percent).toBeCloseTo(90, 10);
    expect(r.graded).toBe(2);
  });

  it("ungraded items don't count; missing counts as zero; excused never counts", () => {
    // counted: 9/10 and missing 0/10 → 9/20 = 45%
    const r = coursePercent(course(), [], [
      item({ earned: 9, possible: 10 }),
      item({ earned: null, possible: 10 }),
      item({ earned: null, possible: 10, missing: true }),
      item({ earned: 0, possible: 10, excused: true }),
    ]);
    expect(r.percent).toBeCloseTo(45, 10);
    expect(r.missing).toBe(1);
  });

  it("extra credit (points out of 0) adds to the total", () => {
    // (45 + 5) / 50 = 100%
    expect(coursePercent(course(), [], [item({ earned: 45, possible: 50 }), item({ earned: 5, possible: 0 })]).percent).toBeCloseTo(100, 10);
  });

  it("no graded work yet → no percentage (not 0%)", () => {
    expect(coursePercent(course(), [], [item({ possible: 10 })]).percent).toBeNull();
  });

  it("ignores other courses and deleted items", () => {
    expect(coursePercent(course(), [], [item({ earned: 8, possible: 10 }), item({ courseId: "c2", earned: 0, possible: 10 }), item({ earned: 0, possible: 10, deleted: true })]).percent).toBeCloseTo(80, 10);
  });
});

describe("course percentage — weighted categories", () => {
  const c = course({ gradingMode: "weighted" });
  const cats = [cat("tests", 50, 0), cat("hw", 30, 1), cat("labs", 20, 2)];

  it("weights each category's percentage", () => {
    // tests 80%, hw 100%, labs 90% → 0.5*80 + 0.3*100 + 0.2*90 = 88
    const r = coursePercent(c, cats, [
      item({ categoryId: "tests", earned: 80, possible: 100 }),
      item({ categoryId: "hw", earned: 10, possible: 10 }),
      item({ categoryId: "labs", earned: 18, possible: 20 }),
    ]);
    expect(r.percent).toBeCloseTo(88, 10);
    expect(r.categories.map((x) => x.percent)).toEqual([80, 100, 90]);
  });

  it("scales the weights up when a category has no grades yet", () => {
    // labs empty → (0.5*80 + 0.3*100) / 0.8 = 70/0.8 = 87.5
    const r = coursePercent(c, cats, [item({ categoryId: "tests", earned: 80, possible: 100 }), item({ categoryId: "hw", earned: 10, possible: 10 })]);
    expect(r.percent).toBeCloseTo(87.5, 10);
  });

  it("reports graded work outside any category as uncounted", () => {
    const r = coursePercent(c, cats, [item({ categoryId: "tests", earned: 90, possible: 100 }), item({ earned: 0, possible: 100 })]);
    expect(r.percent).toBeCloseTo(90, 10);
    expect(r.uncounted).toBe(1);
  });

  it("falls back to points when no categories are set up", () => {
    expect(coursePercent(c, [], [item({ earned: 7, possible: 10 })]).percent).toBeCloseTo(70, 10);
  });
});

describe("portal percentage (manual)", () => {
  it("uses the number from the school portal", () => {
    expect(coursePercent(course({ gradingMode: "manual", manualPercent: 91.4 }), [], [item({ earned: 0, possible: 10 })]).percent).toBe(91.4);
    expect(coursePercent(course({ gradingMode: "manual", manualPercent: null }), [], []).percent).toBeNull();
  });
});

describe("letters and scales", () => {
  const std = PRESET_SCALES[0].bands;
  it("maps percentages on the plus/minus scale, with exact boundaries", () => {
    expect(bandFor(93, std).letter).toBe("A");
    expect(bandFor(92.99, std).letter).toBe("A-");
    expect(bandFor(89.999999, std).letter).toBe("A-"); // floating-point noise rounds to 90.00
    expect(bandFor(59.9, std).letter).toBe("F");
    expect(bandFor(105, std).letter).toBe("A");
  });
  it("supports other scales", () => {
    expect(bandFor(85, PRESET_SCALES[1].bands).letter).toBe("B");
    expect(bandFor(85, PRESET_SCALES[2].bands).letter).toBe("B");
    expect(bandFor(84, PRESET_SCALES[2].bands).letter).toBe("C");
  });
  it("resolves a class's own scale, the default, or the built-in", () => {
    const custom = [{ ...base, id: "s1", name: "Mine", bands: [{ min: 50, letter: "P", points: 4 }] }];
    expect(resolveScale("s1", custom, PRESET_SCALES[0].id).map((b) => b.letter)).toEqual(["P", "F"]);
    expect(resolveScale(null, custom, PRESET_SCALES[1].id)).toEqual(PRESET_SCALES[1].bands);
    expect(resolveScale("gone", custom, "also-gone")).toEqual(PRESET_SCALES[0].bands);
  });
});

describe("GPA", () => {
  const bonus = DEFAULT_ACADEMIC.bonus;
  it("credit-weighted unweighted and weighted GPA", () => {
    // A (4.0) AP 1 credit, B (3.0) regular 1 credit, A- (3.7) honors 0.5 credit
    // unweighted: (4 + 3 + 1.85) / 2.5 = 3.54 ; weighted: (5 + 3 + 0.5*4.2) / 2.5 = 4.04
    const g = gpaOf([{ credits: 1, level: "ap", points: 4 }, { credits: 1, level: "regular", points: 3 }, { credits: 0.5, level: "honors", points: 3.7 }], bonus);
    expect(g).toEqual({ unweighted: 3.54, weighted: 4.04, credits: 2.5 });
  });
  it("no bonus on a failing grade; zero-credit classes ignored; empty → null", () => {
    expect(gpaOf([{ credits: 1, level: "ap", points: 0 }, { credits: 1, level: "regular", points: 4 }], bonus).weighted).toBe(2);
    expect(gpaOf([{ credits: 0, level: "regular", points: 0 }, { credits: 1, level: "regular", points: 3 }], bonus).unweighted).toBe(3);
    expect(gpaOf([], bonus)).toEqual({ unweighted: null, weighted: null, credits: 0 });
  });
  it("term and cumulative GPA from classes and past terms", () => {
    const courses = [course({ id: "c1", level: "honors" }), course({ id: "c2" }), course({ id: "c3" })];
    const items = [item({ courseId: "c1", earned: 95, possible: 100 }), item({ courseId: "c2", earned: 85, possible: 100 })]; // c3 ungraded
    const sums = summarizeCourses(courses, [], items, [], DEFAULT_ACADEMIC);
    expect(sums.map((s) => s.letter)).toEqual(["A", "B", null]);
    expect(termGpa(sums, DEFAULT_ACADEMIC)).toEqual({ unweighted: 3.5, weighted: 3.75, credits: 2 });
    const past: PastCourse[] = [{ ...base, id: "p1", termName: "Spring 2026", name: "Art", credits: 2, level: "regular", letter: "C", points: 2 }];
    // (4 + 3 + 2*2) / 4 = 2.75
    expect(cumulativeGpa(sums, past, DEFAULT_ACADEMIC).unweighted).toBe(2.75);
  });
});

describe("score needed (what-if)", () => {
  it("points: solves exactly for the target", () => {
    // have 80/100; next is out of 100; want 85% → (80 + x)/200 = 0.85 → x = 90
    const r = scoreNeeded(course(), [], [item({ earned: 80, possible: 100 })], 85, { possible: 100, categoryId: null });
    expect(r).toEqual({ kind: "needed", earned: 90, percentOfItem: 90 });
  });
  it("weighted: the new score only moves its own category", () => {
    // tests 70/100 (50%), hw 100% (50%). Final test out of 100, want 85%:
    // 0.5*(70+x)/200*100 + 0.5*100 = 85 → (70+x)/2 = 70 → x = 70
    const c = course({ gradingMode: "weighted" });
    const r = scoreNeeded(c, [cat("tests", 50), cat("hw", 50)], [item({ categoryId: "tests", earned: 70, possible: 100 }), item({ categoryId: "hw", earned: 10, possible: 10 })], 85, { possible: 100, categoryId: "tests" });
    expect(r.kind).toBe("needed");
    if (r.kind === "needed") expect(r.earned).toBeCloseTo(70, 2);
  });
  it("tells you when it's already secured or out of reach", () => {
    expect(scoreNeeded(course(), [], [item({ earned: 100, possible: 100 })], 40, { possible: 50, categoryId: null }).kind).toBe("secured");
    const r = scoreNeeded(course(), [], [item({ earned: 50, possible: 100 })], 90, { possible: 50, categoryId: null });
    expect(r.kind).toBe("unreachable");
    if (r.kind === "unreachable") expect(r.best).toBeCloseTo(66.67, 2);
  });
  it("can't solve for portal-percentage classes", () => {
    expect(scoreNeeded(course({ gradingMode: "manual", manualPercent: 90 }), [], [], 90, { possible: 10, categoryId: null }).kind).toBe("unknown");
  });
});

describe("history", () => {
  it("percentage after each graded day, in order", () => {
    const h = gradeHistory(course(), [], [
      item({ earned: 10, possible: 10, gradedOn: "2026-09-10" }),
      item({ earned: 5, possible: 10, gradedOn: "2026-09-20" }),
      item({ earned: 9, possible: 10, dueOn: "2026-09-15" }),
      item({ earned: 0, possible: 10 }), // undated: counts now, not in history
    ]);
    expect(h).toEqual([
      { date: "2026-09-10", percent: 100 },
      { date: "2026-09-15", percent: 95 },
      { date: "2026-09-20", percent: 80 },
    ]);
  });
  it("recent change compares with ~2 weeks ago", () => {
    const h = [{ date: "2026-11-01", percent: 85 }, { date: "2026-11-10", percent: 88 }, { date: "2026-11-25", percent: 91 }];
    expect(recentChange(h, "2026-11-27")).toBe(3); // vs 11-10 (latest on/before 11-13)
    expect(recentChange([{ date: "2026-11-25", percent: 91 }], "2026-11-27")).toBeNull();
  });
});
