import { CalendarOff, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { SECTION_BY_ID } from "../../app/sections";
import { Badge, Button, Card, EmptyState, IconButton, PageHeader, SectionCard, SegmentedControl, Sheet, TextField, useToast } from "../../components/ui";
import { scheduleStatus } from "../../lib/schedule";
import { store } from "../../lib/store/schema";
import { useNow } from "../../lib/time";
import { localDate } from "../academics/grades";
import { ScheduleCalendar, type DayInfo, type ScheduleException } from "./blockSchedule";
import { PatternPicker, ScheduleSetup } from "./ScheduleSetup";
import { DayTimeline, OccurrenceList } from "./Timeline";
import { useSchedule } from "./useSchedule";

type View = "today" | "week" | "month" | "setup";
const VIEW_KEY = "lt.scheduleView";

function offText(info: DayInfo) {
  if (info.school) return "";
  return { weekend: "No school", no_school: info.note || "No school", outside_term: "Outside the school term", not_set_up: "Schedule not set up" }[info.why];
}

export function SchedulePage() {
  const sec = SECTION_BY_ID.schedule;
  const s = useSchedule();
  const now = useNow(15_000);
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem(VIEW_KEY) as View) || "today";
    } catch {
      return "today";
    }
  });
  const choose = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const todayInfo = s.info(now);

  if (!s.dayTypes.length)
    return (
      <>
        <PageHeader title="Schedule" subtitle={sec.tagline} icon={sec.icon} accent={sec.accent} />
        <SectionCard title="Set up your schedule" subtitle="Pick the pattern your school uses. You can change everything later.">
          <PatternPicker onDone={() => choose("setup")} />
        </SectionCard>
      </>
    );

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        icon={sec.icon}
        accent={sec.accent}
        right={todayInfo.school ? <Badge tone="brand">{s.typeName.get(todayInfo.dayTypeId)?.name}</Badge> : <Badge>{offText(todayInfo)}</Badge>}
      />
      <div className="mb-4">
        <SegmentedControl<View>
          label="Schedule view"
          value={view}
          onChange={choose}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "setup", label: "Set up" },
          ]}
        />
      </div>
      {view === "setup" ? (
        <ScheduleSetup />
      ) : !s.isSetUp ? (
        <Card>
          <EmptyState icon={Clock} accent={sec.accent} title="Add your class times" body="Your day types are ready. Add the classes and times for each one." action={<Button onClick={() => choose("setup")}>Add class times</Button>} />
        </Card>
      ) : view === "today" ? (
        <SectionCard title={todayInfo.school ? `Today · ${s.typeName.get(todayInfo.dayTypeId)?.name}` : `Today · ${offText(todayInfo)}`} icon={sec.icon} accent={sec.accent}>
          <DayTimeline status={scheduleStatus(s.forDay, now)} now={now} labelFor={s.labelFor} />
        </SectionCard>
      ) : view === "week" ? (
        <WeekView now={now} />
      ) : (
        <MonthView now={now} />
      )}
    </>
  );
}

function startOfWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  return x;
}

function WeekView({ now }: { now: Date }) {
  const s = useSchedule();
  const [offset, setOffset] = useState(0);
  const monday = startOfWeek(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset * 7));
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)).filter(
    (d) => s.settings.schoolDays.includes(d.getDay()) || s.info(d).school,
  );
  const today = localDate(now);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <IconButton icon={ChevronLeft} label="Previous week" variant="ghost" onClick={() => setOffset(offset - 1)} />
        <p className="text-[15px] font-semibold">
          Week of {monday.toLocaleDateString(undefined, { month: "long", day: "numeric" })}
          {offset !== 0 && (
            <button type="button" className="ml-2 text-[13px] font-semibold text-brand-ink" onClick={() => setOffset(0)}>
              This week
            </button>
          )}
        </p>
        <IconButton icon={ChevronRight} label="Next week" variant="ghost" onClick={() => setOffset(offset + 1)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days.map((d) => {
          const info = s.info(d);
          const items = s.forDay(d);
          return (
            <Card key={d.toISOString()} className={localDate(d) === today ? "ring-2 ring-brand" : ""}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[15px] font-semibold">{d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</p>
                {info.school ? <Badge tone="brand">{s.typeName.get(info.dayTypeId)?.short || s.typeName.get(info.dayTypeId)?.name}</Badge> : <Badge>{offText(info)}</Badge>}
              </div>
              {items.length ? <OccurrenceList items={items} label={`Classes on ${d.toLocaleDateString(undefined, { weekday: "long" })}`} /> : <p className="text-[14px] text-muted">No classes.</p>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ now }: { now: Date }) {
  const s = useSchedule();
  const [offset, setOffset] = useState(0);
  const [picked, setPicked] = useState<Date | null>(null);
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const cells = useMemo(() => {
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [first.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = localDate(now);
  const weeks = cells[35].getMonth() !== first.getMonth() ? 5 : 6;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <IconButton icon={ChevronLeft} label="Previous month" variant="ghost" onClick={() => setOffset(offset - 1)} />
        <p className="text-[15px] font-semibold">{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</p>
        <IconButton icon={ChevronRight} label="Next month" variant="ghost" onClick={() => setOffset(offset + 1)} />
      </div>
      <div role="grid" aria-label="Month">
        <div role="row" className="mb-1 grid grid-cols-7 text-center text-[11px] font-semibold tracking-wider text-muted uppercase">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d} role="columnheader">
              {d}
            </span>
          ))}
        </div>
        {Array.from({ length: weeks }, (_, w) => (
          <div role="row" key={w} className="grid grid-cols-7 gap-1">
            {cells.slice(w * 7, w * 7 + 7).map((d) => {
              const info = s.info(d);
              const inMonth = d.getMonth() === first.getMonth();
              const t = info.school ? s.typeName.get(info.dayTypeId) : null;
              const iso = localDate(d);
              const ex = s.exceptions.find((e) => e.date === iso);
              return (
                <button
                  key={iso}
                  role="gridcell"
                  type="button"
                  onClick={() => setPicked(d)}
                  aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}: ${t ? t.name : offText(info)}`}
                  className={`flex aspect-square min-h-11 flex-col items-center justify-center rounded-xl text-[13px] select-none ${inMonth ? "" : "opacity-40"} ${
                    iso === today ? "ring-2 ring-brand" : ""
                  } ${t ? "bg-surface-2/70 hover:bg-brand-soft" : "hover:bg-surface-2"}`}
                >
                  <span className="tabular font-semibold">{d.getDate()}</span>
                  <span className={`text-[11px] ${t ? "font-semibold text-brand-ink" : "text-muted"}`}>
                    {t ? t.short || t.name.slice(0, 3) : ex?.kind === "no_school" ? "off" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] text-muted">Tap a date to mark no school or change which day it runs as.</p>
      <Sheet open={!!picked} onClose={() => setPicked(null)} title={picked ? picked.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}>
        {picked && <DayEditor date={picked} onDone={() => setPicked(null)} />}
      </Sheet>
    </Card>
  );
}

function DayEditor({ date, onDone }: { date: Date; onDone: () => void }) {
  const s = useSchedule();
  const toast = useToast();
  const iso = localDate(date);
  const existing = s.exceptions.find((e) => e.date === iso);
  const [choice, setChoice] = useState<string>(existing ? (existing.kind === "no_school" ? "off" : (existing.dayTypeId ?? "normal")) : "normal");
  const [note, setNote] = useState(existing?.note ?? "");
  // What the normal pattern would say, ignoring this date's exception.
  const pattern = useMemo(() => {
    const info = s.info(date);
    if (!existing) return info;
    return new ScheduleCalendar(s.settings, s.exceptions.filter((e) => e.id !== existing.id), s.dayTypes).dayInfo(date);
  }, [s, date, existing]);
  const items = s.forDay(date);
  return (
    <div className="space-y-4">
      {items.length > 0 && <OccurrenceList items={items} label="Classes on this day" />}
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">This day</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="This day">
          <ChoiceChip value="normal" current={choice} onPick={setChoice}>
            Normal ({pattern.school ? s.typeName.get(pattern.dayTypeId)?.name : offText(pattern)})
          </ChoiceChip>
          <ChoiceChip value="off" current={choice} onPick={setChoice}>
            <CalendarOff size={14} aria-hidden /> No school
          </ChoiceChip>
          {s.dayTypes.map((t) => (
            <ChoiceChip key={t.id} value={t.id} current={choice} onPick={setChoice}>
              Runs as {t.name}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>
      {choice !== "normal" && <TextField id="day-note" label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={80} placeholder="e.g. Thanksgiving, Early release" />}
      <Button
        fullWidth
        onClick={() => {
          if (choice === "normal") {
            if (existing) store.exceptions.remove(existing.id);
          } else {
            store.exceptions.put({
              ...(existing ?? {}),
              date: iso,
              kind: choice === "off" ? "no_school" : "day_type",
              dayTypeId: choice === "off" ? null : choice,
              note: note.trim().slice(0, 80),
            } as ScheduleException);
          }
          toast({ tone: "success", title: "Day updated" });
          onDone();
        }}
      >
        Save
      </Button>
    </div>
  );
}

function ChoiceChip({ value, current, onPick, children }: { value: string; current: string; onPick: (v: string) => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={current === value}
      onClick={() => onPick(value)}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
        current === value ? "border-brand-strong bg-brand-strong text-on-brand" : "border-line bg-surface text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
