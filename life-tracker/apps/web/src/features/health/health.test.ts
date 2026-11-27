import { describe, expect, it } from "vitest";
import { parseIngest } from "../../../../../supabase/functions/_shared/health/ingest.ts";
import { goalStreak, lastDays, mergeDays, summarize, thisWeek } from "./stats";
import type { HealthDay } from "./types";

describe("parseIngest (what the Shortcut sends)", () => {
  const today = "2026-11-25";
  it("reads numbers sent as text, in miles and pounds, defaulting to today", () => {
    const r = parseIngest({ Steps: "8,421", "distance mi": "3.2", active_energy: "412.6", exercise_minutes: "34.0", weight_lb: "150" }, today);
    expect(r.days).toEqual([{ day: today, steps: 8421, distanceKm: 5.15, activeEnergyKcal: 412.6, exerciseMinutes: 34 }]);
    expect(r.weightKg).toBe(68.04);
    expect(r.problems).toEqual([]);
  });

  it("accepts km/kg, an explicit date and several days at once (later entries win)", () => {
    const r = parseIngest({ days: [{ date: "2026-11-24", steps: 5000, distance_km: 3.5 }, { date: "2026-11-25T21:30:00", steps: 9000 }, { date: "2026-11-24", steps: 5100 }], weight: 62, weight_unit: "kg" }, today);
    expect(r.days.map((d) => [d.day, d.steps])).toEqual([["2026-11-24", 5100], ["2026-11-25", 9000]]);
    expect(r.weightKg).toBe(62);
  });

  it("ignores impossible values and far-off dates, explaining why", () => {
    const r = parseIngest({ days: [{ steps: -10, exercise_minutes: 3000, distance_km: 2 }, { date: "2027-01-01", steps: 100 }, { date: "last tuesday", steps: 1 }], weight_kg: 5 }, today);
    expect(r.days).toEqual([{ day: today, steps: null, distanceKm: 2, activeEnergyKcal: null, exerciseMinutes: null }]);
    expect(r.weightKg).toBeNull();
    expect(r.problems).toHaveLength(5);
  });

  it("explains an empty or malformed request", () => {
    expect(parseIngest({ hello: 1 }, today).problems[0]).toMatch(/No health values/);
    expect(parseIngest("steps=5", today).problems[0]).toMatch(/JSON dictionary/);
  });
});

describe("health stats", () => {
  let n = 0;
  const row = (day: string, source: "shortcut" | "manual", o: Partial<HealthDay>): HealthDay => ({
    id: `h${++n}`, clientUpdatedAt: 1, deleted: false, source, day, steps: null, distanceKm: null, activeEnergyKcal: null, exerciseMinutes: null, ...o,
  });
  const rows = [
    row("2026-11-23", "manual", { steps: 4000 }),
    row("2026-11-24", "manual", { steps: 6000, exerciseMinutes: 45 }),
    row("2026-11-24", "shortcut", { steps: 8000, distanceKm: 6 }), // Apple Health wins for steps; manual keeps exercise
    row("2026-11-25", "shortcut", { steps: 9000 }),
    row("2026-11-22", "shortcut", { steps: 12000, deleted: true }),
  ];
  const merged = mergeDays(rows);

  it("prefers Apple Health per metric, keeps manual where Health has nothing", () => {
    expect(merged.get("2026-11-24")).toMatchObject({ steps: 8000, distanceKm: 6, exerciseMinutes: 45, fromHealth: true });
    expect(merged.has("2026-11-22")).toBe(false);
  });

  it("missing days are null (no data), not zero", () => {
    const week = lastDays(merged, "2026-11-25", 5);
    expect(week.map((d) => d.steps)).toEqual([null, null, 4000, 8000, 9000]);
    expect(summarize(week, "steps")).toEqual({ total: 21000, average: 7000, daysWithData: 3 });
  });

  it("this week runs Monday to today", () => {
    expect(thisWeek(merged, new Date(2026, 10, 25, 12)).map((d) => d.day)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25"]);
  });

  it("goal streak counts consecutive days at or over the goal", () => {
    expect(goalStreak(merged, "2026-11-25", 7500)).toBe(2);
    expect(goalStreak(merged, "2026-11-26", 7500)).toBe(2); // today not done yet: count from yesterday
    expect(goalStreak(merged, "2026-11-25", 10000)).toBe(0);
  });
});
