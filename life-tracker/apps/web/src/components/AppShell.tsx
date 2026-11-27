import { AnimatePresence, motion } from "motion/react";
import { Ellipsis } from "lucide-react";
import { cloneElement, useEffect, useState } from "react";
import { NavLink, useLocation, useOutlet } from "react-router-dom";
import { GROUP_ORDER, SECTIONS, SECTION_BY_ID, type Section } from "../app/sections";
import { pageVariants, spring } from "../lib/motion";
import { usePrefs } from "../lib/prefs";
import { Logo, Wordmark } from "./Brand";
import { Sheet } from "./ui";
import { UpdatePrompt } from "./UpdatePrompt";
import { AssignmentReminders } from "../features/assignments/Reminders";

const IS_PREVIEW = import.meta.env.VITE_PREVIEW === "1";

/** Desktop sidebar (≥1024px), tablet icon rail (768–1023px), phone bottom bar (<768px). */
export function AppShell() {
  const location = useLocation();
  const outlet = useOutlet();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh md:flex">
      <a
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
        className="fixed top-2 left-2 z-[70] -translate-y-20 rounded-xl bg-brand-strong px-4 py-2 font-semibold text-on-brand focus-visible:translate-y-0"
      >
        Skip to content
      </a>
      <Sidebar />
      <main id="main" tabIndex={-1} className="min-w-0 flex-1 pt-safe pb-28 outline-none md:pb-10">
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 md:px-8 md:pt-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={location.pathname} variants={pageVariants} initial="initial" animate="enter" exit="exit">
              {outlet && cloneElement(outlet)}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <TabBar onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      {!IS_PREVIEW && <UpdatePrompt />}
      <AssignmentReminders />
    </div>
  );
}

function SidebarLink({ section }: { section: Section }) {
  const Icon = section.icon;
  return (
    <NavLink
      to={section.path}
      end={section.path === "/"}
      aria-label={section.label}
      className={({ isActive }) =>
        `relative flex items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors lg:justify-start ${
          isActive ? "text-brand-ink" : "text-muted hover:bg-surface-2 hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="sidebar-active" className="absolute inset-0 rounded-xl bg-brand-soft" transition={spring.snappy} />
          )}
          <Icon size={19} strokeWidth={2.1} className="relative" aria-hidden />
          <span className="relative hidden lg:inline">{section.label}</span>
        </>
      )}
    </NavLink>
  );
}

function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col border-r border-line bg-surface/70 px-3 py-5 backdrop-blur md:flex lg:w-64">
      <div className="mb-6 px-1">
        <div className="hidden lg:block">
          <Wordmark />
        </div>
        <div className="flex justify-center lg:hidden">
          <Logo size={40} />
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto" aria-label="Sections">
        <SidebarLink section={SECTION_BY_ID.home} />
        {GROUP_ORDER.map((group) => (
          <div key={group} role="group" aria-label={group}>
            <p className="mb-1 hidden px-3 text-[11px] font-semibold tracking-wider text-muted uppercase lg:block" aria-hidden>
              {group}
            </p>
            <div className="flex flex-col gap-0.5">
              {SECTIONS.filter((s) => s.group === group && s.id !== "home").map((s) => (
                <SidebarLink key={s.id} section={s} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line pt-3">
        <SidebarLink section={SECTION_BY_ID.settings} />
      </div>
    </aside>
  );
}

function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { prefs } = usePrefs();
  const location = useLocation();
  const tabs = [SECTION_BY_ID.home, ...prefs.pins.map((id) => SECTION_BY_ID[id])];
  const onPinned = tabs.some((t) => (t.path === "/" ? location.pathname === "/" : location.pathname.startsWith(t.path)));

  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2 pt-1.5">
        {tabs.map((s) => (
          <NavLink
            key={s.id}
            to={s.path}
            end={s.path === "/"}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-semibold ${isActive ? "text-brand-ink" : "text-muted"}`
            }
          >
            {({ isActive }) => (
              <>
                <motion.span animate={{ scale: isActive ? 1.1 : 1 }} transition={spring.snappy}>
                  <s.icon size={22} strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                </motion.span>
                {s.label}
              </>
            )}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={onMore}
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-semibold ${
            !onPinned || moreOpen ? "text-brand-ink" : "text-muted"
          }`}
        >
          <Ellipsis size={22} aria-hidden />
          More
        </button>
      </div>
    </nav>
  );
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs } = usePrefs();
  const rest = SECTIONS.filter((s) => s.id !== "home" && !prefs.pins.includes(s.id));
  return (
    <Sheet open={open} onClose={onClose} title="All sections" mobileOnly>
      <div className="grid grid-cols-3 gap-2">
        {rest.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}>
            <NavLink
              to={s.path}
              className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2/60 px-2 py-3.5 text-[12.5px] font-semibold active:scale-95"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${s.accent}`}>
                <s.icon size={21} aria-hidden />
              </span>
              {s.label}
            </NavLink>
          </motion.div>
        ))}
      </div>
    </Sheet>
  );
}
