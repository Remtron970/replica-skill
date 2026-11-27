import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { spring } from "../../lib/motion";
import { cx } from "./cx";

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info" | "demo";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-muted",
  brand: "bg-brand-soft text-brand-ink",
  success: "bg-accent-green/12 text-accent-green",
  warning: "bg-accent-yellow/14 text-accent-yellow",
  danger: "bg-accent-red/10 text-accent-red",
  info: "bg-accent-blue/10 text-accent-blue",
  demo: "border border-dashed border-accent-purple/60 bg-accent-purple/10 text-accent-purple uppercase tracking-wider",
};

/** Small status label. Use tone="demo" on anything showing sample data. */
export function Badge({ children, tone = "neutral", icon: Icon }: { children: ReactNode; tone?: Tone; icon?: LucideIcon }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] leading-5 font-semibold whitespace-nowrap", TONES[tone])}>
      {Icon && <Icon size={12} strokeWidth={2.4} aria-hidden />}
      {children}
    </span>
  );
}

/** Toggleable filter/selection chip. */
export function Chip({
  children,
  selected,
  onClick,
  icon: Icon,
  disabled,
}: {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={disabled ? undefined : { scale: 0.95 }}
      transition={spring.snappy}
      onClick={onClick}
      aria-pressed={selected}
      disabled={disabled}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        selected ? "border-brand-strong bg-brand-strong text-on-brand" : "border-line bg-surface text-muted hover:text-ink",
      )}
    >
      {Icon && <Icon size={14} aria-hidden />}
      {children}
    </motion.button>
  );
}
