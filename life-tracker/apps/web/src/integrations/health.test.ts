import { describe, expect, it } from "vitest";
import { bearerKey, newIngestKey, runHealthIngest, sha256Hex } from "../../../../supabase/functions/_shared/health/runIngest.ts";
import { fakeDb } from "./fakeDb";

async function setup() {
  const key = newIngestKey();
  const f = fakeDb({
    health_ingest_tokens: [{ id: "tok1", user_id: "u1", token_hash: await sha256Hex(key), last_used_at: null }],
    profiles: [{ id: "u1", timezone: "America/Los_Angeles" }],
    health_daily: [],
    weight_entries: [],
  });
  let n = 0;
  return { key, ...f, deps: (iso: string) => ({ now: new Date(iso), newId: () => `new${++n}` }) };
}

describe("health ingest (Shortcut endpoint)", () => {
  it("makes unguessable keys and only accepts well-formed Bearer headers", () => {
    const k = newIngestKey();
    expect(k).toMatch(/^lth_[A-Za-z0-9_-]{43}$/);
    expect(newIngestKey()).not.toBe(k);
    expect(bearerKey(`Bearer ${k}`)).toBe(k);
    expect(bearerKey(k)).toBeNull();
    expect(bearerKey("Bearer eyJhbGciOi.some.jwt")).toBeNull();
  });

  it("rejects a missing or wrong key without touching data", async () => {
    const { db, tables, deps } = await setup();
    expect((await runHealthIngest(db, null, { steps: 1 }, deps("2026-11-26T03:00:00Z"))).status).toBe(401);
    expect((await runHealthIngest(db, newIngestKey(), { steps: 1 }, deps("2026-11-26T03:00:00Z"))).status).toBe(401);
    expect(tables.health_daily).toHaveLength(0);
  });

  it("stores today's numbers in the user's time zone and updates the same row on re-send", async () => {
    const { db, tables, key, deps } = await setup();
    // 03:00 UTC on the 26th is still the 25th in Los Angeles.
    const a = await runHealthIngest(db, key, { steps: "4,100", distance_mi: "1.9" }, deps("2026-11-26T03:00:00Z"));
    expect(a).toMatchObject({ status: 200, body: { ok: true, saved: { days: ["2026-11-25"], weight: false } } });
    expect(tables.health_daily[0]).toMatchObject({ user_id: "u1", source: "shortcut", external_id: "shortcut:2026-11-25", day: "2026-11-25", steps: 4100, distance_km: 3.058 });

    await runHealthIngest(db, key, { steps: 9000 }, deps("2026-11-26T06:00:00Z"));
    expect(tables.health_daily).toHaveLength(1);
    expect(tables.health_daily[0]).toMatchObject({ id: "new1", steps: 9000, client_updated_at: "2026-11-26T06:00:00.000Z" });
    expect(tables.health_ingest_tokens[0].last_used_at).toBe("2026-11-26T06:00:00.000Z");
  });

  it("stays newer than the stored row even if clocks disagree", async () => {
    const { db, tables, key, deps } = await setup();
    tables.health_daily.push({ id: "h1", user_id: "u1", source: "shortcut", external_id: "shortcut:2026-11-25", client_updated_at: "2026-11-26T09:00:00.000Z", steps: 1 });
    await runHealthIngest(db, key, { steps: 2 }, deps("2026-11-26T05:00:00Z"));
    expect(tables.health_daily[0]).toMatchObject({ id: "h1", steps: 2, client_updated_at: "2026-11-26T09:00:00.001Z" });
  });

  it("saves weight once per day (in kg) and reports values it ignored", async () => {
    const { db, tables, key, deps } = await setup();
    const r = await runHealthIngest(db, key, { steps: 300000, exercise_minutes: 20, weight_lb: "160" }, deps("2026-11-25T20:00:00Z"));
    expect(r.body.saved).toEqual({ days: ["2026-11-25"], weight: true });
    expect(r.body.problems).toEqual(["Steps 300000 is out of range and was ignored."]);
    await runHealthIngest(db, key, { weight_lb: "159" }, deps("2026-11-25T21:00:00Z"));
    expect(tables.weight_entries).toHaveLength(1);
    expect(tables.weight_entries[0]).toMatchObject({ source: "shortcut", weight_kg: 72.12 });
  });

  it("explains a request with nothing usable", async () => {
    const { db, key, deps } = await setup();
    const r = await runHealthIngest(db, key, { stepz: 5 }, deps("2026-11-25T20:00:00Z"));
    expect(r.status).toBe(400);
    expect(r.body.error).toMatch(/No health values/);
  });
});
