import type { AnalysisContext, EmailAnalysis, EmailCategory, ParsedEmail } from "./model.ts";

/**
 * Life Tracker's built-in "quick summary": used when AI isn't set up, and as the
 * fallback if the AI call fails. Simple, predictable rules — clearly labeled.
 */

const SCHOOL_WORDS = /\b(teacher|class|classes|homework|assignment|quiz|test|exam|midterm|final|grade|grades|gradebook|school|counsel(?:or|ing)|principal|syllabus|semester|canvas|classroom|studentvue|field trip|permission (?:slip|form)|report card|attendance|tutoring|club|period \d)\b/i;
const AUTOMATED = /(no-?reply|do-?not-?reply|notifications?|mailer-daemon|newsletter|updates?)@/i;
const REPLY_WORDS = /\b(please (?:reply|respond|let me know|confirm|rsvp)|let me know|can you|could you|would you|are you (?:able|free|coming)|rsvp|respond by|reply by|get back to me|what do you think)\b/i;
const DEADLINE_WORDS = /\b(due|deadline|by (?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|tonight|end of (?:day|week))|submit(?:ted)? by|turn(?:ed)? in by|no later than|last day to|closes?|expires?)\b/i;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
const fromIso = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** The first date mentioned near a deadline word, resolved against `today`. */
export function findDeadline(text: string, today: string): string | null {
  const lower = text.toLowerCase();
  const m = lower.match(DEADLINE_WORDS);
  if (!m || m.index === undefined) return null;
  const window = lower.slice(Math.max(0, m.index - 40), m.index + 120);
  const base = fromIso(today);
  if (/\btonight\b|\btoday\b|end of (the )?day/.test(window)) return today;
  if (/\btomorrow\b/.test(window)) return iso(addDays(base, 1));
  // 12/4, 12/4/2026, 12-4
  const num = window.match(/\b(1[0-2]|0?[1-9])[/-]([12]\d|3[01]|0?[1-9])(?:[/-](\d{2,4}))?\b/);
  if (num) return resolveMonthDay(Number(num[1]), Number(num[2]), num[3] ? Number(num[3]) : null, base);
  // Dec 4, December 4th
  const named = window.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/);
  if (named) return resolveMonthDay(MONTHS.indexOf(named[1]) + 1, Number(named[2]), null, base);
  // Friday / this Friday / next Friday
  const wd = window.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[2]);
    // "by Friday" on a Friday = today; "next Friday" = the Friday of next week.
    let diff = (target - base.getUTCDay() + 7) % 7;
    if (wd[1]) diff += diff === 0 || base.getUTCDay() < target ? 7 : 0;
    return iso(addDays(base, diff));
  }
  if (/end of (the )?week/.test(window)) return iso(addDays(base, (5 - base.getUTCDay() + 7) % 7));
  return null;
}

function resolveMonthDay(month: number, day: number, year: number | null, base: Date): string | null {
  let y = year === null ? base.getUTCFullYear() : year < 100 ? 2000 + year : year;
  let d = new Date(Date.UTC(y, month - 1, day));
  if (d.getUTCMonth() !== month - 1) return null;
  // A date without a year that's well in the past probably means next year.
  if (year === null && d.getTime() < base.getTime() - 60 * 86_400_000) {
    y += 1;
    d = new Date(Date.UTC(y, month - 1, day));
  }
  return iso(d);
}

/** A short, plain summary: the first real sentence of the message. */
export function firstSentence(email: Pick<ParsedEmail, "bodyText" | "snippet" | "subject">, max = 180): string {
  const lines = email.bodyText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^(hi|hello|hey|dear|good (morning|afternoon|evening))\b[^.!?]{0,40}[,!]?$/i.test(l) && !/^(on .* wrote:|from:|sent:|to:|subject:)/i.test(l));
  const text = lines.join(" ") || email.snippet || email.subject;
  const sentence = text.match(/^(.{20,}?[.!?])(\s|$)/)?.[1] ?? text;
  return sentence.length > max ? `${sentence.slice(0, max - 1).trimEnd()}…` : sentence;
}

export function analyzeWithRules(email: ParsedEmail, ctx: AnalysisContext): EmailAnalysis {
  const text = `${email.subject}\n${email.bodyText || email.snippet}`;
  const domain = email.fromEmail.split("@")[1] ?? "";
  const automated = AUTOMATED.test(email.fromEmail) || ["promotions", "social", "forums", "updates"].includes(email.gmailCategory ?? "");
  const isSchool = ctx.schoolDomains.some((d) => domain === d || domain.endsWith(`.${d}`)) || SCHOOL_WORDS.test(text);
  const deadlineOn = findDeadline(text, ctx.today);
  const needsReply = !automated && REPLY_WORDS.test(text);
  let importance = (isSchool ? 1 : 0) + (deadlineOn ? 1 : 0) + (needsReply ? 1 : 0) + (email.gmailImportant ? 1 : 0);
  if (automated && !isSchool) importance = Math.min(importance, 1);
  const imp = Math.min(3, importance) as EmailAnalysis["importance"];
  const category: EmailCategory = imp >= 2 ? "important" : isSchool ? "school" : automated ? "notifications" : email.fromName && !/@/.test(email.fromName) ? "personal" : "other";
  return { category, summary: firstSentence(email), hasDeadline: !!deadlineOn, deadlineOn, needsReply, isSchool, importance: imp, source: "rules" };
}
