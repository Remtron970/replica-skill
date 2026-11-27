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
    expect(b.unavailable.map((u) => u.label)).toHaveLength(6);
    expect(b.summary).toMatch(/connect your accounts/i);
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
