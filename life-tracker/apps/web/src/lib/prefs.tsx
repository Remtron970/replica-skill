import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { DEFAULT_PREFS, parsePrefs, pickWinner, prefsToRow, rowToPrefs, type Prefs, type ProfileRow } from "./sync";

export { MAX_PINS, parsePrefs, type Prefs, type ThemePref } from "./sync";

/**
 * Preferences: saved on this device instantly, and — when signed in — synced to
 * the user's profile in Supabase (last-write-wins across devices).
 */

const KEY = "lt.prefs";
const PENDING_KEY = "lt.prefs.pending";
const PUSH_DELAY_MS = 600;

export type SyncStatus = "local" | "syncing" | "synced" | "offline" | "error";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: keep working in memory */
  }
}

const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

interface PrefsCtx {
  prefs: Prefs;
  update: (patch: Partial<Omit<Prefs, "updatedAt">>) => void;
  isDark: boolean;
  sync: { status: SyncStatus; lastSyncedAt?: Date };
  retrySync: () => void;
}

const Ctx = createContext<PrefsCtx | null>(null);

/** The device's (or embedding page's) light/dark setting. A `data-theme` on <html> wins over the OS setting. */
function systemDark() {
  const host = typeof document !== "undefined" ? document.documentElement.getAttribute("data-theme") : null;
  if (host === "dark" || host === "light") return host === "dark";
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(() => parsePrefs(read(KEY)));
  const [sysDark, setSysDark] = useState(systemDark);
  const [sync, setSync] = useState<PrefsCtx["sync"]>({ status: "local" });
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const userId = user?.id ?? null;
  const timer = useRef<number | undefined>(undefined);

  // ---- theme ----
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSysDark(systemDark());
    mq.addEventListener("change", onChange);
    const mo = new MutationObserver(onChange);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", onChange);
      mo.disconnect();
    };
  }, []);

  const isDark = prefs.theme === "dark" || (prefs.theme === "system" && sysDark);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isDark ? "#15120F" : "#FFF8F0");
  }, [isDark]);

  // ---- cloud sync ----
  const push = useCallback(async () => {
    if (!supabase || !userId) return;
    if (!navigator.onLine) {
      write(PENDING_KEY, "1");
      setSync((s) => ({ ...s, status: "offline" }));
      return;
    }
    setSync((s) => ({ ...s, status: "syncing" }));
    const { error } = await supabase.from("profiles").update(prefsToRow(prefsRef.current, timezone())).eq("id", userId);
    if (error) {
      write(PENDING_KEY, "1");
      setSync((s) => ({ ...s, status: "error" }));
    } else {
      write(PENDING_KEY, null);
      setSync({ status: "synced", lastSyncedAt: new Date() });
    }
  }, [userId]);

  const pull = useCallback(async () => {
    if (!supabase || !userId) return;
    setSync((s) => ({ ...s, status: "syncing" }));
    let { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle<ProfileRow>();
    if (!error && !data) {
      // Normally created by the sign-up trigger; create it if missing.
      ({ data, error } = await supabase.from("profiles").insert({ id: userId }).select("*").single<ProfileRow>());
    }
    if (error || !data) {
      setSync((s) => ({ ...s, status: navigator.onLine ? "error" : "offline" }));
      return;
    }
    const remote = rowToPrefs(data);
    const winner = read(PENDING_KEY) ? "local" : pickWinner(prefsRef.current, remote);
    if (winner === "remote") {
      setPrefs(remote);
      write(KEY, JSON.stringify(remote));
      setSync({ status: "synced", lastSyncedAt: new Date() });
    } else if (winner === "local") {
      await push();
    } else {
      setSync({ status: "synced", lastSyncedAt: new Date() });
    }
  }, [userId, push]);

  // On sign-in (or app start while signed in): reconcile with the cloud copy.
  useEffect(() => {
    if (userId) void pull();
    else setSync({ status: "local" });
  }, [userId, pull]);

  // Retry unsent changes when the connection returns or the app comes back to the foreground.
  useEffect(() => {
    if (!userId) return;
    const retry = () => {
      if (read(PENDING_KEY) && navigator.onLine) void push();
    };
    const onVisible = () => document.visibilityState === "visible" && retry();
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId, push]);

  const update = useCallback(
    (patch: Partial<Omit<Prefs, "updatedAt">>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...patch, updatedAt: Date.now() };
        write(KEY, JSON.stringify(next));
        prefsRef.current = next;
        return next;
      });
      if (userId) {
        write(PENDING_KEY, "1");
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void push(), PUSH_DELAY_MS);
      }
    },
    [userId, push],
  );

  const retrySync = useCallback(() => void pull(), [pull]);

  const value = useMemo(() => ({ prefs, update, isDark, sync, retrySync }), [prefs, update, isDark, sync, retrySync]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return v;
}

/** Remove everything Life Tracker stored on this device. */
export function clearDeviceData() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("lt."))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export { DEFAULT_PREFS };
