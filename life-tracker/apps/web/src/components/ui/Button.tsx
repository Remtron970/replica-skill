import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { spring } from "../../lib/motion";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-strong text-on-brand shadow-sm hover:brightness-110",
  secondary: "bg-surface-2 text-ink hover:bg-line",
  ghost: "text-brand-ink hover:bg-brand-soft",
  danger: "bg-accent-red/10 text-accent-red hover:bg-accent-red/15",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-[10px] px-3 text-[13px]",
  md: "h-10 gap-2 rounded-[14px] px-4 text-[14px]",
  lg: "h-12 gap-2 rounded-[16px] px-5 text-[15px]",
};

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", icon: Icon, loading, fullWidth, disabled, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={spring.snappy}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-semibold transition-[filter,background-color] select-none disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner /> : Icon && <Icon size={size === "sm" ? 15 : 17} strokeWidth={2.2} aria-hidden />}
      {children}
    </motion.button>
  );
});

export function IconButton({
  icon: Icon,
  label,
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: Omit<ButtonProps, "children" | "icon"> & { icon: LucideIcon; label: string }) {
  const dims = { sm: "h-8 w-8 rounded-[10px]", md: "h-10 w-10 rounded-[14px]", lg: "h-12 w-12 rounded-[16px]" }[size];
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.92 }}
      transition={spring.snappy}
      className={cx("inline-flex shrink-0 items-center justify-center disabled:opacity-50", VARIANTS[variant], dims, className)}
      {...rest}
    >
      <Icon size={size === "sm" ? 16 : 18} strokeWidth={2.2} aria-hidden />
    </motion.button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin motion-reduce:animate-none" aria-hidden>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
