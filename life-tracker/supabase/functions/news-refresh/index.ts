// POST /functions/v1/news-refresh — refreshes world news and news for the city in
// your News settings (each at most every 30 minutes, shared by everyone).
// Optional secrets: GUARDIAN_API_KEY, GNEWS_API_KEY. Without them, free RSS feeds are used.
import { cors, json, requireUser, serviceClient } from "../_shared/http.ts";
import { refreshRegion, regionFromSettings, WORLD } from "../_shared/news/runNewsRefresh.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Use POST" });
  const user = await requireUser(req);
  if (!user) return json(req, 401, { error: "Sign in first" });

  const db = serviceClient();
  // The city comes from your saved settings, never from the request.
  const { data: profile } = await db.from("profiles").select("news_settings").eq("id", user.id).single();
  const local = regionFromSettings(profile?.news_settings);
  const keys = { guardian: Deno.env.get("GUARDIAN_API_KEY") || undefined, gnews: Deno.env.get("GNEWS_API_KEY") || undefined };
  const deps = { db, fetch, now: new Date(), keys };
  const results = await Promise.all([WORLD, ...(local ? [local] : [])].map((r) => refreshRegion(r, deps)));
  return json(req, 200, { ok: true, results, sources: { guardian: !!keys.guardian, gnews: !!keys.gnews } });
});
