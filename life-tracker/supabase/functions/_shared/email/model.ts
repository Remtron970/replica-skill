/** An email as Life Tracker sees it (no full body is stored). */
export interface ParsedEmail {
  externalId: string; // gmail message id, or "paste:<uuid>"
  threadId: string | null;
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string; // ISO
  labels: string[];
  unread: boolean;
  /** Gmail's own hints. */
  gmailImportant: boolean;
  gmailCategory: "primary" | "updates" | "promotions" | "social" | "forums" | null;
  /** Plain text used for analysis only — never stored. */
  bodyText: string;
}

export type EmailCategory = "important" | "school" | "personal" | "notifications" | "other";

export interface EmailAnalysis {
  category: EmailCategory;
  /** One or two sentences in plain language. */
  summary: string;
  hasDeadline: boolean;
  /** YYYY-MM-DD */
  deadlineOn: string | null;
  needsReply: boolean;
  isSchool: boolean;
  /** 0 = ignore … 3 = act on this today */
  importance: 0 | 1 | 2 | 3;
  /** "ai" = written by Claude; "rules" = Life Tracker's built-in quick summary */
  source: "ai" | "rules";
}

export interface AnalysisContext {
  /** Today in the user's time zone (YYYY-MM-DD), for resolving "tomorrow", "Friday"… */
  today: string;
  /** Domains that count as school (e.g. the school account's own domain). */
  schoolDomains: string[];
}
