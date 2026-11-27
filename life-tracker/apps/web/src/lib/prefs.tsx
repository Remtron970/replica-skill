import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_PINS, PINNABLE, type SectionId } from "../app/sections";

/**
 * Per-device preferences. Until the backend arrives (Phase 3) these live in
 * this browser only; they move to the `profiles` table then.
 */
export type ThemePref = "system" | "light" | "dark";

export interface Prefs {
  name: string;
  theme: ThemePref;
  pins: SectionId[];
}

const KEY = "lt.prefs";
const DEFAULTS: Prefs = { name: "", theme: "system", pins: DEFAULT_PINS };
export const MAX_PINS = 3;

function load(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<Prefs>;
    const pins = Array.isArray(raw.pins)
      ? raw.pins.filter((p): p is SectionId => PINNABLE.includes(p as SectionId)).slice(0, MAX_PINS)
      : DEFAULTS.pins;
    return {
      name: typeof raw.name === "string" ? raw.name.slice(0, 40) : "",
      theme: raw.theme === "light" || raw.theme === "dark" ? raw.theme : "system",
      pins: pins.length ? pins : DEFAULTS.pins,
    };
  } catch {
    return DEFAULTS;
  }
}

function save(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode or blocked storage: keep working in memory */
  }
}

interface PrefsCtx {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
  isDark: boolean;
}

const Ctx = createContext<PrefsCtx | null>(null);

function systemDark() {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(load);
  const [sysDark, setSysDark] = useState(systemDark);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSysDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const isDark = prefs.theme === "dark" || (prefs.theme === "system" && sysDark);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", isDark ? "#15120F" : "#FFF8F0");
  }, [isDark]);

  const update = useCallback((patch: Partial<Prefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({ prefs, update, isDark }), [prefs, update, isDark]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return v;
}
