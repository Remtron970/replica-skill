import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../components/ui";
import { store } from "../../lib/store/schema";
import { dueReminders } from "./logic";

const KEY = "lt.reminders.lastCheck";
const MAX_CATCH_UP_MS = 6 * 3600_000; // after a long time closed, don't flood with old reminders

/** Shows assignment reminders as notifications while the app is open (push comes in Phase 11). */
export function AssignmentReminders() {
  const toast = useToast();
  const navigate = useNavigate();
  const shown = useRef(new Set<string>());

  useEffect(() => {
    const check = () => {
      const now = new Date();
      let last = now.getTime() - 60_000;
      try {
        const saved = Number(localStorage.getItem(KEY));
        if (saved) last = Math.max(saved, now.getTime() - MAX_CATCH_UP_MS);
      } catch {
        /* ignore */
      }
      for (const a of dueReminders(store.assignments.list(), new Date(last), now)) {
        if (shown.current.has(a.id)) continue;
        shown.current.add(a.id);
        toast({ tone: "notification", title: a.title, body: "Reminder: this is due soon.", duration: 0, action: { label: "Open Assignments", onClick: () => navigate("/assignments") } });
      }
      try {
        localStorage.setItem(KEY, String(now.getTime()));
      } catch {
        /* ignore */
      }
    };
    check();
    const id = window.setInterval(check, 30_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [toast, navigate]);

  return null;
}
