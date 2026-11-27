// POST /functions/v1/school-connect-canvas  { baseUrl, token }
// Checks the Canvas access token works, stores it encrypted, and runs a first sync.
import { cors, json, requireUser, serviceClient, tokenKey } from "../_shared/http.ts";
import { canvasApi, normalizeCanvasUrl } from "../_shared/school/canvas.ts";
import { runSchoolSync, saveSecret, SyncError } from "../_shared/school/runSync.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Use POST" });
  const user = await requireUser(req);
  if (!user) return json(req, 401, { error: "Sign in first" });

  let baseUrl: string;
  let token: string;
  try {
    const body = await req.json();
    baseUrl = normalizeCanvasUrl(String(body.baseUrl ?? ""));
    token = String(body.token ?? "").trim();
    if (token.length < 20 || token.length > 200 || /\s/.test(token)) throw new Error("That doesn't look like a Canvas access token");
  } catch (e) {
    return json(req, 400, { error: (e as Error).message || "Invalid request" });
  }

  // Verify before storing anything.
  const me = await fetch(canvasApi(baseUrl).self, { headers: { Authorization: `Bearer ${token}` } });
  if (me.status === 401) return json(req, 400, { error: "Canvas didn't accept that token. Create a new one and try again." });
  if (!me.ok) return json(req, 400, { error: `Couldn't reach Canvas at ${new URL(baseUrl).hostname} (${me.status}).` });
  const profile = await me.json().catch(() => ({}));

  const db = serviceClient();
  const { data: integration, error } = await db
    .from("integrations")
    .upsert({ user_id: user.id, provider: "canvas", status: "connected", account_label: `${profile.name ?? "Canvas"} · ${new URL(baseUrl).hostname}`.slice(0, 200), settings: { baseUrl }, last_error: null }, { onConflict: "user_id,provider" })
    .select("id, user_id, provider, settings")
    .single();
  if (error || !integration) return json(req, 500, { error: "Couldn't save the connection" });

  const key = await tokenKey();
  await saveSecret(db, key, integration.id, token);
  try {
    const changed = await runSchoolSync(integration, { db, key, fetch });
    return json(req, 200, { ok: true, changed });
  } catch (e) {
    return json(req, 200, { ok: true, changed: 0, warning: e instanceof SyncError ? e.message : "Connected, but the first sync failed" });
  }
});
