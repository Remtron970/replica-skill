import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useRef } from "react";
import { duration } from "../../lib/motion";
import { useNow } from "../../lib/time";
import { cx } from "./cx";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Number that counts up the first time it scrolls into view. */
export function AnimatedNumber({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) =>
    `${prefix}${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`,
  );

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: duration.slow, ease: [0.16, 1, 0.3, 1] });
    return () => c.stop();
  }, [inView, value, reduce, mv]);

  const final = `${prefix}${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  return (
    <span ref={ref} className={cx("tabular", className)}>
      <span className="sr-only">{final}</span>
      <motion.span aria-hidden>{text}</motion.span>
    </span>
  );
}

export function ProgressBar({
  value,
  label,
  color = "bg-brand",
  showValue,
}: {
  /** 0–1 */
  value: number;
  label: string;
  color?: string;
  showValue?: boolean;
}) {
  const pct = Math.round(clamp01(value) * 100);
  return (
    <div>
      {showValue && (
        <div className="mb-1.5 flex justify-between text-[13px]">
          <span className="font-medium">{label}</span>
          <span className="tabular text-muted">{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-2.5 overflow-hidden rounded-full bg-surface-2"
      >
        <motion.div
          className={cx("h-full rounded-full", color)}
          initial={{ width: 0 }}
          whileInView={{ width: `${pct}%` }}
          viewport={{ once: true }}
          transition={{ duration: duration.slow, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

export function ProgressRing({
  value,
  size = 88,
  stroke = 9,
  label,
  color = "var(--brand)",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.round(clamp01(value) * 100);
  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - clamp01(value)) }}
          viewport={{ once: true }}
          transition={{ duration: duration.chart, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children ?? <span className="tabular text-[17px] font-bold">{pct}%</span>}</div>
    </div>
  );
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return "now";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/** Live countdown to `target` ("Next class in 12m 04s"). */
export function Countdown({ target, className }: { target: Date; className?: string }) {
  const now = useNow(1000);
  const ms = target.getTime() - now.getTime();
  return (
    <time dateTime={target.toISOString()} className={cx("tabular", className)}>
      {formatCountdown(ms)}
    </time>
  );
}
