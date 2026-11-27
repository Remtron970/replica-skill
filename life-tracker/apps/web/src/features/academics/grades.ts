import type { AcademicSettings } from "../../lib/sync";
import type { Course, GradeCategory, GradeItem, GradingScale, PastCourse, ScaleBand } from "./types";

/**
 * All grade math. Pure functions, unit-tested in grades.test.ts.
 *
 * Conventions (matching how most school portals calculate):
 *   - An item counts once it has a score. "Missing" items count as 0 until scored.
 *   - Excused items never count.
 *   - Points possible of 0 (or blank) with a score = extra credit.
 *   - Weighted categories without any graded work are left out, and the other
 *     weights are scaled up to fill in (re-normalized).
 */

// ---------------------------------------------------------------------------
// Grading scales
// ---------------------------------------------------------------------------
export interface PresetScale {
  id: string;
  name: string;
  bands: ScaleBand[];
}

export const PRESET_SCALES: PresetScale[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Plus/minus · A = 93–100",
    bands: [
      { min: 93, letter: "A", points: 4.0 },
      { min: 90, letter: "A-", points: 3.7 },
      { min: 87, letter: "B+", points: 3.3 },
      { min: 83, letter: "B", points: 3.0 },
      { min: 80, letter: "B-", points: 2.7 },
      { min: 77, letter: "C+", points: 2.3 },
      { min: 73, letter: "C", points: 2.0 },
      { min: 70, letter: "C-", points: 1.7 },
      { min: 67, letter: "D+", points: 1.3 },
      { min: 63, letter: "D", points: 1.0 },
      { min: 60, letter: "D-", points: 0.7 },
      { min: 0, letter: "F", points: 0 },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Letters only · A = 90–100",
    bands: [
      { min: 90, letter: "A", points: 4 },
      { min: 80, letter: "B", points: 3 },
      { min: 70, letter: "C", points: 2 },
      { min: 60, letter: "D", points: 1 },
      { min: 0, letter: "F", points: 0 },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "7-point · A = 93–100",
    bands: [
      { min: 93, letter: "A", points: 4 },
      { min: 85, letter: "B", points: 3 },
      { min: 77, letter: "C", points: 2 },
      { min: 70, letter: "D", points: 1 },
      { min: 0, letter: "F", points: 0 },
    ],
  },
];

/** Sort bands highest first and make sure there's a bottom band. */
export function normalizeBands(bands: ScaleBand[]): ScaleBand[] {
  const sorted = [...bands].filter((b) => Number.isFinite(b.min) && b.letter.trim()).sort((a, b) => b.min - a.min);
  if (!sorted.length || sorted[sorted.length - 1].min > 0) sorted.push({ min: 0, letter: "F", points: 0 });
  return sorted;
}

export function resolveScale(scaleId: string | null | undefined, custom: GradingScale[], fallbackId: string): ScaleBand[] {
  const id = scaleId ?? fallbackId;
  const found = PRESET_SCALES.find((s) => s.id === id)?.bands ?? custom.find((s) => s.id === id && !s.deleted)?.bands;
  if (found) return normalizeBands(found);
  if (id !== fallbackId) return resolveScale(fallbackId, custom, PRESET_SCALES[0].id);
  return PRESET_SCALES[0].bands;
}

export function bandFor(percent: number, bands: ScaleBand[]): ScaleBand {
  const sorted = normalizeBands(bands);
  // Round to 2 decimals first so 92.999999 (floating point) doesn't drop a letter.
  const p = Math.round(percent * 100) / 100;
  return sorted.find((b) => p >= b.min) ?? sorted[sorted.length - 1];
}

// ---------------------------------------------------------------------------
// Course percentage
// ---------------------------------------------------------------------------
export interface CategoryResult {
  id: string | null;
  name: string;
  weight: number;
  earned: number;
  possible: number;
  /** null = nothing graded yet in this category */
  percent: number | null;
  count: number;
}

export interface CourseResult {
  /** null = no graded work yet (or no portal percentage entered) */
  percent: number | null;
  graded: number;
  missing: number;
  categories: CategoryResult[];
  /** Graded items that don't belong to any weighted category, so they can't count. */
  uncounted: number;
}

/** Score that counts for an item, or null if it doesn't count. */
export function countedScore(it: Pick<GradeItem, "earned" | "possible" | "excused" | "missing">): { earned: number; possible: number } | null {
  if (it.excused) return null;
  const possible = it.possible && it.possible > 0 ? it.possible : 0;
  if (it.earned == null) return it.missing && possible > 0 ? { earned: 0, possible } : null;
  return { earned: it.earned, possible };
}

export function coursePercent(course: Pick<Course, "id" | "gradingMode" | "manualPercent">, categories: GradeCategory[], items: GradeItem[]): CourseResult {
  const mine = items.filter((i) => i.courseId === course.id && !i.deleted);
  const cats = categories.filter((c) => c.courseId === course.id && !c.deleted).sort((a, b) => a.sort - b.sort);
  const missing = mine.filter((i) => i.missing && i.earned == null && !i.excused).length;
  const scored = mine.map((i) => ({ i, s: countedScore(i) })).filter((x) => x.s) as { i: GradeItem; s: { earned: number; possible: number } }[];

  const catResults: CategoryResult[] = cats.map((c) => {
    const xs = scored.filter((x) => x.i.categoryId === c.id);
    const earned = xs.reduce((a, x) => a + x.s.earned, 0);
    const possible = xs.reduce((a, x) => a + x.s.possible, 0);
    return { id: c.id, name: c.name, weight: c.weight, earned, possible, count: xs.length, percent: possible > 0 ? (earned / possible) * 100 : null };
  });
  const loose = scored.filter((x) => !x.i.categoryId || !cats.some((c) => c.id === x.i.categoryId));

  if (course.gradingMode === "manual") {
    return { percent: course.manualPercent ?? null, graded: scored.length, missing, categories: catResults, uncounted: 0 };
  }

  if (course.gradingMode === "weighted" && cats.length) {
    const active = catResults.filter((c) => c.percent !== null && c.weight > 0);
    const totalWeight = active.reduce((a, c) => a + c.weight, 0);
    const percent = totalWeight > 0 ? active.reduce((a, c) => a + c.weight * (c.percent as number), 0) / totalWeight : null;
    return { percent, graded: scored.length, missing, categories: catResults, uncounted: loose.length };
  }

  // Points (also used for "weighted" with no categories set up yet).
  const earned = scored.reduce((a, x) => a + x.s.earned, 0);
  const possible = scored.reduce((a, x) => a + x.s.possible, 0);
  return { percent: possible > 0 ? (earned / possible) * 100 : null, graded: scored.length, missing, categories: catResults, uncounted: 0 };
}

// ---------------------------------------------------------------------------
// What do I need? (solve for the score on one new assignment)
// ---------------------------------------------------------------------------
export type NeedResult =
  | { kind: "needed"; earned: number; percentOfItem: number }
  | { kind: "secured" } // even a 0 keeps the target
  | { kind: "unreachable"; best: number } // best possible % with a perfect score
  | { kind: "unknown" }; // can't compute (portal-percentage classes)

export function scoreNeeded(
  course: Pick<Course, "id" | "gradingMode" | "manualPercent">,
  categories: GradeCategory[],
  items: GradeItem[],
  target: number,
  next: { possible: number; categoryId: string | null },
): NeedResult {
  if (course.gradingMode === "manual" || !(next.possible > 0)) return { kind: "unknown" };
  const trial = (earned: number) =>
    coursePercent(course, categories, [
      ...items,
      { id: "__next__", courseId: course.id, categoryId: next.categoryId, title: "next", earned, possible: next.possible, excused: false, missing: false, gradedOn: null, dueOn: null, notes: "", clientUpdatedAt: 0, deleted: false, source: "manual" },
    ]).percent ?? 0;
  const atZero = trial(0);
  const atFull = trial(next.possible);
  if (atZero >= target) return { kind: "secured" };
  if (atFull < target) return { kind: "unreachable", best: atFull };
  // The course % is linear in this one score, so interpolate exactly.
  const earned = ((target - atZero) / (atFull - atZero)) * next.possible;
  const rounded = Math.ceil(earned * 100 - 1e-6) / 100;
  return { kind: "needed", earned: rounded, percentOfItem: (rounded / next.possible) * 100 };
}

// ---------------------------------------------------------------------------
// GPA
// ---------------------------------------------------------------------------
export interface GpaEntry {
  credits: number;
  level: Course["level"];
  /** Unweighted grade points for the final/current grade. */
  points: number;
}

export interface Gpa {
  unweighted: number | null;
  weighted: number | null;
  credits: number;
}

export function gpaOf(entries: GpaEntry[], bonus: AcademicSettings["bonus"]): Gpa {
  const counted = entries.filter((e) => e.credits > 0 && Number.isFinite(e.points));
  const credits = counted.reduce((a, e) => a + e.credits, 0);
  if (!credits) return { unweighted: null, weighted: null, credits: 0 };
  const sum = (w: boolean) =>
    counted.reduce((a, e) => a + (e.points + (w && e.points > 0 ? bonus[e.level] ?? 0 : 0)) * e.credits, 0) / credits;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return { unweighted: r2(sum(false)), weighted: r2(sum(true)), credits };
}

export interface CourseSummary {
  course: Course;
  result: CourseResult;
  letter: string | null;
  points: number | null;
  bands: ScaleBand[];
}

export function summarizeCourses(
  courses: Course[],
  categories: GradeCategory[],
  items: GradeItem[],
  scales: GradingScale[],
  settings: AcademicSettings,
): CourseSummary[] {
  return courses
    .filter((c) => !c.deleted)
    .map((course) => {
      const bands = resolveScale(course.scaleId, scales, settings.scaleId);
      const result = coursePercent(course, categories, items);
      const band = result.percent === null ? null : bandFor(result.percent, bands);
      return { course, result, bands, letter: band?.letter ?? null, points: band?.points ?? null };
    });
}

/** GPA for the given classes (those with a grade), plus past terms for cumulative. */
export function termGpa(summaries: CourseSummary[], settings: AcademicSettings): Gpa {
  return gpaOf(
    summaries.filter((s) => s.points !== null).map((s) => ({ credits: s.course.credits, level: s.course.level, points: s.points as number })),
    settings.bonus,
  );
}

export function cumulativeGpa(current: CourseSummary[], past: PastCourse[], settings: AcademicSettings): Gpa {
  const entries: GpaEntry[] = [
    ...current.filter((s) => s.points !== null).map((s) => ({ credits: s.course.credits, level: s.course.level, points: s.points as number })),
    ...past.filter((p) => !p.deleted).map((p) => ({ credits: p.credits, level: p.level, points: p.points })),
  ];
  return gpaOf(entries, settings.bonus);
}

export function averageOf(summaries: CourseSummary[]): number | null {
  const ps = summaries.map((s) => s.result.percent).filter((p): p is number => p !== null);
  return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null;
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
export interface HistoryPoint {
  date: string; // YYYY-MM-DD
  percent: number;
}

/** The course percentage after each day that had a newly graded item. */
export function gradeHistory(course: Course, categories: GradeCategory[], items: GradeItem[]): HistoryPoint[] {
  if (course.gradingMode === "manual") return [];
  const mine = items.filter((i) => i.courseId === course.id && !i.deleted && countedScore(i));
  const dated = mine.map((i) => ({ i, d: i.gradedOn ?? i.dueOn })).filter((x): x is { i: GradeItem; d: string } => !!x.d);
  const days = [...new Set(dated.map((x) => x.d))].sort();
  const out: HistoryPoint[] = [];
  for (const day of days) {
    const upTo = dated.filter((x) => x.d <= day).map((x) => x.i);
    const p = coursePercent(course, categories, upTo).percent;
    if (p !== null) out.push({ date: day, percent: Math.round(p * 10) / 10 });
  }
  return out;
}

/** Change in percentage over roughly the last `days` days (null if not enough history). */
export function recentChange(history: HistoryPoint[], today: string, days = 14): number | null {
  if (history.length < 2) return null;
  const cutoff = new Date(`${today}T00:00:00`);
  cutoff.setDate(cutoff.getDate() - days);
  const iso = localDate(cutoff);
  const before = [...history].reverse().find((h) => h.date <= iso) ?? history[0];
  const last = history[history.length - 1];
  if (before === last) return null;
  return Math.round((last.percent - before.percent) * 10) / 10;
}

/** YYYY-MM-DD in local time (not UTC, which can be a different day). */
export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const formatPercent = (p: number | null, digits = 1) => (p === null ? "—" : `${p.toFixed(digits)}%`);
export const formatGpa = (g: number | null) => (g === null ? "—" : g.toFixed(2));
