import { motion } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import { spring } from "../../lib/motion";
import { cx } from "./cx";

const fieldBase =
  "w-full rounded-[12px] border bg-surface-2 px-3.5 py-2.5 text-[15px] text-ink outline-none transition-colors placeholder:text-muted/70 focus:border-brand-ink disabled:opacity-50";

function FieldShell({
  id,
  label,
  hint,
  error,
  children,
  hideLabel,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cx("text-[13px] font-semibold", hideLabel && "sr-only")}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-[12.5px] text-accent-red" role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-msg`} className="text-[12.5px] text-muted">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  hideLabel,
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; hideLabel?: boolean }) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input
        {...rest}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-msg` : undefined}
        className={cx(fieldBase, error ? "border-accent-red" : "border-line", className)}
      />
    </FieldShell>
  );
}

export function Select({
  label,
  hint,
  error,
  children,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string }) {
  const auto = useId();
  const id = rest.id ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <select
          {...rest}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${id}-msg` : undefined}
          className={cx(fieldBase, "appearance-none pr-10", error ? "border-accent-red" : "border-line", className)}
        >
          {children}
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-muted" aria-hidden />
      </div>
    </FieldShell>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p id={`${id}-l`} className="text-[15px] font-medium">
          {label}
        </p>
        {description && (
          <p id={`${id}-d`} className="text-[13px] text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-l`}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "relative h-[30px] w-[50px] shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-50",
          checked ? "bg-brand-strong" : "bg-line",
        )}
      >
        <motion.span
          layout
          transition={spring.snappy}
          className={cx("block h-6 w-6 rounded-full bg-white shadow-md", checked && "ml-auto")}
        />
      </button>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/** iOS-style segmented control. Also used as view switcher (Day / Week / Month). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const group = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-[14px] bg-surface-2 p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative flex items-center justify-center gap-1.5 rounded-[10px] font-semibold transition-colors",
              size === "sm" ? "py-1.5 text-[13px]" : "py-2.5 text-[14px]",
              active ? "text-ink" : "text-muted hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${group}`}
                className="absolute inset-0 rounded-[10px] bg-surface shadow-card"
                transition={spring.snappy}
              />
            )}
            {o.icon && <o.icon size={15} className="relative" aria-hidden />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
