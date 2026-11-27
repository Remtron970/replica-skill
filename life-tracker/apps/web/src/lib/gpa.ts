/**
 * Grade math used by the Home summary. Phase 4 extends this with configurable
 * scales, weighted (honors/AP) GPA and cumulative GPA.
 */

export interface ScaleBand {
  min: number;
  letter: string;
  points: number;
}

/** A common US scale (A ≥ 93). Schools differ; Phase 4 makes this editable. */
export const STANDARD_SCALE: ScaleBand[] = [
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
  { min: -Infinity, letter: "F", points: 0 },
];

export function bandFor(percent: number, scale: ScaleBand[] = STANDARD_SCALE): ScaleBand {
  return scale.find((b) => percent >= b.min) ?? scale[scale.length - 1];
}

export interface GradedCourse {
  percent: number;
  credits?: number;
}

/** Unweighted GPA, credit-weighted. Returns undefined when there are no courses. */
export function unweightedGpa(courses: GradedCourse[], scale: ScaleBand[] = STANDARD_SCALE): number | undefined {
  const graded = courses.filter((c) => Number.isFinite(c.percent));
  const credits = graded.reduce((s, c) => s + (c.credits ?? 1), 0);
  if (!credits) return undefined;
  const pts = graded.reduce((s, c) => s + bandFor(c.percent, scale).points * (c.credits ?? 1), 0);
  return Math.round((pts / credits) * 100) / 100;
}

export function averagePercent(courses: GradedCourse[]): number | undefined {
  const graded = courses.filter((c) => Number.isFinite(c.percent));
  if (!graded.length) return undefined;
  return Math.round((graded.reduce((s, c) => s + c.percent, 0) / graded.length) * 10) / 10;
}
