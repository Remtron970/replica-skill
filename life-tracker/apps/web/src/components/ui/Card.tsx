import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { spring } from "../../lib/motion";
import { Badge } from "./Badge";
import { cx } from "./cx";
import { SyncStatus, type SyncInfo } from "./SyncStatus";

export function Card({
  children,
  className,
  interactive = false,
  onClick,
  label,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
  /** Accessible name for interactive cards. */
  label?: string;
}) {
  const base = cx("rounded-[20px] bg-surface p-4 shadow-card md:p-5", className);
  if (!interactive) return <div className={base}>{children}</div>;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={spring.soft}
      className={cx(base, "block w-full cursor-pointer text-left hover:shadow-pop")}
    >
      {children}
    </motion.button>
  );
}

export function IconChip({ icon: Icon, accent, size = "md" }: { icon: LucideIcon; accent: string; size?: "sm" | "md" | "lg" }) {
  const dims = { sm: "h-7 w-7 rounded-lg", md: "h-9 w-9 rounded-xl", lg: "h-14 w-14 rounded-[20px]" }[size];
  const icon = { sm: 15, md: 18, lg: 26 }[size];
  return (
    <span className={cx("inline-flex shrink-0 items-center justify-center", dims, accent)}>
      <Icon size={icon} strokeWidth={2.2} aria-hidden />
    </span>
  );
}

/**
 * The standard card for any block of synced data. It always shows where the
 * data came from and when — or a DEMO badge for sample data.
 */
export function SectionCard({
  title,
  subtitle,
  icon,
  accent,
  action,
  sync,
  demo,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: string;
  action?: ReactNode;
  sync?: SyncInfo;
  demo?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rounded-[20px] bg-surface p-4 shadow-card md:p-5", className)} aria-label={title}>
      <header className="mb-3 flex items-start gap-3">
        {icon && accent && <IconChip icon={icon} accent={accent} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[17px] font-semibold">{title}</h2>
            {demo && <Badge tone="demo">Demo</Badge>}
          </div>
          {subtitle && <p className="text-[13px] text-muted">{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
      {sync && (
        <footer className="mt-3 border-t border-line pt-2.5">
          <SyncStatus {...sync} />
        </footer>
      )}
    </section>
  );
}
