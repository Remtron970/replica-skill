import { describe, expect, it } from "vitest";
import { scheduleStatus } from "../../lib/schedule";
import { DEFAULT_SCHEDULE_SETTINGS, normalizeScheduleSettings, occurrencesFor, overlaps, ScheduleCalendar, type DayType, type ScheduleBlock, type ScheduleException, type ScheduleSettings } from "./blockSchedule";

const base = { clientUpdatedAt: 1, deleted: false, source: "manual" as const };
const types: DayType[] = [
  { ...base, id: "all", name: "All classes", short: "All", sort: 0 },
  { ...base, id: "A", name: "A day", short: "A", sort: 1 },
  { ...base, id: "B", name: "B day", short: "B", sort: 2 },
];
// Modified block: Monday = all classes; Tue–Fri rotate A/B continuously. Tue 24 Nov 2026 is an A day.
const settings: ScheduleSettings = { ...DEFAULT_SCHEDULE_SETTINGS, fixed: { "1": "all" }, rotation: ["A", "B"], anchorDate: "2026-11-24", anchorIndex: 0 };
const ex = (date: string, kind: ScheduleException["kind"], dayTypeId: string | null = null, note = ""): ScheduleException => ({ ...base, id: date, date, kind, dayTypeId, note });
const exceptions = [ex("2026-11-26", "no_school", null, "Thanksgiving"), ex("2026-12-04", "day_type", "all")];
const cal = new ScheduleCalendar(settings, exceptions, types);
const day = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 9);
};
const typeOf = (s: string) => {
  const i = cal.dayInfo(day(s));
  return i.school ? i.dayTypeId : `off:${i.why}`;
};

describe("modified block calendar", () => {
  it("Monday is always all-classes; other days alternate A/B, skipping days off", () => {
    expect(
      ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"].map(typeOf),
    ).toEqual(["all", "A", "B", "off:no_school", "A", "off:weekend", "off:weekend", "all", "B", "A"]);
  });

  it("an anchor on a non-rotating day (Monday, weekend) means the next rotating day", () => {
    const monAnchor = new ScheduleCalendar({ ...settings, anchorDate: "2026-11-23", anchorIndex: 0 }, exceptions, types);
    const sunAnchor = new ScheduleCalendar({ ...settings, anchorDate: "2026-11-22", anchorIndex: 0 }, exceptions, types);
    for (const c of [monAnchor, sunAnchor])
      expect(["2026-11-24", "2026-11-25", "2026-11-27"].map((d) => (c.dayInfo(day(d)) as { dayTypeId: string }).dayTypeId)).toEqual(["A", "B", "A"]);
  });

  it("works backwards from the anchor too", () => {
    expect(["2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"].map(typeOf)).toEqual(["A", "B", "A", "B"]);
  });

  it("an exception can make a day run as another day type, and the rotation keeps going", () => {
    // Thu Dec 3 is B (Dec 1 B, Dec 2 A, Dec 3 B); Fri Dec 4 is forced to all-classes but still uses the A slot.
    expect(["2026-12-03", "2026-12-04", "2026-12-08"].map(typeOf)).toEqual(["B", "all", "B"]);
  });

  it("reports why there's no school", () => {
    expect(cal.dayInfo(day("2026-11-26"))).toEqual({ school: false, why: "no_school", note: "Thanksgiving" });
    const term = new ScheduleCalendar({ ...settings, termEnd: "2026-12-18" }, [], types);
    expect(term.dayInfo(day("2026-12-21"))).toEqual({ school: false, why: "outside_term" });
    expect(new ScheduleCalendar(DEFAULT_SCHEDULE_SETTINGS, [], types).dayInfo(day("2026-11-24"))).toEqual({ school: false, why: "not_set_up" });
  });

  it("a fixed weekly pattern (Tue/Thu = A, Wed/Fri = B) needs no anchor", () => {
    const weekly = new ScheduleCalendar({ ...DEFAULT_SCHEDULE_SETTINGS, fixed: { "1": "all", "2": "A", "3": "B", "4": "A", "5": "B" } }, [], types);
    expect(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"].map((s) => (weekly.dayInfo(day(s)) as { dayTypeId: string }).dayTypeId)).toEqual(["all", "A", "B", "A", "B"]);
  });

  it("ignores references to deleted day types", () => {
    const gone = new ScheduleCalendar(settings, [], [types[0], types[1]]); // B deleted
    expect(gone.dayInfo(day("2026-11-25"))).toEqual({ school: true, dayTypeId: "A", why: "rotation" });
  });
});

describe("timeline from a block schedule", () => {
  const blk = (id: string, dayTypeId: string, title: string, start: string, end: string): ScheduleBlock => ({ ...base, id, dayTypeId, courseId: null, title, room: "", teacher: "", start, end });
  const blocks = [
    blk("m1", "all", "Biology", "08:00", "08:45"), blk("m2", "all", "Chemistry", "08:50", "09:35"),
    blk("a1", "A", "Biology", "08:00", "09:30"), blk("a2", "A", "English", "09:40", "11:10"),
    blk("b1", "B", "Chemistry", "08:00", "09:30"), blk("b2", "B", "History", "09:40", "11:10"),
  ];
  const provider = (d: Date) => occurrencesFor(cal, blocks, d);

  it("uses that day's blocks", () => {
    expect(provider(day("2026-11-24")).map((o) => o.block.title)).toEqual(["Biology", "English"]);
    expect(provider(day("2026-11-25")).map((o) => o.block.title)).toEqual(["Chemistry", "History"]);
    expect(provider(day("2026-11-26"))).toEqual([]);
  });

  it("current block and countdown target on a B day", () => {
    const s = scheduleStatus(provider, new Date(2026, 10, 25, 9, 0));
    expect(s.current?.block.title).toBe("Chemistry");
    expect(s.current?.progress).toBeCloseTo(60 / 90, 5);
    expect(s.next?.block.title).toBe("History");
  });

  it("over a holiday, the next class is on the next school day", () => {
    const s = scheduleStatus(provider, new Date(2026, 10, 25, 15, 0)); // Wed afternoon; Thu off
    expect(s.next?.block.title).toBe("Biology"); // Fri is an A day
    expect(s.next?.start.getDate()).toBe(27);
  });

  it("flags overlapping blocks", () => {
    expect(overlaps([{ id: "x", start: "08:00", end: "09:00" }, { id: "y", start: "08:30", end: "09:30" }, { id: "z", start: "09:30", end: "10:00" }])).toEqual([["x", "y"]]);
  });
});

describe("normalizeScheduleSettings", () => {
  it("cleans bad input", () => {
    expect(normalizeScheduleSettings(undefined)).toEqual(DEFAULT_SCHEDULE_SETTINGS);
    expect(normalizeScheduleSettings({ schoolDays: [1, 1, 9, 5], fixed: { "1": "all", "8": "x", "2": "" }, rotation: ["A", "B", 3], anchorDate: "11/24/2026", anchorIndex: 5 })).toEqual({
      ...DEFAULT_SCHEDULE_SETTINGS,
      schoolDays: [1, 5],
      fixed: { "1": "all" },
      rotation: ["A", "B"],
      anchorIndex: 1,
    });
  });
});
