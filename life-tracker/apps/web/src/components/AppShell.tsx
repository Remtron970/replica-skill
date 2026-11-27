import { AnimatePresence, motion } from "motion/react";
import { Ellipsis, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { GROUP_ORDER, SECTIONS, SECTION_BY_ID, type Section } from "../app/sections";
import { usePrefs } from "../lib/prefs";
import { Wordmark } from "./ui";

/** Desktop sidebar (≥1024px), tablet icon rail (768–1023px), phone bottom bar (<768px). */
export function AppShell() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 pt-safe pb-28 md:pb-10">
        <div className="mx-auto w-full max-w-5xl px-4 pt-5 md:px-8 md:pt-8">
          <Outlet />
        </div>
      </main>
      <TabBar onMore={() => setMoreOpen(true)} moreOpen={moreOpen} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}

function SidebarLink({ section, compact }: { section: Section; compact?: boolean }) {
  const Icon = section.icon;
  return (
    <NavLink
      to={section.path}
      end={section.path === "/"}
      title={section.label}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
          compact ? "justify-center lg:justify-start" : ""
        } ${isActive ? "text-brand" : "text-muted hover:bg-surface-2 hover:text-ink"}`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active"
              className="absolute inset-0 rounded-xl bg-brand-soft"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <Icon size={19} strokeWidth={2.1} className="relative" aria-hidden />
          <span className={`relative ${compact ? "hidden lg:inline" : ""}`}>{section.label}</span>
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
        <img
          src={`${import.meta.env.BASE_URL}icons/icon-192.png`}
          alt="Life Tracker"
          className="mx-auto h-10 w-10 rounded-[22%] lg:hidden"
        />
      </div>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto" aria-label="Sections">
        <SidebarLink section={SECTION_BY_ID.home} compact />
        {GROUP_ORDER.map((group) => (
          <div key={group}>
            <p className="mb-1 hidden px-3 text-[11px] font-semibold tracking-wider text-muted/80 uppercase lg:block">
              {group}
            </p>
            <div className="flex flex-col gap-0.5">
              {SECTIONS.filter((s) => s.group === group && s.id !== "home").map((s) => (
                <SidebarLink key={s.id} section={s} compact />
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-line pt-3">
        <SidebarLink section={SECTION_BY_ID.settings} compact />
      </div>
    </aside>
  );
}

function TabBar({ onMore, moreOpen }: { onMore: () => void; moreOpen: boolean }) {
  const { prefs } = usePrefs();
  const location = useLocation();
  const tabs = [SECTION_BY_ID.home, ...prefs.pins.map((id) => SECTION_BY_ID[id])];
  const onPinned = tabs.some((t) =>
    t.path === "/" ? location.pathname === "/" : location.pathname.startsWith(t.path),
  );

  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/85 backdrop-blur-xl md:hidden"
    >
      <div className="mx-auto grid max-w-lg grid-cols-5 px-2 pt-1.5">
        {tabs.map((s) => (
          <NavLink
            key={s.id}
            to={s.path}
            end={s.path === "/"}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-semibold ${
                isActive ? "text-brand" : "text-muted"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <motion.span animate={{ scale: isActive ? 1.1 : 1 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
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
          aria-expanded={moreOpen}
          className={`flex flex-col items-center gap-0.5 rounded-xl py-1.5 text-[10.5px] font-semibold ${
            !onPinned || moreOpen ? "text-brand" : "text-muted"
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/35 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="All sections"
            className="pb-safe fixed inset-x-0 bottom-0 z-50 rounded-t-[28px] bg-surface px-4 pt-3 shadow-2xl md:hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 90 && onClose()}
          >
            <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[17px] font-semibold">All sections</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-surface-2 p-2 text-muted"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 pb-4">
              {rest.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i }}
                >
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
