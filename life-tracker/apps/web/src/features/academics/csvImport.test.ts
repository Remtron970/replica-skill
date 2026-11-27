import { describe, expect, it } from "vitest";
import { detectColumns, parseDate, parseDelimited, parseGrades, parseScore, planImport } from "./csvImport";
import type { Course, GradeCategory, GradeItem } from "./types";

const base = { clientUpdatedAt: 1, deleted: false, source: "manual" as const };

describe("parseDelimited", () => {
  it("reads commas, quotes and escaped quotes", () => {
    expect(parseDelimited('a,b,c\n"Lab, part 1","say ""hi""",3\r\n')).toEqual([
      ["a", "b", "c"],
      ["Lab, part 1", 'say "hi"', "3"],
    ]);
  });
  it("detects tab-separated text copied from a web page", () => {
    expect(parseDelimited("Assignment\tScore\nQuiz 1\t9/10")).toEqual([
      ["Assignment", "Score"],
      ["Quiz 1", "9/10"],
    ]);
  });
  it("skips blank lines and a byte-order mark", () => {
    expect(parseDelimited("﻿a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("detectColumns", () => {
  it("recognizes common portal headings", () => {
    expect(detectColumns(["Course", "Assignment Name", "Category", "Score", "Points Possible", "Due Date"])).toEqual({
      course: 0, title: 1, category: 2, earned: 3, possible: 4, date: 5,
    });
    expect(detectColumns(["Class", "Title", "Score (pts)", "Out of"])).toEqual({ course: 0, title: 1, earned: 2, possible: 3 });
  });
});

describe("parseScore", () => {
  it.each([
    ["18", "20", { earned: 18, possible: 20, missing: false, excused: false }],
    ["18/20", undefined, { earned: 18, possible: 20, missing: false, excused: false }],
    ["92%", undefined, { earned: 92, possible: 100, missing: false, excused: false }],
    ["Missing", "10", { earned: null, possible: 10, missing: true, excused: false }],
    ["EX", "10", { earned: null, possible: 10, missing: false, excused: true }],
    ["--", "10", { earned: null, possible: 10, missing: false, excused: false }],
  ])("%s (out of %s)", (cell, possible, expected) => {
    expect(parseScore(cell, possible)).toEqual(expected);
  });
  it("flags unreadable scores", () => {
    expect(parseScore("great job").error).toMatch(/Couldn't read score/);
  });
});

describe("parseDate", () => {
  it("handles ISO and US formats", () => {
    expect(parseDate("2026-09-08")).toBe("2026-09-08");
    expect(parseDate("9/8/2026")).toBe("2026-09-08");
    expect(parseDate("9/8/26")).toBe("2026-09-08");
    expect(parseDate("9/8", 2026)).toBe("2026-09-08");
    expect(parseDate("2/30/2026")).toBeNull();
    expect(parseDate("someday")).toBeNull();
  });
});

describe("parseGrades", () => {
  it("parses a typical export and reports bad rows with line numbers", () => {
    const r = parseGrades("Course,Assignment,Category,Score,Out of,Date\nBiology,Quiz 1,Quizzes,9,10,9/8/2026\nBiology,,Quizzes,8,10,9/9/2026\nChemistry,Lab 1,Labs,Missing,20,13/1/2026", { year: 2026 });
    expect(r.problem).toBeUndefined();
    expect(r.rows[0]).toMatchObject({ line: 2, course: "Biology", title: "Quiz 1", category: "Quizzes", earned: 9, possible: 10, date: "2026-09-08" });
    expect(r.rows[1].error).toBe("No assignment name");
    expect(r.rows[2].error).toMatch(/Couldn't read date/);
  });
  it("uses a chosen class when the export has no class column", () => {
    const r = parseGrades("Assignment\tScore\nEssay\t45/50", { defaultCourse: "English 11" });
    expect(r.rows[0]).toMatchObject({ course: "English 11", earned: 45, possible: 50 });
  });
  it("explains what's missing", () => {
    expect(parseGrades("only one line").problem).toMatch(/header row/);
    expect(parseGrades("Foo,Bar\n1,2").problem).toMatch(/assignment name/);
    expect(parseGrades("Assignment,Score\nQuiz,9").problem).toMatch(/class column/);
  });
});

describe("StudentVUE gradebook paste", () => {
  // Columns as shown in StudentVUE's Gradebook assignment list (copied from the web portal).
  const paste = [
    "Date\tAssignment\tAssignment Type\tScore\tScore Type\tPoints\tNotes",
    "9/12/2026\tCell structure quiz\tQuizzes\t18 out of 20\tRaw Score\t18.00 / 20.00\t",
    "9/20/2026\tLab report\tLabs\tNot Graded\tRaw Score\t/ 25.0000\t",
    "9/22/2026\tUnit 1 test\tTests\t86\tPercentage\t86.00 / 100.00\tRetake allowed",
    "9/24/2026\tHomework 3\tHomework\tMissing\tRaw Score\t0.00 / 10.00\t",
    "9/26/2026\tHomework 4\tHomework\tExc\tRaw Score\t/ 10.0000\t",
  ].join("\n");

  it("reads “x out of y”, the Points column, not-graded and missing/excused work", () => {
    const r = parseGrades(paste, { defaultCourse: "Biology" });
    expect(r.problem).toBeUndefined();
    expect(r.rows.map((x) => [x.title, x.category, x.earned, x.possible, x.missing, x.excused, x.date, x.error])).toEqual([
      ["Cell structure quiz", "Quizzes", 18, 20, false, false, "2026-09-12", undefined],
      ["Lab report", "Labs", null, 25, false, false, "2026-09-20", undefined],
      ["Unit 1 test", "Tests", 86, 100, false, false, "2026-09-22", undefined],
      ["Homework 3", "Homework", null, 10, true, false, "2026-09-24", undefined],
      ["Homework 4", "Homework", null, 10, false, true, "2026-09-26", undefined],
    ]);
  });

  it("never turns text like “18 out of 20” into a made-up number", () => {
    expect(parseScore("18 out of 20")).toMatchObject({ earned: 18, possible: 20 });
    expect(parseScore("about 18").error).toMatch(/Couldn't read/);
  });
});

describe("planImport", () => {
  const courses: Course[] = [{ ...base, id: "c1", termId: null, name: "Biology", teacher: "", room: "", color: "purple", credits: 1, level: "regular", gradingMode: "points", manualPercent: null, scaleId: null, archived: false }];
  const cats: GradeCategory[] = [{ ...base, id: "k1", courseId: "c1", name: "Quizzes", weight: 20, sort: 0 }];
  const items: GradeItem[] = [{ ...base, id: "i1", courseId: "c1", categoryId: "k1", title: "Quiz 1", earned: 9, possible: 10, gradedOn: "2026-09-08", dueOn: null, excused: false, missing: false, notes: "" }];

  it("matches classes and categories by name, creates the rest, skips duplicates", () => {
    const { rows } = parseGrades(
      "Course,Assignment,Category,Score,Out of,Date\nbiology,Quiz 1,quizzes,9,10,2026-09-08\nBiology,Quiz 2,Quizzes,10,10,2026-09-15\nBiology,Test 1,Tests,40,50,2026-09-20\nChemistry,Lab 1,Labs,18,20,2026-09-10\nChemistry,Lab 1,Labs,18,20,2026-09-10",
    );
    const plan = planImport(rows, courses, cats, items);
    expect(plan.newCourses).toEqual(["Chemistry"]);
    expect(plan.newCategories).toEqual([{ course: "Biology", name: "Tests" }, { course: "Chemistry", name: "Labs" }]);
    expect(plan.items.map((i) => i.title)).toEqual(["Quiz 2", "Test 1", "Lab 1"]);
    expect(plan.duplicates).toBe(2);
  });
});
