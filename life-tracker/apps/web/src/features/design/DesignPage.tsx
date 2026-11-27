import { Bell, Mail, Palette, Plus, Sparkles, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Logo, Wordmark } from "../../components/Brand";
import { BarSeries, Donut, TrendChart } from "../../components/charts/Charts";
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  Chip,
  Countdown,
  Dialog,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  PageHeader,
  ProgressBar,
  ProgressRing,
  SectionCard,
  SectionTitle,
  Select,
  SegmentedControl,
  Sheet,
  SkeletonCard,
  Switch,
  TextField,
  useToast,
} from "../../components/ui";

/**
 * Living style guide (Settings → About → Design system).
 * Numbers on this page are illustrative values for previewing components
 * and are labeled as such; they are never shown as the user's data.
 */

const COLORS: { name: string; token: string; use: string }[] = [
  { name: "Brand", token: "--brand", use: "Fills, icons, charts" },
  { name: "Brand ink", token: "--brand-ink", use: "Orange text & links" },
  { name: "Brand strong", token: "--brand-strong", use: "Primary buttons" },
  { name: "Brand soft", token: "--brand-soft", use: "Tints, selection" },
  { name: "Background", token: "--bg", use: "Warm cream" },
  { name: "Surface", token: "--surface", use: "Cards" },
  { name: "Text", token: "--text", use: "Charcoal" },
  { name: "Muted", token: "--text-muted", use: "Secondary text" },
  { name: "Blue", token: "--accent-blue", use: "Schedule, email" },
  { name: "Purple", token: "--accent-purple", use: "Academics" },
  { name: "Green", token: "--accent-green", use: "Health, success" },
  { name: "Yellow", token: "--accent-yellow", use: "Calendar, warnings" },
  { name: "Red", token: "--accent-red", use: "News, errors" },
];

const TYPE = [
  ["Display", "text-[34px] font-bold tracking-tight", "34 / bold"],
  ["Title", "text-[22px] font-semibold", "22 / semibold"],
  ["Headline", "text-[17px] font-semibold", "17 / semibold"],
  ["Body", "text-[15px]", "15 / regular"],
  ["Caption", "text-[13px] text-muted", "13 / regular"],
  ["Micro", "text-[11px] font-semibold uppercase tracking-wider text-muted", "11 / semibold"],
] as const;

const EXAMPLE_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label, i) => ({
  label,
  a: [6200, 8100, 5400, 9300, 7600, 11200, 4300][i],
}));
const EXAMPLE_TREND = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"].map((label, i) => ({
  label,
  a: [88, 90, 87, 92, 93, 95][i],
  b: [84, 83, 86, 85, 89, 88][i],
}));

export function DesignPage() {
  const toast = useToast();
  const [dialog, setDialog] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [sw, setSw] = useState(true);
  const [chips, setChips] = useState<string[]>(["School"]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("not-an-email");
  const countdownTarget = useMemo(() => new Date(Date.now() + 12 * 60 * 1000 + 4000), []);

  return (
    <>
      <PageHeader title="Design system" subtitle="The building blocks every Life Tracker screen uses." icon={Palette} accent="bg-brand-soft text-brand-ink" />

      <p className="mb-6 rounded-2xl border border-line bg-surface px-4 py-3 text-[13.5px]">
        <Badge tone="demo">Example values</Badge> <span className="ml-1">Numbers on this page only preview the components. They aren't your data.</span>
      </p>

      <div className="space-y-8">
        {/* Brand */}
        <section>
          <SectionTitle>Brand</SectionTitle>
          <Card className="flex flex-wrap items-center gap-6">
            <img src={`${import.meta.env.BASE_URL}icons/icon-512.png`} alt="Life Tracker app icon" className="h-24 w-24 rounded-[22%] shadow-pop" />
            <div className="flex items-end gap-3" role="group" aria-label="Icon at small sizes">
              <Logo size={60} />
              <Logo size={40} />
              <Logo size={29} />
              <Logo size={20} />
            </div>
            <Wordmark />
          </Card>
        </section>

        {/* Colors */}
        <section>
          <SectionTitle>Color</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {COLORS.map((c) => (
              <div key={c.token} className="overflow-hidden rounded-2xl bg-surface shadow-card">
                <div className="h-14 border-b border-line" style={{ background: `var(${c.token})` }} />
                <div className="p-2.5">
                  <p className="text-[13px] font-semibold">{c.name}</p>
                  <p className="text-[11.5px] text-muted">{c.use}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Type */}
        <section>
          <SectionTitle>Typography — Inter</SectionTitle>
          <Card className="divide-y divide-line">
            {TYPE.map(([name, cls, spec]) => (
              <div key={name} className="flex items-baseline justify-between gap-4 py-2.5">
                <span className={cls}>{name}</span>
                <span className="tabular shrink-0 text-[12px] text-muted">{spec}</span>
              </div>
            ))}
          </Card>
        </section>

        {/* Buttons */}
        <section>
          <SectionTitle>Buttons</SectionTitle>
          <Card className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button icon={Plus}>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger" icon={Trash2}>
                Delete
              </Button>
              <Button disabled>Disabled</Button>
              <Button
                loading={loading}
                onClick={() => {
                  setLoading(true);
                  window.setTimeout(() => setLoading(false), 1500);
                }}
              >
                {loading ? "Saving…" : "Tap to load"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <IconButton icon={Bell} label="Notifications" />
              <IconButton icon={Sparkles} label="Ask AI" variant="primary" />
            </div>
          </Card>
        </section>

        {/* Badges & chips */}
        <section>
          <SectionTitle>Badges & chips</SectionTitle>
          <Card className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge>Neutral</Badge>
              <Badge tone="brand">Brand</Badge>
              <Badge tone="success">Submitted</Badge>
              <Badge tone="warning">Due tomorrow</Badge>
              <Badge tone="danger">Overdue</Badge>
              <Badge tone="info">Developing</Badge>
              <Badge tone="demo">Demo</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Important", "School", "Personal", "Notifications"].map((c) => (
                <Chip key={c} selected={chips.includes(c)} onClick={() => setChips((xs) => (xs.includes(c) ? xs.filter((x) => x !== c) : [...xs, c]))}>
                  {c}
                </Chip>
              ))}
            </div>
          </Card>
        </section>

        {/* Forms */}
        <section>
          <SectionTitle>Forms</SectionTitle>
          <Card className="grid gap-4 md:grid-cols-2">
            <TextField label="Assignment name" placeholder="Lab report" hint="Shown on your Assignments list." />
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? undefined : "Enter a valid email address."}
            />
            <Select label="Grading scale" defaultValue="standard">
              <option value="standard">Standard (A = 93–100)</option>
              <option value="ten">10-point (A = 90–100)</option>
            </Select>
            <div className="flex flex-col justify-end">
              <Switch checked={sw} onChange={setSw} label="Weighted GPA" description="Add honors and AP bonus points." />
            </div>
            <div className="md:col-span-2">
              <SegmentedControl
                label="Calendar view"
                value={view}
                onChange={setView}
                options={[
                  { value: "day", label: "Day" },
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                ]}
              />
            </div>
          </Card>
        </section>

        {/* Cards */}
        <section>
          <SectionTitle>Data cards & sync status</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCard title="Synced card" icon={Mail} accent="bg-accent-blue/10 text-accent-blue" sync={{ source: "Gmail", syncedAt: new Date(Date.now() - 5 * 60_000) }}>
              <ListRow title="Every data card shows its source" subtitle="…and when it was last refreshed." />
            </SectionCard>
            <SectionCard title="Sample data" demo sync={{ source: "Demo data", syncedAt: new Date() }}>
              <ListRow title="Demo content always carries this badge" subtitle="So it can never be mistaken for real data." />
            </SectionCard>
            <SectionCard title="Sync failed" sync={{ source: "Canvas", syncedAt: new Date(Date.now() - 3 * 3600_000), state: "error" }}>
              <ErrorState title="Couldn't reach Canvas" body="Your last good data is still shown." onRetry={() => toast({ tone: "info", title: "Retrying…" })} />
            </SectionCard>
            <SectionCard title="Offline" sync={{ source: "Google Classroom", syncedAt: new Date(Date.now() - 90 * 60_000), state: "offline" }}>
              <ListRow title="Cached data with a clear offline label" />
            </SectionCard>
          </div>
        </section>

        {/* Feedback */}
        <section>
          <SectionTitle>Loading, empty & notifications</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <SkeletonCard />
            <Card>
              <EmptyState compact icon={Sparkles} accent="bg-brand-soft text-brand-ink" title="Nothing due today" body="Enjoy the free time." />
            </Card>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => toast({ tone: "notification", title: "Biology lab due tomorrow", body: "Open Assignments to review it.", action: { label: "Open", onClick: () => {} } })}>
              Show notification
            </Button>
            <Button variant="secondary" onClick={() => toast({ tone: "success", title: "Saved" })}>
              Success toast
            </Button>
            <Button variant="secondary" onClick={() => toast({ tone: "error", title: "Couldn't save", body: "Check your connection and try again." })}>
              Error toast
            </Button>
            <Button variant="secondary" onClick={() => setDialog(true)}>
              Open dialog
            </Button>
            <Button variant="secondary" onClick={() => setSheet(true)}>
              Open sheet
            </Button>
          </div>
        </section>

        {/* Progress */}
        <section>
          <SectionTitle>Numbers & progress</SectionTitle>
          <Card className="grid items-center gap-6 sm:grid-cols-3">
            <div>
              <p className="text-[13px] text-muted">Animated number</p>
              <AnimatedNumber value={3.87} decimals={2} className="text-[34px] font-bold" />
              <p className="mt-2 text-[13px] text-muted">Countdown</p>
              <Countdown target={countdownTarget} className="text-[22px] font-semibold text-brand-ink" />
            </div>
            <div className="flex justify-center gap-4">
              <ProgressRing value={0.72} label="Weekly goal" />
              <ProgressRing value={0.4} label="Habits" color="var(--chart-4)" />
            </div>
            <div className="space-y-4">
              <ProgressBar value={0.8} label="Assignments done" showValue />
              <ProgressBar value={0.35} label="Reading goal" showValue color="bg-accent-purple" />
            </div>
          </Card>
        </section>

        {/* Charts */}
        <section>
          <SectionTitle>Charts</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Trend (line)" demo>
              <TrendChart title="Example grade trend" unit="%" data={EXAMPLE_TREND} series={[{ key: "a", name: "Biology" }, { key: "b", name: "History" }]} />
            </SectionCard>
            <SectionCard title="Bars" demo>
              <BarSeries title="Example steps per day" unit="steps" data={EXAMPLE_WEEK} series={[{ key: "a", name: "Steps", color: "var(--chart-4)" }]} highlightLast />
            </SectionCard>
            <SectionCard title="Area" demo>
              <TrendChart area title="Example weekly focus" data={EXAMPLE_TREND} series={[{ key: "a", name: "Focus" }]} />
            </SectionCard>
            <SectionCard title="Donut" demo>
              <Donut
                title="Example email categories"
                centerValue="24"
                centerLabel="emails"
                data={[
                  { name: "School", value: 9 },
                  { name: "Personal", value: 5 },
                  { name: "Notifications", value: 7 },
                  { name: "Other", value: 3 },
                ]}
              />
            </SectionCard>
          </div>
        </section>
      </div>

      <Dialog
        open={dialog}
        onClose={() => setDialog(false)}
        title="Disconnect Gmail?"
        description="Life Tracker will stop reading new email. Summaries already saved stay until you delete them."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialog(false);
                toast({ tone: "info", title: "Preview only", body: "Nothing was disconnected." });
              }}
            >
              Disconnect
            </Button>
          </>
        }
      />
      <Sheet open={sheet} onClose={() => setSheet(false)} title="Quick add">
        <div className="space-y-3">
          <TextField label="Task" placeholder="Study for Friday's quiz" data-autofocus />
          <Button fullWidth onClick={() => setSheet(false)}>
            Add task
          </Button>
        </div>
      </Sheet>
    </>
  );
}
