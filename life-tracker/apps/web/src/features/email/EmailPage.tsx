import { AlertTriangle, CalendarPlus, ClipboardPaste, ExternalLink, EyeOff, Link2, Mail, RefreshCw, Reply, School, Settings2, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SECTION_BY_ID } from "../../app/sections";
import { Badge, Button, Card, Chip, PageHeader, SectionCard, Select, Sheet, Switch, TextField, useToast, type Tone } from "../../components/ui";
import { formatRelative } from "../../components/ui/SyncStatus";
import { useAuth } from "../../lib/auth";
import { usePrefs } from "../../lib/prefs";
import { store } from "../../lib/store/schema";
import { useCollection, useStoreSync } from "../../lib/store/StoreProvider";
import { supabase } from "../../lib/supabase";
import { useNow } from "../../lib/time";
import { analyzeWithRules } from "../../../../../supabase/functions/_shared/email/rules.ts";
import type { EmailAnalysis } from "../../../../../supabase/functions/_shared/email/model.ts";
import { localDate } from "../academics/grades";
import type { Assignment } from "../assignments/types";
import { countsByCategory, recapFor, recapSentence, visibleEmails, yesterday } from "./recap";
import { CATEGORY_LABEL, type EmailCategory, type EmailRecord } from "./types";

interface GmailIntegration {
  id: string;
  status: "connected" | "error" | "expired" | "blocked" | "disconnected";
  account_label: string;
  last_sync_at: string | null;
  last_error: string | null;
}

const AUTO_SYNC_MS = 30 * 60_000;

export function EmailPage() {
  const sec = SECTION_BY_ID.email;
  const emails = useCollection(store.emails);
  const now = useNow(60_000);
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { enabled, user } = useAuth();
  const storeSync = useStoreSync();
  const [gmail, setGmail] = useState<GmailIntegration | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<EmailCategory | "all">("all");
  const [open, setOpen] = useState<EmailRecord | null>(null);
  const [panel, setPanel] = useState<null | "paste" | "settings">(null);
  const [blocked, setBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !user) return null;
    const { data } = await supabase.from("integrations").select("id, status, account_label, last_sync_at, last_error").eq("provider", "gmail").maybeSingle();
    const row = data && (data as GmailIntegration).status !== "disconnected" ? (data as GmailIntegration) : null;
    setGmail(row);
    return row;
  }, [user]);

  const syncNow = useCallback(
    async (quiet = false) => {
      if (!supabase) return;
      setBusy("sync");
      const { data, error } = await supabase.functions.invoke("email-sync", { method: "POST" });
      setBusy(null);
      if (error || !data?.ok) {
        if (!quiet) toast({ tone: "error", title: "Couldn't check email", body: data?.error ?? "Try again in a moment." });
      } else if (!quiet) toast({ tone: "success", title: data.added ? `${data.added} new email${data.added === 1 ? "" : "s"} summarized` : "No new email" });
      await load();
      await storeSync.syncNow();
    },
    [toast, load, storeSync],
  );

  // Load the connection; pick up summaries the server already made; check Gmail if the last check is old.
  useEffect(() => {
    void storeSync.syncNow();
    void load().then((row) => {
      if (row?.status === "connected" && (!row.last_sync_at || Date.now() - Date.parse(row.last_sync_at) > AUTO_SYNC_MS)) void syncNow(true);
    });
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  // Result of the Google sign-in redirect (…#/email?gmail=connected).
  useEffect(() => {
    const r = new URLSearchParams(location.search).get("gmail");
    if (!r) return;
    const msg: Record<string, ["success" | "error" | "warning" | "info", string]> = {
      connected: ["success", "Gmail connected. Your recent email is summarized."],
      "connected-sync-failed": ["warning", "Gmail connected, but the first check failed. Try Check now."],
      cancelled: ["info", "Gmail wasn't connected."],
      blocked: ["warning", "Your school doesn't allow this app to read school email. You can still paste emails in."],
      "missing-permissions": ["warning", "Google didn't grant read access to email. Try again and allow it."],
      error: ["error", "Couldn't connect Gmail. Please try again."],
    };
    const [tone, title] = msg[r] ?? msg.error;
    if (r === "blocked") setBlocked(true);
    toast({ tone, title });
    void load().then(() => storeSync.syncNow());
    navigate("/email", { replace: true });
  }, [location.search, toast, load, navigate, storeSync]);

  const connect = async () => {
    if (!supabase) return;
    setBusy("connect");
    const { data, error } = await supabase.functions.invoke("google-auth", { method: "POST", body: { service: "gmail" } });
    setBusy(null);
    if (error || !data?.url) return toast({ tone: "error", title: "Couldn't start Google sign-in", body: "Check that the email functions are set up (docs/SETUP_EMAIL.md)." });
    window.location.assign(data.url);
  };

  const visible = visibleEmails(emails);
  const shown = filter === "all" ? visible : visible.filter((e) => e.category === filter);
  const counts = countsByCategory(emails);
  const recap = useMemo(() => recapFor(emails, yesterday(now)), [emails, now]);

  return (
    <>
      <PageHeader
        title="Email"
        subtitle={gmail ? gmail.account_label : sec.tagline}
        icon={sec.icon}
        accent={sec.accent}
        right={
          <div className="flex gap-2">
            {gmail && <Button variant="secondary" size="sm" icon={RefreshCw} loading={busy === "sync"} onClick={() => void syncNow()} aria-label="Check for new email">Check now</Button>}
            <Button size="sm" icon={ClipboardPaste} onClick={() => setPanel("paste")}>
              Paste
            </Button>
          </div>
        }
      />

      <div className="space-y-5">
        <ConnectionCard gmail={gmail} enabled={enabled} signedIn={!!user} blocked={blocked} busy={busy === "connect"} onConnect={connect} onPaste={() => setPanel("paste")} onSettings={() => setPanel("settings")} />

        {visible.length > 0 && (
          <SectionCard title={`Yesterday · ${new Date(`${recap.day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}`} subtitle={recapSentence(recap)} icon={Sparkles} accent="bg-brand-soft text-brand-ink">
            {recap.highlights.length ? (
              <ul className="space-y-2">
                {recap.highlights.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => setOpen(e)} className="w-full rounded-xl bg-surface-2/60 px-3 py-2 text-left hover:bg-surface-2">
                      <span className="block text-[13px] font-semibold">
                        {e.fromName} · {e.subject}
                      </span>
                      <span className="block text-[14px]">{e.summary}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-muted">Nothing that needs attention from yesterday.</p>
            )}
          </SectionCard>
        )}

        {visible.length > 0 && (
          <section aria-labelledby="inbox-h">
            <h2 id="inbox-h" className="sr-only">
              Emails
            </h2>
            <div className="mb-3 flex flex-wrap gap-2" aria-label="Filter by category">
              {(["all", "important", "school", "personal", "notifications", "other"] as const).map((c) => (
                <Chip key={c} selected={filter === c} onClick={() => setFilter(c)} disabled={c !== "all" && !counts[c]}>
                  {c === "all" ? "All" : CATEGORY_LABEL[c]} {counts[c] ? `· ${counts[c]}` : ""}
                </Chip>
              ))}
            </div>
            <Card className="py-1 md:py-1">
              <ul className="divide-y divide-line">
                {shown.map((e) => (
                  <li key={e.id}>
                    <EmailRow e={e} now={now} onOpen={() => setOpen(e)} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.subject ?? ""}>
        {open && <EmailDetail e={open} onDone={() => setOpen(null)} />}
      </Sheet>
      <Sheet open={panel === "paste"} onClose={() => setPanel(null)} title="Paste an email">
        <PasteForm onDone={() => setPanel(null)} />
      </Sheet>
      <Sheet open={panel === "settings"} onClose={() => setPanel(null)} title="Email settings">
        <EmailSettingsForm gmail={gmail} onDisconnected={() => void load()} />
      </Sheet>
    </>
  );
}

function ConnectionCard({ gmail, enabled, signedIn, blocked, busy, onConnect, onPaste, onSettings }: { gmail: GmailIntegration | null; enabled: boolean; signedIn: boolean; blocked: boolean; busy: boolean; onConnect: () => void; onPaste: () => void; onSettings: () => void }) {
  const navigate = useNavigate();
  if (gmail) {
    const tone: Record<GmailIntegration["status"], [Tone, string]> = {
      connected: ["success", "Connected"],
      error: ["warning", "Check failed"],
      expired: ["danger", "Reconnect needed"],
      blocked: ["danger", "Blocked by school"],
      disconnected: ["neutral", "Not connected"],
    };
    const [t, label] = tone[gmail.status];
    return (
      <Card className="flex flex-wrap items-center gap-3">
        <Mail size={20} className="text-accent-blue" aria-hidden />
        <div className="min-w-0 flex-1 text-[13.5px]">
          <p className="font-semibold">
            Gmail <Badge tone={t}>{label}</Badge>
          </p>
          <p className="text-muted">
            Read-only. {gmail.last_sync_at ? `Checked ${formatRelative(new Date(gmail.last_sync_at), new Date())}.` : ""} {gmail.last_error ?? ""}
          </p>
        </div>
        {gmail.status !== "connected" && (
          <Button size="sm" icon={Link2} loading={busy} onClick={onConnect}>
            Reconnect
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={Settings2} onClick={onSettings}>
          Settings
        </Button>
      </Card>
    );
  }
  return (
    <SectionCard title="Get your email recap" icon={Mail} accent="bg-accent-blue/10 text-accent-blue">
      {blocked && (
        <p className="mb-3 flex gap-2 rounded-xl bg-accent-yellow/14 px-3 py-2 text-[13.5px]">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          Your school blocks apps from reading school email. Paste important emails instead, or ask your school's tech office whether Life Tracker can be allowed.
        </p>
      )}
      <ul className="mb-3 space-y-1.5 text-[14px] text-muted">
        <li>• Connect Gmail (read-only — Life Tracker can never send, delete or change email).</li>
        <li>• Or paste any email to get a summary, its deadline and whether it needs a reply.</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        {!enabled || !signedIn ? (
          <Button variant="secondary" onClick={() => navigate("/account")}>
            {enabled ? "Sign in to connect Gmail" : "Set up cloud sync to connect Gmail"}
          </Button>
        ) : (
          <Button icon={Link2} loading={busy} onClick={onConnect}>
            Connect Gmail
          </Button>
        )}
        <Button variant="secondary" icon={ClipboardPaste} onClick={onPaste}>
          Paste an email
        </Button>
        <Button variant="ghost" icon={Settings2} onClick={onSettings}>
          Settings
        </Button>
      </div>
    </SectionCard>
  );
}

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

function EmailRow({ e, now, onOpen }: { e: EmailRecord; now: Date; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface-2">
      <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${e.unread ? "bg-accent-blue" : "bg-transparent"}`} aria-label={e.unread ? "Unread" : undefined} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-[14.5px] ${e.unread ? "font-semibold" : "font-medium"}`}>{e.fromName || e.fromEmail}</span>
          <span className="shrink-0 text-[12px] text-muted">{formatRelative(new Date(e.receivedAt), now)}</span>
        </span>
        <span className="block truncate text-[13.5px]">{e.subject}</span>
        <span className="line-clamp-2 block text-[13px] text-muted">{e.summary}</span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {e.category === "important" && <Badge tone="danger">Important</Badge>}
          {e.hasDeadline && e.deadlineOn && <Badge tone="warning">Due {fmtDate(e.deadlineOn)}</Badge>}
          {e.needsReply && <Badge tone="info">Needs reply</Badge>}
          {e.isSchool && e.category !== "school" && <Badge tone="brand">School</Badge>}
        </span>
      </span>
    </button>
  );
}

function SummaryLabel({ source }: { source: "ai" | "rules" }) {
  return source === "ai" ? (
    <Badge tone="brand" icon={Sparkles}>
      AI summary
    </Badge>
  ) : (
    <Badge>Quick summary (built-in)</Badge>
  );
}

function EmailDetail({ e, onDone }: { e: EmailRecord; onDone: () => void }) {
  const toast = useToast();
  const navigate = useNavigate();
  const addTask = () => {
    if (!e.deadlineOn) return;
    const [y, m, d] = e.deadlineOn.split("-").map(Number);
    store.assignments.put({
      courseId: null,
      title: e.subject.slice(0, 160),
      description: e.summary,
      dueAt: new Date(y, m - 1, d, 12).toISOString(),
      dueHasTime: false,
      priority: e.importance >= 3 ? "high" : "normal",
      status: "todo",
      completedAt: null,
      submitted: false,
      url: e.webUrl,
      reminderMinutes: null,
    } as Assignment);
    toast({ tone: "success", title: "Added to Assignments", action: { label: "Open", onClick: () => navigate("/assignments") } });
  };
  return (
    <div className="space-y-4">
      <div className="text-[13.5px] text-muted">
        <p>
          From <strong className="text-ink">{e.fromName}</strong> {e.fromEmail && e.fromEmail !== e.fromName ? `<${e.fromEmail}>` : ""}
        </p>
        <p>{new Date(e.receivedAt).toLocaleString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
      </div>
      <div className="rounded-2xl bg-surface-2/70 p-3.5">
        <div className="mb-1.5">
          <SummaryLabel source={e.summarySource} />
        </div>
        <p className="text-[15px]">{e.summary}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge>{CATEGORY_LABEL[e.category]}</Badge>
        {e.hasDeadline && e.deadlineOn && <Badge tone="warning">Deadline {fmtDate(e.deadlineOn)}</Badge>}
        {e.needsReply && (
          <Badge tone="info" icon={Reply}>
            Needs a reply
          </Badge>
        )}
        {e.isSchool && e.category !== "school" && (
          <Badge tone="brand" icon={School}>
            School
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {e.webUrl && (
          <a href={e.webUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-surface-2 px-4 text-[14px] font-semibold">
            Open in Gmail <ExternalLink size={15} aria-hidden />
          </a>
        )}
        {e.deadlineOn && (
          <Button variant="secondary" icon={CalendarPlus} onClick={addTask}>
            Add to Assignments
          </Button>
        )}
        <Button
          variant="ghost"
          icon={EyeOff}
          onClick={() => {
            store.emails.patch(e.id, { dismissed: true });
            toast({ tone: "info", title: "Hidden from your recap", action: { label: "Undo", onClick: () => store.emails.patch(e.id, { dismissed: false }) } });
            onDone();
          }}
        >
          Hide
        </Button>
        {e.source === "manual" && (
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => {
              store.emails.remove(e.id);
              onDone();
            }}
          >
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}

function PasteForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const { prefs } = usePrefs();
  const { user } = useAuth();
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EmailAnalysis | null>(null);
  const [error, setError] = useState<string>();

  const analyze = async () => {
    if (!body.trim()) return setError("Paste the email's text first.");
    setError(undefined);
    setBusy(true);
    let analysis: EmailAnalysis | null = null;
    if (supabase && user && prefs.email.ai) {
      const { data } = await supabase.functions.invoke("email-summarize", { body: { from, subject, body } });
      analysis = (data?.analysis as EmailAnalysis) ?? null;
    }
    if (!analysis) {
      // Built-in quick summary, right on this device.
      const fromParts = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
      analysis = analyzeWithRules(
        {
          externalId: "paste", threadId: null, fromName: (fromParts?.[1] || from).trim(), fromEmail: (fromParts?.[2] || (from.includes("@") ? from : "")).trim().toLowerCase(),
          subject, snippet: body.slice(0, 300), receivedAt: new Date().toISOString(), labels: [], unread: false, gmailImportant: false, gmailCategory: null, bodyText: body.slice(0, 20000),
        },
        { today: localDate(new Date()), schoolDomains: [] },
      );
    }
    setBusy(false);
    setResult(analysis);
  };

  const save = () => {
    if (!result) return;
    const fromParts = from.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
    store.emails.put({
      threadId: null,
      fromName: (fromParts?.[1] || from || "Pasted email").trim().slice(0, 120),
      fromEmail: (fromParts?.[2] || (from.includes("@") ? from : "")).trim().toLowerCase().slice(0, 200),
      subject: (subject || "(no subject)").slice(0, 300),
      snippet: body.trim().slice(0, 300),
      receivedAt: new Date().toISOString(),
      labels: [],
      unread: false,
      category: result.category,
      summary: result.summary.slice(0, 400),
      summarySource: result.source,
      hasDeadline: result.hasDeadline,
      deadlineOn: result.deadlineOn,
      needsReply: result.needsReply,
      isSchool: result.isSchool,
      importance: result.importance,
      webUrl: null,
      dismissed: false,
    });
    toast({ tone: "success", title: "Saved to Email" });
    onDone();
  };

  return (
    <div className="space-y-4">
      {!result ? (
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void analyze();
          }}
        >
          <p className="text-[13.5px] text-muted">Copy an email from any app and paste it here. Only the summary is saved — not the email itself.</p>
          <TextField id="paste-from" label="From (optional)" value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Ms. Rivera <rivera@school.org>" />
          <TextField id="paste-subject" label="Subject (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="paste-body" className="text-[13px] font-semibold">
              Email text
            </label>
            <textarea id="paste-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} className="w-full rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[14px] outline-none focus:border-brand-ink" data-autofocus />
            {error && (
              <p className="text-[12.5px] text-accent-red" role="alert">
                {error}
              </p>
            )}
          </div>
          <Button type="submit" fullWidth icon={Sparkles} loading={busy}>
            Summarize
          </Button>
        </form>
      ) : (
        <div className="space-y-4" role="status">
          <div className="rounded-2xl bg-surface-2/70 p-3.5">
            <div className="mb-1.5">
              <SummaryLabel source={result.source} />
            </div>
            <p className="text-[15px]">{result.summary}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{CATEGORY_LABEL[result.category]}</Badge>
            {result.deadlineOn && <Badge tone="warning">Deadline {fmtDate(result.deadlineOn)}</Badge>}
            {result.needsReply && <Badge tone="info">Needs a reply</Badge>}
            {result.isSchool && result.category !== "school" && <Badge tone="brand">School</Badge>}
          </div>
          {result.source === "rules" && <p className="text-[12.5px] text-muted">Made with Life Tracker's built-in rules. AI summaries need cloud sync and an AI key (docs/SETUP_EMAIL.md).</p>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setResult(null)}>
              Edit
            </Button>
            <Button fullWidth onClick={save}>
              Save to Email
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailSettingsForm({ gmail, onDisconnected }: { gmail: GmailIntegration | null; onDisconnected: () => void }) {
  const { prefs, update } = usePrefs();
  const toast = useToast();
  return (
    <div className="space-y-5">
      <Switch
        checked={prefs.email.ai}
        onChange={(ai) => update({ email: { ...prefs.email, ai } })}
        label="AI summaries"
        description="Email text is sent to Anthropic's Claude to write the summary, then discarded. Off: built-in quick summaries only."
      />
      <Select id="email-retention" label="Keep email summaries for" value={String(prefs.email.retentionDays)} onChange={(e) => update({ email: { ...prefs.email, retentionDays: Number(e.target.value) as 7 | 14 | 30 | 60 } })}>
        {[7, 14, 30, 60].map((d) => (
          <option key={d} value={d}>
            {d} days
          </option>
        ))}
      </Select>
      {gmail && supabase && (
        <Button
          variant="danger"
          onClick={async () => {
            await supabase!.from("integrations").update({ status: "disconnected" }).eq("id", gmail.id);
            toast({ tone: "info", title: "Gmail disconnected", body: "No more email will be read. Existing summaries expire on schedule." });
            onDisconnected();
          }}
        >
          Disconnect Gmail
        </Button>
      )}
    </div>
  );
}
