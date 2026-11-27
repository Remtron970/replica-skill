import { AlertTriangle, CloudOff, RefreshCw, Unplug } from "lucide-react";
import { useNow } from "../../lib/time";
import { cx } from "./cx";

export interface SyncInfo {
  /** Human name of the source, e.g. "Google Classroom" or "Entered by you". */
  source: string;
  /** When the data was last refreshed; omit for "never". */
  syncedAt?: Date;
  state?: "ok" | "syncing" | "error" | "offline" | "not_connected";
}

export function formatRelative(from: Date, now: Date) {
  const s = Math.round((now.getTime() - from.getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

/** "Synced 5 min ago · Google Classroom" footer used on every data card. */
export function SyncStatus({ source, syncedAt, state = "ok" }: SyncInfo) {
  const now = useNow(30_000);
  const when = syncedAt ? formatRelative(syncedAt, now) : "never";
  const map = {
    ok: { icon: null, text: `Synced ${when}`, tone: "text-muted" },
    syncing: { icon: RefreshCw, text: "Syncing…", tone: "text-muted" },
    error: { icon: AlertTriangle, text: `Couldn't refresh — last updated ${when}`, tone: "text-accent-red" },
    offline: { icon: CloudOff, text: `Offline — showing data from ${when}`, tone: "text-accent-yellow" },
    not_connected: { icon: Unplug, text: "Not connected", tone: "text-muted" },
  }[state];
  const Icon = map.icon;
  return (
    <p className={cx("flex items-center gap-1.5 text-[12px]", map.tone)} role="status">
      {Icon && <Icon size={13} className={state === "syncing" ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden />}
      <span>{map.text}</span>
      <span aria-hidden>·</span>
      <span className="truncate">{source}</span>
    </p>
  );
}
