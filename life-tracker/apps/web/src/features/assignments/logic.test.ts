import { describe, expect, it } from "vitest";
import { bucketOf, dueReminders, formatDue, groupAssignments, reminderAt } from "./logic";
import type { Assignment } from "./types";

const now = new Date(2026, 10, 25, 10, 0); // Wed 25 Nov 2026, 10:00 local
const at = (d: number, h = 23, m = 59) => new Date(2026, 10, d, h, m).toISOString();
let n = 0;
const a = (o: Partial<Assignment>): Assignment => ({
  id: `a${++n}`, clientUpdatedAt: 1, deleted: false, source: "manual", courseId: null, title: `T${n}`, description: "",
  dueAt: null, dueHasTime: true, priority: "normal", status: "todo", completedAt: null, submitted: false, url: null, reminderMinutes: null, ...o,
});

describe("buckets", () => {
  it.each([
    [{ dueAt: at(24) }, "overdue"],
    [{ dueAt: at(25, 9, 0) }, "overdue"], // earlier today
    [{ dueAt: at(25, 15, 0) }, "today"],
    [{ dueAt: at(26) }, "tomorrow"],
    [{ dueAt: at(30) }, "week"],
    [{ dueAt: at(2 + 30, 9) }, "week"], // Dec 2 = 7 days away
    [{ dueAt: new Date(2026, 11, 10).toISOString() }, "later"],
    [{ dueAt: null }, "nodate"],
    [{ dueAt: at(24), status: "done" as const }, "done"],
    [{ dueAt: at(24), submitted: true }, "done"],
  ])("%o → %s", (o, expected) => {
    expect(bucketOf(a(o), now)).toBe(expected);
  });

  it("date-only due dates count until 11:59 PM that day", () => {
    const d = a({ dueAt: new Date(Date.UTC(2026, 10, 25, 12)).toISOString(), dueHasTime: false });
    expect(bucketOf(d, new Date(2026, 10, 25, 22, 0))).toBe("today");
    expect(formatDue(d, now)).toBe("Due today");
  });
});

describe("formatDue", () => {
  it("reads naturally", () => {
    expect(formatDue(a({ dueAt: at(25, 15, 0) }), now)).toMatch(/^Due today, 3:00\s?PM$/);
    expect(formatDue(a({ dueAt: at(26) }), now)).toMatch(/^Due tomorrow, 11:59\s?PM$/);
    expect(formatDue(a({ dueAt: at(24) }), now)).toMatch(/^Was due yesterday, 11:59\s?PM$/);
    expect(formatDue(a({ dueAt: at(27, 8, 0) }), now)).toMatch(/^Due friday, 8:00\s?AM$/i);
    expect(formatDue(a({}), now)).toBe("No due date");
  });
});

describe("grouping", () => {
  it("sorts soonest first, then by priority", () => {
    const list = [a({ title: "late", dueAt: at(30) }), a({ title: "hi", dueAt: at(28), priority: "high" }), a({ title: "lo", dueAt: at(28), priority: "low" }), a({ title: "gone", dueAt: at(28), deleted: true })];
    expect(groupAssignments(list, now).get("week")!.map((x) => x.title)).toEqual(["hi", "lo", "late"]);
  });
});

describe("reminders", () => {
  it("fires once, inside the window, only for unfinished work", () => {
    const r = a({ dueAt: at(26, 9, 0), reminderMinutes: 1440 }); // reminder Wed 9:00
    expect(reminderAt(r)?.getHours()).toBe(9);
    expect(dueReminders([r], new Date(2026, 10, 25, 8, 59), new Date(2026, 10, 25, 9, 0))).toEqual([r]);
    expect(dueReminders([r], new Date(2026, 10, 25, 9, 0), new Date(2026, 10, 25, 9, 5))).toEqual([]);
    expect(dueReminders([{ ...r, status: "done" }], new Date(2026, 10, 25, 8), new Date(2026, 10, 25, 10))).toEqual([]);
    expect(dueReminders([{ ...r, reminderMinutes: null }], new Date(2026, 10, 25, 8), new Date(2026, 10, 25, 10))).toEqual([]);
  });
});
