// POST /functions/v1/health-ingest — called by the iPhone Shortcut, not the app.
// Authenticated with the personal key (Authorization: Bearer lth_…), so deploy with --no-verify-jwt.
import { serviceClient } from "../_shared/http.ts";
import { bearerKey, runHealthIngest } from "../_shared/health/runIngest.ts";

const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return reply(405, { ok: false, error: "Use POST (Get Contents of URL → Method: POST)." });
  const text = await req.text();
  if (text.length > 64_000) return reply(413, { ok: false, error: "Too much data in one request." });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, error: "The request body isn't JSON. In the Shortcut, set Request Body to JSON." });
  }
  const out = await runHealthIngest(serviceClient(), bearerKey(req.headers.get("Authorization")), body, { now: new Date(), newId: () => crypto.randomUUID() });
  return reply(out.status, out.body);
});
