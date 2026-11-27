import { motion } from "motion/react";
import { AlertTriangle, ChevronRight, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { spring } from "../../lib/motion";
import { Button } from "./Button";
import { cx } from "./cx";

/** Shown when a section has nothing to display — always offers the next action. */
export function EmptyState({
  icon: Icon,
  accent = "bg-surface-2 text-muted",
  title,
  body,
  action,
  badge,
  compact,
}: {
  icon: LucideIcon;
  accent?: string;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx("flex flex-col items-center text-center", compact ? "px-2 py-5" : "px-2 py-9")}>
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ ...spring.bouncy, delay: 0.05 }}
        className={cx("mb-4 flex items-center justify-center", compact ? "h-12 w-12 rounded-2xl" : "h-16 w-16 rounded-[22px]", accent)}
      >
        <Icon size={compact ? 22 : 30} aria-hidden />
      </motion.div>
      {badge}
      <h3 className={cx("font-semibold", badge ? "mt-3" : "", compact ? "text-[16px]" : "text-[19px]")}>{title}</h3>
      {body && <div className="mt-1 max-w-sm text-[14px] text-muted">{body}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", body, onRetry }: { title?: string; body?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl bg-accent-red/8 p-4">
      <AlertTriangle size={20} className="mt-0.5 shrink-0 text-accent-red" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold">{title}</p>
        {body && <p className="mt-0.5 text-[13.5px] text-muted">{body}</p>}
      </div>
      {onRetry && (
        <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** Shimmer placeholder that matches the shape of the content it stands in for. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("skeleton rounded-xl", className)} aria-hidden />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-[20px] bg-surface p-4 shadow-card md:p-5" role="status" aria-busy="true" aria-label="Loading">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="mb-2 h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

/** Standard tappable list row (settings, email list, assignments). */
export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
}: {
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {icon}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{title}</p>
        {subtitle && <p className="truncate text-[13px] text-muted">{subtitle}</p>}
      </div>
      {trailing}
      {onClick && <ChevronRight size={17} className="shrink-0 text-muted/70" aria-hidden />}
    </>
  );
  const cls = "flex w-full items-center gap-3 py-3 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, "-mx-2 rounded-xl px-2 hover:bg-surface-2 active:bg-surface-2")}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
