import { ArrowLeft, CloudOff, Download, LogOut, Mail, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Dialog,
  EmptyState,
  ErrorState,
  ListRow,
  PageHeader,
  SectionCard,
  TextField,
  useToast,
} from "../../components/ui";
import { friendlyAuthError, useAuth } from "../../lib/auth";
import { clearDeviceData, usePrefs } from "../../lib/prefs";
import { googleEnabled } from "../../lib/supabase";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function AccountPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        title="Account"
        subtitle="Sign in to keep your settings in sync across your iPhone and computer."
        icon={UserRound}
        accent="bg-brand-soft text-brand-ink"
        right={<Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate("/settings")}>Settings</Button>}
      />
      <div className="space-y-4">
        {!auth.enabled ? <NotConfigured /> : auth.loading ? null : auth.user ? <SignedIn /> : <SignIn />}
        <DataCard />
      </div>
    </>
  );
}

function NotConfigured() {
  return (
    <SectionCard title="Cloud sync">
      <EmptyState
        compact
        icon={CloudOff}
        title="Cloud sync isn't set up yet"
        body={
          <>
            Life Tracker works fully on this device right now. Sign-in and syncing turn on once the Supabase project is connected
            (see <code className="rounded bg-surface-2 px-1">docs/SETUP_SUPABASE.md</code>).
          </>
        }
        badge={<Badge tone="warning">Waiting for setup</Badge>}
      />
    </SectionCard>
  );
}

function SignIn() {
  const { sendCode, verifyCode, signInWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const send = async () => {
    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) return setError("Enter a valid email address.");
    setBusy(true);
    setError(undefined);
    try {
      await sendCode(clean);
      setEmail(clean);
      setStep("code");
      toast({ tone: "success", title: "Code sent", body: `Check ${clean} for a 6-digit code.` });
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const digits = code.replace(/\D/g, "");
    if (digits.length < 6) return setError("Enter the code from the email.");
    setBusy(true);
    setError(undefined);
    try {
      await verifyCode(email, digits);
      toast({ tone: "success", title: "Signed in", body: "Your settings now sync across devices." });
      navigate("/");
    } catch (e) {
      setError(friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Sign in or create an account" subtitle="No password needed — we email you a one-time code." icon={Mail} accent="bg-accent-blue/10 text-accent-blue">
      {step === "email" ? (
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <TextField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error}
          />
          <Button type="submit" fullWidth loading={busy}>
            Email me a code
          </Button>
          {googleEnabled && (
            <Button
              variant="secondary"
              fullWidth
              onClick={() => signInWithGoogle().catch((e) => setError(friendlyAuthError(e)))}
            >
              Continue with Google
            </Button>
          )}
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
        >
          <p className="text-[14px] text-muted">
            We sent a code to <strong className="text-ink">{email}</strong>. It expires in about an hour.
          </p>
          <TextField
            label="Code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            error={error}
            className="tabular text-center text-[22px] tracking-[0.3em]"
            data-autofocus
          />
          <Button type="submit" fullWidth loading={busy}>
            Verify and sign in
          </Button>
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" onClick={() => { setStep("email"); setCode(""); setError(undefined); }}>
              Use a different email
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void send()}>
              Send a new code
            </Button>
          </div>
        </form>
      )}
    </SectionCard>
  );
}

function SignedIn() {
  const { user, signOut } = useAuth();
  const { sync, retrySync } = usePrefs();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const status = sync.status === "synced" ? "ok" : sync.status === "syncing" ? "syncing" : sync.status === "offline" ? "offline" : sync.status === "error" ? "error" : "ok";
  return (
    <SectionCard title="Signed in" icon={ShieldCheck} accent="bg-accent-green/12 text-accent-green" sync={{ source: "Your account", syncedAt: sync.lastSyncedAt, state: status }}>
      <ListRow title={user?.email ?? "Signed in"} subtitle="Name, theme, tab bar, Home layout and demo mode sync across your devices." />
      {sync.status === "error" && (
        <div className="mt-2">
          <ErrorState title="Couldn't sync your settings" body="Your changes are saved on this device and will sync when possible." onRetry={retrySync} />
        </div>
      )}
      <div className="mt-3">
        <Button
          variant="secondary"
          icon={LogOut}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await signOut();
              toast({ tone: "info", title: "Signed out", body: "Your settings stay on this device." });
            } catch (e) {
              toast({ tone: "error", title: "Couldn't sign out", body: friendlyAuthError(e) });
            } finally {
              setBusy(false);
            }
          }}
        >
          Sign out
        </Button>
      </div>
    </SectionCard>
  );
}

function DataCard() {
  const { user, deleteAccount } = useAuth();
  const { prefs } = usePrefs();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const exportData = () => {
    if (import.meta.env.VITE_PREVIEW === "1") {
      toast({ tone: "info", title: "Not available in this preview", body: "Downloads work in the installed app." });
      return;
    }
    const payload = {
      app: "Life Tracker",
      exportedAt: new Date().toISOString(),
      account: user ? { id: user.id, email: user.email } : null,
      preferences: prefs,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `life-tracker-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ tone: "success", title: "Export downloaded" });
  };

  const erase = async () => {
    setBusy(true);
    try {
      if (user) await deleteAccount();
      clearDeviceData();
      setOpen(false);
      toast({ tone: "success", title: user ? "Account deleted" : "Device data cleared", body: "Everything has been removed." });
      // Full reload so nothing cleared lingers in memory (and gets saved again).
      window.setTimeout(() => {
        window.location.hash = "#/";
        window.location.reload();
      }, 900);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't delete", body: friendlyAuthError(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title="Your data" subtitle="Download a copy, or remove everything.">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" icon={Download} onClick={exportData}>
          Export my data
        </Button>
        <Button variant="danger" icon={Trash2} onClick={() => { setConfirm(""); setOpen(true); }}>
          {user ? "Delete account" : "Clear data on this device"}
        </Button>
      </div>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={user ? "Delete your account?" : "Clear this device?"}
        description={
          user
            ? "This permanently deletes your account and everything stored with it, on every device. It can't be undone."
            : "This removes your settings from this device. It can't be undone."
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" icon={Trash2} disabled={confirm !== "DELETE"} loading={busy} onClick={() => void erase()}>
              {user ? "Delete account" : "Clear data"}
            </Button>
          </>
        }
      >
        <TextField label='Type "DELETE" to confirm' value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" data-autofocus />
      </Dialog>
    </SectionCard>
  );
}
