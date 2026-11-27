import type { SyncRecord } from "../../lib/store/collection";

export type CourseLevel = "regular" | "honors" | "ap" | "ib" | "dual" | "other";
export type GradingMode = "points" | "weighted" | "manual";

export interface ScaleBand {
  /** Lowest percentage that earns this letter. */
  min: number;
  letter: string;
  /** Unweighted grade points (4.0 scale). */
  points: number;
}

export interface Term extends SyncRecord {
  name: string;
  startsOn: string | null; // YYYY-MM-DD
  endsOn: string | null;
  isCurrent: boolean;
}

export interface GradingScale extends SyncRecord {
  name: string;
  bands: ScaleBand[];
}

export interface Course extends SyncRecord {
  termId: string | null;
  name: string;
  teacher: string;
  room: string;
  color: string;
  credits: number;
  level: CourseLevel;
  gradingMode: GradingMode;
  /** The percentage from the school portal, used when gradingMode is "manual". */
  manualPercent: number | null;
  scaleId: string | null;
  archived: boolean;
}

export interface GradeCategory extends SyncRecord {
  courseId: string;
  name: string;
  /** Percent of the course grade (0–100). */
  weight: number;
  sort: number;
}

export interface GradeItem extends SyncRecord {
  courseId: string;
  categoryId: string | null;
  title: string;
  /** null = not graded yet */
  earned: number | null;
  possible: number | null;
  gradedOn: string | null; // YYYY-MM-DD
  dueOn: string | null;
  excused: boolean;
  missing: boolean;
  notes: string;
}

/** Final grade from an earlier term (for cumulative GPA). */
export interface PastCourse extends SyncRecord {
  termName: string;
  name: string;
  credits: number;
  level: CourseLevel;
  letter: string;
  points: number;
}

export const LEVEL_LABEL: Record<CourseLevel, string> = {
  regular: "Regular",
  honors: "Honors",
  ap: "AP",
  ib: "IB",
  dual: "Dual enrollment",
  other: "Other",
};

export const COURSE_COLORS = ["purple", "blue", "green", "orange", "red", "yellow"] as const;
