import { motion } from "motion/react";
import { Check, Hammer } from "lucide-react";
import type { Section } from "../../app/sections";
import { Badge, Card, EmptyState, PageHeader } from "../../components/ui";

/**
 * Placeholder for a section whose features arrive in a later phase.
 * It states plainly what will be built and when; it shows no fake data.
 */
export function SectionPage({ section }: { section: Section }) {
  return (
    <>
      <PageHeader title={section.label} subtitle={section.tagline} icon={section.icon} accent={section.accent} />

      <Card className="mb-4">
        <EmptyState
          icon={section.icon}
          accent={section.accent}
          title="Not set up yet"
          body="This screen is a placeholder so you can try the navigation. It doesn't show sample data."
          badge={
            <Badge tone="brand" icon={Hammer}>
              Built in Phase {section.phase}
            </Badge>
          }
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-[15px] font-semibold">What's planned</h2>
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
    </>
  );
}
