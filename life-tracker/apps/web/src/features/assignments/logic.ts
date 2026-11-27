import { dueDate } from "../home/homeData";
import type { Assignment } from "./types";

export type Bucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "nodate" | "done";

export const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Due today" },
  { id: "tomorrow", label: "Due tomorrow" },
  { id: "week", label: "This week" },
  { id: "later", label: "Later" },
  { id: "nodate", label: "No due date" },
  { id: "done", label: "Done" },
];

export const isDone = (a: Pick<Assignment, "status" | "submitted">) => a.status === "done" || a.submitted;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DAY = 86_400_000;

export function bucketOf(a: Assignment, now: Date): Bucket {
  if (isDone(a)) return "done";
  const due = dueDate(a);
  if (!due) return "nodate";
  if (due.getTime() < now.getTime()) return "overdue";
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "week";
  return "later";
}

export function formatDue(a: Assignment, now: Date): string {
  const due = dueDate(a);
  if (!due) return "No due date";
  const days = Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY);
  const time = a.dueHasTime ? due.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
  const day =
    days === 0 ? "Today" : days === 1 ? "Tomorrow" : days === -1 ? "Yesterday" : days > 1 && days < 7 ? due.toLocaleDateString(undefined, { weekday: "long" }) : due.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const text = time ? `${day}, ${time}` : day;
  return due.getTime() < now.getTime() && !isDone(a) ? `Was due ${text.charAt(0).toLowerCase()}${text.slice(1)}` : `Due ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

/** Group, sorting each group by due date (soonest first; done: most recent first). */
export function groupAssignments(list: Assignment[], now: Date) {
  const groups = new Map<Bucket, Assignment[]>(BUCKETS.map((b) => [b.id, []]));
  for (const a of list) if (!a.deleted) groups.get(bucketOf(a, now))!.push(a);
  const t = (a: Assignment) => dueDate(a)?.getTime() ?? Infinity;
  const pr = { high: 0, normal: 1, low: 2 };
  for (const [k, xs] of groups) xs.sort((x, y) => (k === "done" ? t(y) - t(x) : t(x) - t(y) || pr[x.priority] - pr[y.priority] || x.title.localeCompare(y.title)));
  return groups;
}

export const REMINDER_CHOICES: { value: number | null; label: string }[] = [
  { value: null, label: "No reminder" },
  { value: 15, label: "15 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
  { value: 2880, label: "2 days before" },
];

export function reminderAt(a: Assignment): Date | null {
  const due = dueDate(a);
  if (!due || a.reminderMinutes == null) return null;
  return new Date(due.getTime() - a.reminderMinutes * 60_000);
}

/** Reminders that came due in (from, to], for assignments still to do. */
export function dueReminders(list: Assignment[], from: Date, to: Date): Assignment[] {
  return list.filter((a) => {
    if (a.deleted || isDone(a)) return false;
    const r = reminderAt(a);
    return !!r && r.getTime() > from.getTime() && r.getTime() <= to.getTime();
  });
}
