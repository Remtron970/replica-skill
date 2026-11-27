/**
 * Reads what the iPhone Shortcut sends. Shortcuts can send numbers as text
 * ("8,421", "8421.0"), use the phone's units (miles/pounds or km/kg), and name
 * fields a few different ways, so this is forgiving about format but strict
 * about values. Pure; shared by the health-ingest function and tests.
 */

export interface IngestDay {
  day: string; // YYYY-MM-DD
  steps: number | null;
  distanceKm: number | null;
  activeEnergyKcal: number | null;
  exerciseMinutes: number | null;
}

export interface IngestResult {
  days: IngestDay[];
  weightKg: number | null;
  /** Human-readable problems (values that were ignored). */
  problems: string[];
}

const KM_PER_MI = 1.609344;
const KG_PER_LB = 0.45359237;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/,/g, "").replace(/\s*(steps?|km|mi|miles?|kcal|cal|min(utes)?|lbs?|kg)\s*$/i, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function pick(o: Record<string, unknown>, keys: string[]): unknown {
  const lower = new Map(Object.entries(o).map(([k, v]) => [k.toLowerCase().replace(/[\s-]/g, "_"), v]));
  for (const k of keys) if (lower.has(k)) return lower.get(k);
  return undefined;
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function inRange(label: string, v: number | null, min: number, max: number, problems: string[]): number | null {
  if (v === null) return null;
  if (v < min || v > max) {
    problems.push(`${label} ${v} is out of range and was ignored.`);
    return null;
  }
  return v;
}

function parseDay(o: Record<string, unknown>, today: string, problems: string[]): IngestDay | null {
  const rawDate = pick(o, ["date", "day"]);
  let day = today;
  if (typeof rawDate === "string" && rawDate.trim()) {
    const d = rawDate.trim().slice(0, 10);
    if (!DATE_RE.test(d) || Number.isNaN(Date.parse(d))) {
      problems.push(`Date "${rawDate}" isn't YYYY-MM-DD; skipped.`);
      return null;
    }
    day = d;
  }
  if (day > addDays(today, 1) || day < addDays(today, -60)) {
    problems.push(`Date ${day} is too far from today; skipped.`);
    return null;
  }

  let distanceKm = num(pick(o, ["distance_km", "km"]));
  const mi = num(pick(o, ["distance_mi", "distance_miles", "miles", "mi"]));
  if (distanceKm === null && mi !== null) distanceKm = mi * KM_PER_MI;
  if (distanceKm === null) {
    const d = num(pick(o, ["distance", "walking_running_distance"]));
    const unit = String(pick(o, ["distance_unit", "unit"]) ?? "km").toLowerCase();
    if (d !== null) distanceKm = /^mi/.test(unit) ? d * KM_PER_MI : d;
  }

  const steps = inRange("Steps", num(pick(o, ["steps", "step_count"])), 0, 200000, problems);
  const out: IngestDay = {
    day,
    steps: steps === null ? null : Math.round(steps),
    distanceKm: (() => {
      const v = inRange("Distance", distanceKm, 0, 400, problems);
      return v === null ? null : Math.round(v * 1000) / 1000;
    })(),
    activeEnergyKcal: (() => {
      const v = inRange("Active energy", num(pick(o, ["active_energy_kcal", "active_energy", "active_kcal", "active_calories", "kcal"])), 0, 20000, problems);
      return v === null ? null : Math.round(v * 10) / 10;
    })(),
    exerciseMinutes: (() => {
      const v = inRange("Exercise minutes", num(pick(o, ["exercise_minutes", "exercise_min", "exercise"])), 0, 1440, problems);
      return v === null ? null : Math.round(v);
    })(),
  };
  if (out.steps === null && out.distanceKm === null && out.activeEnergyKcal === null && out.exerciseMinutes === null) return null;
  return out;
}

export function parseIngest(body: unknown, today: string): IngestResult {
  const problems: string[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) return { days: [], weightKg: null, problems: ["Send a JSON dictionary (see the setup guide)."] };
  const o = body as Record<string, unknown>;
  const list = Array.isArray(o.days) ? (o.days as unknown[]) : [o];
  const days: IngestDay[] = [];
  for (const item of list.slice(0, 62)) {
    if (!item || typeof item !== "object") continue;
    const d = parseDay(item as Record<string, unknown>, today, problems);
    if (d) {
      const i = days.findIndex((x) => x.day === d.day);
      if (i >= 0) days[i] = d;
      else days.push(d);
    }
  }

  let weightKg = num(pick(o, ["weight_kg", "kg_weight"]));
  const lb = num(pick(o, ["weight_lb", "weight_lbs", "lb", "lbs"]));
  if (weightKg === null && lb !== null) weightKg = lb * KG_PER_LB;
  if (weightKg === null) {
    const w = num(pick(o, ["weight", "body_mass"]));
    const unit = String(pick(o, ["weight_unit"]) ?? "kg").toLowerCase();
    if (w !== null) weightKg = /^lb/.test(unit) ? w * KG_PER_LB : w;
  }
  weightKg = inRange("Weight", weightKg, 20, 400, problems);
  if (weightKg !== null) weightKg = Math.round(weightKg * 100) / 100;

  if (!days.length && weightKg === null && !problems.length) problems.push("No health values found. Check the field names in the Shortcut.");
  return { days, weightKg, problems };
}
