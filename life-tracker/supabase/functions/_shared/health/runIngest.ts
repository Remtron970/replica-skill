/**
 * Health ingest core: checks the personal key, then stores the Shortcut's
 * numbers. Kept free of Deno globals so it runs under the tests too.
 */
import { todayIn } from "../email/runEmailSync.ts";
import { justAfter } from "../school/apply.ts";
import { parseIngest } from "./ingest.ts";

// deno-lint-ignore no-explicit-any
type Db = { from: (t: string) => any };

export const KEY_PREFIX = "lth_";

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newIngestKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return KEY_PREFIX + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function bearerKey(header: string | null): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? "");
  const k = m?.[1] ?? null;
  return k && k.startsWith(KEY_PREFIX) && k.length >= 20 && k.length <= 100 ? k : null;
}

export interface IngestOutcome {
  status: number;
  body: { ok: boolean; saved?: { days: string[]; weight: boolean }; problems?: string[]; error?: string };
}

const newer = (prev: string | undefined, now: string) => (prev && Date.parse(prev) >= Date.parse(now) ? justAfter(prev) : now);

export async function runHealthIngest(db: Db, key: string | null, body: unknown, deps: { now: Date; newId: () => string }): Promise<IngestOutcome> {
  if (!key) return { status: 401, body: { ok: false, error: "Missing or malformed key. Add the header  Authorization: Bearer lth_…  (copy it from Life Tracker → Health → Connect)." } };
  const { data: token } = await db.from("health_ingest_tokens").select("id, user_id").eq("token_hash", await sha256Hex(key)).single();
  if (!token) return { status: 401, body: { ok: false, error: "That key isn't valid anymore. Make a new one in Life Tracker → Health → Connect and paste it into the Shortcut." } };
  const userId = token.user_id as string;

  const { data: profile } = await db.from("profiles").select("timezone").eq("id", userId).single();
  const today = todayIn((profile?.timezone as string) || "UTC", deps.now);
  const parsed = parseIngest(body, today);
  if (!parsed.days.length && parsed.weightKg === null) return { status: 400, body: { ok: false, problems: parsed.problems, error: parsed.problems[0] } };

  const now = deps.now.toISOString();
  const externalIds = parsed.days.map((d) => `shortcut:${d.day}`);
  const weightId = `shortcut:weight:${today}`;
  const existing = new Map<string, { id: string; client_updated_at: string }>();
  for (const [table, ids] of [["health_daily", externalIds], ["weight_entries", [weightId]]] as const) {
    if (!ids.length) continue;
    const { data } = await db.from(table).select("id, external_id, client_updated_at").eq("user_id", userId).eq("source", "shortcut").in("external_id", ids);
    for (const r of (data ?? []) as { id: string; external_id: string; client_updated_at: string }[]) existing.set(`${table}|${r.external_id}`, r);
  }

  if (parsed.days.length) {
    const rows = parsed.days.map((d) => {
      const prev = existing.get(`health_daily|shortcut:${d.day}`);
      return {
        id: prev?.id ?? deps.newId(),
        user_id: userId,
        client_updated_at: newer(prev?.client_updated_at, now),
        deleted: false,
        source: "shortcut",
        external_id: `shortcut:${d.day}`,
        day: d.day,
        steps: d.steps,
        distance_km: d.distanceKm,
        active_energy_kcal: d.activeEnergyKcal,
        exercise_minutes: d.exerciseMinutes,
      };
    });
    const { error } = await db.from("health_daily").upsert(rows);
    if (error) return { status: 500, body: { ok: false, error: "Couldn't save your health data. Try again in a minute." } };
  }

  let weightSaved = false;
  if (parsed.weightKg !== null) {
    const prev = existing.get(`weight_entries|${weightId}`);
    const { error } = await db.from("weight_entries").upsert({
      id: prev?.id ?? deps.newId(),
      user_id: userId,
      client_updated_at: newer(prev?.client_updated_at, now),
      deleted: false,
      source: "shortcut",
      external_id: weightId,
      measured_at: now,
      weight_kg: parsed.weightKg,
    });
    weightSaved = !error;
  }

  await db.from("health_ingest_tokens").update({ last_used_at: now }).eq("id", token.id);
  return { status: 200, body: { ok: true, saved: { days: parsed.days.map((d) => d.day), weight: weightSaved }, problems: parsed.problems } };
}
