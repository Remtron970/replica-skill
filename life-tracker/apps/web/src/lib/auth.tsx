import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { cloudEnabled, supabase } from "./supabase";

interface AuthCtx {
  /** False until Supabase is configured; the app then runs device-only. */
  enabled: boolean;
  loading: boolean;
  user: User | null;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

/** Turn Supabase/network errors into messages a person can act on. */
export function friendlyAuthError(err: unknown): string {
  const e = err as { message?: string; status?: number; code?: string } | null;
  const msg = (e?.message ?? "").toLowerCase();
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You're offline. Connect to the internet and try again.";
  if (e?.status === 429 || msg.includes("rate limit") || msg.includes("security purposes"))
    return "Too many attempts. Wait a minute, then try again.";
  if (msg.includes("expired") || msg.includes("invalid") || e?.code === "otp_expired")
    return "That code is wrong or has expired. Check the latest email, or send a new code.";
  if (msg.includes("email") && msg.includes("valid")) return "Enter a valid email address.";
  if (msg.includes("fetch") || msg.includes("network")) return "Couldn't reach the server. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

function requireClient() {
  if (!supabase) throw new Error("Cloud sync is not configured");
  return supabase;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(cloudEnabled);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const sendCode = useCallback(async (email: string) => {
    const { error } = await requireClient().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  }, []);

  const verifyCode = useCallback(async (email: string, code: string) => {
    const { error } = await requireClient().auth.verifyOtp({ email, token: code, type: "email" });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await requireClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await requireClient().auth.signOut();
    if (error) throw error;
  }, []);

  const deleteAccount = useCallback(async () => {
    const client = requireClient();
    const { error } = await client.rpc("delete_my_account");
    if (error) throw error;
    // The server-side user is gone; drop the local session too.
    await client.auth.signOut({ scope: "local" });
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ enabled: cloudEnabled, loading, user: session?.user ?? null, sendCode, verifyCode, signInWithGoogle, signOut, deleteAccount }),
    [loading, session, sendCode, verifyCode, signInWithGoogle, signOut, deleteAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside <AuthProvider>");
  return v;
}
