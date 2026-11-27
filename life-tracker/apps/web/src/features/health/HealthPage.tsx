import { Activity, Check, Copy, Flame, Footprints, KeyRound, Pencil, Plus, Ruler, Scale, Settings2, Smartphone, Timer, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SECTION_BY_ID } from "../../app/sections";
import { BarSeries, TrendChart } from "../../components/charts/Charts";
import { Badge, Button, Card, Chip, PageHeader, ProgressRing, SectionCard, SegmentedControl, Sheet, Switch, TextField, useToast } from "../../components/ui";
import { formatRelative } from "../../components/ui/SyncStatus";
import { useAuth } from "../../lib/auth";
import { usePrefs } from "../../lib/prefs";
import { store } from "../../lib/store/schema";
import { useCollection, useStoreSync } from "../../lib/store/StoreProvider";
import { supabase } from "../../lib/supabase";
import { useNow } from "../../lib/time";
import { localDate } from "../academics/grades";
import { fmtDistance, fmtWeight, goalStreak, KG_PER_LB, KM_PER_MI, lastDays, mergeDays, summarize, thisWeek, type DayTotals, type Metric } from "./stats";
import type { HealthDay } from "./types";

interface KeyInfo {
  id: string;
  created_at: string;
  last_used_at: string | null;
}

const METRIC_INFO: Record<Metric, { label: string; unit: (imperial: boolean) => string; icon: typeof Footprints }> = {
  steps: { label: "Steps", unit: () => "steps", icon: Footprints },
  distanceKm: { label: "Distance", unit: (i) => (i ? "mi" : "km"), icon: Ruler },
  activeEnergyKcal: { label: "Active energy", unit: () => "kcal", icon: Flame },
  exerciseMinutes: { label: "Exercise", unit: () => "min", icon: Timer },
};

/** A metric's value in the units shown on screen. */
const shown = (m: Metric, v: number | null, imperial: boolean) => (v === null ? null : m === "distanceKm" && imperial ? Math.round((v / KM_PER_MI) * 100) / 100 : v);
const fmt = (m: Metric, v: number | null, imperial: boolean) => {
  if (v === null) return "—";
  if (m === "distanceKm") return fmtDistance(v, imperial);
  return `${Math.round(v).toLocaleString()}${m === "steps" ? "" : ` ${METRIC_INFO[m].unit(imperial)}`}`;
};
const dayLabel = (iso: string, opts: Intl.DateTimeFormatOptions) => new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, opts);

export function HealthPage() {
  const sec = SECTION_BY_ID.health;
  const { prefs } = usePrefs();
  const imperial = prefs.health.units === "imperial";
  const rows = useCollection(store.health);
  const weights = useCollection(store.weights);
  const now = useNow(60_000);
  const today = localDate(now);
  const { user } = useAuth();
  const storeSync = useStoreSync();
  const [key, setKey] = useState<KeyInfo | null>(null);
  const [panel, setPanel] = useState<null | "entry" | "connect" | "settings">(null);
  const [editDay, setEditDay] = useState<string>(today);
  const [range, setRange] = useState<"week" | "month">("week");
  const [metric, setMetric] = useState<Metric>("steps");

  const loadKey = useCallback(async () => {
    if (!supabase || !user) return setKey(null);
    const { data } = await supabase.from("health_ingest_tokens").select("id, created_at, last_used_at").order("created_at", { ascending: false }).limit(1).maybeSingle();
    setKey((data as KeyInfo) ?? null);
  }, [user]);

  // Pick up what the Shortcut sent since the app was last open.
  useEffect(() => {
    void storeSync.syncNow();
    void loadKey();
  }, [loadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const merged = useMemo(() => mergeDays(rows), [rows]);
  const todayT = merged.get(today) ?? null;
  const week = useMemo(() => thisWeek(merged, now), [merged, now]);
  const series = useMemo(() => lastDays(merged, today, range === "week" ? 7 : 30), [merged, today, range]);
  const periodSum = summarize(series, metric);
  const streak = goalStreak(merged, today, prefs.health.stepGoal);
  const hasData = merged.size > 0;
  const lastFromHealth = rows.filter((r) => !r.deleted && r.source === "shortcut").sort((a, b) => b.clientUpdatedAt - a.clientUpdatedAt)[0];

  const openEntry = (day: string) => {
    setEditDay(day);
    setPanel("entry");
  };

  const chartData = series.map((d) => ({
    label: range === "week" ? dayLabel(d.day, { weekday: "short" }) : dayLabel(d.day, { month: "numeric", day: "numeric" }),
    value: shown(metric, d[metric], imperial) ?? 0,
  }));

  return (
    <>
      <PageHeader
        title="Health"
        subtitle={sec.tagline}
        icon={sec.icon}
        accent={sec.accent}
        right={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={Settings2} onClick={() => setPanel("settings")} aria-label="Health settings">
              Settings
            </Button>
            <Button size="sm" icon={Plus} onClick={() => openEntry(today)}>
              Add
            </Button>
          </div>
        }
      />

      <div className="space-y-5">
        <ConnectionCard keyInfo={key} signedIn={!!user} lastFromHealth={lastFromHealth} now={now} onConnect={() => setPanel("connect")} onAdd={() => openEntry(today)} />

        {hasData && (
          <>
            <SectionCard title="Today" subtitle={dayLabel(today, { weekday: "long", month: "long", day: "numeric" })} icon={Activity} accent="bg-accent-green/12 text-accent-green">
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
                <ProgressRing value={(todayT?.steps ?? 0) / prefs.health.stepGoal} size={132} stroke={12} label={`${(todayT?.steps ?? 0).toLocaleString()} of ${prefs.health.stepGoal.toLocaleString()} steps`} color="var(--accent-green)">
                  <span className="text-center">
                    <span className="tabular block text-[22px] font-bold leading-tight">{todayT?.steps !== null && todayT?.steps !== undefined ? todayT.steps.toLocaleString() : "—"}</span>
                    <span className="block text-[12px] text-muted">of {prefs.health.stepGoal.toLocaleString()}</span>
                  </span>
                </ProgressRing>
                <div className="grid w-full flex-1 grid-cols-2 gap-2.5">
                  {(["distanceKm", "activeEnergyKcal", "exerciseMinutes"] as const).map((m) => {
                    const Icon = METRIC_INFO[m].icon;
                    return (
                      <div key={m} className="rounded-2xl bg-surface-2/70 px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-[12.5px] text-muted">
                          <Icon size={14} aria-hidden /> {METRIC_INFO[m].label}
                        </p>
                        <p className="tabular text-[17px] font-semibold">{fmt(m, todayT?.[m] ?? null, imperial)}</p>
                      </div>
                    );
                  })}
                  <div className="rounded-2xl bg-surface-2/70 px-3 py-2.5">
                    <p className="text-[12.5px] text-muted">Goal streak</p>
                    <p className="tabular text-[17px] font-semibold">
                      {streak} day{streak === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-muted">
                {todayT ? <Badge tone={todayT.fromHealth ? "success" : "neutral"}>{todayT.fromHealth ? "From Apple Health" : "Entered by hand"}</Badge> : <span>No data for today yet.</span>}
                <span>
                  This week: <strong className="tabular text-ink">{summarize(week, "steps").total.toLocaleString()}</strong> steps
                </span>
              </div>
            </SectionCard>

            <SectionCard
              title={range === "week" ? "Last 7 days" : "Last 30 days"}
              subtitle={
                periodSum.daysWithData
                  ? `${METRIC_INFO[metric].label}: ${fmt(metric, periodSum.total, imperial)} total · ${fmt(metric, periodSum.average, imperial)} a day on ${periodSum.daysWithData} day${periodSum.daysWithData === 1 ? "" : "s"} with data`
                  : `No ${METRIC_INFO[metric].label.toLowerCase()} recorded in this period.`
              }
              icon={Footprints}
              accent="bg-accent-green/12 text-accent-green"
            >
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <SegmentedControl
                  label="Period"
                  value={range}
                  onChange={setRange}
                  options={[
                    { value: "week", label: "Week" },
                    { value: "month", label: "Month" },
                  ]}
                />
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="What to chart">
                  {(Object.keys(METRIC_INFO) as Metric[]).map((m) => (
                    <Chip key={m} selected={metric === m} onClick={() => setMetric(m)}>
                      {METRIC_INFO[m].label}
                    </Chip>
                  ))}
                </div>
              </div>
              <BarSeries title={`${METRIC_INFO[metric].label} per day`} data={chartData} series={[{ key: "value", name: METRIC_INFO[metric].label, color: "var(--accent-green)" }]} unit={METRIC_INFO[metric].unit(imperial)} highlightLast />
              <p className="mt-2 text-[12.5px] text-muted">Days with no data show as empty bars, not zero.</p>
            </SectionCard>

            <RecentDays merged={merged} today={today} imperial={imperial} onEdit={openEntry} />
          </>
        )}

        {prefs.health.trackWeight && <WeightCard weights={weights.filter((w) => !w.deleted)} imperial={imperial} />}
      </div>

      <Sheet open={panel === "entry"} onClose={() => setPanel(null)} title="Activity entry">
        {panel === "entry" && <EntryForm day={editDay} rows={rows} merged={merged} imperial={imperial} today={today} onDone={() => setPanel(null)} />}
      </Sheet>
      <Sheet open={panel === "connect"} onClose={() => setPanel(null)} title="Connect Apple Health">
        <ConnectGuide keyInfo={key} onChanged={loadKey} />
      </Sheet>
      <Sheet open={panel === "settings"} onClose={() => setPanel(null)} title="Health settings">
        <HealthSettingsForm keyInfo={key} onChanged={loadKey} />
      </Sheet>
    </>
  );
}

function ConnectionCard({ keyInfo, signedIn, lastFromHealth, now, onConnect, onAdd }: { keyInfo: KeyInfo | null; signedIn: boolean; lastFromHealth?: HealthDay; now: Date; onConnect: () => void; onAdd: () => void }) {
  const navigate = useNavigate();
  if (keyInfo) {
    const last = keyInfo.last_used_at ? new Date(keyInfo.last_used_at) : lastFromHealth ? new Date(lastFromHealth.clientUpdatedAt) : null;
    return (
      <Card className="flex flex-wrap items-center gap-3">
        <Smartphone size={20} className="text-accent-green" aria-hidden />
        <div className="min-w-0 flex-1 text-[13.5px]">
          <p className="font-semibold">
            Apple Health Shortcut <Badge tone={last ? "success" : "warning"}>{last ? "Receiving" : "Waiting for first send"}</Badge>
          </p>
          <p className="text-muted">{last ? `Last received ${formatRelative(last, now)}.` : "Run the Shortcut once on your iPhone to send today's numbers."}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onConnect}>
          Setup steps
        </Button>
      </Card>
    );
  }
  return (
    <SectionCard title="Bring in your activity" icon={Smartphone} accent="bg-accent-green/12 text-accent-green">
      <ul className="mb-3 space-y-1.5 text-[14px] text-muted">
        <li>• Send steps, distance, active energy and exercise minutes from Apple Health with an iPhone Shortcut. It can run on its own every evening.</li>
        <li>• Or enter numbers by hand. Apple Health numbers take the place of typed ones for the same day.</li>
        <li>• Your health data is private to your account and is never used for anything else.</li>
      </ul>
      <div className="flex flex-wrap gap-2">
        {signedIn ? (
          <Button icon={KeyRound} onClick={onConnect}>
            Connect Apple Health
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => navigate("/account")}>
            {supabase ? "Sign in to connect Apple Health" : "Set up cloud sync to connect Apple Health"}
          </Button>
        )}
        <Button variant="secondary" icon={Plus} onClick={onAdd}>
          Enter by hand
        </Button>
      </div>
    </SectionCard>
  );
}

function RecentDays({ merged, today, imperial, onEdit }: { merged: Map<string, DayTotals>; today: string; imperial: boolean; onEdit: (day: string) => void }) {
  const days = lastDays(merged, today, 14).reverse().filter((d) => merged.has(d.day));
  if (!days.length) return null;
  return (
    <section aria-labelledby="recent-h">
      <h2 id="recent-h" className="mb-2 text-[15px] font-semibold">
        Recent days
      </h2>
      <Card className="py-1 md:py-1">
        <ul className="divide-y divide-line">
          {days.map((d) => (
            <li key={d.day} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{d.day === today ? "Today" : dayLabel(d.day, { weekday: "short", month: "short", day: "numeric" })}</p>
                <p className="tabular text-[13px] text-muted">
                  {(Object.keys(METRIC_INFO) as Metric[])
                    .filter((m) => d[m] !== null)
                    .map((m) => fmt(m, d[m], imperial) + (m === "steps" ? " steps" : ""))
                    .join(" · ")}
                </p>
              </div>
              {d.fromHealth && <Badge tone="success">Health</Badge>}
              <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onEdit(d.day)} aria-label={`Edit ${d.day}`}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

const parseNum = (s: string) => {
  const t = s.trim().replace(/,/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

function EntryForm({ day: initialDay, rows, merged, imperial, today, onDone }: { day: string; rows: HealthDay[]; merged: Map<string, DayTotals>; imperial: boolean; today: string; onDone: () => void }) {
  const toast = useToast();
  const { prefs } = usePrefs();
  const [day, setDay] = useState(initialDay);
  const manual = rows.find((r) => !r.deleted && r.source !== "shortcut" && r.day === day);
  const fromHealth = merged.get(day)?.fromHealth ?? false;
  const str = (v: number | null | undefined, m?: Metric) => (v === null || v === undefined ? "" : String(m ? shown(m, v, imperial) : v));
  const [f, setF] = useState({ steps: "", distance: "", energy: "", exercise: "", weight: "" });
  useEffect(() => {
    setF({ steps: str(manual?.steps), distance: str(manual?.distanceKm, "distanceKm"), energy: str(manual?.activeEnergyKcal), exercise: str(manual?.exerciseMinutes), weight: "" });
  }, [day, manual?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [error, setError] = useState<string>();

  const save = () => {
    const steps = parseNum(f.steps);
    const dist = parseNum(f.distance);
    const energy = parseNum(f.energy);
    const exercise = parseNum(f.exercise);
    const weight = prefs.health.trackWeight ? parseNum(f.weight) : null;
    const distanceKm = dist === null || Number.isNaN(dist) ? dist : imperial ? dist * KM_PER_MI : dist;
    const weightKg = weight === null || Number.isNaN(weight) ? weight : imperial ? weight * KG_PER_LB : weight;
    const checks: [number | null, number, number, string][] = [
      [steps, 0, 200000, "Steps"],
      [distanceKm, 0, 400, "Distance"],
      [energy, 0, 20000, "Active energy"],
      [exercise, 0, 1440, "Exercise minutes"],
      [weightKg, 20, 400, "Weight"],
    ];
    for (const [v, lo, hi, label] of checks) if (v !== null && (Number.isNaN(v) || v < lo || v > hi)) return setError(`${label} doesn't look right. Check the number.`);
    if (day > today) return setError("That date is in the future.");
    const values = {
      steps: steps === null ? null : Math.round(steps),
      distanceKm: distanceKm === null ? null : Math.round(distanceKm * 1000) / 1000,
      activeEnergyKcal: energy === null ? null : Math.round(energy * 10) / 10,
      exerciseMinutes: exercise === null ? null : Math.round(exercise),
    };
    const empty = Object.values(values).every((v) => v === null);
    if (empty && weightKg === null && !manual) return setError("Enter at least one number.");
    if (manual && empty) store.health.remove(manual.id);
    else if (!empty) store.health.put({ ...(manual ? { id: manual.id } : {}), day, ...values, source: "manual", externalId: null } as HealthDay);
    if (weightKg !== null) store.weights.put({ measuredAt: new Date(`${day}T12:00:00`).toISOString(), weightKg: Math.round(weightKg * 100) / 100, source: "manual", externalId: null } as never);
    toast({ tone: "success", title: "Saved" });
    onDone();
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <TextField label="Date" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value || today)} />
      {fromHealth && <p className="rounded-xl bg-accent-green/10 px-3 py-2 text-[13px]">Apple Health already sent numbers for this day. Those are shown instead of typed ones; anything Health didn't send is filled from what you type here.</p>}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Steps" inputMode="numeric" value={f.steps} onChange={(e) => setF({ ...f, steps: e.target.value })} />
        <TextField label={`Distance (${imperial ? "mi" : "km"})`} inputMode="decimal" value={f.distance} onChange={(e) => setF({ ...f, distance: e.target.value })} />
        <TextField label="Active energy (kcal)" inputMode="decimal" value={f.energy} onChange={(e) => setF({ ...f, energy: e.target.value })} />
        <TextField label="Exercise (min)" inputMode="numeric" value={f.exercise} onChange={(e) => setF({ ...f, exercise: e.target.value })} />
        {prefs.health.trackWeight && <TextField label={`Weight (${imperial ? "lb" : "kg"})`} inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} hint="Optional. Adds a new weight entry." />}
      </div>
      {error && (
        <p role="alert" className="text-[13.5px] text-accent-red">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" icon={Check}>
          Save
        </Button>
        {manual && (
          <Button
            type="button"
            variant="danger"
            icon={Trash2}
            onClick={() => {
              store.health.remove(manual.id);
              onDone();
            }}
          >
            Delete typed entry
          </Button>
        )}
      </div>
    </form>
  );
}

function WeightCard({ weights, imperial }: { weights: { id: string; measuredAt: string; weightKg: number; source: string }[]; imperial: boolean }) {
  const sorted = [...weights].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt)).slice(-60);
  const latest = sorted[sorted.length - 1];
  return (
    <SectionCard title="Weight" subtitle={latest ? `Latest: ${fmtWeight(latest.weightKg, imperial)} on ${new Date(latest.measuredAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "No weight entries yet. Add one with Add, or send it from the Shortcut."} icon={Scale} accent="bg-surface-2 text-muted">
      {sorted.length >= 2 && (
        <TrendChart
          title="Weight entries over time"
          data={sorted.map((w) => ({ label: new Date(w.measuredAt).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }), value: imperial ? Math.round((w.weightKg / KG_PER_LB) * 10) / 10 : w.weightKg }))}
          series={[{ key: "value", name: "Weight", color: "var(--text-muted)" }]}
          unit={imperial ? "lb" : "kg"}
          height={180}
        />
      )}
      {sorted.length > 0 && (
        <ul className="mt-2 divide-y divide-line text-[13.5px]">
          {[...sorted].reverse().slice(0, 5).map((w) => (
            <li key={w.id} className="flex items-center justify-between py-1.5">
              <span>
                {new Date(w.measuredAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · <span className="tabular">{fmtWeight(w.weightKg, imperial)}</span>
              </span>
              <Button size="sm" variant="ghost" icon={Trash2} aria-label="Delete this weight entry" onClick={() => store.weights.remove(w.id)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-1 text-[12.5px] font-semibold text-muted">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-xl bg-surface-2 px-3 py-2 text-[12.5px]">{value}</code>
        <Button
          size="sm"
          variant="secondary"
          icon={copied ? Check : Copy}
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

function ConnectGuide({ keyInfo, onChanged }: { keyInfo: KeyInfo | null; onChanged: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<{ key: string; url: string } | null>(null);

  const makeKey = async () => {
    if (!supabase) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("health-token", { method: "POST", body: {} });
    setBusy(false);
    if (error || !data?.key) return toast({ tone: "error", title: "Couldn't make a key", body: "Check that the health functions are set up (docs/SETUP_HEALTH.md)." });
    setFresh({ key: data.key, url: data.url });
    onChanged();
  };

  if (!supabase || !user) return <p className="text-[14px] text-muted">Sign in first (Account) so the Shortcut has somewhere private to send your data. You can still enter numbers by hand.</p>;

  return (
    <div className="space-y-4 text-[14px]">
      <section>
        <h3 className="mb-1.5 font-semibold">1. Get your personal key</h3>
        {fresh ? (
          <div className="space-y-3">
            <p className="rounded-xl bg-accent-yellow/14 px-3 py-2 text-[13px]">Copy the key now. It's shown only once. Anyone with it can add numbers to your Health page (but can't read anything), so don't share it.</p>
            <CopyRow label="Address (URL)" value={fresh.url} />
            <CopyRow label="Key" value={`Bearer ${fresh.key}`} />
          </div>
        ) : (
          <>
            <p className="mb-2 text-muted">{keyInfo ? `You made a key on ${new Date(keyInfo.created_at).toLocaleDateString()}. Making a new one turns the old one off.` : "The Shortcut uses this key instead of your password."}</p>
            <Button icon={KeyRound} loading={busy} onClick={() => void makeKey()}>
              {keyInfo ? "Make a new key" : "Make my key"}
            </Button>
          </>
        )}
      </section>
      <section>
        <h3 className="mb-1.5 font-semibold">2. Build the Shortcut (on your iPhone)</h3>
        <ol className="list-decimal space-y-1.5 pl-5 text-muted">
          <li>Open <strong className="text-ink">Shortcuts</strong>, tap <strong className="text-ink">+</strong>, name it “Send to Life Tracker”.</li>
          <li>Add <strong className="text-ink">Find Health Samples</strong>: Type <em>Steps</em>, Start Date <em>is today</em>. Then <strong className="text-ink">Calculate Statistics</strong> → <em>Sum</em>.</li>
          <li>Repeat for <em>Walking + Running Distance</em>, <em>Active Energy</em> and <em>Exercise Minutes</em> (Sum each).</li>
          <li>Add <strong className="text-ink">Get Contents of URL</strong>. Paste the address. Method <em>POST</em>. Headers: <code>Authorization</code> = the key line above (starts with “Bearer”). Request Body <em>JSON</em> with fields <code>steps</code>, <code>distance_mi</code> (or <code>distance_km</code>), <code>active_energy_kcal</code>, <code>exercise_minutes</code>, each set to its Statistics result.</li>
          <li>Tap ▶︎ once. iPhone asks to allow Health access: allow only the types above. This page then shows “Receiving”.</li>
        </ol>
      </section>
      <section>
        <h3 className="mb-1.5 font-semibold">3. Make it automatic</h3>
        <p className="text-muted">
          Shortcuts → Automation → <strong className="text-ink">+</strong> → Time of Day (e.g. 9 PM, daily) → <strong className="text-ink">Run Immediately</strong> → choose your shortcut. iPhone keeps Health locked while the phone is locked, so an automation that runs while it's locked may send nothing; it catches up the next time it runs unlocked, or tap ▶︎ any time.
        </p>
      </section>
      <p className="text-[12.5px] text-muted">Full guide and troubleshooting: docs/SETUP_HEALTH.md.</p>
    </div>
  );
}

function HealthSettingsForm({ keyInfo, onChanged }: { keyInfo: KeyInfo | null; onChanged: () => void }) {
  const { prefs, update } = usePrefs();
  const toast = useToast();
  const h = prefs.health;
  const [goal, setGoal] = useState(String(h.stepGoal));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (patch: Partial<typeof h>) => update({ health: { ...h, ...patch } });

  const revoke = async () => {
    if (!supabase) return;
    const { data, error } = await supabase.functions.invoke("health-token", { method: "POST", body: { revoke: true } });
    if (error || !data?.ok) return toast({ tone: "error", title: "Couldn't turn off the key" });
    toast({ tone: "success", title: "Shortcut key turned off", body: "The Shortcut can't send anything until you make a new key." });
    onChanged();
  };

  const deleteAll = () => {
    store.health.batch(() => store.health.list().forEach((r) => store.health.remove(r.id)));
    store.weights.batch(() => store.weights.list().forEach((r) => store.weights.remove(r.id)));
    setConfirmDelete(false);
    toast({ tone: "success", title: "Health data deleted" });
  };

  return (
    <div className="space-y-4">
      <SegmentedControl
        label="Units"
        value={h.units}
        onChange={(units) => set({ units })}
        options={[
          { value: "imperial", label: "Miles · lb" },
          { value: "metric", label: "Km · kg" },
        ]}
      />
      <TextField
        label="Daily step goal"
        inputMode="numeric"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        onBlur={() => {
          const n = Math.round(Number(goal.replace(/,/g, "")));
          if (n >= 500 && n <= 100000) set({ stepGoal: n });
          else setGoal(String(h.stepGoal));
        }}
        hint="Between 500 and 100,000."
      />
      <Switch checked={h.trackWeight} onChange={(trackWeight) => set({ trackWeight })} label="Show weight" description="Off by default. When on, weight entries appear as a plain history, without goals or judgments." />
      {keyInfo && (
        <Button variant="secondary" icon={KeyRound} onClick={() => void revoke()}>
          Turn off Shortcut key
        </Button>
      )}
      <div className="border-t border-line pt-4">
        {confirmDelete ? (
          <div className="space-y-2">
            <p className="text-[13.5px]">Delete every activity and weight entry on all your devices? This can't be undone. (Apple Health itself isn't affected.)</p>
            <div className="flex gap-2">
              <Button variant="danger" icon={Trash2} onClick={deleteAll}>
                Delete everything
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>
            Delete all health data
          </Button>
        )}
      </div>
    </div>
  );
}
