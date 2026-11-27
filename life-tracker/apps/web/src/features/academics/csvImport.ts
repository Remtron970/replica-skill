import type { Course, GradeCategory, GradeItem } from "./types";

/**
 * Import grades pasted or uploaded from a spreadsheet or a school portal
 * (PowerSchool, Infinite Campus, etc. usually copy as tab-separated text).
 */

export function parseDelimited(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delim = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? "\t" : (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

type Field = "course" | "title" | "category" | "earned" | "possible" | "date";
const SYNONYMS: Record<Field, string[]> = {
  course: ["class", "course", "subject", "class name", "course name", "section"],
  title: ["assignment", "title", "name", "assignment name", "item", "description"],
  category: ["category", "type", "assignment type", "grading category"],
  earned: ["score", "earned", "points earned", "points", "grade", "mark", "result"],
  possible: ["out of", "possible", "points possible", "total", "max", "max points", "total points", "worth"],
  date: ["date", "graded", "graded on", "date graded", "due", "due date", "assigned"],
};

export type ColumnMap = Partial<Record<Field, number>>;

export function detectColumns(header: string[]): ColumnMap {
  const norm = header.map((h) => h.toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim());
  const map: ColumnMap = {};
  for (const f of Object.keys(SYNONYMS) as Field[]) {
    // Exact synonym first, then "starts with" (e.g. "Score (pts)").
    let idx = norm.findIndex((h, i) => SYNONYMS[f].includes(h) && !Object.values(map).includes(i));
    if (idx < 0) idx = norm.findIndex((h, i) => SYNONYMS[f].some((s) => h.startsWith(s)) && !Object.values(map).includes(i));
    if (idx >= 0) map[f] = idx;
  }
  return map;
}

export function parseDate(raw: string, year = new Date().getFullYear()): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (m) {
    let y = m[3] ? +m[3] : year;
    if (y < 100) y += 2000;
    return iso(y, +m[1], +m[2]);
  }
  return null;
}

function iso(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getMonth() !== mo - 1) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function num(s: string): number | null {
  const v = s.replace(/[^\d.-]/g, "");
  if (!v || v === "-" || v === ".") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export interface ImportRow {
  line: number;
  course: string;
  title: string;
  category: string;
  earned: number | null;
  possible: number | null;
  date: string | null;
  missing: boolean;
  excused: boolean;
  error?: string;
}

const MISSING = /^(missing|miss|m|0\*|z)$/i;
const EXCUSED = /^(ex|exc|excused|exempt|x)$/i;
const BLANK = /^(|-|--|—|n\/a|na|ng|not graded|\*)$/i;

/** Read one score cell: "18", "18/20", "90%", "Missing", "EX", "--". */
export function parseScore(cell: string, possibleCell?: string): Pick<ImportRow, "earned" | "possible" | "missing" | "excused"> & { error?: string } {
  const s = cell.trim();
  const possible = possibleCell !== undefined ? num(possibleCell) : null;
  if (MISSING.test(s)) return { earned: null, possible, missing: true, excused: false };
  if (EXCUSED.test(s)) return { earned: null, possible, missing: false, excused: true };
  if (BLANK.test(s)) return { earned: null, possible, missing: false, excused: false };
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (frac) return { earned: +frac[1], possible: +frac[2], missing: false, excused: false };
  if (/%\s*$/.test(s) && possible === null) {
    const p = num(s);
    return p === null ? { earned: null, possible: null, missing: false, excused: false, error: `Couldn't read score "${s}"` } : { earned: p, possible: 100, missing: false, excused: false };
  }
  const e = num(s);
  if (e === null) return { earned: null, possible, missing: false, excused: false, error: `Couldn't read score "${s}"` };
  return { earned: e, possible, missing: false, excused: false };
}

export interface ParseResult {
  columns: ColumnMap;
  rows: ImportRow[];
  /** Why nothing can be imported (e.g. no recognizable columns). */
  problem?: string;
}

export function parseGrades(text: string, opts: { defaultCourse?: string; year?: number } = {}): ParseResult {
  const table = parseDelimited(text);
  if (table.length < 2) return { columns: {}, rows: [], problem: "Paste a header row plus at least one row of grades." };
  const columns = detectColumns(table[0]);
  if (columns.title === undefined) return { columns, rows: [], problem: "Couldn't find an assignment name column (e.g. “Assignment”)." };
  if (columns.earned === undefined) return { columns, rows: [], problem: "Couldn't find a score column (e.g. “Score”)." };
  if (columns.course === undefined && !opts.defaultCourse) return { columns, rows: [], problem: "Couldn't find a class column. Choose which class these grades belong to." };

  const rows = table.slice(1).map((cells, i): ImportRow => {
    const get = (f: Field) => (columns[f] === undefined ? "" : (cells[columns[f]!] ?? ""));
    const course = (get("course") || opts.defaultCourse || "").trim();
    const title = get("title").trim();
    const score = parseScore(get("earned"), columns.possible === undefined ? undefined : get("possible"));
    const dateRaw = get("date");
    const date = dateRaw ? parseDate(dateRaw, opts.year) : null;
    let error = score.error;
    if (!title) error = "No assignment name";
    else if (!course) error = "No class name";
    else if (score.earned !== null && score.earned < 0) error = "Score can't be negative";
    else if (dateRaw && !date) error = `Couldn't read date "${dateRaw}"`;
    return {
      line: i + 2,
      course: course.slice(0, 80),
      title: title.slice(0, 120),
      category: get("category").trim().slice(0, 60),
      earned: score.earned,
      possible: score.possible,
      date,
      missing: score.missing,
      excused: score.excused,
      error,
    };
  });
  return { columns, rows };
}

export interface ImportPlan {
  newCourses: string[];
  newCategories: { course: string; name: string }[];
  items: ImportRow[];
  duplicates: number;
  errors: ImportRow[];
}

const key = (s: string) => s.trim().toLowerCase();

/** Decide what an import will create, matching existing classes/categories by name and skipping duplicates. */
export function planImport(rows: ImportRow[], courses: Course[], categories: GradeCategory[], items: GradeItem[]): ImportPlan {
  const errors = rows.filter((r) => r.error);
  const ok = rows.filter((r) => !r.error);
  const courseByName = new Map(courses.filter((c) => !c.deleted).map((c) => [key(c.name), c]));
  const newCourses = [...new Set(ok.map((r) => r.course).filter((n) => !courseByName.has(key(n))))].filter(
    (n, i, a) => a.findIndex((x) => key(x) === key(n)) === i,
  );

  const newCategories: ImportPlan["newCategories"] = [];
  for (const r of ok) {
    if (!r.category) continue;
    const course = courseByName.get(key(r.course));
    const exists = course && categories.some((c) => !c.deleted && c.courseId === course.id && key(c.name) === key(r.category));
    if (!exists && !newCategories.some((n) => key(n.course) === key(r.course) && key(n.name) === key(r.category))) newCategories.push({ course: r.course, name: r.category });
  }

  const sig = (course: string, title: string, date: string | null, earned: number | null, possible: number | null) =>
    [key(course), key(title), date ?? "", earned ?? "", possible ?? ""].join("|");
  const courseName = new Map(courses.map((c) => [c.id, c.name]));
  const seen = new Set(items.filter((i) => !i.deleted).map((i) => sig(courseName.get(i.courseId) ?? "", i.title, i.gradedOn ?? i.dueOn, i.earned, i.possible)));
  const fresh: ImportRow[] = [];
  let duplicates = 0;
  for (const r of ok) {
    const s = sig(r.course, r.title, r.date, r.earned, r.possible);
    if (seen.has(s)) duplicates++;
    else {
      seen.add(s);
      fresh.push(r);
    }
  }
  return { newCourses, newCategories, items: fresh, duplicates, errors };
}
