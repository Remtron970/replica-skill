import { motion } from "motion/react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { PINNABLE, SECTION_BY_ID } from "../../app/sections";
import { Card, PageHeader, PageTransition, StatusChip } from "../../components/ui";
import { MAX_PINS, usePrefs, type ThemePref } from "../../lib/prefs";

const THEMES: { id: ThemePref; label: string; icon: typeof Sun }[] = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
];

const COMING = [
  ["Account & sign-in", 3],
  ["School integrations", 4],
  ["Email integrations", 6],
  ["Health permissions", 7],
  ["Location for local news", 8],
  ["Calendar connections", 9],
  ["AI privacy controls", 10],
  ["Notification preferences", 11],
  ["Data export & delete account", 3],
] as const;

export function SettingsPage() {
  const s = SECTION_BY_ID.settings;
  const { prefs, update } = usePrefs();
  const [name, setName] = useState(prefs.name);
  const [saved, setSaved] = useState(false);

  const togglePin = (id: (typeof PINNABLE)[number]) => {
    const on = prefs.pins.includes(id);
    if (on) {
      if (prefs.pins.length > 1) update({ pins: prefs.pins.filter((p) => p !== id) });
    } else if (prefs.pins.length < MAX_PINS) {
      update({ pins: [...prefs.pins, id] });
    }
  };

  return (
    <PageTransition>
      <PageHeader title={s.label} subtitle={s.tagline} icon={s.icon} accent={s.accent} />

      <div className="space-y-4">
        <Card>
          <h2 className="mb-1 text-[16px] font-semibold">Profile</h2>
          <p className="mb-3 text-[13px] text-muted">Used for your greeting. Saved on this device for now.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              update({ name: name.trim().slice(0, 40) });
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1800);
            }}
          >
            <label htmlFor="name" className="sr-only">
              Your name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Your first name"
              autoComplete="given-name"
              className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-[15px] outline-none focus:border-brand"
            />
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="submit"
              className="rounded-xl bg-brand px-4 py-2.5 text-[14px] font-semibold text-white shadow-sm"
            >
              {saved ? "Saved ✓" : "Save"}
            </motion.button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-[16px] font-semibold">Appearance</h2>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => {
              const active = prefs.theme === t.id;
              return (
                <button
                  key={t.id}
                  role="radio"
                  aria-checked={active}
                  type="button"
                  onClick={() => update({ theme: t.id })}
                  className={`relative flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[14px] font-semibold ${
                    active ? "text-ink" : "text-muted"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="theme-pill"
                      className="absolute inset-0 rounded-xl bg-surface shadow-card"
                      transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    />
                  )}
                  <t.icon size={16} className="relative" aria-hidden />
                  <span className="relative">{t.label}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-1 text-[16px] font-semibold">Phone tab bar</h2>
          <p className="mb-3 text-[13px] text-muted">
            Choose up to {MAX_PINS} sections next to Home. Everything else is under "More".
          </p>
          <div className="flex flex-wrap gap-2">
            {PINNABLE.map((id) => {
              const sec = SECTION_BY_ID[id];
              const on = prefs.pins.includes(id);
              const disabled = !on && prefs.pins.length >= MAX_PINS;
              return (
                <motion.button
                  key={id}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => togglePin(id)}
                  aria-pressed={on}
                  disabled={disabled}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                    on
                      ? "border-brand bg-brand text-white"
                      : "border-line bg-surface text-muted hover:text-ink disabled:opacity-40"
                  }`}
                >
                  <sec.icon size={14} aria-hidden />
                  {sec.label}
                </motion.button>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-[16px] font-semibold">Coming next</h2>
          <ul className="divide-y divide-line">
            {COMING.map(([label, phase]) => (
              <li key={label} className="flex items-center justify-between py-2.5 text-[14px]">
                {label}
                <StatusChip>Phase {phase}</StatusChip>
              </li>
            ))}
          </ul>
        </Card>

        <p className="pt-2 text-center text-[12px] text-muted">Life Tracker · preview 0.1.0</p>
      </div>
    </PageTransition>
  );
}
