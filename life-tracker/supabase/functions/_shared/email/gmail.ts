import type { ParsedEmail } from "./model.ts";

/** Gmail API v1 message (format=full or metadata) — the parts we read. */
export interface GmailMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string; // ms since epoch, as a string
  payload?: GmailPart;
}
interface GmailPart {
  mimeType?: string;
  headers?: { name: string; value: string }[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

export function header(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/** "Ms. Rivera <rivera@school.org>" → { name, email } */
export function parseAddress(raw: string): { name: string; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || m[2].trim(), email: m[2].trim().toLowerCase() };
  const email = raw.trim().toLowerCase();
  return { name: email, email };
}

function decodeBase64Url(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const stripHtml = (html: string) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<(br|\/p|\/div|\/li|\/tr)\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** Plain text of a message: text/plain preferred, else text/html with tags removed. */
export function bodyText(part: GmailPart | undefined, max = 6000): string {
  if (!part) return "";
  const plain: string[] = [];
  const html: string[] = [];
  const walk = (p: GmailPart) => {
    if (p.mimeType === "text/plain" && p.body?.data) plain.push(decodeBase64Url(p.body.data));
    else if (p.mimeType === "text/html" && p.body?.data) html.push(stripHtml(decodeBase64Url(p.body.data)));
    p.parts?.forEach(walk);
  };
  walk(part);
  const text = (plain.length ? plain.join("\n") : html.join("\n"))
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => !/^\s*>/.test(l)) // drop quoted replies
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text.slice(0, max);
}

const CATEGORY_LABEL: Record<string, ParsedEmail["gmailCategory"]> = {
  CATEGORY_PERSONAL: "primary",
  CATEGORY_UPDATES: "updates",
  CATEGORY_PROMOTIONS: "promotions",
  CATEGORY_SOCIAL: "social",
  CATEGORY_FORUMS: "forums",
};

export function parseGmailMessage(msg: GmailMessage): ParsedEmail {
  const labels = msg.labelIds ?? [];
  const from = parseAddress(header(msg, "From"));
  const ms = Number(msg.internalDate);
  const dateHeader = Date.parse(header(msg, "Date"));
  const received = Number.isFinite(ms) && ms > 0 ? ms : Number.isFinite(dateHeader) ? dateHeader : Date.now();
  return {
    externalId: msg.id,
    threadId: msg.threadId ?? null,
    fromName: from.name.slice(0, 120),
    fromEmail: from.email.slice(0, 200),
    subject: (header(msg, "Subject") || "(no subject)").slice(0, 300),
    snippet: (msg.snippet ?? "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").slice(0, 300),
    receivedAt: new Date(received).toISOString(),
    labels: labels.slice(0, 30),
    unread: labels.includes("UNREAD"),
    gmailImportant: labels.includes("IMPORTANT"),
    gmailCategory: labels.map((l) => CATEGORY_LABEL[l]).find(Boolean) ?? null,
    bodyText: bodyText(msg.payload),
  };
}

/** Link that opens the message in Gmail for the right account. */
export function gmailWebUrl(messageId: string, account: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(account)}#all/${encodeURIComponent(messageId)}`;
}
