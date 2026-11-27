import { AnimatePresence, motion } from "motion/react";
import { Bell, Check, ChevronDown, ExternalLink, Flag, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { SECTION_BY_ID } from "../../app/sections";
import { Badge, Button, Card, Chip, EmptyState, IconButton, PageHeader, SegmentedControl, Select, Sheet, TextField, useToast } from "../../components/ui";
import { spring } from "../../lib/motion";
import { store } from "../../lib/store/schema";
import { useCollection } from "../../lib/store/StoreProvider";
import { useNow } from "../../lib/time";
import { COLOR_CLASS } from "../academics/forms";
import { localDate } from "../academics/grades";
import { dueDate } from "../home/homeData";
import { BUCKETS, formatDue, groupAssignments, isDone, REMINDER_CHOICES, type Bucket } from "./logic";
import type { Assignment, Priority } from "./types";

const SOURCE_LABEL: Record<string, string> = { canvas: "Canvas", google_classroom: "Classroom" };

export function AssignmentsPage() {
  const sec = SECTION_BY_ID.assignments;
  const now = useNow(30_000);
  const list = useCollection(store.assignments);
  const courses = useCollection(store.courses);
  const [courseFilter, setCourseFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Assignment | "new" | null>(null);
  const [showDone, setShowDone] = useState(false);
  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);
  const filtered = courseFilter ? list.filter((a) => a.courseId === courseFilter) : list;
  const groups = groupAssignments(filtered, now);
  const usedCourses = courses.filter((c) => list.some((a) => a.courseId === c.id)).sort((a, b) => a.name.localeCompare(b.name));
  const open = BUCKETS.filter((b) => b.id !== "done").reduce((n, b) => n + groups.get(b.id)!.length, 0);

  return (
    <>
      <PageHeader
        title="Assignments"
        subtitle={list.length ? `${open} to do${groups.get("overdue")!.length ? ` · ${groups.get("overdue")!.length} overdue` : ""}` : sec.tagline}
        icon={sec.icon}
        accent={sec.accent}
        right={
          <span className="inline-flex">
            <IconButton icon={Plus} label="Add assignment" variant="primary" onClick={() => setEditing("new")} />
          </span>
        }
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={sec.icon}
            accent={sec.accent}
            title="No assignments yet"
            body="Add one yourself, or connect Canvas or Google Classroom in Settings and due dates arrive automatically."
            action={
              <Button icon={Plus} onClick={() => setEditing("new")}>
                Add an assignment
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {usedCourses.length > 1 && (
            <div className="flex flex-wrap gap-2" aria-label="Filter by class">
              <Chip selected={!courseFilter} onClick={() => setCourseFilter(null)}>
                All classes
              </Chip>
              {usedCourses.map((c) => (
                <Chip key={c.id} selected={courseFilter === c.id} onClick={() => setCourseFilter(courseFilter === c.id ? null : c.id)}>
                  {c.name}
                </Chip>
              ))}
            </div>
          )}

          {BUCKETS.filter((b) => b.id !== "done").map((b) => {
            const xs = groups.get(b.id)!;
            if (!xs.length) return null;
            return (
              <section key={b.id} aria-labelledby={`bucket-${b.id}`}>
                <h2 id={`bucket-${b.id}`} className={`mb-2 flex items-center gap-2 text-[15px] font-semibold ${b.id === "overdue" ? "text-accent-red" : ""}`}>
                  {b.label}
                  <span className="text-[13px] font-normal text-muted">{xs.length}</span>
                </h2>
                <Card className="py-1 md:py-1">
                  <ul className="divide-y divide-line">
                    <AnimatePresence initial={false}>
                      {xs.map((a) => (
                        <Row key={a.id} a={a} bucket={b.id} now={now} course={a.courseId ? courseById.get(a.courseId) : undefined} onOpen={() => setEditing(a)} />
                      ))}
                    </AnimatePresence>
                  </ul>
                </Card>
              </section>
            );
          })}

          {open === 0 && (
            <Card>
              <EmptyState compact icon={Check} accent="bg-accent-green/12 text-accent-green" title="All caught up" body="Nothing left to do. Nice work." />
            </Card>
          )}

          {groups.get("done")!.length > 0 && (
            <section>
              <button type="button" aria-expanded={showDone} onClick={() => setShowDone(!showDone)} className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
                <ChevronDown size={16} className={`transition-transform ${showDone ? "" : "-rotate-90"}`} aria-hidden />
                Done <span className="text-[13px] font-normal text-muted">{groups.get("done")!.length}</span>
              </button>
              {showDone && (
                <Card className="py-1 md:py-1">
                  <ul className="divide-y divide-line">
                    {groups.get("done")!.slice(0, 50).map((a) => (
                      <Row key={a.id} a={a} bucket="done" now={now} course={a.courseId ? courseById.get(a.courseId) : undefined} onOpen={() => setEditing(a)} />
                    ))}
                  </ul>
                </Card>
              )}
            </section>
          )}
        </div>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === "new" ? "Add assignment" : "Assignment"}>
        {editing && <AssignmentForm assignment={editing === "new" ? undefined : editing} defaultCourse={courseFilter} onDone={() => setEditing(null)} />}
      </Sheet>
    </>
  );
}

function Row({ a, bucket, now, course, onOpen }: { a: Assignment; bucket: Bucket; now: Date; course?: { name: string; color: string }; onOpen: () => void }) {
  const done = isDone(a);
  const toast = useToast();
  const toggle = () => {
    if (a.submitted) return;
    const next = a.status === "done" ? "todo" : "done";
    store.assignments.patch(a.id, { status: next, completedAt: next === "done" ? new Date().toISOString() : null });
    if (next === "done")
      toast({ tone: "success", title: "Marked done", action: { label: "Undo", onClick: () => store.assignments.patch(a.id, { status: "todo", completedAt: null }) } });
  };
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} transition={spring.soft} className="flex items-start gap-3 py-2.5">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={a.submitted ? `${a.title}: turned in` : `Mark ${a.title} ${done ? "not done" : "done"}`}
        disabled={a.submitted}
        onClick={toggle}
        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          done ? "border-accent-green bg-accent-green text-white" : "border-line hover:border-brand-ink"
        } disabled:cursor-default`}
      >
        {done && <Check size={14} strokeWidth={3} aria-hidden />}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className={`block text-[15px] font-medium ${done ? "text-muted line-through" : ""}`}>{a.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted">
          {course && <span className={`rounded-md px-1.5 py-px text-[11.5px] font-semibold ${COLOR_CLASS[course.color] ?? COLOR_CLASS.purple}`}>{course.name}</span>}
          <span className={bucket === "overdue" ? "font-semibold text-accent-red" : ""}>{formatDue(a, now)}</span>
          {a.priority === "high" && !done && (
            <Badge tone="danger" icon={Flag}>
              High
            </Badge>
          )}
          {a.reminderMinutes != null && !done && <Bell size={13} aria-label="Reminder set" />}
          {a.submitted && <Badge tone="success">Turned in</Badge>}
          {SOURCE_LABEL[a.source] && <span>{SOURCE_LABEL[a.source]}</span>}
        </span>
      </button>
    </motion.li>
  );
}

function AssignmentForm({ assignment, defaultCourse, onDone }: { assignment?: Assignment; defaultCourse: string | null; onDone: () => void }) {
  const toast = useToast();
  const synced = !!assignment && assignment.source !== "manual" && assignment.source !== "csv";
  const courses = store.courses.list().filter((c) => !c.archived).sort((x, y) => x.name.localeCompare(y.name));
  const due = assignment ? dueDate(assignment) : null;
  const [title, setTitle] = useState(assignment?.title ?? "");
  const [courseId, setCourseId] = useState(assignment?.courseId ?? defaultCourse ?? "");
  const [date, setDate] = useState(due ? localDate(due) : "");
  const [time, setTime] = useState(due && assignment?.dueHasTime ? `${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")}` : "");
  const [priority, setPriority] = useState<Priority>(assignment?.priority ?? "normal");
  const [reminder, setReminder] = useState<string>(assignment?.reminderMinutes == null ? "" : String(assignment.reminderMinutes));
  const [description, setDescription] = useState(assignment?.description ?? "");
  const [tried, setTried] = useState(false);
  const errors = {
    title: !title.trim() ? "Enter what the assignment is." : undefined,
    reminder: reminder && !date ? "Add a due date to set a reminder." : undefined,
  };

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (errors.title || errors.reminder) return;
        const reminderMinutes = reminder ? Number(reminder) : null;
        if (synced) {
          store.assignments.patch(assignment!.id, { priority, reminderMinutes });
        } else {
          let dueAt: string | null = null;
          if (date) {
            const [y, m, d] = date.split("-").map(Number);
            const [hh, mm] = time ? time.split(":").map(Number) : [12, 0];
            dueAt = new Date(y, m - 1, d, hh, mm).toISOString();
          }
          store.assignments.put({
            ...(assignment ?? { status: "todo", completedAt: null, submitted: false, url: null }),
            title: title.trim().slice(0, 160),
            courseId: courseId || null,
            dueAt,
            dueHasTime: !!time,
            priority,
            reminderMinutes,
            description: description.trim().slice(0, 2000),
          } as Assignment);
        }
        toast({ tone: "success", title: assignment ? "Saved" : "Assignment added" });
        onDone();
      }}
    >
      {synced && (
        <p className="rounded-xl bg-surface-2/70 px-3 py-2 text-[13px] text-muted">
          From {SOURCE_LABEL[assignment!.source]}. The title, class and due date come from your teacher; you can set priority and a reminder here.
        </p>
      )}
      <TextField id="as-title" label="Assignment" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} disabled={synced} placeholder="e.g. Read chapter 5" error={tried ? errors.title : undefined} data-autofocus={!synced || undefined} />
      {courses.length > 0 && (
        <Select id="as-course" label="Class" value={courseId} onChange={(e) => setCourseId(e.target.value)} disabled={synced}>
          <option value="">No class</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField id="as-date" label="Due date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={synced} />
        <TextField id="as-time" label="Time (optional)" type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={synced || !date} hint={date && !time ? "Counts as end of day" : undefined} />
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold">Priority</p>
        <SegmentedControl<Priority>
          label="Priority"
          size="sm"
          value={priority}
          onChange={setPriority}
          options={[
            { value: "low", label: "Low" },
            { value: "normal", label: "Normal" },
            { value: "high", label: "High" },
          ]}
        />
      </div>
      <Select id="as-reminder" label="Reminder" value={reminder} onChange={(e) => setReminder(e.target.value)} error={tried ? errors.reminder : undefined} hint="Shows while Life Tracker is open. Phone notifications arrive in a later update.">
        {REMINDER_CHOICES.map((r) => (
          <option key={r.label} value={r.value ?? ""}>
            {r.label}
          </option>
        ))}
      </Select>
      {synced ? (
        assignment!.description && <p className="max-h-40 overflow-y-auto rounded-xl border border-line p-3 text-[13.5px] whitespace-pre-line">{assignment!.description}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="as-notes" className="text-[13px] font-semibold">
            Notes
          </label>
          <textarea id="as-notes" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} className="w-full rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-ink" />
        </div>
      )}
      {assignment?.url && (
        <a href={assignment.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-ink">
          Open in {SOURCE_LABEL[assignment.source] ?? "browser"} <ExternalLink size={14} aria-hidden />
        </a>
      )}
      <div className="flex gap-2">
        {assignment && !synced && (
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => {
              store.assignments.remove(assignment.id);
              toast({ tone: "info", title: "Assignment deleted" });
              onDone();
            }}
          >
            Delete
          </Button>
        )}
        <Button type="submit" fullWidth>
          {assignment ? "Save" : "Add assignment"}
        </Button>
      </div>
    </form>
  );
}
