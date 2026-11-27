import { useEffect, useState } from "react";

/** Current time, re-rendering every `intervalMs` (aligned to the next tick). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let id: number;
    const tick = () => {
      setNow(new Date());
      id = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };
    id = window.setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    return () => window.clearTimeout(id);
  }, [intervalMs]);
  return now;
}

export function greetingFor(date: Date) {
  const h = date.getHours();
  if (h < 5) return "Good night";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Good night";
}

export const formatLongDate = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });

export const formatClock = (d: Date) =>
  d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
