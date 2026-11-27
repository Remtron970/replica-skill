import { localDate } from "../academics/grades";
import type { EmailCategory, EmailRecord } from "./types";

/** Emails to show: not deleted, not hidden, newest first. */
export function visibleEmails(list: EmailRecord[]): EmailRecord[] {
  return list.filter((e) => !e.deleted && !e.dismissed).sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
}

export function dayOf(e: Pick<EmailRecord, "receivedAt">): string {
  return localDate(new Date(e.receivedAt));
}

export function yesterday(now: Date): string {
  return localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
}

export interface Recap {
  day: string;
  total: number;
  important: number;
  school: number;
  needsReply: number;
  deadlines: number;
  /** Most important first, then newest. */
  highlights: EmailRecord[];
}

export function recapFor(list: EmailRecord[], day: string, limit = 5): Recap {
  const xs = visibleEmails(list).filter((e) => dayOf(e) === day);
  const highlights = [...xs]
    .filter((e) => e.category !== "notifications" || e.importance >= 2)
    .sort((a, b) => b.importance - a.importance || Date.parse(b.receivedAt) - Date.parse(a.receivedAt))
    .slice(0, limit);
  return {
    day,
    total: xs.length,
    important: xs.filter((e) => e.category === "important" || e.importance >= 2).length,
    school: xs.filter((e) => e.isSchool).length,
    needsReply: xs.filter((e) => e.needsReply).length,
    deadlines: xs.filter((e) => e.hasDeadline).length,
    highlights,
  };
}

export function countsByCategory(list: EmailRecord[]): Record<EmailCategory | "all", number> {
  const xs = visibleEmails(list);
  const c = { all: xs.length, important: 0, school: 0, personal: 0, notifications: 0, other: 0 };
  for (const e of xs) c[e.category]++;
  return c;
}

/** One-line recap sentence for the briefing. */
export function recapSentence(r: Recap): string {
  if (!r.total) return "No new email yesterday.";
  const bits = [r.important ? `${r.important} important` : null, r.needsReply ? `${r.needsReply} need${r.needsReply === 1 ? "s" : ""} a reply` : null, r.deadlines ? `${r.deadlines} with a deadline` : null].filter(Boolean);
  return `You got ${r.total} email${r.total === 1 ? "" : "s"} yesterday${bits.length ? ` — ${bits.join(", ")}` : ""}.`;
}
