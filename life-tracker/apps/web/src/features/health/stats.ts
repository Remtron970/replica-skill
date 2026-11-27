import { localDate } from "../academics/grades";
import type { HealthDay } from "./types";

export type Metric = "steps" | "distanceKm" | "activeEnergyKcal" | "exerciseMinutes";
export const METRICS: Metric[] = ["steps", "distanceKm", "activeEnergyKcal", "exerciseMinutes"];

export interface DayTotals {
  day: string;
  steps: number | null;
  distanceKm: number | null;
  activeEnergyKcal: number | null;
  exerciseMinutes: number | null;
  /** Where the numbers came from (Apple Health wins over manual entries, per metric). */
  fromHealth: boolean;
}

const RANK: Record<string, number> = { shortcut: 0, manual: 1, demo: 2 };

/** One set of numbers per day: for each metric, Apple Health first, then manual. */
export function mergeDays(rows: HealthDay[]): Map<string, DayTotals> {
  const byDay = new Map<string, HealthDay[]>();
  for (const r of rows) if (!r.deleted) (byDay.get(r.day) ?? byDay.set(r.day, []).get(r.day)!).push(r);
  const out = new Map<string, DayTotals>();
  for (const [day, rs] of byDay) {
    const sorted = [...rs].sort((a, b) => (RANK[a.source] ?? 9) - (RANK[b.source] ?? 9));
    const t: DayTotals = { day, steps: null, distanceKm: null, activeEnergyKcal: null, exerciseMinutes: null, fromHealth: false };
    for (const m of METRICS) {
      const r = sorted.find((x) => x[m] !== null && x[m] !== undefined);
      if (r) {
        t[m] = r[m];
        if (r.source === "shortcut") t.fromHealth = true;
      }
    }
    out.set(day, t);
  }
  return out;
}

const shift = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + n));
};

/** The last `n` days ending today, oldest first; missing days have null values (not 0). */
export function lastDays(merged: Map<string, DayTotals>, today: string, n: number): DayTotals[] {
  return Array.from({ length: n }, (_, i) => {
    const day = shift(today, i - n + 1);
    return merged.get(day) ?? { day, steps: null, distanceKm: null, activeEnergyKcal: null, exerciseMinutes: null, fromHealth: false };
  });
}

export interface PeriodSummary {
  total: number;
  /** Average over days that have data. */
  average: number | null;
  daysWithData: number;
}

export function summarize(days: DayTotals[], m: Metric): PeriodSummary {
  const vals = days.map((d) => d[m]).filter((v): v is number => v !== null);
  const total = vals.reduce((a, b) => a + b, 0);
  return { total: Math.round(total * 100) / 100, average: vals.length ? Math.round((total / vals.length) * 10) / 10 : null, daysWithData: vals.length };
}

/** Monday-to-today of the current week. */
export function thisWeek(merged: Map<string, DayTotals>, now: Date): DayTotals[] {
  const today = localDate(now);
  const sinceMonday = (now.getDay() + 6) % 7;
  return lastDays(merged, today, sinceMonday + 1);
}

/** Consecutive days (ending today or yesterday) that reached the step goal. */
export function goalStreak(merged: Map<string, DayTotals>, today: string, goal: number): number {
  let n = 0;
  let day = (merged.get(today)?.steps ?? 0) >= goal ? today : shift(today, -1);
  while ((merged.get(day)?.steps ?? -1) >= goal) {
    n++;
    day = shift(day, -1);
  }
  return n;
}

export const KM_PER_MI = 1.609344;
export const KG_PER_LB = 0.45359237;
export const fmtDistance = (km: number | null, imperial: boolean) => (km === null ? "—" : imperial ? `${(km / KM_PER_MI).toFixed(1)} mi` : `${km.toFixed(1)} km`);
export const fmtWeight = (kg: number, imperial: boolean) => (imperial ? `${(kg / KG_PER_LB).toFixed(1)} lb` : `${kg.toFixed(1)} kg`);
