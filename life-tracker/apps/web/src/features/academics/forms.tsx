import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Chip, IconButton, SegmentedControl, Select, Switch, TextField } from "../../components/ui";
import { newId } from "../../lib/store/collection";
import { store } from "../../lib/store/schema";
import { usePrefs } from "../../lib/prefs";
import { PRESET_SCALES, localDate, normalizeBands, resolveScale } from "./grades";
import { COURSE_COLORS, LEVEL_LABEL, type Course, type CourseLevel, type GradeCategory, type GradeItem, type GradingMode, type GradingScale, type PastCourse, type ScaleBand, type Term } from "./types";
import { saveCategories } from "./useAcademics";

/** Parse a number typed by a person ("", "9", "9.5", "9,5"). */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}
const str = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

export const COLOR_CLASS: Record<string, string> = {
  purple: "bg-accent-purple/12 text-accent-purple",
  blue: "bg-accent-blue/10 text-accent-blue",
  green: "bg-accent-green/12 text-accent-green",
  orange: "bg-brand-soft text-brand-ink",
  red: "bg-accent-red/10 text-accent-red",
  yellow: "bg-accent-yellow/14 text-accent-yellow",
};
export const COLOR_SWATCH: Record<string, string> = {
  purple: "var(--chart-3)",
  blue: "var(--chart-2)",
  green: "var(--chart-4)",
  orange: "var(--chart-1)",
  red: "var(--accent-red)",
  yellow: "var(--chart-5)",
};

const LEVELS = Object.keys(LEVEL_LABEL) as CourseLevel[];

function ScaleOptions({ custom, includeDefault }: { custom: GradingScale[]; includeDefault?: boolean }) {
  return (
    <>
      {includeDefault && <option value="">Use my default scale</option>}
      {PRESET_SCALES.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
      {custom.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name} (custom)
        </option>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Class
// ---------------------------------------------------------------------------
export function CourseForm({ course, onDone }: { course?: Course; onDone: (id: string) => void }) {
  const scales = store.scales.list();
  const terms = store.terms.list();
  const [name, setName] = useState(course?.name ?? "");
  const [teacher, setTeacher] = useState(course?.teacher ?? "");
  const [room, setRoom] = useState(course?.room ?? "");
  const [credits, setCredits] = useState(str(course?.credits ?? 1));
  const [level, setLevel] = useState<CourseLevel>(course?.level ?? "regular");
  const [mode, setMode] = useState<GradingMode>(course?.gradingMode ?? "points");
  const [manual, setManual] = useState(str(course?.manualPercent));
  const [scaleId, setScaleId] = useState(course?.scaleId ?? "");
  const [termId, setTermId] = useState(course?.termId ?? terms.find((t) => t.isCurrent)?.id ?? "");
  const [color, setColor] = useState(course?.color ?? COURSE_COLORS[store.courses.list().length % COURSE_COLORS.length]);
  const [tried, setTried] = useState(false);

  const cr = parseNum(credits);
  const mp = parseNum(manual);
  const errors = {
    name: !name.trim() ? "Enter the class name." : undefined,
    credits: cr === null || Number.isNaN(cr) || cr < 0 || cr > 10 ? "Credits must be a number from 0 to 10." : undefined,
    manual: mode === "manual" && mp !== null && (Number.isNaN(mp) || mp < 0 || mp > 200) ? "Enter a percentage from 0 to 200." : undefined,
  };
  const valid = !errors.name && !errors.credits && !errors.manual;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (!valid) return;
        const saved = store.courses.put({
          ...(course ?? {}),
          name: name.trim().slice(0, 80),
          teacher: teacher.trim().slice(0, 80),
          room: room.trim().slice(0, 40),
          credits: cr as number,
          level,
          gradingMode: mode,
          manualPercent: mode === "manual" ? (mp as number | null) : (course?.manualPercent ?? null),
          scaleId: scaleId || null,
          termId: termId || null,
          color,
          archived: course?.archived ?? false,
        } as Course);
        onDone(saved.id);
      }}
    >
      <TextField id="course-name" label="Class name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. Biology" error={tried ? errors.name : undefined} data-autofocus />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="course-teacher" label="Teacher" value={teacher} onChange={(e) => setTeacher(e.target.value)} maxLength={80} placeholder="Optional" />
        <TextField id="course-room" label="Room" value={room} onChange={(e) => setRoom(e.target.value)} maxLength={40} placeholder="Optional" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Select id="course-level" label="Level" value={level} onChange={(e) => setLevel(e.target.value as CourseLevel)} hint="Honors/AP add weighted-GPA points.">
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </Select>
        <TextField id="course-credits" label="Credits" inputMode="decimal" value={credits} onChange={(e) => setCredits(e.target.value)} error={tried ? errors.credits : undefined} hint="Usually 1 (or 0.5 for a semester)." />
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold">How is this class graded?</p>
        <SegmentedControl<GradingMode>
          label="Grading method"
          size="sm"
          value={mode}
          onChange={setMode}
          options={[
            { value: "points", label: "Total points" },
            { value: "weighted", label: "Categories" },
            { value: "manual", label: "Portal %" },
          ]}
        />
        <p className="mt-1.5 text-[12.5px] text-muted">
          {mode === "points" && "Your grade is all points earned ÷ all points possible."}
          {mode === "weighted" && "Categories like Tests 50% and Homework 20% each count for a set share. You'll set them up next."}
          {mode === "manual" && "Just type the percentage your school portal shows. Good for PowerSchool or Infinite Campus."}
        </p>
      </div>
      {mode === "manual" && (
        <TextField id="course-manual" label="Current percentage" inputMode="decimal" value={manual} onChange={(e) => setManual(e.target.value)} placeholder="e.g. 91.4" error={tried ? errors.manual : undefined} />
      )}
      <Select id="course-scale" label="Grading scale" value={scaleId} onChange={(e) => setScaleId(e.target.value)}>
        <ScaleOptions custom={scales} includeDefault />
      </Select>
      {terms.length > 0 && (
        <Select id="course-term" label="Term" value={termId} onChange={(e) => setTermId(e.target.value)}>
          <option value="">No term</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      )}
      <div>
        <p className="mb-1.5 text-[13px] font-semibold">Color</p>
        <div className="flex gap-2" role="radiogroup" aria-label="Color">
          {COURSE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-ink" : "border-transparent"}`}
              style={{ background: COLOR_SWATCH[c] }}
            />
          ))}
        </div>
      </div>
      <Button type="submit" fullWidth>
        {course ? "Save class" : "Add class"}
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Grade
// ---------------------------------------------------------------------------
export function ItemForm({
  courseId,
  item,
  categories,
  onDone,
  onDelete,
  hypothetical,
}: {
  courseId: string;
  item?: GradeItem;
  categories: GradeCategory[];
  onDone: (item: GradeItem) => void;
  onDelete?: () => void;
  /** What-if mode: returns the item without saving. */
  hypothetical?: boolean;
}) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? categories[0]?.id ?? "");
  const [earned, setEarned] = useState(str(item?.earned));
  const [possible, setPossible] = useState(str(item?.possible));
  const [date, setDate] = useState(item?.gradedOn ?? localDate(new Date()));
  const [status, setStatus] = useState<"none" | "missing" | "excused">(item?.missing ? "missing" : item?.excused ? "excused" : "none");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [tried, setTried] = useState(false);

  const e = parseNum(earned);
  const p = parseNum(possible);
  const errors = {
    title: !title.trim() ? "Enter a name for this assignment." : undefined,
    earned: e !== null && (Number.isNaN(e) || e < 0) ? "Score must be a number, 0 or more." : undefined,
    possible: p !== null && (Number.isNaN(p) || p < 0) ? "“Out of” must be a number, 0 or more." : undefined,
    need: hypothetical && (e === null || p === null) ? "Enter both numbers to see the effect." : undefined,
  };
  const valid = !errors.title && !errors.earned && !errors.possible && !errors.need;

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        setTried(true);
        if (!valid) return;
        const rec = {
          ...(item ?? {}),
          id: item?.id ?? newId(),
          courseId,
          categoryId: categoryId || null,
          title: title.trim().slice(0, 120),
          earned: e,
          possible: p,
          gradedOn: date || null,
          dueOn: item?.dueOn ?? null,
          missing: status === "missing",
          excused: status === "excused",
          notes: notes.trim().slice(0, 500),
          clientUpdatedAt: 0,
          deleted: false,
          source: item?.source ?? "manual",
        } as GradeItem;
        onDone(hypothetical ? rec : store.items.put(rec));
      }}
    >
      <TextField id="item-title" label="Assignment" value={title} onChange={(ev) => setTitle(ev.target.value)} maxLength={120} placeholder="e.g. Chapter 4 quiz" error={tried ? errors.title : undefined} data-autofocus />
      {categories.length > 0 && (
        <Select id="item-category" label="Category" value={categoryId} onChange={(ev) => setCategoryId(ev.target.value)}>
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.weight}%)
            </option>
          ))}
        </Select>
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField id="item-earned" label="Score" inputMode="decimal" value={earned} onChange={(ev) => setEarned(ev.target.value)} placeholder="18" error={tried ? errors.earned : undefined} hint="Blank = not graded yet" />
        <TextField id="item-possible" label="Out of" inputMode="decimal" value={possible} onChange={(ev) => setPossible(ev.target.value)} placeholder="20" error={tried ? errors.possible : undefined} hint="Blank or 0 = extra credit" />
      </div>
      {tried && errors.need && <p className="text-[12.5px] text-accent-red">{errors.need}</p>}
      {!hypothetical && (
        <>
          <TextField id="item-date" label="Date graded" type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Status</p>
            <div className="flex flex-wrap gap-2">
              <Chip selected={status === "none"} onClick={() => setStatus("none")}>
                Normal
              </Chip>
              <Chip selected={status === "missing"} onClick={() => setStatus("missing")}>
                Missing (counts as 0)
              </Chip>
              <Chip selected={status === "excused"} onClick={() => setStatus("excused")}>
                Excused (doesn't count)
              </Chip>
            </div>
          </div>
          <TextField id="item-notes" label="Notes" value={notes} onChange={(ev) => setNotes(ev.target.value)} maxLength={500} placeholder="Optional" />
        </>
      )}
      <div className="flex gap-2">
        {onDelete && (
          <Button variant="danger" icon={Trash2} onClick={onDelete}>
            Delete
          </Button>
        )}
        <Button type="submit" fullWidth>
          {hypothetical ? "Add what-if grade" : item ? "Save grade" : "Add grade"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
export function CategoriesForm({ courseId, categories, onDone }: { courseId: string; categories: GradeCategory[]; onDone: () => void }) {
  const [rows, setRows] = useState(categories.map((c) => ({ id: c.id as string | undefined, name: c.name, weight: String(c.weight) })));
  const [tried, setTried] = useState(false);
  const parsed = rows.map((r) => ({ ...r, w: parseNum(r.weight) }));
  const total = parsed.reduce((a, r) => a + (r.w && !Number.isNaN(r.w) ? r.w : 0), 0);
  const bad = parsed.some((r) => !r.name.trim() || r.w === null || Number.isNaN(r.w) || r.w < 0 || r.w > 100);

  return (
    <form
      className="space-y-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (bad) return;
        saveCategories(courseId, parsed.map((r) => ({ id: r.id, name: r.name.trim().slice(0, 60), weight: r.w as number })));
        onDone();
      }}
    >
      <p className="text-[13.5px] text-muted">Use the weights from your syllabus. Categories without grades yet are left out until they have some.</p>
      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <TextField id={`cat-name-${i}`} label="Category" hideLabel={i > 0} value={r.name} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} placeholder="e.g. Tests" />
          </div>
          <div className="w-24">
            <TextField id={`cat-weight-${i}`} label="Weight %" hideLabel={i > 0} inputMode="decimal" value={r.weight} onChange={(e) => setRows(rows.map((x, k) => (k === i ? { ...x, weight: e.target.value } : x)))} placeholder="50" />
          </div>
          <IconButton icon={Trash2} label={`Remove ${r.name || "category"}`} variant="ghost" onClick={() => setRows(rows.filter((_, k) => k !== i))} />
        </div>
      ))}
      <Button variant="ghost" size="sm" icon={Plus} onClick={() => setRows([...rows, { id: undefined, name: "", weight: "" }])}>
        Add category
      </Button>
      <div className="flex items-center justify-between rounded-xl bg-surface-2/70 px-3 py-2 text-[13.5px]">
        <span>Total weight</span>
        <Badge tone={Math.abs(total - 100) < 0.01 ? "success" : "warning"}>{Math.round(total * 100) / 100}%</Badge>
      </div>
      {Math.abs(total - 100) >= 0.01 && rows.length > 0 && (
        <p className="text-[12.5px] text-muted">Most syllabi add up to 100%. Grades still calculate; the weights are scaled to the categories you use.</p>
      )}
      {tried && bad && <p className="text-[12.5px] text-accent-red" role="alert">Give every category a name and a weight from 0 to 100.</p>}
      <Button type="submit" fullWidth>
        Save categories
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Past terms (cumulative GPA)
// ---------------------------------------------------------------------------
export function PastCourseForm({ onDone }: { onDone: () => void }) {
  const { prefs } = usePrefs();
  const bands = resolveScale(prefs.academic.scaleId, store.scales.list(), prefs.academic.scaleId);
  const [termName, setTermName] = useState(store.pastCourses.list().at(-1)?.termName ?? "");
  const [name, setName] = useState("");
  const [credits, setCredits] = useState("1");
  const [level, setLevel] = useState<CourseLevel>("regular");
  const [letter, setLetter] = useState(bands[0]?.letter ?? "A");
  const [tried, setTried] = useState(false);
  const cr = parseNum(credits);
  const band = bands.find((b) => b.letter === letter) ?? bands[0];
  const errors = {
    term: !termName.trim() ? "Enter the term, e.g. Spring 2026." : undefined,
    name: !name.trim() ? "Enter the class name." : undefined,
    credits: cr === null || Number.isNaN(cr) || cr < 0 || cr > 10 ? "Credits must be 0–10." : undefined,
  };
  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setTried(true);
        if (errors.term || errors.name || errors.credits) return;
        store.pastCourses.put({ termName: termName.trim().slice(0, 60), name: name.trim().slice(0, 80), credits: cr as number, level, letter: band.letter, points: Math.min(5, band.points) } as PastCourse);
        setName("");
        setTried(false);
        onDone();
      }}
    >
      <TextField id="past-term" label="Term" value={termName} onChange={(e) => setTermName(e.target.value)} placeholder="e.g. Spring 2026" error={tried ? errors.term : undefined} />
      <TextField id="past-name" label="Class" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. World History" error={tried ? errors.name : undefined} data-autofocus />
      <div className="grid grid-cols-3 gap-3">
        <Select id="past-letter" label="Final grade" value={letter} onChange={(e) => setLetter(e.target.value)}>
          {bands.map((b) => (
            <option key={b.letter} value={b.letter}>
              {b.letter} ({b.points.toFixed(1)})
            </option>
          ))}
        </Select>
        <TextField id="past-credits" label="Credits" inputMode="decimal" value={credits} onChange={(e) => setCredits(e.target.value)} error={tried ? errors.credits : undefined} />
        <Select id="past-level" label="Level" value={level} onChange={(e) => setLevel(e.target.value as CourseLevel)}>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABEL[l]}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" fullWidth>
        Add past class
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// GPA settings, custom scales and terms
// ---------------------------------------------------------------------------
export function GpaSettingsForm({ onDone }: { onDone: () => void }) {
  const { prefs, update } = usePrefs();
  const scales = store.scales.list();
  const [scaleId, setScaleId] = useState(prefs.academic.scaleId);
  const [bonus, setBonus] = useState(Object.fromEntries(LEVELS.map((l) => [l, String(prefs.academic.bonus[l])])) as Record<CourseLevel, string>);
  const [editing, setEditing] = useState<{ name: string; bands: { min: string; letter: string; points: string }[] } | null>(null);
  const [tried, setTried] = useState(false);

  const parsedBonus = Object.fromEntries(LEVELS.map((l) => [l, parseNum(bonus[l])])) as Record<CourseLevel, number | null>;
  const bonusBad = LEVELS.some((l) => parsedBonus[l] === null || Number.isNaN(parsedBonus[l]!) || parsedBonus[l]! < 0 || parsedBonus[l]! > 2);
  const current = resolveScale(scaleId, scales, scaleId);

  const startCustom = () =>
    setEditing({ name: "My school's scale", bands: current.map((b) => ({ min: String(b.min), letter: b.letter, points: String(b.points) })) });

  const customBands: ScaleBand[] | null = useMemo(() => {
    if (!editing) return null;
    const bs = editing.bands.map((b) => ({ min: parseNum(b.min), letter: b.letter.trim(), points: parseNum(b.points) }));
    if (bs.some((b) => b.min === null || Number.isNaN(b.min) || b.points === null || Number.isNaN(b.points) || b.points < 0 || b.points > 5 || !b.letter)) return null;
    return normalizeBands(bs as ScaleBand[]);
  }, [editing]);

  return (
    <div className="space-y-5">
      <Select id="gpa-scale" label="Default grading scale" value={scaleId} onChange={(e) => setScaleId(e.target.value)} hint="Used by classes that don't pick their own.">
        <ScaleOptions custom={scales} />
      </Select>
      <div className="rounded-2xl bg-surface-2/60 p-3 text-[12.5px]">
        <p className="mb-1.5 font-semibold">This scale</p>
        <p className="tabular text-muted">{current.map((b) => `${b.letter} ≥ ${b.min} (${b.points})`).join(" · ")}</p>
      </div>
      {!editing ? (
        <Button variant="secondary" size="sm" icon={Plus} onClick={startCustom}>
          Make a custom scale from this one
        </Button>
      ) : (
        <div className="space-y-2 rounded-2xl border border-line p-3">
          <TextField id="scale-name" label="Scale name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-[12px] font-semibold text-muted">
            <span>Letter</span>
            <span>From %</span>
            <span>Points</span>
            <span className="w-8" />
          </div>
          {editing.bands.map((b, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
              {(["letter", "min", "points"] as const).map((f) => (
                <input
                  key={f}
                  aria-label={`${f === "min" ? "From percent" : f === "letter" ? "Letter" : "Points"} for row ${i + 1}`}
                  value={b[f]}
                  inputMode={f === "letter" ? "text" : "decimal"}
                  onChange={(e) => setEditing({ ...editing, bands: editing.bands.map((x, k) => (k === i ? { ...x, [f]: e.target.value } : x)) })}
                  className="w-full rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-[14px] outline-none focus:border-brand-ink"
                />
              ))}
              <IconButton icon={Trash2} label={`Remove row ${i + 1}`} size="sm" variant="ghost" onClick={() => setEditing({ ...editing, bands: editing.bands.filter((_, k) => k !== i) })} />
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => setEditing({ ...editing, bands: [...editing.bands, { min: "", letter: "", points: "" }] })}>
              Add row
            </Button>
            <Button
              size="sm"
              disabled={!customBands || !editing.name.trim()}
              onClick={() => {
                const s = store.scales.put({ name: editing.name.trim().slice(0, 60), bands: customBands! } as GradingScale);
                setScaleId(s.id);
                setEditing(null);
              }}
            >
              Save scale
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
          {!customBands && <p className="text-[12.5px] text-muted">Every row needs a letter, a starting % and points from 0 to 5.</p>}
        </div>
      )}

      <div>
        <p className="mb-1 text-[13px] font-semibold">Weighted GPA bonus points</p>
        <p className="mb-2 text-[12.5px] text-muted">Added to a passing grade's points. Check your school's rules; common is +0.5 honors, +1.0 AP/IB.</p>
        <div className="grid grid-cols-3 gap-2">
          {LEVELS.map((l) => (
            <TextField key={l} id={`bonus-${l}`} label={LEVEL_LABEL[l]} inputMode="decimal" value={bonus[l]} onChange={(e) => setBonus({ ...bonus, [l]: e.target.value })} />
          ))}
        </div>
        {tried && bonusBad && <p className="mt-1 text-[12.5px] text-accent-red" role="alert">Bonus points must be numbers from 0 to 2.</p>}
      </div>
      <Button
        fullWidth
        onClick={() => {
          setTried(true);
          if (bonusBad) return;
          update({ academic: { scaleId, bonus: parsedBonus as Record<CourseLevel, number> } });
          onDone();
        }}
      >
        Save GPA settings
      </Button>
    </div>
  );
}

export function TermsForm({ onDone }: { onDone: () => void }) {
  const terms = store.terms.list();
  const [name, setName] = useState("");
  const setCurrent = (id: string) =>
    store.terms.batch(() => store.terms.list().forEach((t) => (t.isCurrent !== (t.id === id) ? store.terms.patch(t.id, { isCurrent: t.id === id }) : undefined)));
  return (
    <div className="space-y-4">
      <p className="text-[13.5px] text-muted">Terms group your classes so Academics shows the current semester's GPA. Optional.</p>
      {terms.length > 0 && (
        <ul className="space-y-2">
          {terms.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2">
              <div className="min-w-0 flex-1">
                <Switch checked={t.isCurrent} onChange={() => setCurrent(t.id)} label={t.name} description={t.isCurrent ? "Current term" : "Tap to make current"} />
              </div>
              <IconButton icon={Trash2} label={`Delete ${t.name}`} size="sm" variant="ghost" onClick={() => store.terms.remove(t.id)} />
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          const t = store.terms.put({ name: name.trim().slice(0, 60), startsOn: null, endsOn: null, isCurrent: terms.length === 0 } as Term);
          if (terms.length === 0) setCurrent(t.id);
          setName("");
        }}
      >
        <div className="flex-1">
          <TextField id="term-name" label="New term" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fall 2026" />
        </div>
        <Button type="submit" icon={Plus}>
          Add
        </Button>
      </form>
      <Button variant="secondary" fullWidth onClick={onDone}>
        Done
      </Button>
    </div>
  );
}
