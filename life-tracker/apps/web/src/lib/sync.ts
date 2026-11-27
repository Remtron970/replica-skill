import { DEFAULT_PINS, PINNABLE, type SectionId } from "../app/sections";

/** Preferences that follow the user across devices (stored in `profiles`). */
export type ThemePref = "system" | "light" | "dark";
export type DashboardSectionId = "briefing" | "stats" | "schedule" | "important";
export interface DashboardItem {
  id: DashboardSectionId;
  visible: boolean;
}

export interface Prefs {
  name: string;
  theme: ThemePref;
  pins: SectionId[];
  dashboard: DashboardItem[];
  demo: boolean;
  /** ms since epoch of the last change on any device; 0 = never changed. */
  updatedAt: number;
}

export const MAX_PINS = 3;
export const DASHBOARD_SECTIONS: { id: DashboardSectionId; label: string }[] = [
  { id: "briefing", label: "Daily briefing" },
  { id: "stats", label: "At a glance" },
  { id: "schedule", label: "Today's schedule" },
  { id: "important", label: "Important" },
];
export const DEFAULT_DASHBOARD: DashboardItem[] = DASHBOARD_SECTIONS.map((s) => ({ id: s.id, visible: true }));
export const DEFAULT_PREFS: Prefs = { name: "", theme: "system", pins: DEFAULT_PINS, dashboard: DEFAULT_DASHBOARD, demo: false, updatedAt: 0 };

/** Keep known sections in the saved order, drop junk/duplicates, append any new sections. */
export function normalizeDashboard(raw: unknown): DashboardItem[] {
  const known = new Set(DASHBOARD_SECTIONS.map((s) => s.id));
  const out: DashboardItem[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const id = (item as DashboardItem)?.id;
      if (known.has(id) && !out.some((o) => o.id === id)) out.push({ id, visible: (item as DashboardItem).visible !== false });
    }
  }
  for (const s of DASHBOARD_SECTIONS) if (!out.some((o) => o.id === s.id)) out.push({ id: s.id, visible: true });
  return out;
}

function normalizePins(raw: unknown): SectionId[] {
  if (!Array.isArray(raw)) return DEFAULT_PINS;
  const pins = [...new Set(raw)].filter((p): p is SectionId => PINNABLE.includes(p as SectionId)).slice(0, MAX_PINS);
  return pins.length ? pins : DEFAULT_PINS;
}

/** Validate prefs stored on this device; anything malformed falls back to defaults. */
export function parsePrefs(json: string | null): Prefs {
  try {
    const raw = JSON.parse(json || "{}") as Partial<Prefs> | null;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return DEFAULT_PREFS;
    return {
      name: typeof raw.name === "string" ? raw.name.slice(0, 40) : "",
      theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : "system",
      pins: normalizePins(raw.pins),
      dashboard: normalizeDashboard(raw.dashboard),
      demo: raw.demo === true,
      updatedAt: typeof raw.updatedAt === "number" && raw.updatedAt > 0 ? raw.updatedAt : 0,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** Shape of a `public.profiles` row (see supabase/migrations). */
export interface ProfileRow {
  id: string;
  display_name: string;
  timezone: string;
  theme: string;
  nav_pins: string[];
  dashboard_layout: unknown;
  demo_mode: boolean;
  prefs_updated_at: string;
}

export function rowToPrefs(row: ProfileRow): Prefs {
  const t = Date.parse(row.prefs_updated_at);
  return {
    name: (row.display_name ?? "").slice(0, 40),
    theme: row.theme === "light" || row.theme === "dark" ? row.theme : "system",
    pins: normalizePins(row.nav_pins),
    dashboard: normalizeDashboard(row.dashboard_layout),
    demo: row.demo_mode === true,
    updatedAt: Number.isFinite(t) && t > 0 ? t : 0,
  };
}

export function prefsToRow(p: Prefs, timezone: string): Omit<ProfileRow, "id"> {
  return {
    display_name: p.name,
    timezone,
    theme: p.theme,
    nav_pins: p.pins,
    dashboard_layout: p.dashboard,
    demo_mode: p.demo,
    prefs_updated_at: new Date(p.updatedAt || 0).toISOString(),
  };
}

/** Last-write-wins: whichever copy was changed most recently is kept. */
export function pickWinner(local: Prefs, remote: Prefs): "local" | "remote" | "equal" {
  if (local.updatedAt === remote.updatedAt) return "equal";
  return local.updatedAt > remote.updatedAt ? "local" : "remote";
}
