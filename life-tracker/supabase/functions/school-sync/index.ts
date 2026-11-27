// POST /functions/v1/school-sync — sync the signed-in user's school connections now.
import { cors, json, requireUser, serviceClient, tokenKey } from "../_shared/http.ts";
import { runSchoolSync, SyncError, type Integration } from "../_shared/school/runSync.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Use POST" });
  const user = await requireUser(req);
  if (!user) return json(req, 401, { error: "Sign in first" });

  const db = serviceClient();
  const { data: integrations, error } = await db.from("integrations").select("id, user_id, provider, settings").eq("user_id", user.id).neq("status", "disconnected");
  if (error) return json(req, 500, { error: "Couldn't load connections" });

  const key = await tokenKey();
  const google = Deno.env.get("GOOGLE_CLIENT_ID") ? { clientId: Deno.env.get("GOOGLE_CLIENT_ID")!, clientSecret: Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "" } : undefined;
  const results: Record<string, unknown> = {};
  for (const i of (integrations ?? []) as Integration[]) {
    try {
      results[i.provider] = { ok: true, changed: await runSchoolSync(i, { db, key, fetch, google }) };
    } catch (e) {
      results[i.provider] = { ok: false, error: e instanceof SyncError ? e.message : "Sync failed" };
    }
  }
  return json(req, 200, { results });
});
