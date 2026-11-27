// POST /functions/v1/health-token            → makes a new Shortcut key (old keys stop working), shown once
// POST /functions/v1/health-token {revoke:1} → turns off every key
import { cors, env, json, requireUser, serviceClient } from "../_shared/http.ts";
import { newIngestKey, sha256Hex } from "../_shared/health/runIngest.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Use POST" });
  const user = await requireUser(req);
  if (!user) return json(req, 401, { error: "Sign in first" });
  const body = await req.json().catch(() => ({}));

  const db = serviceClient();
  const { error: delError } = await db.from("health_ingest_tokens").delete().eq("user_id", user.id);
  if (delError) return json(req, 500, { error: "Couldn't update your keys" });
  if (body?.revoke) return json(req, 200, { ok: true, revoked: true });

  const key = newIngestKey();
  const { error } = await db.from("health_ingest_tokens").insert({ user_id: user.id, token_hash: await sha256Hex(key) });
  if (error) return json(req, 500, { error: "Couldn't make a key" });
  return json(req, 200, { ok: true, key, url: `${env("SUPABASE_URL").replace(/\/+$/, "")}/functions/v1/health-ingest` });
});
