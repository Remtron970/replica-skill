import { motion } from "motion/react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Button, IconButton, Switch } from "../../components/ui";
import { spring } from "../../lib/motion";
import { usePrefs } from "../../lib/prefs";
import { DASHBOARD_SECTIONS, DEFAULT_DASHBOARD } from "../../lib/sync";

const LABEL = Object.fromEntries(DASHBOARD_SECTIONS.map((s) => [s.id, s.label]));

/** Reorder and show/hide Home sections. Saved to the profile (syncs across devices). */
export function CustomizeDashboard() {
  const { prefs, update } = usePrefs();
  const items = prefs.dashboard;

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    update({ dashboard: next });
  };

  const toggle = (i: number) => {
    const visibleCount = items.filter((x) => x.visible).length;
    if (items[i].visible && visibleCount === 1) return; // keep at least one section
    update({ dashboard: items.map((x, k) => (k === i ? { ...x, visible: !x.visible } : x)) });
  };

  return (
    <div>
      <p className="mb-3 text-[13.5px] text-muted">Change the order of Home sections or hide the ones you don't need.</p>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <motion.li layout transition={spring.snappy} key={item.id} className="flex items-center gap-2 rounded-2xl bg-surface-2/70 px-3 py-2">
            <div className="flex flex-col">
              <IconButton icon={ChevronUp} label={`Move ${LABEL[item.id]} up`} size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} />
              <IconButton icon={ChevronDown} label={`Move ${LABEL[item.id]} down`} size="sm" variant="ghost" disabled={i === items.length - 1} onClick={() => move(i, 1)} />
            </div>
            <div className="min-w-0 flex-1">
              <Switch checked={item.visible} onChange={() => toggle(i)} label={LABEL[item.id]} description={item.visible ? "Shown" : "Hidden"} />
            </div>
          </motion.li>
        ))}
      </ol>
      <div className="mt-3">
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={() => update({ dashboard: DEFAULT_DASHBOARD })}>
          Reset to default
        </Button>
      </div>
    </div>
  );
}
