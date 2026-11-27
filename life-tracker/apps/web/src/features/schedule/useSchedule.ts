import { useMemo } from "react";
import { usePrefs } from "../../lib/prefs";
import { store } from "../../lib/store/schema";
import { useCollection } from "../../lib/store/StoreProvider";
import type { DayProvider } from "../../lib/schedule";
import { occurrencesFor, ScheduleCalendar, type DayInfo } from "./blockSchedule";

/** The user's block schedule, ready for timelines and calendars. */
export function useSchedule() {
  const { prefs } = usePrefs();
  const dayTypes = useCollection(store.dayTypes);
  const blocks = useCollection(store.blocks);
  const exceptions = useCollection(store.exceptions);
  const courses = useCollection(store.courses);
  return useMemo(() => {
    const types = [...dayTypes].sort((a, b) => a.sort - b.sort);
    const cal = new ScheduleCalendar(prefs.schedule, exceptions, types);
    const colorOf = (id: string) => courses.find((c) => c.id === id)?.color;
    const forDay: DayProvider = (d) => occurrencesFor(cal, blocks, d, colorOf);
    const typeName = new Map(types.map((t) => [t.id, t]));
    const labelFor = (d: Date) => {
      const info = cal.dayInfo(d);
      return info.school ? (typeName.get(info.dayTypeId)?.name ?? null) : null;
    };
    const info = (d: Date): DayInfo => cal.dayInfo(d);
    return {
      settings: prefs.schedule,
      dayTypes: types,
      blocks,
      exceptions,
      courses,
      calendar: cal,
      forDay,
      labelFor,
      info,
      typeName,
      isSetUp: types.length > 0 && blocks.length > 0,
    };
  }, [prefs.schedule, dayTypes, blocks, exceptions, courses]);
}
