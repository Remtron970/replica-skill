import { motion } from "motion/react";
import { ArrowRight, Info, Moon, Sun, Sunrise, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SECTION_BY_ID, type SectionId } from "../../app/sections";
import { InstallCard } from "../../components/InstallCard";
import { Badge, Button, Card, EmptyState, IconButton, IconChip, SectionCard, SectionTitle } from "../../components/ui";
import { useInstall } from "../../lib/install";
import { itemVariants, listVariants } from "../../lib/motion";
import { usePrefs } from "../../lib/prefs";
import { formatClock, formatLongDate, greetingFor, useNow } from "../../lib/time";

const STATS: { label: string; section: SectionId }[] = [
  { label: "Current GPA", section: "academics" },
  { label: "Grade average", section: "academics" },
  { label: "Assignments due", section: "assignments" },
  { label: "Unread emails", section: "email" },
  { label: "Steps today", section: "health" },
  { label: "Tasks completed", section: "productivity" },
  { label: "Upcoming events", section: "calendar" },
];

export function HomePage() {
  const now = useNow(1000);
  const { prefs } = usePrefs();
  const navigate = useNavigate();
  const name = prefs.name.trim();
  const hour = now.getHours();
  const TimeIcon = hour < 12 ? Sunrise : hour < 19 ? Sun : Moon;

  return (
    <>
      {/* Greeting */}
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
            <p className="mt-1 max-w-md text-[14.5px]">Your daily overview will appear here once your accounts are connected.</p>
          </div>
          <p className="tabular text-[30px] font-semibold tracking-tight md:text-[40px]" aria-hidden>
            {formatClock(now)}
          </p>
        </div>
      </section>

      <InstallBanner />

      {/* Honest build status */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-dashed border-brand/50 bg-brand-soft/50 px-4 py-3 text-[13.5px]">
        <Info size={18} className="mt-0.5 shrink-0 text-brand-ink" aria-hidden />
        <p>
          <strong>Early preview.</strong> Nothing is connected yet, so each card shows what it will track and the build phase that
          delivers it. No sample numbers are shown.
          {!name && (
            <>
              {" "}
              <button className="font-semibold text-brand-ink underline underline-offset-2" onClick={() => navigate("/settings")}>
                Add your name
              </button>{" "}
              for a personal greeting.
            </>
          )}
        </p>
      </div>

      <SectionTitle>At a glance</SectionTitle>
      <motion.ul variants={listVariants} initial="hidden" animate="show" className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {STATS.map((s) => {
          const sec = SECTION_BY_ID[s.section];
          return (
            <motion.li key={s.label} variants={itemVariants}>
              <Card interactive onClick={() => navigate(sec.path)} className="h-full">
                <div className="mb-3 flex items-center justify-between">
                  <IconChip icon={sec.icon} accent={sec.accent} />
                  <ArrowRight size={16} className="text-muted" aria-hidden />
                </div>
                <p className="text-[13px] text-muted">{s.label}</p>
                <p className="tabular mt-0.5 text-[26px] font-bold text-muted" aria-hidden>
                  —
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[12px] text-muted">Not connected</span>
                  <Badge>Phase {sec.phase}</Badge>
                </div>
              </Card>
            </motion.li>
          );
        })}
      </motion.ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Today's schedule"
          subtitle="Classes, countdown and current-class indicator"
          icon={SECTION_BY_ID.schedule.icon}
          accent={SECTION_BY_ID.schedule.accent}
          sync={{ source: "Schedule", state: "not_connected" }}
        >
          <EmptyState
            compact
            icon={SECTION_BY_ID.schedule.icon}
            accent={SECTION_BY_ID.schedule.accent}
            title="No classes yet"
            body="Your classes will appear here after you add your schedule."
            badge={<Badge tone="brand">Phase {SECTION_BY_ID.schedule.phase}</Badge>}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/schedule")}>
                Open Schedule <ArrowRight size={15} aria-hidden />
              </Button>
            }
          />
        </SectionCard>

        <SectionCard
          title="Daily briefing"
          subtitle="A morning summary built from your connected accounts"
          icon={SECTION_BY_ID.ai.icon}
          accent={SECTION_BY_ID.ai.accent}
          sync={{ source: "Briefing", state: "not_connected" }}
        >
          <EmptyState
            compact
            icon={SECTION_BY_ID.ai.icon}
            accent={SECTION_BY_ID.ai.accent}
            title="No briefing yet"
            body="Your first briefing arrives once classes, assignments and email are connected."
            badge={<Badge tone="brand">Phase 11</Badge>}
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("/ai")}>
                Open AI <ArrowRight size={15} aria-hidden />
              </Button>
            }
          />
        </SectionCard>
      </div>
    </>
  );
}

const DISMISS_KEY = "lt.installBannerDismissed";

/** Nudge to install, only on phones/tablets that aren't already running the installed app. */
function InstallBanner() {
  const { installed, ios, canPrompt } = useInstall();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (installed || dismissed || !(ios || canPrompt)) return null;
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
