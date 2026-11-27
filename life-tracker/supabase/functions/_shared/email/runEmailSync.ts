import { decrypt } from "../crypto.ts";
import { getJson, refreshGoogleToken, SyncError } from "../school/runSync.ts";
import type { ClaudeLike } from "./ai.ts";
import { analyzeEmail } from "./analyze.ts";
import { parseGmailMessage, type GmailMessage } from "./gmail.ts";
import type { AnalysisContext, EmailAnalysis, ParsedEmail } from "./model.ts";
import { planEmails } from "./plan.ts";

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

// deno-lint-ignore no-explicit-any
type Db = { from: (table: string) => any };

export interface EmailIntegration {
  id: string;
  user_id: string;
  last_sync_at: string | null;
  settings: { email?: string };
}

export interface EmailSyncDeps {
  db: Db;
  key: CryptoKey;
  fetch: typeof fetch;
  google: { clientId: string; clientSecret: string };
  ai: { client: ClaudeLike; model: string } | null;
  timezone: string;
  retentionDays?: number;
  /** Most new emails analyzed per run (the rest wait for the next run). */
  maxNew?: number;
  now?: () => Date;
  newId?: () => string;
}

export function todayIn(timezone: string, now: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** Personal Gmail addresses aren't a school; a school account's domain is. */
export function schoolDomainsFor(account: string): string[] {
  const domain = account.split("@")[1]?.toLowerCase();
  return domain && !["gmail.com", "googlemail.com"].includes(domain) ? [domain] : [];
}

export async function runEmailSync(integration: EmailIntegration, deps: EmailSyncDeps): Promise<{ added: number; updated: number; expired: number }> {
  const now = (deps.now ?? (() => new Date()))();
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const { db, fetch: f } = deps;
  const run = await db.from("sync_runs").insert({ integration_id: integration.id, user_id: integration.user_id }).select("id").single();
  try {
    const tok = await db.from("integration_tokens").select("secret_enc, iv").eq("integration_id", integration.id).single();
    if (tok.error || !tok.data) throw new SyncError("No stored credentials. Reconnect Gmail.", "expired");
    const access = await refreshGoogleToken(f, deps.google, await decrypt(deps.key, tok.data.secret_enc, tok.data.iv));
    const account = integration.settings.email ?? "";

    // Which messages to look at: 3 days the first time, then since the last sync (max a week).
    const days = integration.last_sync_at ? Math.min(7, Math.max(1, Math.ceil((now.getTime() - Date.parse(integration.last_sync_at)) / 86_400_000) + 1)) : 3;
    const ids: string[] = [];
    let page: string | undefined;
    for (let i = 0; i < 3; i++) {
      const u = new URL(`${GMAIL}/messages`);
      u.searchParams.set("q", `newer_than:${days}d -in:chats`);
      u.searchParams.set("maxResults", "100");
      if (page) u.searchParams.set("pageToken", page);
      const { data } = await getJson(f, u.toString(), access);
      const d = data as { messages?: { id: string }[]; nextPageToken?: string };
      ids.push(...(d.messages ?? []).map((m) => m.id));
      page = d.nextPageToken;
      if (!page) break;
    }

    const ex = await db.from("emails").select("id, external_id, received_at, unread, labels, deleted, client_updated_at").eq("user_id", integration.user_id).eq("source", "gmail");
    if (ex.error) throw new SyncError("Database read failed (emails).", "error");
    const known = new Set((ex.data ?? []).map((r: { external_id: string }) => r.external_id));

    const ctx: AnalysisContext = { today: todayIn(deps.timezone, now), schoolDomains: schoolDomainsFor(account) };
    const analyzed: { email: ParsedEmail; analysis: EmailAnalysis }[] = [];
    const labelUpdates: { externalId: string; labels: string[] }[] = [];
    for (const id of ids) {
      if (known.has(id)) {
        const { data } = await getJson(f, `${GMAIL}/messages/${encodeURIComponent(id)}?format=minimal`, access);
        labelUpdates.push({ externalId: id, labels: (data as GmailMessage).labelIds ?? [] });
      } else if (analyzed.length < (deps.maxNew ?? 40)) {
        const { data } = await getJson(f, `${GMAIL}/messages/${encodeURIComponent(id)}?format=full`, access);
        const email = parseGmailMessage(data as GmailMessage);
        analyzed.push({ email, analysis: await analyzeEmail(email, ctx, deps.ai) });
      }
    }

    const plan = planEmails(analyzed, labelUpdates, ex.data ?? [], { userId: integration.user_id, now, newId, account, retentionDays: deps.retentionDays ?? 30 });
    for (let i = 0; i < plan.upserts.length; i += 200) {
      const r = await db.from("emails").upsert(plan.upserts.slice(i, i + 200), { onConflict: "id" });
      if (r.error) throw new SyncError("Database write failed (emails).", "error");
    }
    if (plan.expired.length) {
      const r = await db.from("emails").update({ deleted: true, client_updated_at: now.toISOString() }).in("id", plan.expired);
      if (r.error) throw new SyncError("Database write failed (emails).", "error");
    }
    const counts = { added: analyzed.length, updated: plan.upserts.length - analyzed.length, expired: plan.expired.length };
    await db.from("integrations").update({ status: "connected", last_sync_at: now.toISOString(), last_error: null }).eq("id", integration.id);
    if (run.data) await db.from("sync_runs").update({ status: "ok", finished_at: new Date().toISOString(), items_upserted: plan.upserts.length }).eq("id", run.data.id);
    return counts;
  } catch (e) {
    const err = e instanceof SyncError ? e : new SyncError("Email sync failed unexpectedly.", "error");
    await db.from("integrations").update({ status: err.status, last_error: err.message.slice(0, 500) }).eq("id", integration.id);
    if (run.data) await db.from("sync_runs").update({ status: "error", finished_at: new Date().toISOString(), error: err.message.slice(0, 500) }).eq("id", run.data.id);
    throw err;
  }
}
