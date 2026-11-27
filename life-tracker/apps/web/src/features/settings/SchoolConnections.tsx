import { FileUp, Link2, RefreshCw, School, Unplug } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Badge, Button, ListRow, SectionCard, Sheet, TextField, useToast, type Tone } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useStoreSync } from "../../lib/store/StoreProvider";
import { supabase } from "../../lib/supabase";
import { formatRelative } from "../../components/ui/SyncStatus";

interface IntegrationRow {
  id: string;
  provider: "canvas" | "google_classroom";
  status: "connected" | "error" | "expired" | "blocked" | "disconnected";
  account_label: string;
  last_sync_at: string | null;
  last_error: string | null;
}

const STATUS: Record<IntegrationRow["status"], { label: string; tone: Tone }> = {
  connected: { label: "Connected", tone: "success" },
  error: { label: "Sync problem", tone: "warning" },
  expired: { label: "Reconnect needed", tone: "danger" },
  blocked: { label: "Blocked by school", tone: "danger" },
  disconnected: { label: "Not connected", tone: "neutral" },
};

/** Friendly message for errors from the server functions. */
async function functionError(e: unknown): Promise<string> {
  const ctx = (e as { context?: Response })?.context;
  try {
    const body = ctx ? await ctx.clone().json() : null;
    if (body?.error) return /missing the/i.test(body.error) ? "This connection isn't set up on the server yet (see docs/SETUP_SCHOOL.md)." : body.error;
  } catch {
    /* not JSON */
  }
  if (!navigator.onLine) return "You're offline.";
  return "Couldn't reach the Life Tracker server. Check that the school functions are deployed (docs/SETUP_SCHOOL.md).";
}

export function SchoolConnections() {
  const { enabled, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const store = useStoreSync();
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [canvasOpen, setCanvasOpen] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !user) return;
    const { data } = await supabase.from("integrations").select("id, provider, status, account_label, last_sync_at, last_error");
    setRows((data ?? []) as IntegrationRow[]);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  // Result of the Google sign-in redirect (…#/settings?school=connected).
  useEffect(() => {
    const r = new URLSearchParams(location.search).get("school");
    if (!r) return;
    const msg: Record<string, ["success" | "error" | "warning" | "info", string]> = {
      connected: ["success", "Google Classroom connected. Your classes are syncing."],
      "connected-sync-failed": ["warning", "Google Classroom connected, but the first sync failed. Try Sync now."],
      cancelled: ["info", "Google Classroom wasn't connected."],
      "missing-permissions": ["warning", "Google didn't grant all the read-only permissions Life Tracker needs. Try again and allow them."],
      error: ["error", "Couldn't connect Google Classroom. Please try again."],
    };
    const [tone, title] = msg[r] ?? msg.error;
    toast({ tone, title });
    void load().then(() => store.syncNow());
    navigate("/settings", { replace: true });
  }, [location.search, toast, load, navigate, store]);

  const get = (p: IntegrationRow["provider"]) => rows.find((r) => r.provider === p && r.status !== "disconnected");

  const syncNow = async () => {
    if (!supabase) return;
    setBusy("sync");
    const { data, error } = await supabase.functions.invoke("school-sync", { method: "POST" });
    setBusy(null);
    if (error) return toast({ tone: "error", title: "Sync failed", body: await functionError(error) });
    const failures = Object.entries((data?.results ?? {}) as Record<string, { ok: boolean; error?: string }>).filter(([, v]) => !v.ok);
    if (failures.length) toast({ tone: "warning", title: "Some connections need attention", body: failures.map(([, v]) => v.error).join(" ") });
    else toast({ tone: "success", title: "School data synced" });
    await load();
    await store.syncNow();
  };

  const disconnect = async (row: IntegrationRow) => {
    if (!supabase) return;
    const { error } = await supabase.from("integrations").update({ status: "disconnected" }).eq("id", row.id);
    if (error) return toast({ tone: "error", title: "Couldn't disconnect" });
    toast({ tone: "info", title: "Disconnected", body: "Synced classes stay until you delete them. No new data will be read." });
    await load();
  };

  const connectGoogle = async () => {
    if (!supabase) return;
    setBusy("google");
    const { data, error } = await supabase.functions.invoke("google-auth", { method: "POST", body: { service: "classroom" } });
    setBusy(null);
    if (error || !data?.url) return toast({ tone: "error", title: "Couldn't start Google sign-in", body: await functionError(error) });
    window.location.assign(data.url);
  };

  const needsAccount = !enabled || !user;

  const row = (provider: IntegrationRow["provider"], name: string, onConnect: () => void) => {
    const r = get(provider);
    const s = r ? STATUS[r.status] : STATUS.disconnected;
    return (
      <li className="py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-[15px] font-medium">{name}</p>
          <Badge tone={s.tone}>{s.label}</Badge>
        </div>
        <p className="mt-0.5 text-[12.5px] text-muted">
          {needsAccount
            ? "Needs sign-in, so the connection can sync securely through your account."
            : r
              ? `${r.account_label}${r.last_sync_at ? ` · synced ${formatRelative(new Date(r.last_sync_at), new Date())}` : ""}${r.last_error ? ` · ${r.last_error}` : ""}`
              : "Read-only: classes, assignments and grades. Never posts or changes anything."}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {needsAccount ? (
            <Button size="sm" variant="secondary" onClick={() => navigate("/account")}>
              {enabled ? "Sign in" : "Set up cloud sync"}
            </Button>
          ) : r ? (
            <>
              {r.status !== "connected" && (
                <Button size="sm" icon={Link2} onClick={onConnect} loading={busy === provider}>
                  Reconnect
                </Button>
              )}
              <Button size="sm" variant="ghost" icon={Unplug} onClick={() => void disconnect(r)}>
                Disconnect
              </Button>
            </>
          ) : (
            <Button size="sm" icon={Link2} onClick={onConnect} loading={busy === (provider === "google_classroom" ? "google" : provider)}>
              Connect
            </Button>
          )}
        </div>
      </li>
    );
  };

  return (
    <SectionCard
      title="School connections"
      subtitle="Bring in classes and grades automatically"
      icon={School}
      accent="bg-accent-purple/12 text-accent-purple"
      action={
        rows.some((r) => r.status !== "disconnected") ? (
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={busy === "sync"} onClick={() => void syncNow()}>
            Sync now
          </Button>
        ) : undefined
      }
    >
      <ul className="divide-y divide-line">
        {row("google_classroom", "Google Classroom", () => void connectGoogle())}
        {row("canvas", "Canvas", () => setCanvasOpen(true))}
        <li className="py-1">
          <ListRow
            title="StudentVUE · PowerSchool · Infinite Campus"
            subtitle="These don't offer student access for apps, so use Import: copy your gradebook table and paste it in."
            trailing={<Badge>Use import</Badge>}
            onClick={() => navigate("/academics/import")}
            icon={<FileUp size={18} className="text-muted" aria-hidden />}
          />
        </li>
      </ul>
      <Sheet open={canvasOpen} onClose={() => setCanvasOpen(false)} title="Connect Canvas">
        <CanvasForm
          onDone={async (changed) => {
            setCanvasOpen(false);
            toast({ tone: "success", title: "Canvas connected", body: changed ? `${changed} classes, categories and grades synced.` : undefined });
            await load();
            await store.syncNow();
          }}
        />
      </Sheet>
    </SectionCard>
  );
}

function CanvasForm({ onDone }: { onDone: (changed: number) => void }) {
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!baseUrl.trim() || token.trim().length < 20) return setError("Enter your school's Canvas address and the access token.");
        if (!supabase) return;
        setBusy(true);
        setError(undefined);
        const { data, error: err } = await supabase.functions.invoke("school-connect-canvas", { body: { baseUrl, token } });
        setBusy(false);
        if (err) return setError(await functionError(err));
        setToken("");
        onDone(data?.changed ?? 0);
      }}
    >
      <ol className="list-inside list-decimal space-y-1 text-[13.5px] text-muted">
        <li>Sign in to Canvas in your browser.</li>
        <li>Open Account → Settings and find Approved Integrations.</li>
        <li>Choose “+ New Access Token”, name it “Life Tracker”, and copy the token.</li>
      </ol>
      <p className="text-[12.5px] text-muted">
        The token lets Life Tracker read your courses and grades. It's stored encrypted on the server, is never shown again, and you can
        delete it in Canvas at any time. Some schools turn off token creation; if so, use Import instead.
      </p>
      <TextField id="canvas-url" label="Canvas address" placeholder="yourschool.instructure.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} autoComplete="url" data-autofocus />
      <TextField id="canvas-token" label="Access token" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} error={error} />
      <Button type="submit" fullWidth loading={busy}>
        Connect Canvas
      </Button>
    </form>
  );
}
