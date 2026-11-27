import { CheckCircle2, Download, Share, SquarePlus } from "lucide-react";
import { useInstall } from "../lib/install";
import { Badge, Button } from "./ui";

/** How to install Life Tracker on this device. */
export function InstallCard() {
  const { installed, ios, canPrompt, prompt } = useInstall();

  if (installed) {
    return (
      <p className="flex items-center gap-2 text-[14px]">
        <CheckCircle2 size={18} className="text-accent-green" aria-hidden />
        Installed on this device.
      </p>
    );
  }

  if (ios) {
    return (
      <ol className="space-y-2.5 text-[14px]">
        <Step n={1}>
          Open this page in <strong>Safari</strong>.
        </Step>
        <Step n={2}>
          Tap <Share size={15} className="inline -translate-y-px text-accent-blue" aria-label="Share" /> <strong>Share</strong>.
        </Step>
        <Step n={3}>
          Choose <SquarePlus size={15} className="inline -translate-y-px" aria-hidden /> <strong>Add to Home Screen</strong>, then{" "}
          <strong>Add</strong>.
        </Step>
      </ol>
    );
  }

  if (canPrompt) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Button icon={Download} onClick={prompt}>
          Install Life Tracker
        </Button>
        <span className="text-[13px] text-muted">Opens in its own window, works offline.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2 text-[14px] text-muted">
      <p>
        On iPhone: open in Safari → Share → <strong className="text-ink">Add to Home Screen</strong>.
      </p>
      <p>
        On a computer: use Chrome or Edge and choose <strong className="text-ink">Install</strong> in the address bar.
      </p>
      <Badge>Not installed</Badge>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="tabular flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[12px] font-bold text-brand-ink">
        {n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
