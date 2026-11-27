import type { SyncRecord } from "../../lib/store/collection";
import type { EmailCategory } from "../../../../../supabase/functions/_shared/email/model.ts";

export type { EmailCategory };

/** An email summary row (source "gmail" = synced, "manual" = pasted). Full bodies are never stored. */
export interface EmailRecord extends SyncRecord {
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  labels: string[];
  unread: boolean;
  category: EmailCategory;
  summary: string;
  summarySource: "ai" | "rules";
  hasDeadline: boolean;
  deadlineOn: string | null;
  needsReply: boolean;
  isSchool: boolean;
  importance: number;
  webUrl: string | null;
  dismissed: boolean;
}

export const CATEGORY_LABEL: Record<EmailCategory, string> = {
  important: "Important",
  school: "School",
  personal: "Personal",
  notifications: "Notifications",
  other: "Other",
};
