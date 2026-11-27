import { averagePercent, unweightedGpa } from "../../lib/gpa";
import { scheduleStatus, type ClassBlock } from "../../lib/schedule";

/**
 * Everything the Home dashboard and the daily briefing read. In "live" mode it
 * comes from connected sources (added phase by phase); in "demo" mode from the
 * labeled sample generator below. Nothing is ever invented in live mode.
 */

export type SourceId = "school" | "email" | "health" | "news" | "calendar" | "tasks";

export const SOURCES: Record<SourceId, { label: string; phase: number }> = {
  school: { label: "School (grades, classes, assignments)", phase: 4 },
  email: { label: "Email", phase: 6 },
  health: { label: "Health", phase: 7 },
  news: { label: "News", phase: 8 },
  calendar: { label: "Calendar", phase: 9 },
  tasks: { label: "Tasks & habits", phase: 9 },
};

export interface Course {
  id: string;
  name: string;
  teacher: string;
  percent: number;
  credits: number;
}
export interface Assignment {
  id: string;
  title: string;
  course: string;
  dueAt: Date;
  done: boolean;
}
export interface Email {
  id: string;
  from: string;
  subject: string;
  summary: string;
  receivedAt: Date;
  important: boolean;
  unread: boolean;
  needsReply: boolean;
}
export interface CalEvent {
  id: string;
  title: string;
  startsAt: Date;
  location?: string;
}
export interface GradeUpdate {
  id: string;
  course: string;
  title: string;
  percent: number;
  at: Date;
}
export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  at: Date;
  breaking: boolean;
}

export interface HomeData {
  mode: "live" | "demo";
  connected: Record<SourceId, boolean>;
  courses: Course[];
  schedule: ClassBlock[];
  assignments: Assignment[];
  emails: Email[];
  events: CalEvent[];
  gradeUpdates: GradeUpdate[];
  news: NewsItem[];
  steps?: { today: number; week: number };
  tasks?: { done: number; total: number };
}

const NONE: Record<SourceId, boolean> = { school: false, email: false, health: false, news: false, calendar: false, tasks: false };

/** Live data. No integrations exist yet (they arrive in Phases 4–9), so it is empty and says so. */
export function liveData(): HomeData {
  return { mode: "live", connected: NONE, courses: [], schedule: [], assignments: [], emails: [], events: [], gradeUpdates: [], news: [] };
}

// ---------------------------------------------------------------------------
// Demo data — clearly fictional, generated relative to "now" so it always fits today.
// ---------------------------------------------------------------------------
const WEEKDAYS = [1, 2, 3, 4, 5];

export function demoData(now: Date): HomeData {
  const day = (offset: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);

  const courses: Course[] = [
    { id: "bio", name: "Biology", teacher: "Ms. Rivera", percent: 94.2, credits: 1 },
    { id: "alg", name: "Algebra II", teacher: "Mr. Chen", percent: 88.5, credits: 1 },
    { id: "eng", name: "English 11", teacher: "Mrs. Okafor", percent: 91.0, credits: 1 },
    { id: "his", name: "U.S. History", teacher: "Mr. Patel", percent: 85.7, credits: 1 },
    { id: "chem", name: "Chemistry", teacher: "Dr. Novak", percent: 89.9, credits: 1 },
    { id: "spa", name: "Spanish II", teacher: "Sra. Morales", percent: 96.3, credits: 1 },
  ];
  const block = (id: string, title: string, start: string, end: string, room?: string, teacher?: string): ClassBlock => ({
    id,
    title,
    start,
    end,
    room,
    teacher,
    days: WEEKDAYS,
  });
  const schedule: ClassBlock[] = [
    block("p1", "Biology", "08:00", "08:50", "Room 204", "Ms. Rivera"),
    block("p2", "Algebra II", "09:00", "09:50", "Room 112", "Mr. Chen"),
    block("p3", "English 11", "10:00", "10:50", "Room 305", "Mrs. Okafor"),
    block("p4", "U.S. History", "11:00", "11:50", "Room 118", "Mr. Patel"),
    block("lunch", "Lunch", "11:50", "12:30", "Cafeteria"),
    block("p5", "Chemistry", "12:30", "13:20", "Lab 2", "Dr. Novak"),
    block("p6", "Spanish II", "13:30", "14:20", "Room 210", "Sra. Morales"),
  ];

  return {
    mode: "demo",
    connected: { school: true, email: true, health: true, news: true, calendar: true, tasks: true },
    courses,
    schedule,
    assignments: [
      { id: "a1", title: "Lab report: enzyme activity", course: "Chemistry", dueAt: day(1, 23, 59), done: false },
      { id: "a2", title: "Problem set 7", course: "Algebra II", dueAt: day(3, 8, 0), done: false },
      { id: "a3", title: "Essay draft: The Great Gatsby", course: "English 11", dueAt: day(5, 23, 59), done: false },
      { id: "a4", title: "Chapter 12 reading questions", course: "U.S. History", dueAt: day(-1, 23, 59), done: false },
      { id: "a5", title: "Vocabulary quiz prep", course: "Spanish II", dueAt: day(2, 13, 30), done: true },
    ],
    emails: [
      { id: "e1", from: "Ms. Rivera", subject: "Field trip permission form due Friday", summary: "Return the signed form by Friday; the trip is next Wednesday.", receivedAt: hoursAgo(18), important: true, unread: true, needsReply: false },
      { id: "e2", from: "School Counseling Office", subject: "Course registration opens Monday", summary: "Pick next year's classes in the portal starting Monday at 8 AM.", receivedAt: hoursAgo(20), important: true, unread: true, needsReply: false },
      { id: "e3", from: "Jordan", subject: "Study group this weekend?", summary: "Asks whether you can meet Saturday afternoon to study for Chemistry.", receivedAt: hoursAgo(15), important: false, unread: true, needsReply: true },
      { id: "e4", from: "Library", subject: "Your book is due in 3 days", summary: "Renew online or return it by Thursday.", receivedAt: hoursAgo(22), important: false, unread: false, needsReply: false },
      { id: "e5", from: "Newsletter", subject: "This week's club events", summary: "Robotics, debate and art club meeting times.", receivedAt: hoursAgo(26), important: false, unread: true, needsReply: false },
    ],
    events: [
      { id: "c1", title: "Soccer practice", startsAt: day(0, 16, 30), location: "North field" },
      { id: "c2", title: "Dentist appointment", startsAt: day(2, 15, 45) },
      { id: "c3", title: "Robotics club", startsAt: day(4, 15, 0), location: "Room 101" },
    ],
    gradeUpdates: [{ id: "g1", course: "Biology", title: "Cell structure quiz", percent: 92, at: hoursAgo(20) }],
    news: [
      { id: "n1", headline: "Sample story: City opens new public library branch", source: "Sample News", at: hoursAgo(3), breaking: false },
      { id: "n2", headline: "Sample breaking story — this is demo data", source: "Sample News", at: hoursAgo(1), breaking: true },
    ],
    steps: { today: 3214, week: 3214 + ((now.getDay() + 6) % 7) * 7400 },
    tasks: { done: 3, total: 5 },
  };
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------
const DAY = 86_400_000;

export interface Stats {
  gpa?: number;
  average?: number;
  assignmentsDue?: number;
  unreadEmails?: number;
  stepsToday?: number;
  tasksDone?: { done: number; total: number };
  upcomingEvents?: number;
}

export function computeStats(d: HomeData, now: Date): Stats {
  const t = now.getTime();
  return {
    gpa: d.connected.school ? unweightedGpa(d.courses) : undefined,
    average: d.connected.school ? averagePercent(d.courses) : undefined,
    assignmentsDue: d.connected.school ? d.assignments.filter((a) => !a.done && a.dueAt.getTime() >= t && a.dueAt.getTime() - t <= 7 * DAY).length : undefined,
    unreadEmails: d.connected.email ? d.emails.filter((e) => e.unread).length : undefined,
    stepsToday: d.connected.health ? d.steps?.today : undefined,
    tasksDone: d.connected.tasks ? d.tasks : undefined,
    upcomingEvents: d.connected.calendar ? d.events.filter((e) => e.startsAt.getTime() >= t && e.startsAt.getTime() - t <= 7 * DAY).length : undefined,
  };
}

export type ImportantKind = "overdue" | "due" | "email" | "grade" | "news" | "event";
export interface ImportantItem {
  id: string;
  kind: ImportantKind;
  title: string;
  detail: string;
  at: Date;
  /** Route to open. */
  to: string;
}

const relDay = (d: Date, now: Date) => {
  const a = new Date(d);
  a.setHours(0, 0, 0, 0);
  const b = new Date(now);
  b.setHours(0, 0, 0, 0);
  const diff = Math.round((a.getTime() - b.getTime()) / DAY);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long" });
};
const time = (d: Date) => d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** The handful of things worth attention right now, most urgent first. */
export function importantItems(d: HomeData, now: Date, limit = 6): ImportantItem[] {
  const t = now.getTime();
  const items: (ImportantItem & { rank: number })[] = [];
  for (const a of d.assignments) {
    if (a.done) continue;
    const due = a.dueAt.getTime();
    if (due < t) items.push({ id: a.id, kind: "overdue", title: a.title, detail: `${a.course} · was due ${relDay(a.dueAt, now)}`, at: a.dueAt, to: "/assignments", rank: 0 });
    else if (due - t <= 2 * DAY) items.push({ id: a.id, kind: "due", title: a.title, detail: `${a.course} · due ${relDay(a.dueAt, now)} at ${time(a.dueAt)}`, at: a.dueAt, to: "/assignments", rank: 1 });
  }
  for (const e of d.emails) if (e.important) items.push({ id: e.id, kind: "email", title: e.subject, detail: `From ${e.from}`, at: e.receivedAt, to: "/email", rank: 2 });
  for (const g of d.gradeUpdates)
    if (t - g.at.getTime() <= 2 * DAY) items.push({ id: g.id, kind: "grade", title: `${g.course}: ${g.title}`, detail: `Scored ${g.percent}%`, at: g.at, to: "/academics", rank: 3 });
  for (const n of d.news) if (n.breaking) items.push({ id: n.id, kind: "news", title: n.headline, detail: n.source, at: n.at, to: "/news", rank: 4 });
  for (const e of d.events) {
    const s = e.startsAt.getTime();
    if (s >= t && s - t <= DAY) items.push({ id: e.id, kind: "event", title: e.title, detail: `${relDay(e.startsAt, now)} at ${time(e.startsAt)}${e.location ? ` · ${e.location}` : ""}`, at: e.startsAt, to: "/calendar", rank: 5 });
  }
  return items
    .sort((x, y) => x.rank - y.rank || x.at.getTime() - y.at.getTime())
    .slice(0, limit)
    .map(({ rank: _r, ...rest }) => rest);
}

// ---------------------------------------------------------------------------
// Daily briefing (template-based preview; AI-written briefings arrive in Phase 11)
// ---------------------------------------------------------------------------
export interface BriefingSection {
  title: string;
  lines: string[];
}
export interface Briefing {
  summary: string;
  sections: BriefingSection[];
  priorities: string[];
  /** Sources that aren't connected, so the briefing can't include them. */
  unavailable: { label: string; phase: number }[];
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function buildBriefing(d: HomeData, now: Date): Briefing {
  const t = now.getTime();
  const sections: BriefingSection[] = [];
  const summary: string[] = [];
  const priorities: string[] = [];
  const unavailable = (Object.keys(SOURCES) as SourceId[]).filter((s) => !d.connected[s]).map((s) => SOURCES[s]);

  if (d.connected.school) {
    const st = scheduleStatus(d.schedule, now);
    const classes = st.today.filter((o) => o.block.id !== "lunch" && o.block.title !== "Lunch");
    if (classes.length) {
      summary.push(`You have ${plural(classes.length, "class", "classes")} today, starting with ${classes[0].block.title} at ${time(classes[0].start)}.`);
      sections.push({ title: "Classes", lines: classes.map((o) => `${time(o.start)} — ${o.block.title}${o.block.room ? ` (${o.block.room})` : ""}`) });
    } else {
      summary.push("No classes today.");
      sections.push({ title: "Classes", lines: ["No classes today."] });
    }

    const open = d.assignments.filter((a) => !a.done).sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
    const overdue = open.filter((a) => a.dueAt.getTime() < t);
    const upcoming = open.filter((a) => a.dueAt.getTime() >= t && a.dueAt.getTime() - t <= 7 * DAY);
    if (upcoming[0]) summary.push(`Your ${upcoming[0].course} ${upcoming[0].title.toLowerCase()} is due ${relDay(upcoming[0].dueAt, now)}.`);
    if (overdue.length) summary.push(`${plural(overdue.length, "assignment")} ${overdue.length === 1 ? "is" : "are"} overdue.`);
    sections.push({
      title: "Assignments",
      lines: [
        ...overdue.map((a) => `Overdue: ${a.title} (${a.course})`),
        ...upcoming.map((a) => `${a.title} (${a.course}) — due ${relDay(a.dueAt, now)}`),
      ].concat(overdue.length + upcoming.length ? [] : ["Nothing due in the next 7 days."]),
    });
    overdue.forEach((a) => priorities.push(`Finish the overdue ${a.course} work: ${a.title}`));
    upcoming.filter((a) => a.dueAt.getTime() - t <= 2 * DAY).forEach((a) => priorities.push(`Work on ${a.title} (${a.course}), due ${relDay(a.dueAt, now)}`));

    const grades = d.gradeUpdates.filter((g) => t - g.at.getTime() <= 2 * DAY);
    if (grades.length) sections.push({ title: "Grade updates", lines: grades.map((g) => `${g.course} — ${g.title}: ${g.percent}%`) });
  }

  if (d.connected.email) {
    const y = d.emails.filter((e) => t - e.receivedAt.getTime() <= 2 * DAY);
    const imp = y.filter((e) => e.important);
    if (y.length)
      summary.push(
        `You received ${plural(y.length, "email")} recently${imp.length ? `, including ${imp.length} important: “${imp[0].subject}” from ${imp[0].from}` : ""}.`,
      );
    sections.push({ title: "Email", lines: y.length ? y.map((e) => `${e.important ? "★ " : ""}${e.from}: ${e.summary}`) : ["No new email."] });
    y.filter((e) => e.needsReply).forEach((e) => priorities.push(`Reply to ${e.from} about “${e.subject}”`));
  }

  if (d.connected.calendar) {
    const soon = d.events.filter((e) => e.startsAt.getTime() >= t && e.startsAt.getTime() - t <= 2 * DAY);
    if (soon.length) sections.push({ title: "Coming up", lines: soon.map((e) => `${e.title} — ${relDay(e.startsAt, now)} at ${time(e.startsAt)}`) });
  }

  if (d.connected.health && d.steps) {
    summary.push(`You've taken ${d.steps.week.toLocaleString()} steps so far this week.`);
    sections.push({ title: "Activity", lines: [`${d.steps.today.toLocaleString()} steps today`, `${d.steps.week.toLocaleString()} steps this week`] });
  }

  if (d.connected.news) {
    const top = [...d.news].sort((a, b) => Number(b.breaking) - Number(a.breaking) || b.at.getTime() - a.at.getTime());
    if (top.length) sections.push({ title: "News", lines: top.map((n) => `${n.breaking ? "Developing: " : ""}${n.headline} (${n.source})`) });
  }

  return {
    summary: summary.join(" ") || "Connect your accounts to get a personalized daily briefing.",
    sections,
    priorities: priorities.slice(0, 4),
    unavailable,
  };
}
