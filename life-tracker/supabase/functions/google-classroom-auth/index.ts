// Google Classroom connection (OAuth 2.0, read-only scopes).
//   POST /functions/v1/google-classroom-auth             → { url } to send the user to Google
//   GET  /functions/v1/google-classroom-auth?code&state  ← Google redirects here; stores the
//        refresh token encrypted, runs a first sync, and sends the user back to the app.
import { cors, env, json, requireUser, serviceClient, tokenKey } from "../_shared/http.ts";
import { CLASSROOM_SCOPES } from "../_shared/school/classroom.ts";
import { runSchoolSync, saveSecret } from "../_shared/school/runSync.ts";
import { signState, verifyState } from "../_shared/state.ts";

const callbackUrl = () => `${env("SUPABASE_URL")}/functions/v1/google-classroom-auth`;
const appUrl = () => env("APP_URL").split(",")[0].trim().replace(/\/+$/, "");
const back = (result: string) => Response.redirect(`${appUrl()}/#/settings?school=${encodeURIComponent(result)}`, 302);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const url = new URL(req.url);

  if (req.method === "POST") {
    const user = await requireUser(req);
    if (!user) return json(req, 401, { error: "Sign in first" });
    const state = await signState(env("TOKEN_ENCRYPTION_KEY"), user.id);
    const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    auth.search = new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      redirect_uri: callbackUrl(),
      response_type: "code",
      scope: CLASSROOM_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "false",
      state,
    }).toString();
    return json(req, 200, { url: auth.toString() });
  }

  // Callback from Google.
  if (url.searchParams.get("error")) return back(url.searchParams.get("error") === "access_denied" ? "cancelled" : "error");
  const userId = await verifyState(env("TOKEN_ENCRYPTION_KEY"), url.searchParams.get("state") ?? "");
  const code = url.searchParams.get("code");
  if (!userId || !code) return back("error");

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"), redirect_uri: callbackUrl(), grant_type: "authorization_code" }),
  });
  if (!tokenRes.ok) return back("error");
  const tokens = (await tokenRes.json()) as { refresh_token?: string; scope?: string };
  if (!tokens.refresh_token) return back("error");
  const granted = new Set((tokens.scope ?? "").split(" "));
  if (!CLASSROOM_SCOPES.every((s) => granted.has(s))) return back("missing-permissions");

  const db = serviceClient();
  const { data: integration, error } = await db
    .from("integrations")
    .upsert({ user_id: userId, provider: "google_classroom", status: "connected", account_label: "Google Classroom", settings: {}, last_error: null }, { onConflict: "user_id,provider" })
    .select("id, user_id, provider, settings")
    .single();
  if (error || !integration) return back("error");
  const key = await tokenKey();
  await saveSecret(db, key, integration.id, tokens.refresh_token);
  try {
    await runSchoolSync(integration, { db, key, fetch, google: { clientId: env("GOOGLE_CLIENT_ID"), clientSecret: env("GOOGLE_CLIENT_SECRET") } });
    return back("connected");
  } catch {
    return back("connected-sync-failed");
  }
});
