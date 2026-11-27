import { AlarmClock, MapPin } from "lucide-react";
import { Countdown, ProgressBar } from "../../components/ui";
import { durationMinutes, formatTime, type Occurrence, type ScheduleStatus } from "../../lib/schedule";

/** "Happening now" + "Next" + today's timeline. Used on Home and Schedule. */
export function DayTimeline({ status: st, now, labelFor }: { status: ScheduleStatus; now: Date; labelFor?: (d: Date) => string | null }) {
  const t = now.getTime();
  const nextDay = st.next && !st.next.isToday ? labelFor?.(st.next.start) : null;
  return (
    <>
      {st.current && (
        <div className="mb-4 rounded-2xl bg-brand-soft/60 p-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold tracking-wider text-brand-ink uppercase">Happening now</p>
            <p className="text-[13px] text-muted">
              ends {formatTime(st.current.end)} · <Countdown target={st.current.end} className="font-semibold text-ink" /> left
            </p>
          </div>
          <p className="text-[17px] font-semibold">{st.current.block.title}</p>
          <p className="mb-2.5 text-[13px] text-muted">{[st.current.block.room, st.current.block.teacher].filter(Boolean).join(" · ")}</p>
          <ProgressBar value={st.current.progress} label={`${st.current.block.title} progress`} />
        </div>
      )}
      {st.next && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3.5">
          <AlarmClock size={20} className="shrink-0 text-accent-blue" aria-hidden />
          <p className="min-w-0 flex-1 text-[14px]">
            Next: <strong>{st.next.block.title}</strong>{" "}
            {st.next.isToday
              ? `at ${formatTime(st.next.start)}`
              : `on ${st.next.start.toLocaleDateString(undefined, { weekday: "long" })}${nextDay ? ` (${nextDay})` : ""} at ${formatTime(st.next.start)}`}
          </p>
          <p className="shrink-0 text-[13px] text-muted">
            in <Countdown target={st.next.start} className="font-semibold text-ink" />
          </p>
        </div>
      )}
      {st.doneForToday && !st.next?.isToday && <p className="mb-3 text-[14px] text-muted">Classes are done for today. 🎉</p>}
      {st.today.length ? <OccurrenceList items={st.today} currentId={st.current?.block.id} now={t} label="Today's classes" /> : <p className="text-[14px] text-muted">No classes today.</p>}
    </>
  );
}

export function OccurrenceList({ items, currentId, now, label }: { items: Occurrence[]; currentId?: string; now?: number; label: string }) {
  return (
    <ol className="relative ml-1.5 border-l-2 border-line" aria-label={label}>
      {items.map((o) => {
        const isNow = currentId === o.block.id;
        const past = now !== undefined && o.end.getTime() <= now;
        return (
          <li key={o.block.id} className="relative pb-3 pl-5 last:pb-0" aria-current={isNow ? "time" : undefined}>
            <span
              className={`absolute top-1.5 -left-[7px] h-3 w-3 rounded-full border-2 border-surface ${isNow ? "bg-brand ring-4 ring-brand/25" : past ? "bg-line" : "bg-accent-blue"}`}
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
  );
}
