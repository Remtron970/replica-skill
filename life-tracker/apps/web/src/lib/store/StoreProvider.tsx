import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "../auth";
import { supabase } from "../supabase";
import type { Collection, SyncRecord } from "./collection";
import { syncOnce, type EngineStatus, type Remote } from "./engine";
import { allCollections, bindings } from "./schema";

/** Supabase as the remote for the sync engine. RLS limits every call to the user's own rows. */
const supabaseRemote: Remote | null = supabase
  ? {
      async upsert(table, rows) {
        const { error } = await supabase!.from(table).upsert(rows, { onConflict: "id" });
        if (error) throw error;
      },
      async pull(table, since, limit) {
        let q = supabase!.from(table).select("*").order("updated_at", { ascending: true }).limit(limit);
        q = since ? q.gt("updated_at", since) : q.eq("deleted", false);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as Record<string, unknown>[];
      },
    }
  : null;

const DEBOUNCE_MS = 1500;
const INTERVAL_MS = 5 * 60_000;

interface StoreCtx {
  status: EngineStatus;
  /** Number of local changes not yet uploaded. */
  pending: number;
  syncNow: () => Promise<void>;
}

const Ctx = createContext<StoreCtx | null>(null);

function pendingCount() {
  return allCollections.reduce((n, c) => n + c.dirtyCount, 0);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<EngineStatus>({ state: "idle" });
  const [pending, setPending] = useState(pendingCount);
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const prevUser = useRef<string | null>(null);

  const run = useCallback(async (): Promise<void> => {
    if (!supabaseRemote || !userId) return;
    if (running.current) {
      again.current = true;
      return running.current;
    }
    if (!navigator.onLine) {
      setStatus((s) => ({ ...s, state: "offline" }));
      return;
    }
    setStatus((s) => ({ ...s, state: "syncing" }));
    running.current = (async () => {
      try {
        await syncOnce(supabaseRemote, bindings, userId);
        setStatus({ state: "synced", lastSyncedAt: new Date() });
      } catch (e) {
        setStatus((s) => ({ ...s, state: navigator.onLine ? "error" : "offline", error: (e as Error)?.message }));
      } finally {
        running.current = null;
        setPending(pendingCount());
        if (again.current) {
          again.current = false;
          void run();
        }
      }
    })();
    return running.current;
  }, [userId]);

  // Sign-in / sign-out.
  useEffect(() => {
    const prev = prevUser.current;
    prevUser.current = userId;
    if (userId) {
      allCollections.forEach((c) => c.claim(userId));
      void run();
    } else if (prev) {
      // Signed out: the account's data shouldn't stay on a possibly shared device.
      allCollections.forEach((c) => c.clear());
      setStatus({ state: "idle" });
    }
  }, [userId, run]);

  // Sync shortly after local changes, when back online, on return to the app, and periodically.
  useEffect(() => {
    const onChange = () => {
      setPending(pendingCount());
      if (!userId) return;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void run(), DEBOUNCE_MS);
    };
    const unsubs = allCollections.map((c) => c.subscribe(onChange));
    if (!userId) return () => unsubs.forEach((u) => u());
    const onOnline = () => void run();
    const onVisible = () => document.visibilityState === "visible" && void run();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(() => void run(), INTERVAL_MS);
    return () => {
      unsubs.forEach((u) => u());
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
      window.clearTimeout(timer.current);
    };
  }, [userId, run]);

  const value = useMemo(() => ({ status, pending, syncNow: run }), [status, pending, run]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStoreSync() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStoreSync must be used inside <StoreProvider>");
  return v;
}

/** Live list of a collection's records; re-renders when it changes. */
export function useCollection<T extends SyncRecord>(c: Collection<T>): T[] {
  return useSyncExternalStore(c.subscribe, c.list, c.list);
}
