import { describe, expect, it } from "vitest";
import { buildBriefing, computeStats, demoData, importantItems, liveData } from "./homeData";

const now = new Date(2026, 10, 25, 8, 25); // Wednesday, during first period

describe("live mode (nothing connected)", () => {
  const d = liveData();
  it("shows no numbers at all — never invented", () => {
    expect(Object.values(computeStats(d, now)).every((v) => v === undefined)).toBe(true);
    expect(importantItems(d, now)).toEqual([]);
  });
  it("briefing lists every source as unavailable", () => {
    const b = buildBriefing(d, now);
    expect(b.sections).toEqual([]);
    expect(b.priorities).toEqual([]);
    expect(b.unavailable.map((u) => u.label)).toHaveLength(7);
    expect(b.summary).toMatch(/connect your accounts/i);
  });
});

describe("live mode with grades entered", () => {
  const summaries = [
    { course: { id: "c1", name: "Biology", teacher: "", credits: 1 }, result: { percent: 92, graded: 2, missing: 0, categories: [], uncounted: 0 }, letter: "A-", points: 3.7, bands: [] },
  ] as unknown as Parameters<typeof liveData>[0] extends infer T ? (T extends { summaries: infer S } ? S : never) : never;
  const items = [
    { id: "i1", courseId: "c1", title: "Quiz 3", earned: 9, possible: 10, gradedOn: "2026-11-24", clientUpdatedAt: 1, deleted: false, source: "manual", categoryId: null, dueOn: null, excused: false, missing: false, notes: "" },
    { id: "i2", courseId: "c1", title: "Old test", earned: 40, possible: 50, gradedOn: "2026-10-01", clientUpdatedAt: 1, deleted: false, source: "manual", categoryId: null, dueOn: null, excused: false, missing: false, notes: "" },
  ] as never;
  const d = liveData({ summaries, items, gpa: 3.7, average: 92 }, now);
  it("uses the user's GPA and average; other sources stay empty", () => {
    const s = computeStats(d, now);
    expect(s.gpa).toBe(3.7);
    expect(s.average).toBe(92);
    expect(s.assignmentsDue).toBeUndefined();
    expect(s.unreadEmails).toBeUndefined();
  });
  it("recent grades show in Important and the briefing; Grades is no longer unavailable", () => {
    expect(importantItems(d, now).map((i) => i.title)).toEqual(["Biology: Quiz 3"]);
    const b = buildBriefing(d, now);
    expect(b.summary).toMatch(/New grade: Biology Quiz 3 \(90%\)/);
    expect(b.sections.find((s) => s.title === "Grades")?.lines[0]).toBe("Current GPA 3.70 · average 92.0%");
    expect(b.unavailable.map((u) => u.label)).not.toContain("Grades");
  });
});

describe("demo mode", () => {
  const d = demoData(now);
  it("is marked as demo", () => expect(d.mode).toBe("demo"));

  it("computes stats from the sample data", () => {
    const s = computeStats(d, now);
    expect(s.gpa).toBeGreaterThan(3);
    expect(s.assignmentsDue).toBe(3); // due within 7 days, not done, not overdue
    expect(s.unreadEmails).toBe(4);
    expect(s.tasksDone).toEqual({ done: 3, total: 5 });
  });

  it("puts overdue work first, then work due soon", () => {
    const items = importantItems(d, now);
    expect(items[0].kind).toBe("overdue");
    expect(items[1].kind).toBe("due");
    expect(items.length).toBeLessThanOrEqual(6);
    expect(items.some((i) => i.kind === "email")).toBe(true);
  });

  it("briefing summarizes classes, deadlines, email and steps, with priorities", () => {
    const b = buildBriefing(d, now);
    expect(b.summary).toMatch(/You have 6 classes today, starting with Biology/);
    expect(b.summary).toMatch(/due tomorrow/);
    expect(b.summary).toMatch(/steps so far this week/);
    expect(b.priorities[0]).toMatch(/overdue/i);
    expect(b.priorities.some((p) => p.startsWith("Reply to Jordan"))).toBe(true);
    expect(b.unavailable).toEqual([]);
  });

  it("weekend: no classes today", () => {
    const sat = new Date(2026, 10, 28, 10);
    expect(buildBriefing(demoData(sat), sat).summary).toMatch(/^No classes today\./);
  });
});

describe("live mode with news and weather", () => {
  const now = new Date(2026, 10, 28, 7, 30);
  const d = liveData(
    {
      summaries: [],
      items: [],
      gpa: null,
      average: null,
      news: [
        { id: "n1", headline: "Council approves trail", source: "The Daily Sentinel", at: new Date(2026, 10, 28, 6), breaking: false },
        { id: "n2", headline: "Summit talks", source: "BBC News +2", at: new Date(2026, 10, 28, 7), breaking: true },
      ],
      weather: { place: "Grand Junction", temp: 28, label: "Snow", hi: 34, lo: 20, alerts: [{ id: "w1", event: "Winter Storm Warning", area: "Grand Valley; Grand Mesa", isWarning: true, ends: new Date(2026, 10, 29, 5).toISOString() }] },
    },
    now,
  );
  it("weather leads the briefing; warnings come first in Important and priorities", () => {
    const b = buildBriefing(d, now);
    expect(b.summary.startsWith("Grand Junction: 28° and snow, high 34°.")).toBe(true);
    expect(b.sections.find((s) => s.title === "Weather")?.lines).toEqual(["28°, Snow · high 34°, low 20°", "Winter Storm Warning (Grand Valley)"]);
    expect(b.priorities[0]).toBe("Check the Winter Storm Warning before heading out");
    const imp = importantItems(d, now);
    expect(imp[0]).toMatchObject({ kind: "weather", title: "Winter Storm Warning", to: "/news" });
    expect(imp.some((i) => i.kind === "news" && i.title === "Summit talks")).toBe(true);
    expect(b.sections.find((s) => s.title === "News")?.lines).toContain("Breaking: Summit talks (BBC News +2)");
  });
});
