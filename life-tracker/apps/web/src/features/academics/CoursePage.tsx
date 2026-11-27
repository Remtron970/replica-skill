import { AlertTriangle, ArrowLeft, Calculator, FlaskConical, ListTree, Pencil, Plus, Trash2, X } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  IconButton,
  PageHeader,
  ProgressBar,
  SectionCard,
  Select,
  Sheet,
  Skeleton,
  Switch,
  TextField,
  useToast,
} from "../../components/ui";
import { store } from "../../lib/store/schema";
import { CategoriesForm, COLOR_CLASS, CourseForm, ItemForm, parseNum } from "./forms";
import { bandFor, coursePercent, formatGpa, formatPercent, scoreNeeded, summarizeCourses, termGpa } from "./grades";
import { LEVEL_LABEL, type GradeItem } from "./types";
import { deleteCourse, useAcademics } from "./useAcademics";

const TrendChart = lazy(() => import("../../components/charts/Charts").then((m) => ({ default: m.TrendChart })));

type Panel = null | "edit" | "categories" | "add" | "whatif" | { item: GradeItem };

export function CoursePage() {
  const { courseId = "" } = useParams();
  const a = useAcademics();
  const navigate = useNavigate();
  const toast = useToast();
  const [panel, setPanel] = useState<Panel>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [whatIf, setWhatIf] = useState(false);
  const [hypos, setHypos] = useState<GradeItem[]>([]);
  const close = () => setPanel(null);

  const summary = a.summaries.find((s) => s.course.id === courseId);
  const course = summary?.course ?? a.allCourses.find((c) => c.id === courseId);
  const cats = useMemo(() => a.categories.filter((c) => c.courseId === courseId).sort((x, y) => x.sort - y.sort), [a.categories, courseId]);
  const items = useMemo(
    () =>
      a.items
        .filter((i) => i.courseId === courseId)
        .sort((x, y) => (y.gradedOn ?? y.dueOn ?? "").localeCompare(x.gradedOn ?? x.dueOn ?? "") || x.title.localeCompare(y.title)),
    [a.items, courseId],
  );

  const projected = useMemo(() => {
    if (!course || !whatIf || !hypos.length) return null;
    const result = coursePercent(course, a.categories, [...a.items, ...hypos]);
    const sums = summarizeCourses(a.courses, a.categories, [...a.items, ...hypos], a.scales, a.settings);
    return { result, gpa: termGpa(sums, a.settings) };
  }, [course, whatIf, hypos, a]);

  if (!course) {
    return (
      <Card>
        <EmptyState
          icon={AlertTriangle}
          title="Class not found"
          body="It may have been deleted on another device."
          action={
            <Button icon={ArrowLeft} onClick={() => navigate("/academics")}>
              Back to Academics
            </Button>
          }
        />
      </Card>
    );
  }

  const bands = summary?.bands ?? [];
  const r = summary?.result ?? coursePercent(course, a.categories, a.items);
  const letter = r.percent === null ? null : bandFor(r.percent, bands);
  const history = a.history(course);

  return (
    <>
      <PageHeader
        title={course.name}
        subtitle={[course.teacher, course.room, LEVEL_LABEL[course.level], `${course.credits} credit${course.credits === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
        right={
          <div className="flex gap-2">
            <IconButton icon={ArrowLeft} label="Back to Academics" variant="ghost" onClick={() => navigate("/academics")} />
            <IconButton icon={Pencil} label="Edit class" onClick={() => setPanel("edit")} />
          </div>
        }
      />

      <div className="space-y-4">
        {/* Grade */}
        <Card>
          <div className="flex flex-wrap items-center gap-4">
            <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] text-[24px] font-bold ${COLOR_CLASS[course.color] ?? COLOR_CLASS.purple}`}>
              {letter?.letter ?? "—"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="tabular text-[34px] leading-none font-bold">{formatPercent(r.percent)}</p>
              <p className="mt-1 text-[13px] text-muted">
                {r.percent === null
                  ? course.gradingMode === "manual"
                    ? "Enter the percentage from your school portal."
                    : "Add a graded assignment to see your grade."
                  : `${letter?.points.toFixed(1)} grade points · ${course.gradingMode === "manual" ? "from your school portal" : `${r.graded} graded item${r.graded === 1 ? "" : "s"}`}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {r.missing > 0 && <Badge tone="danger" icon={AlertTriangle}>{r.missing} missing</Badge>}
            </div>
          </div>
          {course.gradingMode === "manual" && <ManualPercent courseId={course.id} value={course.manualPercent} />}
          {r.uncounted > 0 && (
            <p className="mt-3 rounded-xl bg-accent-yellow/14 px-3 py-2 text-[13px]">
              {r.uncounted} graded item{r.uncounted === 1 ? " isn't" : "s aren't"} in a category, so {r.uncounted === 1 ? "it doesn't" : "they don't"} count yet. Edit them to pick a category.
            </p>
          )}
        </Card>

        {/* What-if */}
        {course.gradingMode !== "manual" && (
          <SectionCard title="What-if" icon={FlaskConical} accent="bg-accent-purple/12 text-accent-purple">
            <Switch checked={whatIf} onChange={(v) => { setWhatIf(v); if (!v) setHypos([]); }} label="What-if mode" description="Try pretend grades. Nothing is saved." />
            {whatIf && (
              <div className="mt-3 space-y-3">
                {hypos.length > 0 && (
                  <ul className="space-y-1.5">
                    {hypos.map((h) => (
                      <li key={h.id} className="flex items-center gap-2 rounded-xl border border-dashed border-accent-purple/50 px-3 py-2 text-[14px]">
                        <span className="min-w-0 flex-1 truncate">{h.title}</span>
                        <span className="tabular text-muted">{h.earned}/{h.possible}</span>
                        <IconButton icon={X} label={`Remove ${h.title}`} size="sm" variant="ghost" onClick={() => setHypos(hypos.filter((x) => x.id !== h.id))} />
                      </li>
                    ))}
                  </ul>
                )}
                {projected && (
                  <div className="rounded-2xl bg-accent-purple/8 p-3 text-[14px]">
                    <p>
                      Projected grade: <strong className="tabular">{formatPercent(projected.result.percent)}</strong>
                      {projected.result.percent !== null && <> ({bandFor(projected.result.percent, bands).letter})</>}
                      {r.percent !== null && projected.result.percent !== null && (
                        <span className="text-muted"> · {projected.result.percent - r.percent >= 0 ? "+" : ""}{(projected.result.percent - r.percent).toFixed(1)} points</span>
                      )}
                    </p>
                    <p className="mt-1 text-muted">
                      Term GPA: {formatGpa(a.gpa.unweighted)} → <strong className="text-ink">{formatGpa(projected.gpa.unweighted)}</strong> unweighted · {formatGpa(a.gpa.weighted)} → <strong className="text-ink">{formatGpa(projected.gpa.weighted)}</strong> weighted
                    </p>
                  </div>
                )}
                <Button variant="secondary" size="sm" icon={Plus} onClick={() => setPanel("whatif")}>
                  Add a what-if grade
                </Button>
              </div>
            )}
          </SectionCard>
        )}

        {/* What do I need */}
        {course.gradingMode !== "manual" && <NeedCalculator courseId={course.id} />}

        {/* Categories */}
        {course.gradingMode === "weighted" && (
          <SectionCard
            title="Categories"
            icon={ListTree}
            accent="bg-accent-blue/10 text-accent-blue"
            action={
              <Button variant="ghost" size="sm" onClick={() => setPanel("categories")}>
                Edit
              </Button>
            }
          >
            {cats.length === 0 ? (
              <EmptyState compact icon={ListTree} title="No categories yet" body="Add the categories and weights from your syllabus (e.g. Tests 50%, Homework 20%)." action={<Button size="sm" onClick={() => setPanel("categories")}>Set up categories</Button>} />
            ) : (
              <ul className="space-y-3">
                {r.categories.map((c) => (
                  <li key={c.id}>
                    <div className="mb-1 flex justify-between text-[14px]">
                      <span>
                        {c.name} <span className="text-muted">· {c.weight}%</span>
                      </span>
                      <span className="tabular font-semibold">{c.percent === null ? <span className="font-normal text-muted">no grades</span> : formatPercent(c.percent)}</span>
                    </div>
                    <ProgressBar value={(c.percent ?? 0) / 100} label={`${c.name} average`} color="bg-accent-blue" />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        {/* History */}
        {history.length >= 2 && (
          <SectionCard title="Grade history" subtitle="Your percentage after each graded day">
            <Suspense fallback={<Skeleton className="h-[220px] w-full" />}>
              <TrendChart
                title={`${course.name} grade history`}
                unit="%"
                area
                data={history.map((h) => ({ label: new Date(`${h.date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }), pct: h.percent }))}
                series={[{ key: "pct", name: "Grade" }]}
              />
            </Suspense>
          </SectionCard>
        )}

        {/* Grades */}
        {course.gradingMode !== "manual" && (
          <SectionCard
            title="Grades"
            subtitle={`${items.length} assignment${items.length === 1 ? "" : "s"}`}
            action={
              <Button size="sm" icon={Plus} onClick={() => setPanel("add")}>
                Add grade
              </Button>
            }
          >
            {items.length === 0 ? (
              <p className="text-[14px] text-muted">No grades yet. Add one, or import them from a spreadsheet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {items.map((it) => (
                  <li key={it.id}>
                    <GradeRow item={it} category={cats.find((c) => c.id === it.categoryId)?.name} onOpen={() => setPanel({ item: it })} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        )}

        <div className="pt-2">
          <Button variant="danger" size="sm" icon={Trash2} onClick={() => setConfirmDelete(true)}>
            Delete class
          </Button>
        </div>
      </div>

      <Sheet open={panel === "edit"} onClose={close} title="Edit class">
        <CourseForm course={course} onDone={() => { close(); toast({ tone: "success", title: "Class saved" }); }} />
      </Sheet>
      <Sheet open={panel === "categories"} onClose={close} title="Categories">
        <CategoriesForm courseId={course.id} categories={cats} onDone={close} />
      </Sheet>
      <Sheet open={panel === "add"} onClose={close} title="Add grade">
        <ItemForm courseId={course.id} categories={cats} onDone={() => { close(); toast({ tone: "success", title: "Grade added" }); }} />
      </Sheet>
      <Sheet open={panel === "whatif"} onClose={close} title="Add a what-if grade">
        <ItemForm courseId={course.id} categories={cats} hypothetical onDone={(it) => { setHypos([...hypos, { ...it, id: `whatif-${hypos.length}-${Date.now()}` }]); close(); }} />
      </Sheet>
      <Sheet open={typeof panel === "object" && panel !== null} onClose={close} title="Edit grade">
        {typeof panel === "object" && panel !== null && (
          <ItemForm
            courseId={course.id}
            item={panel.item}
            categories={cats}
            onDone={() => { close(); toast({ tone: "success", title: "Grade saved" }); }}
            onDelete={() => { store.items.remove(panel.item.id); close(); toast({ tone: "info", title: "Grade deleted" }); }}
          />
        )}
      </Sheet>
      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${course.name}?`}
        description="This removes the class and all its grades from every device. It can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                deleteCourse(course.id);
                setConfirmDelete(false);
                navigate("/academics");
                toast({ tone: "info", title: "Class deleted" });
              }}
            >
              Delete class
            </Button>
          </>
        }
      />
    </>
  );
}

function GradeRow({ item, category, onOpen }: { item: GradeItem; category?: string; onOpen: () => void }) {
  const pct = item.earned !== null && item.possible ? (item.earned / item.possible) * 100 : null;
  const date = item.gradedOn ?? item.dueOn;
  return (
    <button type="button" onClick={onOpen} className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-3 text-left hover:bg-surface-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">{item.title}</span>
        <span className="block truncate text-[12.5px] text-muted">
          {[category, date ? new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null, item.source === "csv" ? "imported" : null].filter(Boolean).join(" · ") || "No date"}
        </span>
      </span>
      <span className="shrink-0 text-right">
        {item.excused ? (
          <Badge>Excused</Badge>
        ) : item.earned === null ? (
          item.missing ? <Badge tone="danger">Missing</Badge> : <Badge>Not graded</Badge>
        ) : (
          <>
            <span className="tabular block text-[15px] font-semibold">
              {item.earned}
              {item.possible ? `/${item.possible}` : ""}
            </span>
            <span className="tabular block text-[12px] text-muted">{pct === null ? "extra credit" : `${pct.toFixed(1)}%`}</span>
          </>
        )}
      </span>
    </button>
  );
}

function ManualPercent({ courseId, value }: { courseId: string; value: number | null }) {
  const [v, setV] = useState(value === null ? "" : String(value));
  const [err, setErr] = useState<string | undefined>();
  const toast = useToast();
  return (
    <form
      className="mt-4 flex items-end gap-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const n = parseNum(v);
        if (n !== null && (Number.isNaN(n) || n < 0 || n > 200)) return setErr("Enter a percentage from 0 to 200.");
        setErr(undefined);
        store.courses.patch(courseId, { manualPercent: n });
        toast({ tone: "success", title: "Percentage updated" });
      }}
    >
      <div className="flex-1">
        <TextField id="manual-pct" label="Percentage in your school portal" inputMode="decimal" value={v} onChange={(e) => setV(e.target.value)} error={err} placeholder="e.g. 91.4" />
      </div>
      <Button type="submit">Update</Button>
    </form>
  );
}

function NeedCalculator({ courseId }: { courseId: string }) {
  const a = useAcademics();
  const summary = a.summaries.find((s) => s.course.id === courseId);
  const course = summary?.course;
  const cats = a.categories.filter((c) => c.courseId === courseId);
  const bands = summary?.bands ?? [];
  const passing = bands.filter((b) => b.points > 0);
  const [target, setTarget] = useState(String(passing[0]?.min ?? 90));
  const [possible, setPossible] = useState("100");
  const [categoryId, setCategoryId] = useState(cats.find((c) => /final|exam|test/i.test(c.name))?.id ?? cats[0]?.id ?? "");
  if (!course) return null;
  const t = parseNum(target);
  const p = parseNum(possible);
  const ok = t !== null && !Number.isNaN(t) && p !== null && !Number.isNaN(p) && p > 0;
  const res = ok ? scoreNeeded(course, a.categories, a.items, t!, { possible: p!, categoryId: categoryId || null }) : null;
  return (
    <SectionCard title="What do I need?" subtitle="The score you need on your next assignment or final" icon={Calculator} accent="bg-brand-soft text-brand-ink">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select id="need-target" label="To end with at least" value={target} onChange={(e) => setTarget(e.target.value)}>
          {passing.map((b) => (
            <option key={b.letter} value={b.min}>
              {b.letter} ({b.min}%)
            </option>
          ))}
        </Select>
        <TextField id="need-possible" label="It's out of" inputMode="decimal" value={possible} onChange={(e) => setPossible(e.target.value)} />
        {cats.length > 0 && (
          <Select id="need-cat" label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>
      <div className="mt-3 rounded-2xl bg-surface-2/70 p-3 text-[14.5px]" role="status">
        {!res ? (
          <span className="text-muted">Enter how many points it's worth.</span>
        ) : res.kind === "needed" ? (
          <>
            You need at least <strong className="tabular">{res.earned}</strong> out of {p} (<strong className="tabular">{res.percentOfItem.toFixed(1)}%</strong>).
          </>
        ) : res.kind === "secured" ? (
          <>You'll stay at or above that grade even with a 0. 🎉</>
        ) : res.kind === "unreachable" ? (
          <>Even a perfect score reaches {res.best.toFixed(1)}%, so that target isn't reachable with this one assignment.</>
        ) : (
          <span className="text-muted">Not available for this class.</span>
        )}
      </div>
    </SectionCard>
  );
}
