// POST /functions/v1/email-sync — fetch and summarize the signed-in user's new Gmail messages.
import { aiFor } from "../_shared/email/aiClient.ts";
import { runEmailSync, type EmailIntegration } from "../_shared/email/runEmailSync.ts";
import { cors, env, json, requireUser, serviceClient, tokenKey } from "../_shared/http.ts";
import { SyncError } from "../_shared/school/runSync.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Use POST" });
  const user = await requireUser(req);
  if (!user) return json(req, 401, { error: "Sign in first" });
  const db = serviceClient();
  const { data: integration } = await db.from("integrations").select("id, user_id, settings, last_sync_at").eq("user_id", user.id).eq("provider", "gmail").neq("status", "disconnected").maybeSingle();
  if (!integration) return json(req, 404, { error: "Gmail isn't connected" });
  const { data: profile } = await db.from("profiles").select("timezone, email_settings").eq("id", user.id).single();
  try {
    const result = await runEmailSync(integration as EmailIntegration, {
      db,
      key: await tokenKey(),
      fetch,
      google: { clientId: env("GOOGLE_CLIENT_ID"), clientSecret: env("GOOGLE_CLIENT_SECRET") },
      ai: aiFor(profile?.email_settings),
      timezone: profile?.timezone ?? "UTC",
      retentionDays: profile?.email_settings?.retentionDays,
    });
    return json(req, 200, { ok: true, ...result });
  } catch (e) {
    return json(req, 200, { ok: false, error: e instanceof SyncError ? e.message : "Email sync failed" });
  }
});
