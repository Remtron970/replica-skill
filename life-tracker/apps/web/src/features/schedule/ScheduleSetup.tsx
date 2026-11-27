import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Chip, IconButton, SectionCard, Select, Sheet, TextField, useToast } from "../../components/ui";
import { usePrefs } from "../../lib/prefs";
import { formatTime } from "../../lib/schedule";
import { store } from "../../lib/store/schema";
import { localDate } from "../academics/grades";
import { isTime, overlaps, PRESETS, type DayType, type ScheduleBlock, type ScheduleSettings } from "./blockSchedule";
import { useSchedule } from "./useSchedule";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return formatTime(new Date(2000, 0, 1, h, m));
};

/** One-tap start for common patterns. */
export function PatternPicker({ onDone }: { onDone: () => void }) {
  const { update } = usePrefs();
  const toast = useToast();
  const start = (key: keyof typeof PRESETS) => {
    const preset = PRESETS[key];
    const ids: string[] = [];
    store.dayTypes.batch(() => preset.types.forEach((t, i) => ids.push(store.dayTypes.put({ name: t.name, short: t.short, sort: i } as DayType).id)));
    const today = localDate(new Date());
    const settings: ScheduleSettings =
      key === "modified"
        ? { schoolDays: [1, 2, 3, 4, 5], fixed: { "1": ids[0] }, rotation: [ids[1], ids[2]], anchorDate: today, anchorIndex: 0, termStart: null, termEnd: null }
        : key === "ab"
          ? { schoolDays: [1, 2, 3, 4, 5], fixed: {}, rotation: [ids[0], ids[1]], anchorDate: today, anchorIndex: 0, termStart: null, termEnd: null }
          : { schoolDays: [1, 2, 3, 4, 5], fixed: {}, rotation: [ids[0]], anchorDate: null, anchorIndex: 0, termStart: null, termEnd: null };
    update({ schedule: settings });
    toast({ tone: "success", title: `${preset.label} set up`, body: "Next: add your class times to each day, then check which day today is." });
    onDone();
  };
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(
        [
          ["modified", "Modified block", "One day with all classes (often Monday), other days alternate A/B."],
          ["ab", "A/B block", "Days alternate A and B, each with its own long classes."],
          ["same", "Same every day", "The same classes at the same times each school day."],
        ] as const
      ).map(([k, title, body]) => (
        <button key={k} type="button" onClick={() => start(k)} className="rounded-2xl border border-line bg-surface p-4 text-left shadow-card hover:border-brand-ink">
          <p className="text-[15px] font-semibold">{title}</p>
          <p className="mt-1 text-[13px] text-muted">{body}</p>
        </button>
      ))}
    </div>
  );
}

export function ScheduleSetup() {
  const s = useSchedule();
  const { prefs, update } = usePrefs();
  const [editing, setEditing] = useState<{ dayTypeId: string; block?: ScheduleBlock } | null>(null);
  const settings = prefs.schedule;
  const setSettings = (patch: Partial<ScheduleSettings>) => update({ schedule: { ...settings, ...patch } });

  if (!s.dayTypes.length)
    return (
      <SectionCard title="What kind of schedule do you have?">
        <PatternPicker onDone={() => undefined} />
      </SectionCard>
    );

  const rotating = settings.rotation.filter((id) => s.typeName.has(id));
  const todayInfo = s.info(new Date());

  return (
    <div className="space-y-4">
      {/* 1. Classes for each day type */}
      {s.dayTypes.map((t) => {
        const mine = s.blocks.filter((b) => b.dayTypeId === t.id).sort((a, b) => a.start.localeCompare(b.start));
        const clash = new Set(overlaps(mine).flat());
        return (
          <SectionCard
            key={t.id}
            title={t.name}
            subtitle={`${mine.length} class${mine.length === 1 ? "" : "es"}`}
            action={
              <Button size="sm" icon={Plus} onClick={() => setEditing({ dayTypeId: t.id })}>
                Add class
              </Button>
            }
          >
            {mine.length === 0 ? (
              <p className="text-[14px] text-muted">No classes yet. Add the classes and times for a {t.name}.</p>
            ) : (
              <ul className="divide-y divide-line">
                {mine.map((b) => (
                  <li key={b.id}>
                    <button type="button" onClick={() => setEditing({ dayTypeId: t.id, block: b })} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-surface-2">
                      <span className="tabular w-[124px] shrink-0 text-[13px] text-muted">
                        {at(b.start)}–{at(b.end)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{b.title}</span>
                      {clash.has(b.id) && <Badge tone="warning">Overlaps</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <DayTypeName type={t} />
          </SectionCard>
        );
      })}

      {/* 2. Which days are which */}
      <SectionCard title="Which day is which?" subtitle="Fixed weekdays always use one day type; the rest rotate.">
        <div className="space-y-4">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">School days</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((w, i) => (
                <Chip
                  key={w}
                  selected={settings.schoolDays.includes(i)}
                  onClick={() => setSettings({ schoolDays: settings.schoolDays.includes(i) ? settings.schoolDays.filter((d) => d !== i) : [...settings.schoolDays, i].sort() })}
                >
                  {w}
                </Chip>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {settings.schoolDays.map((d) => (
              <Select
                key={d}
                id={`fixed-${d}`}
                label={WEEKDAYS[d]}
                value={settings.fixed[String(d)] ?? ""}
                onChange={(e) => {
                  const fixed = { ...settings.fixed };
                  if (e.target.value) fixed[String(d)] = e.target.value;
                  else delete fixed[String(d)];
                  setSettings({ fixed });
                }}
              >
                <option value="">Rotates ({rotating.map((id) => s.typeName.get(id)?.short || s.typeName.get(id)?.name).join("/") || "set up below"})</option>
                {s.dayTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    Always {t.name}
                  </option>
                ))}
              </Select>
            ))}
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Rotation order</p>
            <ul className="space-y-1.5">
              {s.dayTypes.map((t) => {
                const pos = settings.rotation.indexOf(t.id);
                return (
                  <li key={t.id} className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-1.5">
                    <Chip
                      selected={pos >= 0}
                      onClick={() => setSettings({ rotation: pos >= 0 ? settings.rotation.filter((x) => x !== t.id) : [...settings.rotation, t.id], anchorIndex: 0 })}
                    >
                      {pos >= 0 ? `${pos + 1}. ${t.name}` : t.name}
                    </Chip>
                    <span className="flex-1" />
                    {pos >= 0 && (
                      <>
                        <IconButton icon={ArrowUp} label={`Move ${t.name} earlier`} size="sm" variant="ghost" disabled={pos === 0} onClick={() => setSettings({ rotation: swap(settings.rotation, pos, pos - 1) })} />
                        <IconButton icon={ArrowDown} label={`Move ${t.name} later`} size="sm" variant="ghost" disabled={pos === settings.rotation.length - 1} onClick={() => setSettings({ rotation: swap(settings.rotation, pos, pos + 1) })} />
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {rotating.length > 1 && (
            <div className="rounded-2xl border border-line p-3">
              <p className="mb-2 text-[13px] font-semibold">Line up the rotation with a real day</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id="anchor-date" label="On this school day…" type="date" value={settings.anchorDate ?? ""} onChange={(e) => setSettings({ anchorDate: e.target.value || null })} />
                <Select id="anchor-type" label="…it was" value={String(settings.anchorIndex)} onChange={(e) => setSettings({ anchorIndex: Number(e.target.value) })}>
                  {rotating.map((id, i) => (
                    <option key={id} value={i}>
                      {s.typeName.get(id)?.name}
                    </option>
                  ))}
                </Select>
              </div>
              <p className="mt-2 text-[13px]" role="status">
                Check: today ({new Date().toLocaleDateString(undefined, { weekday: "long" })}) is{" "}
                <strong>{todayInfo.school ? s.typeName.get(todayInfo.dayTypeId)?.name : "not a school day"}</strong>. Days off don't use up a rotation day.
              </p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField id="term-start" label="First day of classes (optional)" type="date" value={settings.termStart ?? ""} onChange={(e) => setSettings({ termStart: e.target.value || null })} />
            <TextField id="term-end" label="Last day of classes (optional)" type="date" value={settings.termEnd ?? ""} onChange={(e) => setSettings({ termEnd: e.target.value || null })} />
          </div>
        </div>
      </SectionCard>

      <AddDayType />

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.block ? "Edit class time" : `Add a class to ${s.typeName.get(editing?.dayTypeId ?? "")?.name ?? ""}`}>
        {editing && <BlockForm dayTypeId={editing.dayTypeId} block={editing.block} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  );
}

function swap<T>(a: T[], i: number, j: number) {
  const x = [...a];
  [x[i], x[j]] = [x[j], x[i]];
  return x;
}

function DayTypeName({ type }: { type: DayType }) {
  const [name, setName] = useState(type.name);
  const [short, setShort] = useState(type.short);
  const [open, setOpen] = useState(false);
  const { prefs, update } = usePrefs();
  if (!open)
    return (
      <div className="mt-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Rename or remove {type.name}
        </Button>
      </div>
    );
  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        store.dayTypes.patch(type.id, { name: name.trim().slice(0, 40), short: short.trim().slice(0, 6) });
        setOpen(false);
      }}
    >
      <div className="min-w-[140px] flex-1">
        <TextField id={`dt-name-${type.id}`} label="Name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="w-20">
        <TextField id={`dt-short-${type.id}`} label="Short" value={short} onChange={(e) => setShort(e.target.value)} maxLength={6} />
      </div>
      <Button type="submit">Save</Button>
      <IconButton
        icon={Trash2}
        label={`Delete ${type.name}`}
        variant="danger"
        onClick={() => {
          store.blocks.batch(() => store.blocks.list().filter((b) => b.dayTypeId === type.id).forEach((b) => store.blocks.remove(b.id)));
          store.dayTypes.remove(type.id);
          const fixed = Object.fromEntries(Object.entries(prefs.schedule.fixed).filter(([, v]) => v !== type.id));
          update({ schedule: { ...prefs.schedule, fixed, rotation: prefs.schedule.rotation.filter((x) => x !== type.id), anchorIndex: 0 } });
        }}
      />
    </form>
  );
}

function AddDayType() {
  const [name, setName] = useState("");
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        store.dayTypes.put({ name: name.trim().slice(0, 40), short: name.trim().slice(0, 1).toUpperCase(), sort: store.dayTypes.list().length } as DayType);
        setName("");
      }}
    >
      <div className="flex-1">
        <TextField id="new-day-type" label="Add another day type" placeholder="e.g. C day, Early release" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <Button type="submit" variant="secondary" icon={Plus}>
        Add
      </Button>
    </form>
  );
}

function BlockForm({ dayTypeId, block, onDone }: { dayTypeId: string; block?: ScheduleBlock; onDone: () => void }) {
  const courses = store.courses.list().filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name));
  const [courseId, setCourseId] = useState(block?.courseId ?? "");
  const [title, setTitle] = useState(block?.title ?? "");
  const [start, setStart] = useState(block?.start ?? "");
  const [end, setEnd] = useState(block?.end ?? "");
  const [room, setRoom] = useState(block?.room ?? "");
  const [tried, setTried] = useState(false);
  const course = courses.find((c) => c.id === courseId);
  const name = (course?.name ?? title).trim();
  const errors = {
    title: !name ? "Pick a class or type a name (e.g. Lunch)." : undefined,
    start: !isTime(start) ? "Enter a start time." : undefined,
    end: !isTime(end) ? "Enter an end time." : end <= start ? "End time must be after the start time." : undefined,
  };
  const valid = !errors.title && !errors.start && !errors.end;
  const others = store.blocks.list().filter((b) => b.dayTypeId === dayTypeId && b.id !== block?.id);
  const clash = valid ? others.find((b) => b.start < end && start < b.end) : undefined;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!valid) return;
        store.blocks.put({
          ...(block ?? {}),
          dayTypeId,
          courseId: course?.id ?? null,
          title: name.slice(0, 80),
          teacher: course?.teacher ?? block?.teacher ?? "",
          room: (room || course?.room || "").slice(0, 40),
          start,
          end,
        } as ScheduleBlock);
        onDone();
      }}
    >
      {courses.length > 0 && (
        <Select id="block-course" label="Class" value={courseId} onChange={(e) => setCourseId(e.target.value)} hint="Linking a class shows its grade and assignments with it.">
          <option value="">Something else (type a name)</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      {!course && <TextField id="block-title" label="Name" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Biology, Lunch, Advisory" error={tried ? errors.title : undefined} data-autofocus />}
      <div className="grid grid-cols-2 gap-3">
        <TextField id="block-start" label="Starts" type="time" value={start} onChange={(e) => setStart(e.target.value)} error={tried ? errors.start : undefined} />
        <TextField id="block-end" label="Ends" type="time" value={end} onChange={(e) => setEnd(e.target.value)} error={tried ? errors.end : undefined} />
      </div>
      <TextField id="block-room" label="Room" value={room} onChange={(e) => setRoom(e.target.value)} placeholder={course?.room || "Optional"} />
      {clash && (
        <p className="rounded-xl bg-accent-yellow/14 px-3 py-2 text-[13px]" role="status">
          Overlaps with {clash.title} ({at(clash.start)}–{at(clash.end)}). Save anyway if that's right.
        </p>
      )}
      <div className="flex gap-2">
        {block && (
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => {
              store.blocks.remove(block.id);
              onDone();
            }}
          >
            Delete
          </Button>
        )}
        <Button type="submit" fullWidth>
          {block ? "Save" : "Add class"}
        </Button>
      </div>
    </form>
  );
}
