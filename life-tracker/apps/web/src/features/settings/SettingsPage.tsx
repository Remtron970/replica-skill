import { CloudOff, LayoutDashboard, Monitor, Moon, Palette, Smartphone, Sun, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PINNABLE, SECTION_BY_ID } from "../../app/sections";
import { InstallCard } from "../../components/InstallCard";
import { Badge, Button, Chip, IconChip, ListRow, PageHeader, SectionCard, SegmentedControl, Sheet, Switch, TextField, useToast } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { CustomizeDashboard } from "../home/CustomizeDashboard";
import { SchoolConnections } from "./SchoolConnections";
import { MAX_PINS, usePrefs, type ThemePref } from "../../lib/prefs";

const COMING = [
  ["Location for local news", 8],
  ["Calendar connections", 9],
  ["AI privacy controls", 10],
  ["Notification preferences", 11],
] as const;

export function SettingsPage() {
  const s = SECTION_BY_ID.settings;
  const { prefs, update } = usePrefs();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(prefs.name);
  // Follow changes that arrive from another device.
  useEffect(() => setName(prefs.name), [prefs.name]);
  const [customizing, setCustomizing] = useState(false);
  const auth = useAuth();

  const togglePin = (id: (typeof PINNABLE)[number]) => {
    const on = prefs.pins.includes(id);
    if (on) {
      if (prefs.pins.length > 1) update({ pins: prefs.pins.filter((p) => p !== id) });
    } else if (prefs.pins.length < MAX_PINS) {
      update({ pins: [...prefs.pins, id] });
    }
  };

  return (
    <>
      <PageHeader title={s.label} subtitle={s.tagline} icon={s.icon} accent={s.accent} />

      <div className="space-y-4">
        <SectionCard title="Account" icon={UserRound} accent="bg-brand-soft text-brand-ink">
          <ListRow
            icon={!auth.enabled ? <IconChip icon={CloudOff} accent="bg-surface-2 text-muted" size="sm" /> : undefined}
            title={!auth.enabled ? "Cloud sync not set up yet" : auth.user ? (auth.user.email ?? "Signed in") : "Not signed in"}
            subtitle={
              !auth.enabled
                ? "Settings are saved on this device."
                : auth.user
                  ? "Settings sync across your devices. Export or delete your data here."
                  : "Sign in to sync settings across your iPhone and computer."
            }
            trailing={auth.user ? <Badge tone="success">Synced</Badge> : undefined}
            onClick={() => navigate("/account")}
          />
        </SectionCard>

        <SchoolConnections />

        <SectionCard title="Profile" subtitle="Used for your greeting. Saved on this device until sign-in arrives (Phase 3).">
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const clean = name.trim().slice(0, 40);
              update({ name: clean });
              setName(clean);
              toast({ tone: "success", title: clean ? `Nice to meet you, ${clean}!` : "Name cleared" });
            }}
          >
            <div className="flex-1">
              <TextField id="name" label="Your first name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Sam" autoComplete="given-name" />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </SectionCard>

        <SectionCard title="Appearance">
          <SegmentedControl<ThemePref>
            label="Theme"
            value={prefs.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "system", label: "System", icon: Monitor },
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
            ]}
          />
        </SectionCard>

        <SectionCard title="Home" icon={LayoutDashboard} accent="bg-accent-blue/10 text-accent-blue">
          <div className="space-y-4">
            <Switch
              checked={prefs.demo}
              onChange={(demo) => {
                update({ demo });
                toast({ tone: "info", title: demo ? "Demo mode on" : "Demo mode off", body: demo ? "Home now shows labeled sample data." : "Home shows only your real data." });
              }}
              label="Demo mode"
              description="Preview Home with clearly labeled sample data."
            />
            <Button variant="secondary" icon={LayoutDashboard} onClick={() => setCustomizing(true)}>
              Customize Home sections
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Phone tab bar" subtitle={`Choose up to ${MAX_PINS} sections next to Home. Everything else is under "More".`}>
          <div className="flex flex-wrap gap-2">
            {PINNABLE.map((id) => {
              const sec = SECTION_BY_ID[id];
              const on = prefs.pins.includes(id);
              return (
                <Chip key={id} icon={sec.icon} selected={on} disabled={!on && prefs.pins.length >= MAX_PINS} onClick={() => togglePin(id)}>
                  {sec.label}
                </Chip>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Install on your devices" icon={Smartphone} accent="bg-accent-blue/10 text-accent-blue">
          <InstallCard />
        </SectionCard>

        <SectionCard title="Coming next">
          <ul className="divide-y divide-line">
            {COMING.map(([label, phase]) => (
              <li key={label}>
                <ListRow title={label} trailing={<Badge>Phase {phase}</Badge>} />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="About">
          <ListRow
            icon={<IconChip icon={Palette} accent="bg-brand-soft text-brand-ink" size="sm" />}
            title="Design system"
            subtitle="Every component, color and animation used in Life Tracker"
            onClick={() => navigate("/design")}
          />
          <p className="pt-2 text-[12px] text-muted">Life Tracker · version {__APP_VERSION__}</p>
        </SectionCard>
      </div>
      <Sheet open={customizing} onClose={() => setCustomizing(false)} title="Customize Home">
        <CustomizeDashboard />
      </Sheet>
    </>
  );
}
