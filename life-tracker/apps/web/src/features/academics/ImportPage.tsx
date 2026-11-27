import { ArrowLeft, CheckCircle2, ClipboardPaste, FileUp, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, ErrorState, PageHeader, SectionCard, TextField, useToast } from "../../components/ui";
import { parseGrades, planImport } from "./csvImport";
import { applyImport, useAcademics } from "./useAcademics";

const EXAMPLE = `Course\tAssignment\tCategory\tScore\tOut of\tDate
Biology\tCell structure quiz\tQuizzes\t18\t20\t9/12/2026
Biology\tUnit 1 test\tTests\t86\t100\t9/26/2026
Chemistry\tLab 1: density\tLabs\tMissing\t25\t9/18/2026`;

export function ImportPage() {
  const a = useAcademics();
  const navigate = useNavigate();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [defaultCourse, setDefaultCourse] = useState("");
  const [fileError, setFileError] = useState<string>();

  const parsed = useMemo(() => (text.trim() ? parseGrades(text, { defaultCourse: defaultCourse.trim() || undefined }) : null), [text, defaultCourse]);
  const plan = useMemo(() => (parsed && !parsed.problem ? planImport(parsed.rows, a.allCourses, a.categories, a.items) : null), [parsed, a.allCourses, a.categories, a.items]);
  const needsCourse = parsed?.problem?.includes("class column");

  const readFile = (f: File) => {
    setFileError(undefined);
    if (f.size > 2_000_000) return setFileError("That file is larger than 2 MB. Export only the grades you need.");
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result ?? ""));
    reader.onerror = () => setFileError("Couldn't read that file. Try saving it as CSV and choosing it again.");
    reader.readAsText(f);
  };

  return (
    <>
      <PageHeader
        title="Import grades"
        subtitle="Paste a grade table from StudentVUE, PowerSchool or a spreadsheet — no school password needed."
        icon={FileUp}
        accent="bg-accent-purple/12 text-accent-purple"
        right={<IconBack onClick={() => navigate("/academics")} />}
      />
      <div className="space-y-4">
        <SectionCard title="1. Copy your grades" icon={ClipboardPaste} accent="bg-surface-2 text-muted">
          <ol className="list-inside list-decimal space-y-1 text-[14px] text-muted">
            <li>
              Open your gradebook in a web browser (StudentVUE: Grade Book → pick a class; PowerSchool, Infinite Campus or a spreadsheet work too),
              select the assignment table including its heading row, and copy it.
            </li>
            <li>Paste it below, or export a CSV file and choose it.</li>
            <li>Check the preview, then import. Running it again skips grades you already have.</li>
          </ol>
        </SectionCard>

        <SectionCard title="2. Paste or choose a file" icon={Upload} accent="bg-accent-blue/10 text-accent-blue">
          <label htmlFor="import-text" className="mb-1.5 block text-[13px] font-semibold">
            Grade table
          </label>
          <textarea
            id="import-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={EXAMPLE}
            spellCheck={false}
            className="w-full rounded-[12px] border border-line bg-surface-2 px-3.5 py-2.5 font-mono text-[13px] outline-none placeholder:text-muted/70 focus:border-brand-ink"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" className="sr-only" id="import-file" aria-label="Choose a CSV file" tabIndex={-1} onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
            <Button variant="secondary" size="sm" icon={FileUp} onClick={() => fileRef.current?.click()}>
              Choose CSV file
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setText(EXAMPLE)}>
              Use example
            </Button>
          </div>
          {fileError && <p className="mt-2 text-[12.5px] text-accent-red" role="alert">{fileError}</p>}
          {(needsCourse || defaultCourse) && (
            <div className="mt-3">
              <TextField
                id="import-course"
                label="Which class are these grades for?"
                value={defaultCourse}
                onChange={(e) => setDefaultCourse(e.target.value)}
                list="import-course-list"
                placeholder="Type or pick a class"
                hint="Your table has no class column, so all rows go to this class."
              />
              <datalist id="import-course-list">
                {a.allCourses.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
          )}
        </SectionCard>

        {parsed && (
          <SectionCard title="3. Preview" icon={CheckCircle2} accent="bg-accent-green/12 text-accent-green">
            {parsed.problem && !needsCourse ? (
              <ErrorState title="Can't read this table yet" body={parsed.problem} />
            ) : plan ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 text-[13px]">
                  <Badge tone="success">{plan.items.length} new grade{plan.items.length === 1 ? "" : "s"}</Badge>
                  {plan.newCourses.length > 0 && <Badge tone="info">{plan.newCourses.length} new class{plan.newCourses.length === 1 ? "" : "es"}: {plan.newCourses.join(", ")}</Badge>}
                  {plan.newCategories.length > 0 && <Badge tone="info">{plan.newCategories.length} new categor{plan.newCategories.length === 1 ? "y" : "ies"}</Badge>}
                  {plan.duplicates > 0 && <Badge>{plan.duplicates} already imported (skipped)</Badge>}
                  {plan.errors.length > 0 && <Badge tone="danger">{plan.errors.length} row{plan.errors.length === 1 ? "" : "s"} can't be read</Badge>}
                </div>
                <div className="overflow-x-auto rounded-xl border border-line" role="region" aria-label="Import preview table" tabIndex={0}>
                  <table className="w-full min-w-[520px] text-left text-[13px]">
                    <thead className="bg-surface-2 text-muted">
                      <tr>
                        {["Line", "Class", "Assignment", "Category", "Score", "Date", ""].map((h) => (
                          <th key={h} className="px-3 py-2 font-semibold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {parsed.rows.slice(0, 50).map((r) => (
                        <tr key={r.line} className={r.error ? "bg-accent-red/5" : ""}>
                          <td className="tabular px-3 py-1.5 text-muted">{r.line}</td>
                          <td className="px-3 py-1.5">{r.course}</td>
                          <td className="px-3 py-1.5">{r.title}</td>
                          <td className="px-3 py-1.5 text-muted">{r.category}</td>
                          <td className="tabular px-3 py-1.5">{r.missing ? "Missing" : r.excused ? "Excused" : r.earned === null ? "—" : `${r.earned}${r.possible !== null ? `/${r.possible}` : ""}`}</td>
                          <td className="tabular px-3 py-1.5 text-muted">{r.date ?? ""}</td>
                          <td className="px-3 py-1.5 text-accent-red">{r.error ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {parsed.rows.length > 50 && <p className="text-[12.5px] text-muted">Showing the first 50 of {parsed.rows.length} rows.</p>}
                {plan.newCategories.length > 0 && (
                  <p className="text-[12.5px] text-muted">New categories start with 0% weight. If a class uses weighted categories, set the weights on its page after importing.</p>
                )}
                <Button
                  fullWidth
                  icon={Upload}
                  disabled={plan.items.length === 0}
                  onClick={() => {
                    const n = applyImport(plan);
                    toast({ tone: "success", title: `Imported ${n} grade${n === 1 ? "" : "s"}`, body: plan.duplicates ? `${plan.duplicates} already there were skipped.` : undefined });
                    navigate("/academics");
                  }}
                >
                  {plan.items.length ? `Import ${plan.items.length} grade${plan.items.length === 1 ? "" : "s"}` : "Nothing new to import"}
                </Button>
              </div>
            ) : (
              <p className="text-[14px] text-muted">Enter the class name above to see the preview.</p>
            )}
          </SectionCard>
        )}
      </div>
    </>
  );
}

function IconBack({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onClick}>
      Academics
    </Button>
  );
}
