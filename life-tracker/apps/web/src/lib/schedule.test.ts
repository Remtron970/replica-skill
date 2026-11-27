import { describe, expect, it } from "vitest";
import { averagePercent, bandFor, unweightedGpa } from "./gpa";
import { occurrencesOn, scheduleStatus, type ClassBlock } from "./schedule";

const WEEKDAYS = [1, 2, 3, 4, 5];
const blocks: ClassBlock[] = [
  { id: "b", title: "Algebra", days: WEEKDAYS, start: "09:00", end: "09:50" },
  { id: "a", title: "Biology", days: WEEKDAYS, start: "08:00", end: "08:50" },
  { id: "c", title: "Art", days: [3], start: "13:00", end: "14:00" },
];
// Wednesday 25 Nov 2026 and Friday 27 Nov 2026 (local time)
const wed = (h: number, m = 0) => new Date(2026, 10, 25, h, m);
const fri = (h: number, m = 0) => new Date(2026, 10, 27, h, m);

describe("occurrencesOn", () => {
  it("returns only that weekday's classes, sorted by time", () => {
    expect(occurrencesOn(blocks, wed(0)).map((o) => o.block.id)).toEqual(["a", "b", "c"]);
    expect(occurrencesOn(blocks, fri(0)).map((o) => o.block.id)).toEqual(["a", "b"]);
    expect(occurrencesOn(blocks, new Date(2026, 10, 28))).toEqual([]); // Saturday
  });
});

describe("scheduleStatus", () => {
  it("before school: no current class, next is the first class today", () => {
    const s = scheduleStatus(blocks, wed(7, 30));
    expect(s.current).toBeUndefined();
    expect(s.next?.block.id).toBe("a");
    expect(s.next?.isToday).toBe(true);
    expect(s.doneForToday).toBe(false);
  });

  it("during a class: current class with progress, next class later today", () => {
    const s = scheduleStatus(blocks, wed(8, 25));
    expect(s.current?.block.id).toBe("a");
    expect(s.current?.progress).toBeCloseTo(0.5, 5);
    expect(s.next?.block.id).toBe("b");
  });

  it("a class ending exactly now is no longer current", () => {
    const s = scheduleStatus(blocks, wed(8, 50));
    expect(s.current).toBeUndefined();
    expect(s.next?.block.id).toBe("b");
  });

  it("after the last class: done for today, next is the following school day", () => {
    const s = scheduleStatus(blocks, wed(15));
    expect(s.doneForToday).toBe(true);
    expect(s.next?.block.id).toBe("a");
    expect(s.next?.isToday).toBe(false);
    expect(s.next?.start.getDate()).toBe(26);
  });

  it("Friday afternoon: next class is Monday", () => {
    const s = scheduleStatus(blocks, fri(16));
    expect(s.next?.start.getDay()).toBe(1);
    expect(s.next?.start.getDate()).toBe(30);
  });

  it("no schedule at all", () => {
    const s = scheduleStatus([], wed(9));
    expect(s).toEqual({ today: [], current: undefined, next: undefined, doneForToday: false });
  });
});

describe("gpa", () => {
  it("maps percentages to letters on the standard scale", () => {
    expect(bandFor(93).letter).toBe("A");
    expect(bandFor(92.99).letter).toBe("A-");
    expect(bandFor(59).letter).toBe("F");
  });
  it("computes a credit-weighted unweighted GPA", () => {
    expect(unweightedGpa([{ percent: 95 }, { percent: 85 }])).toBe(3.5);
    expect(unweightedGpa([{ percent: 95, credits: 2 }, { percent: 85, credits: 1 }])).toBe(3.67);
    expect(unweightedGpa([])).toBeUndefined();
  });
  it("averages percentages", () => {
    expect(averagePercent([{ percent: 90 }, { percent: 85 }])).toBe(87.5);
    expect(averagePercent([])).toBeUndefined();
  });
});
