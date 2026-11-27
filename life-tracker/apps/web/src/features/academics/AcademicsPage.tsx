import { motion } from "motion/react";
import { AlertTriangle, CalendarRange, FileUp, GraduationCap, History, Plus, Settings2, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SECTION_BY_ID } from "../../app/sections";
import {
  AnimatedNumber,
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  PageHeader,
  SectionCard,
  SectionTitle,
  Sheet,
  Skeleton,
} from "../../components/ui";
import { itemVariants, listVariants } from "../../lib/motion";
import { store } from "../../lib/store/schema";
import { CourseForm, COLOR_CLASS, COLOR_SWATCH, GpaSettingsForm, PastCourseForm, TermsForm } from "./forms";
import { recentChange, type CourseSummary } from "./grades";
import { LEVEL_LABEL } from "./types";
import { useAcademics } from "./useAcademics";

const BarSeries = lazy(() => import("../../components/charts/Charts").then((m) => ({ default: m.BarSeries })));

type Panel = null | "add" | "settings" | "past" | "terms";

export function AcademicsPage() {
  const sec = SECTION_BY_ID.academics;
  const a = useAcademics();
  const navigate = useNavigate();
  const [panel, setPanel] = useState<Panel>(null);
  const close = () => setPanel(null);
  const graded = a.summaries.filter((s) => s.result.percent !== null);

  return (
    <>
      <PageHeader
        title="Academics"
        subtitle={a.currentTerm ? `${a.currentTerm.name} · grades, GPA and trends` : sec.tagline}
        icon={sec.icon}
        accent={sec.accent}
        right={
          <div className="flex gap-2">
            <IconButton icon={Settings2} label="GPA settings" onClick={() => setPanel("settings")} />
            {/* Wrappers carry the responsive visibility (a class on the button itself loses to its own display style). */}
            <span className="hidden sm:inline-flex">
              <Button icon={Plus} onClick={() => setPanel("add")}>
                Add class
              </Button>
            </span>
            <span className="inline-flex sm:hidden">
              <IconButton icon={Plus} label="Add class" variant="primary" onClick={() => setPanel("add")} />
            </span>
          </div>
        }
      />

      {a.courses.length === 0 ? (
        <Card>
          <EmptyState
            icon={GraduationCap}
            accent={sec.accent}
            title="Add your classes"
            body="Enter your classes and grades, paste them from your school portal, or (soon) connect Google Classroom or Canvas. Your GPA and trends appear here."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button icon={Plus} onClick={() => setPanel("add")}>
                  Add a class
                </Button>
                <Button variant="secondary" icon={FileUp} onClick={() => navigate("/academics/import")}>
                  Import from a spreadsheet
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* GPA summary */}
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryTile label="GPA (unweighted)" value={a.gpa.unweighted} decimals={2} detail={`${a.gpa.credits} credits graded`} />
            <SummaryTile label="GPA (weighted)" value={a.gpa.weighted} decimals={2} detail="Honors/AP bonus included" />
            <SummaryTile label="Grade average" value={a.average} decimals={1} suffix="%" detail={`${graded.length} of ${a.courses.length} classes graded`} />
            <SummaryTile
              label={a.pastCourses.length ? "Cumulative GPA" : "Missing work"}
              value={a.pastCourses.length ? a.cumulative.unweighted : a.missing}
              decimals={a.pastCourses.length ? 2 : 0}
              detail={a.pastCourses.length ? `Weighted ${a.cumulative.weighted?.toFixed(2) ?? "—"} · ${a.cumulative.credits} credits` : a.missing ? "assignments marked missing" : "Nothing missing"}
              alert={!a.pastCourses.length && a.missing > 0}
            />
          </section>

          {/* Classes */}
          <section aria-labelledby="classes-h">
            <SectionTitle
              right={
                <Button variant="ghost" size="sm" icon={FileUp} onClick={() => navigate("/academics/import")}>
                  Import
                </Button>
              }
            >
              <span id="classes-h">Classes</span>
            </SectionTitle>
            <motion.ul variants={listVariants} initial="hidden" animate="show" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {a.summaries.map((s) => (
                <motion.li key={s.course.id} variants={itemVariants}>
                  <ClassCard s={s} history={a.history(s.course)} today={a.today} onOpen={() => navigate(`/academics/${s.course.id}`)} />
                </motion.li>
              ))}
            </motion.ul>
          </section>

          {/* Comparison */}
          {graded.length >= 2 && (
            <SectionCard title="Class comparison" subtitle="Current percentage in each graded class" icon={GraduationCap} accent={sec.accent}>
              <Suspense fallback={<Skeleton className="h-[220px] w-full" />}>
                <BarSeries
                  title="Current percentage by class"
                  unit="%"
                  data={graded.map((s) => ({ label: s.course.name.length > 10 ? `${s.course.name.slice(0, 9)}…` : s.course.name, pct: Math.round((s.result.percent as number) * 10) / 10 }))}
                  series={[{ key: "pct", name: "Current %", color: "var(--chart-3)" }]}
                />
              </Suspense>
            </SectionCard>
          )}

          {/* Past terms */}
          <SectionCard
            title="Past terms"
            subtitle="Final grades from earlier terms, for your cumulative GPA"
            icon={History}
            accent="bg-surface-2 text-muted"
            action={
              <Button variant="ghost" size="sm" icon={Plus} onClick={() => setPanel("past")}>
                Add
              </Button>
            }
          >
            {a.pastCourses.length === 0 ? (
              <p className="text-[14px] text-muted">None added. Add last year's final grades to see a cumulative GPA.</p>
            ) : (
              <PastList />
            )}
          </SectionCard>

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={CalendarRange} onClick={() => setPanel("terms")}>
              {a.currentTerm ? `Term: ${a.currentTerm.name}` : "Set up terms"}
            </Button>
          </div>
        </div>
      )}

      <Sheet open={panel === "add"} onClose={close} title="Add a class">
        <CourseForm
          onDone={(id) => {
            close();
            navigate(`/academics/${id}`);
          }}
        />
      </Sheet>
      <Sheet open={panel === "settings"} onClose={close} title="GPA settings">
        <GpaSettingsForm onDone={close} />
      </Sheet>
      <Sheet open={panel === "past"} onClose={close} title="Add a past class">
        <PastCourseForm onDone={() => undefined} />
        <div className="mt-4">
          <PastList />
        </div>
      </Sheet>
      <Sheet open={panel === "terms"} onClose={close} title="Terms">
        <TermsForm onDone={close} />
      </Sheet>
    </>
  );
}

function SummaryTile({ label, value, decimals, suffix, detail, alert }: { label: string; value: number | null; decimals: number; suffix?: string; detail: string; alert?: boolean }) {
  return (
    <Card className="h-full">
      <p className="text-[13px] text-muted">{label}</p>
      {value === null ? (
        <p className="tabular mt-0.5 text-[28px] font-bold text-muted">—</p>
      ) : (
        <AnimatedNumber value={value} decimals={decimals} suffix={suffix} className={`mt-0.5 block text-[28px] font-bold ${alert ? "text-accent-red" : ""}`} />
      )}
      <p className="mt-1 text-[12px] text-muted">{detail}</p>
    </Card>
  );
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const w = 96;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - 3 - ((p - min) / span) * (h - 6)]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="3" fill={color} />
    </svg>
  );
}

function ClassCard({ s, history, today, onOpen }: { s: CourseSummary; history: { date: string; percent: number }[]; today: string; onOpen: () => void }) {
  const delta = recentChange(history, today);
  const c = s.course;
  return (
    <Card interactive onClick={onOpen} className="h-full">
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold ${COLOR_CLASS[c.color] ?? COLOR_CLASS.purple}`} aria-hidden>
          {c.name.slice(0, 2).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{c.name}</p>
          <p className="truncate text-[12.5px] text-muted">{[c.teacher, c.level !== "regular" ? LEVEL_LABEL[c.level] : null, c.gradingMode === "manual" ? "Portal %" : null].filter(Boolean).join(" · ") || "No teacher added"}</p>
        </div>
        {s.letter && <Badge tone="brand">{s.letter}</Badge>}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          {s.result.percent === null ? (
            <p className="text-[14px] text-muted">No grades yet</p>
          ) : (
            <AnimatedNumber value={s.result.percent} decimals={1} suffix="%" className="text-[26px] font-bold" />
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {delta !== null && delta !== 0 && (
              <Badge tone={delta > 0 ? "success" : "danger"} icon={delta > 0 ? TrendingUp : TrendingDown}>
                {delta > 0 ? "+" : ""}
                {delta}% · 2 wks
              </Badge>
            )}
            {s.result.missing > 0 && (
              <Badge tone="danger" icon={AlertTriangle}>
                {s.result.missing} missing
              </Badge>
            )}
          </div>
        </div>
        <Sparkline points={history.map((h) => h.percent)} color={COLOR_SWATCH[c.color] ?? "var(--chart-3)"} />
      </div>
    </Card>
  );
}

function PastList() {
  const a = useAcademics();
  const byTerm = a.pastCourses.reduce<Record<string, typeof a.pastCourses>>((acc, p) => ((acc[p.termName] ??= []).push(p), acc), {});
  return (
    <div className="space-y-3">
      {Object.entries(byTerm).map(([term, list]) => (
        <div key={term}>
          <p className="mb-1 text-[12px] font-semibold tracking-wider text-muted uppercase">{term}</p>
          <ul className="divide-y divide-line">
            {list.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2 text-[14px]">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-[12.5px] text-muted">
                  {p.credits} cr{p.level !== "regular" ? ` · ${LEVEL_LABEL[p.level]}` : ""}
                </span>
                <Badge tone="brand">{p.letter}</Badge>
                <IconButton icon={Trash2} label={`Delete ${p.name}`} size="sm" variant="ghost" onClick={() => store.pastCourses.remove(p.id)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
