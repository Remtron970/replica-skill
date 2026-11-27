import { motion } from "motion/react";
import { ArrowRight, Info, Sun, Sunrise } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SECTION_BY_ID, type SectionId } from "../../app/sections";
import { Card, IconChip, PageTransition, StatusChip } from "../../components/ui";
import { usePrefs } from "../../lib/prefs";
import { formatClock, formatLongDate, greetingFor, useNow } from "../../lib/time";

interface Stat {
  label: string;
  section: SectionId;
}

const STATS: Stat[] = [
  { label: "Current GPA", section: "academics" },
  { label: "Grade average", section: "academics" },
  { label: "Assignments due", section: "assignments" },
  { label: "Unread emails", section: "email" },
  { label: "Steps today", section: "health" },
  { label: "Tasks completed", section: "productivity" },
  { label: "Upcoming events", section: "calendar" },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.045 } } };
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 380, damping: 30 } },
};

export function HomePage() {
  const now = useNow(1000);
  const { prefs } = usePrefs();
  const navigate = useNavigate();
  const name = prefs.name.trim();

  return (
    <PageTransition>
      {/* Greeting */}
      <section className="relative mb-6 overflow-hidden rounded-[24px] bg-gradient-to-br from-[#ff9a3d] via-brand to-brand-deep p-5 text-white shadow-card md:p-7">
        <div className="pointer-events-none absolute -top-16 -right-10 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/85">
              {now.getHours() < 12 ? <Sunrise size={15} /> : <Sun size={15} />}
              {formatLongDate(now)}
            </p>
            <h1 className="mt-1 text-[28px] leading-tight font-bold tracking-tight md:text-[36px]">
              {greetingFor(now)}
              {name ? `, ${name}` : ""}!
            </h1>
            <p className="mt-1 max-w-md text-[14.5px] text-white/90">
              Your daily overview will appear here once your accounts are connected.
            </p>
          </div>
          <p className="tabular text-[30px] font-semibold tracking-tight md:text-[40px]" aria-live="off">
            {formatClock(now)}
          </p>
        </div>
      </section>

      {/* Honest build status */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-dashed border-brand/40 bg-brand-soft/50 px-4 py-3 text-[13.5px]">
        <Info size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden />
        <p>
          <strong>Early preview.</strong> Nothing is connected yet, so the cards below show what each
          one will track and the build phase that delivers it. No sample numbers are shown.
          {!name && (
            <>
              {" "}
              <button className="font-semibold text-brand underline-offset-2 hover:underline" onClick={() => navigate("/settings")}>
                Add your name
              </button>{" "}
              for a personal greeting.
            </>
          )}
        </p>
      </div>

      {/* Stats */}
      <h2 className="mb-3 text-[17px] font-semibold">At a glance</h2>
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
      >
        {STATS.map((s) => {
          const sec = SECTION_BY_ID[s.section];
          return (
            <motion.div key={s.label} variants={item}>
              <Card interactive onClick={() => navigate(sec.path)} className="h-full">
                <div className="mb-3 flex items-center justify-between">
                  <IconChip icon={sec.icon} accent={sec.accent} />
                  <ArrowRight size={16} className="text-muted/60" aria-hidden />
                </div>
                <p className="text-[13px] text-muted">{s.label}</p>
                <p className="tabular mt-0.5 text-[26px] font-bold text-muted/50" aria-label="No data yet">
                  —
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[12px] text-muted">Not connected</span>
                  <StatusChip>Phase {sec.phase}</StatusChip>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-3">
            <IconChip icon={SECTION_BY_ID.schedule.icon} accent={SECTION_BY_ID.schedule.accent} />
            <div>
              <h2 className="text-[17px] font-semibold">Today's schedule</h2>
              <p className="text-[13px] text-muted">Classes, countdown and current-class indicator</p>
            </div>
          </div>
          <EmptyRow
            text="Your classes will appear here after you add your schedule."
            action="Preview Schedule"
            onClick={() => navigate("/schedule")}
            phase={SECTION_BY_ID.schedule.phase}
          />
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-3">
            <IconChip icon={SECTION_BY_ID.ai.icon} accent={SECTION_BY_ID.ai.accent} />
            <div>
              <h2 className="text-[17px] font-semibold">Daily briefing</h2>
              <p className="text-[13px] text-muted">A morning summary built from your connected accounts</p>
            </div>
          </div>
          <EmptyRow
            text="Your first briefing arrives once classes, assignments and email are connected."
            action="See the AI section"
            onClick={() => navigate("/ai")}
            phase={11}
          />
        </Card>
      </div>
    </PageTransition>
  );
}

function EmptyRow({
  text,
  action,
  onClick,
  phase,
}: {
  text: string;
  action: string;
  onClick: () => void;
  phase: number;
}) {
  return (
    <div className="rounded-2xl bg-surface-2/70 p-4">
      <p className="text-[14px] text-muted">{text}</p>
      <div className="mt-3 flex items-center justify-between">
        <StatusChip>Phase {phase}</StatusChip>
        <button
          type="button"
          onClick={onClick}
          className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-brand"
        >
          {action} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
