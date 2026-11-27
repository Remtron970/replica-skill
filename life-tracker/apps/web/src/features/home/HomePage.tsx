import { AnimatePresence, motion } from "motion/react";
import {
  AlarmClock,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  FlaskConical,
  Info,
  Mail,
  MapPin,
  Moon,
  Newspaper,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Sunrise,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { SECTION_BY_ID, type SectionId } from "../../app/sections";
import { InstallCard } from "../../components/InstallCard";
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  Countdown,
  EmptyState,
  IconButton,
  IconChip,
  ProgressBar,
  SectionCard,
  Sheet,
  type Tone,
} from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { useInstall } from "../../lib/install";
import { itemVariants, listVariants, spring } from "../../lib/motion";
import { usePrefs } from "../../lib/prefs";
import { durationMinutes, formatTime, scheduleStatus } from "../../lib/schedule";
import type { DashboardSectionId } from "../../lib/sync";
import { formatClock, formatLongDate, greetingFor, useNow } from "../../lib/time";
import { CustomizeDashboard } from "./CustomizeDashboard";
import {
  buildBriefing,
  computeStats,
  demoData,
  importantItems,
  liveData,
  type HomeData,
  type ImportantKind,
} from "./homeData";

export function HomePage() {
  const { prefs, update } = usePrefs();
  const now = useNow(15_000); // data refresh; the clock and countdowns tick on their own
  const data = useMemo(() => (prefs.demo ? demoData(now) : liveData()), [prefs.demo, now]);
  const [customizing, setCustomizing] = useState(false);

  const sections: Record<DashboardSectionId, ReactNode> = {
    briefing: <BriefingCard data={data} now={now} />,
    stats: <StatsGrid data={data} now={now} />,
    schedule: <ScheduleCard data={data} now={now} />,
    important: <ImportantCard data={data} now={now} />,
  };
  const visible = prefs.dashboard.filter((s) => s.visible);

  return (
    <>
      <Hero />
      <InstallBanner />
      <ModeBanner demo={prefs.demo} onToggle={() => update({ demo: !prefs.demo })} />

      <div className="mb-3 flex justify-end">
        <Button variant="ghost" size="sm" icon={SlidersHorizontal} onClick={() => setCustomizing(true)}>
          Customize Home
        </Button>
      </div>

      <div className="space-y-6">
        <AnimatePresence initial={false}>
          {visible.map((s) => (
            <motion.div key={s.id} layout transition={spring.soft} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {sections[s.id]}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <Sheet open={customizing} onClose={() => setCustomizing(false)} title="Customize Home">
        <CustomizeDashboard />
      </Sheet>
    </>
  );
}

// ---------------------------------------------------------------------------

function Hero() {
  const now = useNow(1000);
  const { prefs } = usePrefs();
  const name = prefs.name.trim();
  const hour = now.getHours();
  const TimeIcon = hour < 12 ? Sunrise : hour < 19 ? Sun : Moon;
  return (
    <section
      aria-label="Greeting"
      className="relative mb-5 overflow-hidden rounded-[24px] bg-gradient-to-br from-[var(--hero-from)] to-[var(--hero-to)] p-5 text-white shadow-card md:p-7"
    >
      <div className="pointer-events-none absolute -top-20 -right-16 h-64 w-64 rounded-full bg-[#ffb070]/45 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-[#ff7a1a]/40 blur-3xl" aria-hidden />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[13px] font-medium">
            <TimeIcon size={15} aria-hidden />
            {formatLongDate(now)}
          </p>
          <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-tight md:text-[36px]">
            {greetingFor(now)}
            {name ? `, ${name}` : ""}!
          </h1>
          <p className="mt-1 max-w-md text-[14.5px]">Here's what's happening today.</p>
        </div>
        <p className="tabular text-[30px] font-semibold tracking-tight md:text-[40px]" aria-hidden>
          {formatClock(now)}
        </p>
      </div>
    </section>
  );
}

function ModeBanner({ demo, onToggle }: { demo: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const { enabled, user } = useAuth();
  const { prefs } = usePrefs();
  if (demo)
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-accent-purple/60 bg-surface px-4 py-3 text-[13.5px]">
        <FlaskConical size={18} className="shrink-0 text-accent-purple" aria-hidden />
        <div className="min-w-0 flex-1">
          <Badge tone="demo">Demo mode</Badge>
          <p className="mt-1">Everything below is sample data — not yours.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onToggle}>
          Turn off
        </Button>
      </div>
    );
  return (
    <div className="mb-4 flex items-start gap-3 rounded-2xl border border-dashed border-brand/50 bg-brand-soft/50 px-4 py-3 text-[13.5px]">
      <Info size={18} className="mt-0.5 shrink-0 text-brand-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p>
          <strong>No accounts connected yet.</strong> School, email, health and news connections arrive in Phases 4–9. Until then you can
          preview Home with sample data.
          {!prefs.name && (
            <>
              {" "}
              <button className="font-semibold text-brand-ink underline underline-offset-2" onClick={() => navigate("/settings")}>
                Add your name
              </button>{" "}
              for a personal greeting.
            </>
          )}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" icon={FlaskConical} onClick={onToggle}>
            Try demo data
          </Button>
          {enabled && !user && (
            <Button size="sm" variant="secondary" onClick={() => navigate("/account")}>
              Sign in to sync
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatsGrid({ data, now }: { data: HomeData; now: Date }) {
  const navigate = useNavigate();
  const s = computeStats(data, now);
  const demo = data.mode === "demo";
  const cards: { label: string; section: SectionId; value?: number; decimals?: number; suffix?: string; extra?: string }[] = [
    { label: "Current GPA", section: "academics", value: s.gpa, decimals: 2 },
    { label: "Grade average", section: "academics", value: s.average, decimals: 1, suffix: "%" },
    { label: "Due this week", section: "assignments", value: s.assignmentsDue },
    { label: "Unread emails", section: "email", value: s.unreadEmails },
    { label: "Steps today", section: "health", value: s.stepsToday },
    { label: "Tasks done", section: "productivity", value: s.tasksDone?.done, extra: s.tasksDone ? `of ${s.tasksDone.total}` : undefined },
    { label: "Events this week", section: "calendar", value: s.upcomingEvents },
  ];
  return (
    <section aria-labelledby="stats-h">
      <h2 id="stats-h" className="mb-3 text-[17px] font-semibold">
        At a glance
      </h2>
      <motion.ul variants={listVariants} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map((c) => {
          const sec = SECTION_BY_ID[c.section];
          const has = c.value !== undefined;
          return (
            <motion.li key={c.label} variants={itemVariants}>
              <Card interactive onClick={() => navigate(sec.path)} className="h-full">
                <div className="mb-3 flex items-center justify-between">
                  <IconChip icon={sec.icon} accent={sec.accent} />
                  {demo ? <Badge tone="demo">Demo</Badge> : <ArrowRight size={16} className="text-muted" aria-hidden />}
                </div>
                <p className="text-[13px] text-muted">{c.label}</p>
                {has ? (
                  <p className="mt-0.5 flex items-baseline gap-1.5">
                    <AnimatedNumber value={c.value!} decimals={c.decimals} suffix={c.suffix} className="text-[26px] font-bold" />
                    {c.extra && <span className="text-[13px] text-muted">{c.extra}</span>}
                  </p>
                ) : (
                  <>
                    <p className="tabular mt-0.5 text-[26px] font-bold text-muted" aria-hidden>
                      —
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[12px] text-muted">Not connected</span>
                      <Badge>Phase {sec.phase}</Badge>
                    </div>
                  </>
                )}
              </Card>
            </motion.li>
          );
        })}
      </motion.ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ScheduleCard({ data, now }: { data: HomeData; now: Date }) {
  const navigate = useNavigate();
  const sec = SECTION_BY_ID.schedule;
  const demo = data.mode === "demo";
  const st = scheduleStatus(data.schedule, now);
  const t = now.getTime();

  return (
    <SectionCard
      title="Today's schedule"
      subtitle={st.today.length ? `${st.today.filter((o) => o.block.title !== "Lunch").length} classes` : undefined}
      icon={sec.icon}
      accent={sec.accent}
      demo={demo}
      sync={demo ? { source: "Demo data", syncedAt: now } : { source: "Schedule", state: "not_connected" }}
      action={
        <Button variant="ghost" size="sm" onClick={() => navigate("/schedule")}>
          Open
        </Button>
      }
    >
      {!data.schedule.length ? (
        <EmptyState
          compact
          icon={sec.icon}
          accent={sec.accent}
          title="No classes yet"
          body="Your classes appear here once you add your schedule or connect your school."
          badge={<Badge tone="brand">Phase {sec.phase}</Badge>}
        />
      ) : (
        <>
          {/* Now / next */}
          {st.current ? (
            <div className="mb-4 rounded-2xl bg-brand-soft/60 p-3.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12px] font-semibold tracking-wider text-brand-ink uppercase">Happening now</p>
                <p className="text-[13px] text-muted">
                  ends {formatTime(st.current.end)} · <Countdown target={st.current.end} className="font-semibold text-ink" /> left
                </p>
              </div>
              <p className="text-[17px] font-semibold">{st.current.block.title}</p>
              <p className="mb-2.5 text-[13px] text-muted">{[st.current.block.room, st.current.block.teacher].filter(Boolean).join(" · ")}</p>
              <ProgressBar value={st.current.progress} label={`${st.current.block.title} progress`} />
            </div>
          ) : null}
          {st.next && (
            <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3.5">
              <AlarmClock size={20} className="shrink-0 text-accent-blue" aria-hidden />
              <p className="min-w-0 flex-1 text-[14px]">
                Next: <strong>{st.next.block.title}</strong>{" "}
                {st.next.isToday ? `at ${formatTime(st.next.start)}` : `on ${st.next.start.toLocaleDateString(undefined, { weekday: "long" })} at ${formatTime(st.next.start)}`}
              </p>
              <p className="shrink-0 text-[13px] text-muted">
                in <Countdown target={st.next.start} className="font-semibold text-ink" />
              </p>
            </div>
          )}
          {st.doneForToday && !st.next?.isToday && <p className="mb-3 text-[14px] text-muted">Classes are done for today. 🎉</p>}

          {/* Timeline */}
          {st.today.length ? (
            <ol className="relative ml-1.5 border-l-2 border-line" aria-label="Today's classes">
              {st.today.map((o) => {
                const isNow = st.current?.block.id === o.block.id;
                const past = o.end.getTime() <= t;
                return (
                  <li key={o.block.id} className="relative pb-3 pl-5 last:pb-0" aria-current={isNow ? "time" : undefined}>
                    <span
                      className={`absolute top-1.5 -left-[7px] h-3 w-3 rounded-full border-2 border-surface ${
                        isNow ? "bg-brand ring-4 ring-brand/25" : past ? "bg-line" : "bg-accent-blue"
                      }`}
                      aria-hidden
                    />
                    <div className={`flex items-baseline justify-between gap-3 ${past && !isNow ? "opacity-60" : ""}`}>
                      <div className="min-w-0">
                        <p className={`truncate text-[15px] ${isNow ? "font-semibold" : "font-medium"}`}>
                          {o.block.title}
                          {isNow && <span className="sr-only"> (now)</span>}
                        </p>
                        {o.block.room && (
                          <p className="flex items-center gap-1 text-[12.5px] text-muted">
                            <MapPin size={12} aria-hidden /> {o.block.room}
                          </p>
                        )}
                      </div>
                      <p className="tabular shrink-0 text-[12.5px] text-muted">
                        {formatTime(o.start)}–{formatTime(o.end)} · {durationMinutes(o)} min
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-[14px] text-muted">No classes today.</p>
          )}
        </>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------

const KIND: Record<ImportantKind, { icon: typeof Mail; tone: Tone; label: string; accent: string }> = {
  overdue: { icon: BookOpenCheck, tone: "danger", label: "Overdue", accent: "bg-accent-red/10 text-accent-red" },
  due: { icon: BookOpenCheck, tone: "warning", label: "Due soon", accent: "bg-accent-yellow/14 text-accent-yellow" },
  email: { icon: Mail, tone: "info", label: "Important email", accent: "bg-accent-blue/10 text-accent-blue" },
  grade: { icon: SECTION_BY_ID.academics.icon, tone: "success", label: "New grade", accent: "bg-accent-green/12 text-accent-green" },
  news: { icon: Newspaper, tone: "brand", label: "Developing", accent: "bg-brand-soft text-brand-ink" },
  event: { icon: CalendarClock, tone: "neutral", label: "Today", accent: "bg-surface-2 text-muted" },
};

function ImportantCard({ data, now }: { data: HomeData; now: Date }) {
  const navigate = useNavigate();
  const items = importantItems(data, now);
  const demo = data.mode === "demo";
  return (
    <SectionCard
      title="Important"
      subtitle="Deadlines, emails, grades and news that need attention"
      icon={Info}
      accent="bg-accent-red/10 text-accent-red"
      demo={demo}
      sync={demo ? { source: "Demo data", syncedAt: now } : undefined}
    >
      {items.length ? (
        <ul className="divide-y divide-line">
          {items.map((it) => {
            const k = KIND[it.kind];
            return (
              <li key={`${it.kind}-${it.id}`}>
                <button
                  type="button"
                  onClick={() => navigate(it.to)}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-start gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface-2 active:bg-surface-2"
                >
                  <IconChip icon={k.icon} accent={k.accent} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[15px] font-medium">{it.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Badge tone={k.tone}>{k.label}</Badge>
                      <span className="text-[13px] text-muted">{it.detail}</span>
                    </span>
                  </span>
                  <ArrowRight size={16} className="mt-1 shrink-0 text-muted" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState
          compact
          icon={Sparkles}
          accent="bg-surface-2 text-muted"
          title={data.mode === "live" ? "Nothing to show yet" : "All clear"}
          body={data.mode === "live" ? "Deadlines, important emails, grade updates and breaking news will collect here once sources are connected." : "Nothing needs your attention right now."}
        />
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------

function BriefingCard({ data, now }: { data: HomeData; now: Date }) {
  const [open, setOpen] = useState(false);
  const b = buildBriefing(data, now);
  const demo = data.mode === "demo";
  return (
    <SectionCard
      title="Daily briefing"
      subtitle={now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
      icon={Sparkles}
      accent="bg-brand-soft text-brand-ink"
      demo={demo}
      action={<Badge tone="neutral">Preview</Badge>}
    >
      <p className="text-[15px] leading-relaxed">{b.summary}</p>
      {b.priorities.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[12px] font-semibold tracking-wider text-muted uppercase">Suggested priorities</p>
          <ol className="list-inside list-decimal space-y-1 text-[14px]">
            {b.priorities.slice(0, 3).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ol>
        </div>
      )}
      {b.unavailable.length > 0 && (
        <p className="mt-3 text-[12.5px] text-muted">Not included (not connected): {b.unavailable.map((u) => u.label.split(" (")[0]).join(", ")}.</p>
      )}
      <div className="mt-3">
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          Read full briefing <ArrowRight size={15} aria-hidden />
        </Button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Daily briefing">
        <div className="space-y-5">
          {demo && (
            <p className="text-[13px]">
              <Badge tone="demo">Demo</Badge> <span className="ml-1 text-muted">Built from sample data.</span>
            </p>
          )}
          <p className="text-[15px] leading-relaxed">{b.summary}</p>
          {b.priorities.length > 0 && (
            <section>
              <h3 className="mb-2 text-[15px] font-semibold">Suggested priorities</h3>
              <ol className="list-inside list-decimal space-y-1.5 text-[14px]">
                {b.priorities.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </section>
          )}
          {b.sections.map((s) => (
            <section key={s.title}>
              <h3 className="mb-2 text-[15px] font-semibold">{s.title}</h3>
              <ul className="space-y-1.5 text-[14px]">
                {s.lines.map((l) => (
                  <li key={l} className="rounded-xl bg-surface-2/60 px-3 py-2">
                    {l}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {b.unavailable.length > 0 && (
            <section>
              <h3 className="mb-2 text-[15px] font-semibold">Unavailable data</h3>
              <p className="mb-2 text-[13.5px] text-muted">These sources aren't connected, so this briefing doesn't include them.</p>
              <ul className="space-y-1.5 text-[14px]">
                {b.unavailable.map((u) => (
                  <li key={u.label} className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-line px-3 py-2">
                    {u.label}
                    <Badge>Phase {u.phase}</Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-[12.5px] text-muted">
            This preview is assembled from a template. AI-written briefings with a morning notification arrive in Phase 11.
          </p>
        </div>
      </Sheet>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------

const DISMISS_KEY = "lt.installBannerDismissed";

function InstallBanner() {
  const { installed, ios, canPrompt } = useInstall();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (import.meta.env.VITE_PREVIEW === "1" || installed || dismissed || !(ios || canPrompt)) return null;
  return (
    <SectionCard
      className="mb-5"
      title="Install Life Tracker"
      subtitle="Get the full-screen app on your Home Screen"
      action={
        <IconButton
          icon={X}
          label="Dismiss"
          size="sm"
          variant="ghost"
          onClick={() => {
            setDismissed(true);
            try {
              localStorage.setItem(DISMISS_KEY, "1");
            } catch {
              /* ignore */
            }
          }}
        />
      }
    >
      <InstallCard />
    </SectionCard>
  );
}

