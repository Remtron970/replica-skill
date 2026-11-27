import { motion } from "motion/react";
import { Check, Hammer } from "lucide-react";
import type { Section } from "../../app/sections";
import { Card, PageHeader, PageTransition, StatusChip } from "../../components/ui";

/**
 * Placeholder for a section whose features arrive in a later phase.
 * It states plainly what will be built and when; it shows no fake data.
 */
export function SectionPage({ section }: { section: Section }) {
  const Icon = section.icon;
  return (
    <PageTransition>
      <PageHeader title={section.label} subtitle={section.tagline} icon={section.icon} accent={section.accent} />

      <Card className="mb-4 overflow-hidden">
        <div className="flex flex-col items-center px-2 py-8 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18, delay: 0.05 }}
            className={`mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] ${section.accent}`}
          >
            <Icon size={30} aria-hidden />
          </motion.div>
          <StatusChip tone="brand">
            <Hammer size={12} aria-hidden /> Built in Phase {section.phase}
          </StatusChip>
          <h2 className="mt-3 text-[19px] font-semibold">Not set up yet</h2>
          <p className="mt-1 max-w-sm text-[14px] text-muted">
            This screen is a placeholder so you can try the navigation. It doesn't show sample data.
          </p>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 text-[15px] font-semibold">What's planned</h3>
        <ul className="space-y-2.5">
          {section.planned.map((p, i) => (
            <motion.li
              key={p}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.04 }}
              className="flex items-start gap-2.5 text-[14px]"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted">
                <Check size={12} strokeWidth={3} aria-hidden />
              </span>
              {p}
            </motion.li>
          ))}
        </ul>
      </Card>
    </PageTransition>
  );
}
