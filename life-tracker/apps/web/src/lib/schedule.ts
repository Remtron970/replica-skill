/** A recurring class period, in the user's local time. */
export interface ClassBlock {
  id: string;
  title: string;
  teacher?: string;
  room?: string;
  /** 0 = Sunday … 6 = Saturday */
  days: number[];
  /** "HH:MM", 24-hour */
  start: string;
  end: string;
  color?: string;
}

export interface Occurrence {
  block: ClassBlock;
  start: Date;
  end: Date;
}

export interface ScheduleStatus {
  /** Today's classes in order. */
  today: Occurrence[];
  /** The class happening right now, with 0–1 progress. */
  current?: Occurrence & { progress: number };
  /** The next class to start (today or a later day, up to a week ahead). */
  next?: Occurrence & { isToday: boolean };
  /** True when today had classes and they've all ended. */
  doneForToday: boolean;
}

function at(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Classes that meet on the calendar day of `date`, sorted by start time. */
export function occurrencesOn(blocks: ClassBlock[], date: Date): Occurrence[] {
  const dow = date.getDay();
  return blocks
    .filter((b) => b.days.includes(dow))
    .map((b) => ({ block: b, start: at(date, b.start), end: at(date, b.end) }))
    .filter((o) => o.end > o.start)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function scheduleStatus(blocks: ClassBlock[], now: Date): ScheduleStatus {
  const today = occurrencesOn(blocks, now);
  const t = now.getTime();
  const cur = today.find((o) => o.start.getTime() <= t && t < o.end.getTime());
  const current = cur ? { ...cur, progress: (t - cur.start.getTime()) / (cur.end.getTime() - cur.start.getTime()) } : undefined;

  let next: ScheduleStatus["next"];
  const laterToday = today.find((o) => o.start.getTime() > t);
  if (laterToday) next = { ...laterToday, isToday: true };
  else {
    for (let i = 1; i <= 7 && !next; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() + i);
      const first = occurrencesOn(blocks, day)[0];
      if (first) next = { ...first, isToday: false };
    }
  }

  return {
    today,
    current,
    next,
    doneForToday: today.length > 0 && today[today.length - 1].end.getTime() <= t,
  };
}

export const formatTime = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export function durationMinutes(o: Occurrence) {
  return Math.round((o.end.getTime() - o.start.getTime()) / 60000);
}
