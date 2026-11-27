import { describe, expect, it } from "vitest";
import { DEFAULT_DASHBOARD, DEFAULT_PREFS, normalizeDashboard, parsePrefs, pickWinner, prefsToRow, rowToPrefs, type Prefs } from "./sync";

describe("parsePrefs", () => {
  it("returns defaults for missing or broken data", () => {
    for (const raw of [null, "", "not json", "null", "42", "[]"]) expect(parsePrefs(raw)).toEqual(DEFAULT_PREFS);
  });

  it("keeps valid values", () => {
    const p: Prefs = {
      name: "Sam",
      theme: "dark",
      pins: ["health", "news"],
      dashboard: [
        { id: "schedule", visible: true },
        { id: "stats", visible: false },
        { id: "briefing", visible: true },
        { id: "important", visible: true },
      ],
      demo: true,
      updatedAt: 1_700_000_000_000,
    };
    expect(parsePrefs(JSON.stringify(p))).toEqual(p);
  });

  it("drops unknown sections, de-duplicates and caps pins, trims long names", () => {
    const p = parsePrefs(JSON.stringify({ name: "x".repeat(99), theme: "neon", pins: ["home", "settings", "bogus", "email", "email", "news", "ai", "health"], demo: "yes", updatedAt: -5 }));
    expect(p.name).toHaveLength(40);
    expect(p.theme).toBe("system");
    expect(p.pins).toEqual(["email", "news", "ai"]);
    expect(p.demo).toBe(false);
    expect(p.updatedAt).toBe(0);
  });
});

describe("normalizeDashboard", () => {
  it("keeps saved order, removes junk and duplicates, appends missing sections", () => {
    expect(normalizeDashboard([{ id: "important", visible: false }, { id: "nope" }, { id: "important", visible: true }, "x", null, { id: "stats" }])).toEqual([
      { id: "important", visible: false },
      { id: "stats", visible: true },
      { id: "briefing", visible: true },
      { id: "schedule", visible: true },
    ]);
  });
  it("falls back to the default layout", () => {
    expect(normalizeDashboard(undefined)).toEqual(DEFAULT_DASHBOARD);
    expect(normalizeDashboard({})).toEqual(DEFAULT_DASHBOARD);
  });
});

describe("profile row mapping", () => {
  it("round-trips preferences through a database row", () => {
    const p: Prefs = { ...DEFAULT_PREFS, name: "Ana", theme: "light", pins: ["calendar"], demo: true, updatedAt: Date.UTC(2026, 10, 27, 8) };
    const row = { id: "u1", ...prefsToRow(p, "America/Chicago") };
    expect(row.timezone).toBe("America/Chicago");
    expect(row.prefs_updated_at).toBe("2026-11-27T08:00:00.000Z");
    expect(rowToPrefs(row)).toEqual(p);
  });

  it("treats a never-changed profile ('epoch') as older than any local change", () => {
    const remote = rowToPrefs({ id: "u", display_name: "", timezone: "UTC", theme: "system", nav_pins: ["ai"], dashboard_layout: [], demo_mode: false, prefs_updated_at: "1970-01-01T00:00:00+00:00" });
    expect(remote.updatedAt).toBe(0);
    expect(pickWinner({ ...DEFAULT_PREFS, updatedAt: 5 }, remote)).toBe("local");
  });
});

describe("pickWinner (last write wins)", () => {
  const at = (updatedAt: number) => ({ ...DEFAULT_PREFS, updatedAt });
  it("prefers the newer copy", () => {
    expect(pickWinner(at(200), at(100))).toBe("local");
    expect(pickWinner(at(100), at(200))).toBe("remote");
    expect(pickWinner(at(100), at(100))).toBe("equal");
  });
  it("a new device with untouched settings takes the cloud copy", () => {
    expect(pickWinner(at(0), at(100))).toBe("remote");
  });
});
