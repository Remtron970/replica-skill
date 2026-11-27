// Google connections (OAuth 2.0, read-only scopes) for Classroom and Gmail.
//   POST /functions/v1/google-auth  { service: "classroom" | "gmail" }  → { url } to send the user to Google
//   GET  /functions/v1/google-auth?code&state  ← Google redirects here; stores the refresh token
//        encrypted, runs a first sync, and sends the user back to the app.
import { cors, env, json, requireUser, serviceClient, tokenKey } from "../_shared/http.ts";
import { aiFor } from "../_shared/email/aiClient.ts";
import { runEmailSync } from "../_shared/email/runEmailSync.ts";
import { CLASSROOM_SCOPES } from "../_shared/school/classroom.ts";
import { runSchoolSync, saveSecret } from "../_shared/school/runSync.ts";
import { signState, verifyState } from "../_shared/state.ts";

const SERVICES = {
  classroom: { provider: "google_classroom", scopes: CLASSROOM_SCOPES, label: "Google Classroom", back: "school" },
  gmail: { provider: "gmail", scopes: ["https://www.googleapis.com/auth/gmail.readonly"], label: "Gmail", back: "email" },
} as const;
type Service = keyof typeof SERVICES;

const callbackUrl = () => `${env("SUPABASE_URL")}/functions/v1/google-auth`;
const appUrl = () => env("APP_URL").split(",")[0].trim().replace(/\/+$/, "");
const back = (service: Service | null, result: string) =>
  Response.redirect(`${appUrl()}/#/${service === "gmail" ? "email" : "settings"}?${service === "gmail" ? "gmail" : "school"}=${encodeURIComponent(result)}`, 302);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const url = new URL(req.url);

  if (req.method === "POST") {
    const user = await requireUser(req);
    if (!user) return json(req, 401, { error: "Sign in first" });
    const body = await req.json().catch(() => ({}));
    const service: Service = body?.service === "gmail" ? "gmail" : "classroom";
    const state = await signState(env("TOKEN_ENCRYPTION_KEY"), `${user.id}~${service}`);
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.search = new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      redirect_uri: callbackUrl(),
      response_type: "code",
      scope: SERVICES[service].scopes.join(" "),
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: "false",
      state,
    }).toString();
    return json(req, 200, { url: auth.toString() });
  }

  // Callback from Google.
  const subject = await verifyState(env("TOKEN_ENCRYPTION_KEY"), url.searchParams.get("state") ?? "");
  const [userId, svc] = (subject ?? "").split("~");
  const service: Service | null = svc === "gmail" || svc === "classroom" ? svc : subject ? "classroom" : null;
  if (url.searchParams.get("error")) {
    const e = url.searchParams.get("error");
    return back(service, e === "access_denied" ? "cancelled" : e === "admin_policy_enforced" || e === "org_internal" ? "blocked" : "error");
  }
  const code = url.searchParams.get("code");
  if (!subject || !service || !code) return back(service, "error");
  const s = SERVICES[service];

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), redirect_uri: callbackUrl(), grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) return back(service, "error");
  const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token?: string; scope?: string };
  if (!tokens.refresh_token) return back(service, "error");
  const granted = new Set((tokens.scope ?? "").split(" "));
  if (!s.scopes.every((x) => granted.has(x))) return back(service, "missing-permissions");

  // For Gmail, remember which address was connected (for "Open in Gmail" links and school detection).
  let account = s.label;
  const settings: Record<string, string> = {};
  if (service === "gmail" && tokens.access_token) {
    const p = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    if (p.status === 403) return back(service, "blocked");
    const profile = p.ok ? await p.json() : {};
    if (profile.emailAddress) {
      account = profile.emailAddress;
      settings.email = profile.emailAddress;
    }
  }

  const db = serviceClient();
  const { data: integration, error } = await db
    .from("integrations")
    .upsert({ user_id: userId, provider: s.provider, status: "connected", account_label: account.slice(0, 200), settings, last_error: null }, { onConflict: "user_id,provider" })
    .select("id, user_id, provider, settings, last_sync_at")
    .single();
  if (error || !integration) return back(service, "error");
  const key = await tokenKey();
  await saveSecret(db, key, integration.id, tokens.refresh_token);
  const google = { clientId: env("GOOGLE_CLIENT_ID"), clientSecret: env("GOOGLE_CLIENT_SECRET") };
  try {
    if (service === "gmail") {
      const { data: profile } = await db.from("profiles").select("timezone, email_settings").eq("id", userId).single();
      await runEmailSync(integration, { db, key, fetch, google, ai: aiFor(profile?.email_settings), timezone: profile?.timezone ?? "UTC", retentionDays: profile?.email_settings?.retentionDays });
    } else {
      await runSchoolSync(integration, { db, key, fetch, google });
    }
    return back(service, "connected");
  } catch {
    return back(service, "connected-sync-failed");
  }
});
