import type { Transition, Variants } from "motion/react";

/** Shared motion presets so every screen moves the same way (docs/DESIGN_SYSTEM.md → Motion). */
export const spring = {
  snappy: { type: "spring", stiffness: 500, damping: 38 } satisfies Transition,
  soft: { type: "spring", stiffness: 380, damping: 30 } satisfies Transition,
  bouncy: { type: "spring", stiffness: 300, damping: 18 } satisfies Transition,
  sheet: { type: "spring", stiffness: 420, damping: 40 } satisfies Transition,
};

export const duration = { fast: 0.15, base: 0.22, slow: 0.6, chart: 0.7 };

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  enter: { opacity: 1, y: 0, transition: { duration: duration.base, ease: "easeOut" } },
  exit: { opacity: 0, y: -4, transition: { duration: duration.fast, ease: "easeIn" } },
};

export const listVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045 } },
};

export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: spring.soft },
};

export const press = { whileTap: { scale: 0.97 } } as const;
