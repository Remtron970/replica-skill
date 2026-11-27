// POST /functions/v1/email-summarize  { from, subject, body, receivedAt? }
// Summarizes one pasted email. Nothing is stored here; the app saves the result.
import { aiFor } from "../_shared/email/aiClient.ts";
import { analyzeEmail } from "../_shared/email/analyze.ts";
import { parseAddress } from "../_shared/email/gmail.ts";
import { schoolDomainsFor, todayIn } from "../_shared/email/runEmailSync.ts";
import { cors, json, requireUser, serviceClient } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Use POST" });
  const user = await requireUser(req);
  if (!user) return json(req, 401, { error: "Sign in first" });
  const body = await req.json().catch(() => null);
  const text = String(body?.body ?? "").slice(0, 20000);
  if (!text.trim()) return json(req, 400, { error: "Paste the email text first." });
  const from = parseAddress(String(body?.from ?? "").slice(0, 300));
  const db = serviceClient();
  const { data: profile } = await db.from("profiles").select("timezone, email_settings").eq("id", user.id).single();
  const now = new Date();
  const analysis = await analyzeEmail(
    {
      externalId: "paste",
      threadId: null,
      fromName: from.name,
      fromEmail: from.email,
      subject: String(body?.subject ?? "").slice(0, 300) || "(no subject)",
      snippet: text.slice(0, 300),
      receivedAt: typeof body?.receivedAt === "string" && !Number.isNaN(Date.parse(body.receivedAt)) ? new Date(body.receivedAt).toISOString() : now.toISOString(),
      labels: [],
      unread: false,
      gmailImportant: false,
      gmailCategory: null,
      bodyText: text,
    },
    { today: todayIn(profile?.timezone ?? "UTC", now), schoolDomains: schoolDomainsFor(user.email ?? "") },
    aiFor(profile?.email_settings),
  );
  return json(req, 200, { analysis });
});
