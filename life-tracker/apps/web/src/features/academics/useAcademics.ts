import { useMemo } from "react";
import { usePrefs } from "../../lib/prefs";
import { store } from "../../lib/store/schema";
import { useCollection } from "../../lib/store/StoreProvider";
import { newId } from "../../lib/store/collection";
import type { ImportPlan } from "./csvImport";
import { averageOf, cumulativeGpa, gradeHistory, localDate, summarizeCourses, termGpa } from "./grades";
import type { Course, GradeCategory, GradeItem } from "./types";

/** Everything the Academics screens need, recomputed only when data changes. */
export function useAcademics() {
  const { prefs } = usePrefs();
  const settings = prefs.academic;
  const terms = useCollection(store.terms);
  const scales = useCollection(store.scales);
  const courses = useCollection(store.courses);
  const categories = useCollection(store.categories);
  const items = useCollection(store.items);
  const pastCourses = useCollection(store.pastCourses);

  return useMemo(() => {
    const currentTerm = terms.find((t) => t.isCurrent) ?? null;
    const active = courses.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name));
    const inTerm = currentTerm ? active.filter((c) => c.termId === currentTerm.id || c.termId === null) : active;
    const summaries = summarizeCourses(inTerm, categories, items, scales, settings);
    const today = localDate(new Date());
    return {
      settings,
      terms,
      currentTerm,
      scales,
      courses: inTerm,
      allCourses: courses,
      categories,
      items,
      pastCourses,
      summaries,
      gpa: termGpa(summaries, settings),
      cumulative: cumulativeGpa(summaries, pastCourses, settings),
      average: averageOf(summaries),
      missing: summaries.reduce((n, s) => n + s.result.missing, 0),
      history: (c: Course) => gradeHistory(c, categories, items),
      today,
    };
  }, [settings, terms, scales, courses, categories, items, pastCourses]);
}

// ---------------------------------------------------------------------------
// Actions (all go through the synced collections)
// ---------------------------------------------------------------------------
export function deleteCourse(id: string) {
  store.items.batch(() => store.items.list().filter((i) => i.courseId === id).forEach((i) => store.items.remove(i.id)));
  store.categories.batch(() => store.categories.list().filter((c) => c.courseId === id).forEach((c) => store.categories.remove(c.id)));
  store.courses.remove(id);
}

/** Replace a class's categories with the edited list (keeps ids so grades stay attached). */
export function saveCategories(courseId: string, next: { id?: string; name: string; weight: number }[]) {
  const existing = store.categories.list().filter((c) => c.courseId === courseId);
  const keep = new Set(next.map((n) => n.id).filter(Boolean));
  store.categories.batch(() => {
    existing.filter((c) => !keep.has(c.id)).forEach((c) => store.categories.remove(c.id));
    next.forEach((n, i) => {
      const prev = n.id ? store.categories.get(n.id) : undefined;
      if (prev && prev.name === n.name && prev.weight === n.weight && prev.sort === i) return;
      store.categories.put({ ...(prev ?? {}), id: n.id ?? newId(), courseId, name: n.name, weight: n.weight, sort: i } as GradeCategory);
    });
  });
  // Grades in a removed category become uncategorized rather than disappearing.
  const removed = new Set(existing.filter((c) => !keep.has(c.id)).map((c) => c.id));
  if (removed.size)
    store.items.batch(() => store.items.list().filter((i) => i.categoryId && removed.has(i.categoryId)).forEach((i) => store.items.patch(i.id, { categoryId: null })));
}

/** Carry out a CSV import plan. Returns how many grades were added. */
export function applyImport(plan: ImportPlan): number {
  const key = (s: string) => s.trim().toLowerCase();
  const courseId = new Map(store.courses.list().map((c) => [key(c.name), c.id]));
  store.courses.batch(() => {
    for (const name of plan.newCourses) {
      const c = store.courses.put({
        termId: store.terms.list().find((t) => t.isCurrent)?.id ?? null,
        name, teacher: "", room: "", color: "purple", credits: 1, level: "regular", gradingMode: "points",
        manualPercent: null, scaleId: null, archived: false, source: "csv",
      } as Course);
      courseId.set(key(name), c.id);
    }
  });
  const catId = new Map(store.categories.list().map((c) => [`${c.courseId}|${key(c.name)}`, c.id]));
  store.categories.batch(() => {
    for (const nc of plan.newCategories) {
      const cid = courseId.get(key(nc.course))!;
      const sort = store.categories.list().filter((c) => c.courseId === cid).length;
      const c = store.categories.put({ courseId: cid, name: nc.name, weight: 0, sort, source: "csv" } as GradeCategory);
      catId.set(`${cid}|${key(nc.name)}`, c.id);
    }
  });
  store.items.batch(() => {
    for (const r of plan.items) {
      const cid = courseId.get(key(r.course))!;
      store.items.put({
        courseId: cid,
        categoryId: r.category ? (catId.get(`${cid}|${key(r.category)}`) ?? null) : null,
        title: r.title, earned: r.earned, possible: r.possible, gradedOn: r.date, dueOn: null,
        excused: r.excused, missing: r.missing, notes: "", source: "csv",
      } as GradeItem);
    }
  });
  return plan.items.length;
}
