import { describe, expect, it } from "vitest";
import { countsByCategory, recapFor, recapSentence, visibleEmails, yesterday } from "./recap";
import type { EmailRecord } from "./types";

let n = 0;
const e = (o: Partial<EmailRecord>): EmailRecord => ({
  id: `e${++n}`, clientUpdatedAt: 1, deleted: false, source: "gmail", threadId: null, fromName: "X", fromEmail: "x@y.org", subject: "S", snippet: "",
  receivedAt: new Date(2026, 10, 24, 10).toISOString(), labels: [], unread: true, category: "other", summary: "s", summarySource: "rules",
  hasDeadline: false, deadlineOn: null, needsReply: false, isSchool: false, importance: 0, webUrl: null, dismissed: false, ...o,
});

describe("email recap", () => {
  const now = new Date(2026, 10, 25, 7, 0);
  const list = [
    e({ subject: "Field trip", category: "important", importance: 3, isSchool: true, hasDeadline: true, needsReply: true }),
    e({ subject: "Club meeting", category: "school", importance: 1, isSchool: true }),
    e({ subject: "Sale", category: "notifications", importance: 0 }),
    e({ subject: "From Jordan", category: "personal", importance: 2, needsReply: true, receivedAt: new Date(2026, 10, 24, 22).toISOString() }),
    e({ subject: "Today", receivedAt: new Date(2026, 10, 25, 6).toISOString() }),
    e({ subject: "Hidden", dismissed: true }),
    e({ subject: "Gone", deleted: true }),
  ];

  it("summarizes yesterday in local time, most important first, skipping hidden and routine notifications", () => {
    expect(yesterday(now)).toBe("2026-11-24");
    const r = recapFor(list, yesterday(now));
    expect([r.total, r.important, r.school, r.needsReply, r.deadlines]).toEqual([4, 2, 2, 2, 1]);
    expect(r.highlights.map((x) => x.subject)).toEqual(["Field trip", "From Jordan", "Club meeting"]);
    expect(recapSentence(r)).toBe("You got 4 emails yesterday — 2 important, 2 need a reply, 1 with a deadline.");
    expect(recapSentence(recapFor([], "2026-11-24"))).toBe("No new email yesterday.");
  });

  it("counts by category and lists newest first", () => {
    expect(countsByCategory(list)).toEqual({ all: 5, important: 1, school: 1, personal: 1, notifications: 1, other: 1 });
    expect(visibleEmails(list)[0].subject).toBe("Today");
  });
});
