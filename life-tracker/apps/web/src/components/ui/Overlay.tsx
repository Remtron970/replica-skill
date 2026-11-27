import { AnimatePresence, motion, useDragControls } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { spring } from "../../lib/motion";
import { IconButton } from "./Button";
import { cx } from "./cx";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Keeps keyboard focus inside `ref` while open, closes on Escape, restores focus on close. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = ref.current;
    const first = node?.querySelector<HTMLElement>("[data-autofocus]") ?? node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!items.length) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      // Return focus to what opened this; if that's gone, to the page content (not the skip link).
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
      else document.getElementById("main")?.focus({ preventScroll: true });
    };
  }, [open, ref]);
}

function Scrim({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <motion.div
      className={cx("fixed inset-0 z-40 bg-scrim", className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      onClick={onClick}
      aria-hidden
    />
  );
}

/** Centered modal dialog. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Scrim onClick={onClose} />
          <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              ref={ref}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-t`}
              aria-describedby={description ? `${id}-d` : undefined}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
              transition={spring.soft}
              className="pointer-events-auto w-full max-w-md rounded-[24px] bg-surface p-5 shadow-pop outline-none"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <h2 id={`${id}-t`} className="text-[19px] font-semibold">
                  {title}
                </h2>
                <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
              </div>
              {description && (
                <p id={`${id}-d`} className="mb-4 text-[14.5px] text-muted">
                  {description}
                </p>
              )}
              {children}
              {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Bottom sheet on phones; a right-side panel on wider screens. Drag down to dismiss on touch. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  mobileOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Hide entirely at ≥768px (used by the phone "More" menu). */
  mobileOnly?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const drag = useDragControls();
  useFocusTrap(ref, open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <Scrim onClick={onClose} className={mobileOnly ? "md:hidden" : undefined} />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-t`}
            tabIndex={-1}
            className={cx(
              "pb-safe fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-[28px] bg-surface px-4 pt-3 shadow-pop outline-none",
              mobileOnly
                ? "md:hidden"
                : "md:inset-x-auto md:top-0 md:right-0 md:h-dvh md:max-h-none md:w-[420px] md:rounded-none md:rounded-l-[28px] md:px-6 md:pt-6",
            )}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: { duration: 0.2, ease: "easeIn" } }}
            transition={spring.sheet}
            // Only the handle/title bar drags the sheet, so content inside can scroll normally.
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => (info.offset.y > 90 || info.velocity.y > 600) && onClose()}
          >
            <div className="touch-none" onPointerDown={(e) => drag.start(e)}>
              <div className={cx("mx-auto mb-3 h-1.5 w-10 rounded-full bg-line", !mobileOnly && "md:hidden")} aria-hidden />
            </div>
            <div className="mb-3 flex touch-none items-center justify-between" onPointerDown={(e) => (e.target as HTMLElement).closest("button") || drag.start(e)}>
              <h2 id={`${id}-t`} className="text-[17px] font-semibold">
                {title}
              </h2>
              <IconButton icon={X} label="Close" size="sm" onClick={onClose} />
            </div>
            <div className="pb-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
