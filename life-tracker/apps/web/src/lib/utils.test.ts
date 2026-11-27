import { describe, expect, it } from "vitest";
import { formatCountdown } from "../components/ui/Progress";
import { formatRelative } from "../components/ui/SyncStatus";
import { greetingFor } from "./time";

const at = (h: number, m = 0) => new Date(2026, 10, 27, h, m);

describe("greetingFor", () => {
  it.each([
    [3, "Good night"],
    [5, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [16, "Good afternoon"],
    [17, "Good evening"],
    [21, "Good evening"],
    [22, "Good night"],
  ])("%i:00 → %s", (h, expected) => {
    expect(greetingFor(at(h))).toBe(expected);
  });
});

describe("formatCountdown", () => {
  it.each([
    [-5, "now"],
    [0, "now"],
    [9_000, "9s"],
    [64_000, "1m 04s"],
    [12 * 60_000 + 4_000, "12m 04s"],
    [3_600_000 + 5 * 60_000, "1h 05m"],
  ])("%i ms → %s", (ms, expected) => {
    expect(formatCountdown(ms)).toBe(expected);
  });
});

describe("formatRelative", () => {
  const now = at(12);
  it.each([
    [10_000, "just now"],
    [5 * 60_000, "5 min ago"],
    [3 * 3_600_000, "3 h ago"],
    [24 * 3_600_000, "yesterday"],
    [3 * 24 * 3_600_000, "3 days ago"],
  ])("%i ms ago → %s", (ago, expected) => {
    expect(formatRelative(new Date(now.getTime() - ago), now)).toBe(expected);
  });
});
