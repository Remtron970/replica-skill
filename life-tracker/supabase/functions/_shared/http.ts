import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.119.2";
import { importKey } from "./crypto.ts";

/** Shared plumbing for Life Tracker's Edge Functions. */

export const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Server is missing the ${name} secret`);
  return v;
};

/** Only the app's own address may call these functions from a browser. */
export function cors(req: Request): Record<string, string> {
  const allowed = (Deno.env.get("APP_URL") ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : (allowed[0] ?? ""),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    Vary: "Origin",
  };
}

export function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors(req) } });
}

export function serviceClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
}

/** The signed-in user making the request, verified with Supabase Auth. */
export async function requireUser(req: Request): Promise<User | null> {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const client = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data, error } = await client.auth.getUser();
  return error ? null : data.user;
}

export const tokenKey = () => importKey(env("TOKEN_ENCRYPTION_KEY"));
