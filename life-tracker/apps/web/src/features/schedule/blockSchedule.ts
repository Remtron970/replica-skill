import type { SyncRecord } from "../../lib/store/collection";
import type { ClassBlock, Occurrence } from "../../lib/schedule";
import { localDate } from "../academics/grades";

/**
 * Block-schedule model, covering the common patterns:
 *   - "Modified block": Monday = all classes (short periods), other days rotate A/B
 *   - A/B (or A/B/C…) rotation that continues across weeks, skipping days off
 *   - fixed weekly patterns (Tue/Thu = A, Wed/Fri = B)
 *   - plain schedules (every day the same)
 * Pure functions; unit-tested in blockSchedule.test.ts.
 */

export interface DayType extends SyncRecord {
  name: string; // "A day"
  short: string; // "A"
  sort: number;
}

export interface ScheduleBlock extends SyncRecord {
  dayTypeId: string;
  courseId: string | null;
  title: string;
  room: string;
  teacher: string;
  start: string; // "HH:MM"
  end: string;
}

export interface ScheduleException extends SyncRecord {
  date: string; // YYYY-MM-DD
  /** no_school: holiday/break; day_type: this date runs as `dayTypeId` */
  kind: "no_school" | "day_type";
  dayTypeId: string | null;
  note: string;
}

/** How day types are assigned to dates. Synced with the other preferences. */
export interface ScheduleSettings {
  /** Weekdays with school (0 = Sunday). */
  schoolDays: number[];
  /** Weekdays that always use one day type, e.g. { "1": <all-classes id> } for Monday. */
  fixed: Record<string, string>;
  /** Day types that rotate through the other school days, in order (e.g. [A, B]). */
  rotation: string[];
  /** A school date whose rotation position is known… */
  anchorDate: string | null;
  /** …and its index in `rotation` (e.g. 0 = it was an A day). */
  anchorIndex: number;
  /** Optional first/last day of classes; outside it there's no school. */
  termStart: string | null;
  termEnd: string | null;
}

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  schoolDays: [1, 2, 3, 4, 5],
  fixed: {},
  rotation: [],
  anchorDate: null,
  anchorIndex: 0,
  termStart: null,
  termEnd: null,
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeScheduleSettings(raw: unknown): ScheduleSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ScheduleSettings>;
  const days = Array.isArray(r.schoolDays) ? [...new Set(r.schoolDays.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : DEFAULT_SCHEDULE_SETTINGS.schoolDays;
  const fixed: Record<string, string> = {};
  if (r.fixed && typeof r.fixed === "object")
    for (const [k, v] of Object.entries(r.fixed)) if (/^[0-6]$/.test(k) && typeof v === "string" && v) fixed[k] = v;
  const rotation = Array.isArray(r.rotation) ? r.rotation.filter((x): x is string => typeof x === "string" && !!x).slice(0, 12) : [];
  const date = (v: unknown) => (typeof v === "string" && DATE_RE.test(v) ? v : null);
  const idx = typeof r.anchorIndex === "number" && Number.isInteger(r.anchorIndex) && r.anchorIndex >= 0 ? r.anchorIndex : 0;
  return {
    schoolDays: days,
    fixed,
    rotation,
    anchorDate: date(r.anchorDate),
    anchorIndex: rotation.length ? idx % rotation.length : 0,
    termStart: date(r.termStart),
    termEnd: date(r.termEnd),
  };
}

export type DayInfo =
  | { school: true; dayTypeId: string; why: "fixed" | "rotation" | "exception" }
  | { school: false; why: "weekend" | "no_school" | "outside_term" | "not_set_up"; note?: string };

function addDays(d: Date, n: number) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return x;
}

function parseDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export class ScheduleCalendar {
  private exceptions: Map<string, ScheduleException>;
  private types: Set<string>;

  constructor(
    readonly settings: ScheduleSettings,
    exceptions: ScheduleException[],
    dayTypes: DayType[],
  ) {
    this.exceptions = new Map(exceptions.filter((e) => !e.deleted).map((e) => [e.date, e]));
    this.types = new Set(dayTypes.filter((t) => !t.deleted).map((t) => t.id));
  }

  /** Is this a school day that takes the next rotation slot? */
  private rotates(d: Date) {
    const s = this.settings;
    const iso = localDate(d);
    if (!s.schoolDays.includes(d.getDay())) return false;
    if (s.fixed[String(d.getDay())]) return false;
    if ((s.termStart && iso < s.termStart) || (s.termEnd && iso > s.termEnd)) return false;
    return this.exceptions.get(iso)?.kind !== "no_school";
  }

  /** Which day type a date runs, or why there's no school. */
  dayInfo(date: Date): DayInfo {
    const s = this.settings;
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const iso = localDate(d);
    const ex = this.exceptions.get(iso);
    if (ex?.kind === "no_school") return { school: false, why: "no_school", note: ex.note || undefined };
    if (ex?.kind === "day_type" && ex.dayTypeId && this.types.has(ex.dayTypeId)) return { school: true, dayTypeId: ex.dayTypeId, why: "exception" };
    if (!s.schoolDays.includes(d.getDay())) return { school: false, why: "weekend" };
    if ((s.termStart && iso < s.termStart) || (s.termEnd && iso > s.termEnd)) return { school: false, why: "outside_term" };

    const fixed = s.fixed[String(d.getDay())];
    if (fixed && this.types.has(fixed)) return { school: true, dayTypeId: fixed, why: "fixed" };

    const rot = s.rotation.filter((id) => this.types.has(id));
    if (!rot.length) return { school: false, why: "not_set_up" };
    if (rot.length === 1 || !s.anchorDate) return { school: true, dayTypeId: rot[0], why: "rotation" };

    // Count rotating school days between the anchor and this date. If the anchor
    // itself doesn't rotate (a fixed weekday, a weekend, a day off), the first
    // rotating day after it takes the anchor's position.
    let anchor = parseDate(s.anchorDate);
    for (let i = 0; i < 31 && !this.rotates(anchor); i++) anchor = addDays(anchor, 1);
    let steps = 0;
    const forward = d >= anchor;
    const LIMIT = 800;
    if (forward) {
      for (let x = addDays(anchor, 1), i = 0; x <= d && i < LIMIT; x = addDays(x, 1), i++) if (this.rotates(x)) steps++;
    } else {
      for (let x = addDays(d, 1), i = 0; x <= anchor && i < LIMIT; x = addDays(x, 1), i++) if (this.rotates(x)) steps--;
      // The target day itself takes a slot only when counting forward from it; handled by the loop bounds above.
    }
    const idx = (((s.anchorIndex + steps) % rot.length) + rot.length) % rot.length;
    return { school: true, dayTypeId: rot[idx], why: "rotation" };
  }
}

/** Classes on a date, as timeline occurrences. */
export function occurrencesFor(cal: ScheduleCalendar, blocks: ScheduleBlock[], date: Date, courseColor?: (id: string) => string | undefined): Occurrence[] {
  const info = cal.dayInfo(date);
  if (!info.school) return [];
  return blocks
    .filter((b) => !b.deleted && b.dayTypeId === info.dayTypeId)
    .map((b) => {
      const block: ClassBlock = {
        id: b.id,
        title: b.title,
        room: b.room || undefined,
        teacher: b.teacher || undefined,
        days: [],
        start: b.start,
        end: b.end,
        color: b.courseId ? courseColor?.(b.courseId) : undefined,
      };
      const [sh, sm] = b.start.split(":").map(Number);
      const [eh, em] = b.end.split(":").map(Number);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm);
      const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em);
      return { block, start, end };
    })
    .filter((o) => o.end > o.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Validate "HH:MM" (24-hour). */
export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Blocks within one day type that overlap in time (a likely typo). */
export function overlaps(blocks: Pick<ScheduleBlock, "id" | "start" | "end">[]): [string, string][] {
  const sorted = [...blocks].sort((a, b) => a.start.localeCompare(b.start));
  const out: [string, string][] = [];
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j++) out.push([sorted[i].id, sorted[j].id]);
  return out;
}

/** Starter day types for common block schedules. */
export const PRESETS = {
  modified: { label: "Modified block", types: [{ name: "All classes", short: "All" }, { name: "A day", short: "A" }, { name: "B day", short: "B" }] },
  ab: { label: "A/B block", types: [{ name: "A day", short: "A" }, { name: "B day", short: "B" }] },
  same: { label: "Same every day", types: [{ name: "Every day", short: "" }] },
} as const;
