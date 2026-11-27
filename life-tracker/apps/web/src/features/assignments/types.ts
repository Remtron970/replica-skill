import type { SyncRecord } from "../../lib/store/collection";

export type Priority = "low" | "normal" | "high";
export type AssignmentStatus = "todo" | "doing" | "done";

export interface Assignment extends SyncRecord {
  courseId: string | null;
  title: string;
  description: string;
  /** ISO timestamp; null = no due date */
  dueAt: string | null;
  /** false = only the date is known (treated as 11:59 PM) */
  dueHasTime: boolean;
  priority: Priority;
  /** The student's own progress. */
  status: AssignmentStatus;
  completedAt: string | null;
  /** Turned in, according to Canvas/Classroom. */
  submitted: boolean;
  url: string | null;
  /** Minutes before the due time to remind; null = none. */
  reminderMinutes: number | null;
}
