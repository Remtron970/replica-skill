import { decrypt, encrypt } from "../crypto.ts";
import { planSchoolSync, type Existing, type Source } from "./apply.ts";
import { fetchCanvas } from "./canvas.ts";
import { fetchClassroom } from "./classroom.ts";
import type { MappedSchool } from "./model.ts";

/**
 * One school sync for one connection, run by a server function with the
 * service role. Everything outside (database, network, clock) is passed in so
 * the flow can be tested without a live school account.
 */

// Minimal shape of the supabase-js client we use (kept loose on purpose).
// deno-lint-ignore no-explicit-any
type Db = { from: (table: string) => any };

export interface Integration {
  id: string;
  user_id: string;
  provider: Source;
  settings: { baseUrl?: string };
}

export interface SyncDeps {
  db: Db;
  key: CryptoKey;
  fetch: typeof fetch;
  now?: () => Date;
  newId?: () => string;
  google?: { clientId: string; clientSecret: string };
}

export class SyncError extends Error {
  constructor(
    message: string,
    readonly status: "error" | "expired" | "blocked",
  ) {
    super(message);
  }
}

async function getJson(f: typeof fetch, url: string, token: string) {
  const res = await f(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  if (res.status === 401) throw new SyncError("Access expired or was revoked. Reconnect to continue syncing.", "expired");
  if (res.status === 403) {
    const body = await res.text();
    if (/admin|domain|policy|disabled/i.test(body)) throw new SyncError("Your school has blocked this connection for student accounts.", "blocked");
    throw new SyncError("The school platform refused access (403).", "error");
  }
  if (!res.ok) throw new SyncError(`The school platform returned an error (${res.status}).`, "error");
  return { data: await res.json(), link: res.headers.get("link") };
}

/** Canvas paginates with Link: <…>; rel="next". */
export function nextLink(link: string | null): string | null {
  const m = link?.split(",").find((p) => /rel="next"/.test(p))?.match(/<([^>]+)>/);
  return m ? m[1] : null;
}

export async function refreshGoogleToken(f: typeof fetch, creds: { clientId: string; clientSecret: string }, refreshToken: string) {
  const res = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: creds.clientId, client_secret: creds.clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  if (res.status === 400 || res.status === 401) throw new SyncError("Google access expired or was revoked. Reconnect Google Classroom.", "expired");
  if (!res.ok) throw new SyncError(`Google sign-in service error (${res.status}).`, "error");
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new SyncError("Google didn't return an access token.", "error");
  return j.access_token;
}

export async function fetchSchool(integration: Integration, secret: string, deps: SyncDeps, today: string): Promise<MappedSchool> {
  const f = deps.fetch;
  if (integration.provider === "canvas") {
    if (!integration.settings.baseUrl) throw new SyncError("Canvas address missing. Reconnect Canvas.", "error");
    return fetchCanvas(integration.settings.baseUrl, async (url) => {
      const all: unknown[] = [];
      let next: string | null = url;
      for (let page = 0; next && page < 50; page++) {
        const { data, link } = await getJson(f, next, secret);
        all.push(...(Array.isArray(data) ? data : [data]));
        next = nextLink(link);
      }
      return all;
    });
  }
  if (!deps.google) throw new SyncError("Google Classroom isn't configured on the server.", "error");
  const access = await refreshGoogleToken(f, deps.google, secret);
  return fetchClassroom(async (url, key) => {
    const all: unknown[] = [];
    let token: string | undefined;
    for (let page = 0; page < 50; page++) {
      const u = new URL(url);
      if (token) u.searchParams.set("pageToken", token);
      const { data } = await getJson(f, u.toString(), access);
      const d = data as Record<string, unknown>;
      all.push(...((d[key] as unknown[]) ?? []));
      token = d.nextPageToken as string | undefined;
      if (!token) break;
    }
    return all;
  }, today);
}

const BATCH = 500;

/** Runs a sync and records the outcome on the connection. Returns how many rows changed. */
export async function runSchoolSync(integration: Integration, deps: SyncDeps): Promise<number> {
  const now = (deps.now ?? (() => new Date()))();
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const { db } = deps;
  const run = await db.from("sync_runs").insert({ integration_id: integration.id, user_id: integration.user_id }).select("id").single();
  try {
    const tok = await db.from("integration_tokens").select("secret_enc, iv").eq("integration_id", integration.id).single();
    if (tok.error || !tok.data) throw new SyncError("No stored credentials. Reconnect to continue.", "expired");
    const secret = await decrypt(deps.key, tok.data.secret_enc, tok.data.iv);
    const mapped = await fetchSchool(integration, secret, deps, now.toISOString().slice(0, 10));

    const existing = {} as Existing;
    for (const t of ["courses", "grade_categories", "grade_items", "assignments"] as const) {
      const r = await db.from(t).select("*").eq("user_id", integration.user_id).eq("source", integration.provider);
      if (r.error) throw new SyncError(`Database read failed (${t}).`, "error");
      existing[t] = r.data ?? [];
    }
    const plan = planSchoolSync(mapped, existing, { userId: integration.user_id, source: integration.provider, now: now.toISOString(), newId });
    let changed = 0;
    for (const t of ["courses", "grade_categories", "grade_items", "assignments"] as const) {
      for (let i = 0; i < plan[t].length; i += BATCH) {
        const r = await db.from(t).upsert(plan[t].slice(i, i + BATCH), { onConflict: "id" });
        if (r.error) throw new SyncError(`Database write failed (${t}).`, "error");
      }
      if (plan.deleted[t].length) {
        const r = await db.from(t).update({ deleted: true, client_updated_at: now.toISOString() }).in("id", plan.deleted[t]);
        if (r.error) throw new SyncError(`Database write failed (${t}).`, "error");
      }
      changed += plan[t].length + plan.deleted[t].length;
    }
    await db.from("integrations").update({ status: "connected", last_sync_at: now.toISOString(), last_error: null }).eq("id", integration.id);
    if (run.data) await db.from("sync_runs").update({ status: "ok", finished_at: new Date().toISOString(), items_upserted: changed }).eq("id", run.data.id);
    return changed;
  } catch (e) {
    const err = e instanceof SyncError ? e : new SyncError("Sync failed unexpectedly.", "error");
    await db.from("integrations").update({ status: err.status, last_error: err.message.slice(0, 500) }).eq("id", integration.id);
    if (run.data) await db.from("sync_runs").update({ status: "error", finished_at: new Date().toISOString(), error: err.message.slice(0, 500) }).eq("id", run.data.id);
    throw err;
  }
}

/** Store (or replace) a connection's credentials, encrypted. */
export async function saveSecret(db: Db, key: CryptoKey, integrationId: string, secret: string) {
  const { ciphertext, iv } = await encrypt(key, secret);
  const r = await db.from("integration_tokens").upsert({ integration_id: integrationId, secret_enc: ciphertext, iv, updated_at: new Date().toISOString() });
  if (r.error) throw new Error("Couldn't store credentials");
}
