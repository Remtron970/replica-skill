import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
      width={size}
      height={size}
      alt=""
      className="rounded-[22%] shadow-sm"
    />
  );
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo />
      <span className="text-[15px] font-extrabold tracking-[0.08em] text-ink">LIFE TRACKER</span>
    </div>
  );
}

export function Card({
  children,
  className = "",
  interactive = false,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}) {
  const base = `rounded-[20px] bg-surface p-4 shadow-card md:p-5 ${className}`;
  if (!interactive) return <div className={base}>{children}</div>;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={`${base} block w-full cursor-pointer text-left`}
    >
      {children}
    </motion.button>
  );
}

export function IconChip({ icon: Icon, accent, size = 18 }: { icon: LucideIcon; accent: string; size?: number }) {
  return (
    <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accent}`}>
      <Icon size={size} strokeWidth={2.2} aria-hidden />
    </span>
  );
}

export function StatusChip({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "brand" | "green" }) {
  const tones = {
    muted: "bg-surface-2 text-muted",
    brand: "bg-brand-soft text-brand-deep dark:text-brand",
    green: "bg-accent-green/15 text-accent-green",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  icon,
  accent,
  right,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  accent?: string;
  right?: ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-4 md:mb-7">
      <div className="flex items-center gap-3">
        {icon && accent && <IconChip icon={icon} accent={accent} size={20} />}
        <div>
          <h1 className="text-[26px] leading-tight font-bold tracking-tight md:text-[32px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[15px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {right}
    </header>
  );
}

/** Fade + small slide used when a page mounts. */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
