import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, Bell, CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { spring } from "../../lib/motion";
import { cx } from "./cx";

type ToastTone = "success" | "info" | "warning" | "error" | "notification";

export interface ToastInput {
  title: string;
  body?: string;
  tone?: ToastTone;
  /** Optional action button (e.g. "Open", "Reload"). */
  action?: { label: string; onClick: () => void };
  /** ms; 0 keeps it until dismissed. Default 4000. */
  duration?: number;
}

interface ToastItem extends ToastInput {
  id: number;
}

const ICONS = { success: CheckCircle2, info: Info, warning: AlertTriangle, error: AlertTriangle, notification: Bell };
const TONES = {
  success: "text-accent-green",
  info: "text-accent-blue",
  warning: "text-accent-yellow",
  error: "text-accent-red",
  notification: "text-brand-ink",
};

const Ctx = createContext<((t: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (t: ToastInput) => {
      const id = next.current++;
      setItems((xs) => [...xs.slice(-2), { ...t, id }]);
      const ms = t.duration ?? 4000;
      if (ms > 0) window.setTimeout(() => dismiss(id), ms);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),12px)] md:items-end md:px-6"
      >
        <AnimatePresence initial={false}>
          {items.map((t) => {
            const Icon = ICONS[t.tone ?? "info"];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.96 }}
                transition={spring.soft}
                drag="y"
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0.6, bottom: 0 }}
                onDragEnd={(_, info) => info.offset.y < -30 && dismiss(t.id)}
                role={t.tone === "error" ? "alert" : "status"}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[18px] border border-line bg-surface/95 p-3.5 shadow-pop backdrop-blur-xl"
              >
                <Icon size={20} className={cx("mt-0.5 shrink-0", TONES[t.tone ?? "info"])} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-[13.5px] text-muted">{t.body}</p>}
                  {t.action && (
                    <button
                      type="button"
                      onClick={() => {
                        t.action!.onClick();
                        dismiss(t.id);
                      }}
                      className="mt-1.5 text-[13.5px] font-semibold text-brand-ink"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
                <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="rounded-full p-1 text-muted hover:text-ink">
                  <X size={15} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside <ToastProvider>");
  return v;
}
