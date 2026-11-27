import { justAfter } from "../school/apply.ts";
import { gmailWebUrl } from "./gmail.ts";
import type { EmailAnalysis, ParsedEmail } from "./model.ts";

type Row = { id: string; external_id: string | null; received_at: string; unread: boolean; labels: string[] | null; deleted: boolean; client_updated_at: string };

export interface EmailPlan {
  upserts: Record<string, unknown>[];
  /** Ids to soft-delete with a plain UPDATE (older than the retention period). */
  expired: string[];
}

/**
 * New Gmail messages become rows (with their analysis); known messages only get
 * their read/labels refreshed; old ones expire. `dismissed` belongs to the user
 * and is never overwritten.
 */
export function planEmails(
  analyzed: { email: ParsedEmail; analysis: EmailAnalysis }[],
  labelUpdates: { externalId: string; labels: string[] }[],
  existing: Row[],
  opts: { userId: string; now: Date; newId: () => string; account: string; retentionDays: number },
): EmailPlan {
  const byExt = new Map(existing.filter((r) => r.external_id).map((r) => [r.external_id as string, r]));
  const now = opts.now.toISOString();
  const upserts: Record<string, unknown>[] = [];
  for (const { email: e, analysis: a } of analyzed) {
    if (byExt.has(e.externalId)) continue;
    upserts.push({
      id: opts.newId(),
      user_id: opts.userId,
      client_updated_at: now,
      deleted: false,
      source: "gmail",
      external_id: e.externalId,
      thread_id: e.threadId,
      from_name: e.fromName,
      from_email: e.fromEmail,
      subject: e.subject,
      snippet: e.snippet,
      received_at: e.receivedAt,
      labels: e.labels,
      unread: e.unread,
      category: a.category,
      summary: a.summary,
      summary_source: a.source,
      has_deadline: a.hasDeadline,
      deadline_on: a.deadlineOn,
      needs_reply: a.needsReply,
      is_school: a.isSchool,
      importance: a.importance,
      web_url: gmailWebUrl(e.externalId, opts.account),
      dismissed: false,
    });
  }
  for (const u of labelUpdates) {
    const r = byExt.get(u.externalId);
    if (!r || r.deleted) continue;
    const unread = u.labels.includes("UNREAD");
    const same = r.unread === unread && JSON.stringify(r.labels ?? []) === JSON.stringify(u.labels.slice(0, 30));
    // Stamped just after the row's time so a not-yet-uploaded "dismiss" from a device still wins.
    if (!same) upserts.push({ id: r.id, user_id: opts.userId, client_updated_at: justAfter(r.client_updated_at), received_at: r.received_at, labels: u.labels.slice(0, 30), unread });
  }
  const cutoff = opts.now.getTime() - opts.retentionDays * 86_400_000;
  const expired = existing.filter((r) => !r.deleted && Date.parse(r.received_at) < cutoff).map((r) => r.id);
  return { upserts, expired };
}
