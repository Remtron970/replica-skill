import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * The Supabase client, or null when cloud sync isn't configured yet.
 * Without it the app still works fully, saving to this device only.
 */
export const supabase: SupabaseClient | null =
  url && anonKey && !url.includes("your-project-ref")
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
      })
    : null;

export const cloudEnabled = supabase !== null;
export const googleEnabled = cloudEnabled && import.meta.env.VITE_AUTH_GOOGLE === "1";
