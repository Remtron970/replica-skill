import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { IconChip } from "./Card";

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
      <div className="flex min-w-0 items-center gap-3">
        {icon && accent && <IconChip icon={icon} accent={accent} />}
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-bold tracking-tight md:text-[32px]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[15px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {right}
    </header>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[17px] font-semibold">{children}</h2>
      {right}
    </div>
  );
}
