import {
  CalendarDays,
  ClipboardList,
  Clock,
  GraduationCap,
  HeartPulse,
  House,
  ListChecks,
  Mail,
  Newspaper,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type SectionId =
  | "home"
  | "academics"
  | "schedule"
  | "assignments"
  | "email"
  | "health"
  | "news"
  | "calendar"
  | "productivity"
  | "ai"
  | "settings";

export type SectionGroup = "Today" | "School" | "Life" | "Assistant" | "System";

export interface Section {
  id: SectionId;
  path: string;
  label: string;
  icon: LucideIcon;
  /** Tailwind text/bg classes for the section's accent chip. */
  accent: string;
  group: SectionGroup;
  tagline: string;
  /** Roadmap phase that delivers this section's full functionality. */
  phase: number;
  planned: string[];
}

export const SECTIONS: Section[] = [
  {
    id: "home",
    path: "/",
    label: "Home",
    icon: House,
    accent: "text-brand bg-brand-soft",
    group: "Today",
    tagline: "Everything happening in your life, at a glance.",
    phase: 3,
    planned: [],
  },
  {
    id: "schedule",
    path: "/schedule",
    label: "Schedule",
    icon: Clock,
    accent: "text-accent-blue bg-accent-blue/12",
    group: "Today",
    tagline: "Your classes, times, rooms and the countdown to the next one.",
    phase: 5,
    planned: [
      "Weekly and rotating (A/B, block) schedules",
      "Daily timeline with the current class highlighted",
      "Countdown to your next class",
      "Teachers and room locations",
      "Manual editing plus sync from Google Classroom / Canvas",
    ],
  },
  {
    id: "calendar",
    path: "/calendar",
    label: "Calendar",
    icon: CalendarDays,
    accent: "text-accent-yellow bg-accent-yellow/15",
    group: "Today",
    tagline: "Classes, assignments, events and reminders in one calendar.",
    phase: 9,
    planned: [
      "Day, week and month views",
      "Create your own events and reminders",
      "Google Calendar sync",
      "Apple Calendar via the iPhone app or a shared calendar link",
    ],
  },
  {
    id: "academics",
    path: "/academics",
    label: "Academics",
    icon: GraduationCap,
    accent: "text-accent-purple bg-accent-purple/12",
    group: "School",
    tagline: "Grades, GPA and how every class is trending.",
    phase: 4,
    planned: [
      "Class cards with percentage, letter grade and missing work",
      "Weighted and unweighted GPA, semester and cumulative",
      "Configurable grading scales",
      "Grade history charts",
      "What-if calculator",
      "Google Classroom and Canvas sync, manual entry and spreadsheet import",
    ],
  },
  {
    id: "assignments",
    path: "/assignments",
    label: "Assignments",
    icon: ClipboardList,
    accent: "text-brand bg-brand-soft",
    group: "School",
    tagline: "Every deadline, sorted by what's due next.",
    phase: 5,
    planned: [
      "Due today, tomorrow, this week, upcoming, overdue and completed",
      "Priorities, descriptions and grades received",
      "Create and edit your own assignments",
      "Imported automatically from connected school platforms",
      "Custom deadline reminders",
    ],
  },
  {
    id: "email",
    path: "/email",
    label: "Email",
    icon: Mail,
    accent: "text-accent-blue bg-accent-blue/12",
    group: "Life",
    tagline: "Yesterday's email, summarized and sorted.",
    phase: 6,
    planned: [
      "Read-only Gmail connection (can't send or delete)",
      "Important, School, Personal, Notifications and Other",
      "AI summaries: deadlines, replies needed, school info",
      "Daily email recap",
      "Open the original in Gmail",
    ],
  },
  {
    id: "health",
    path: "/health",
    label: "Health",
    icon: HeartPulse,
    accent: "text-accent-green bg-accent-green/12",
    group: "Life",
    tagline: "Steps, activity and weight, presented neutrally.",
    phase: 7,
    planned: [
      "Daily, weekly and monthly steps",
      "Walking and running distance, active energy, exercise minutes",
      "Weight history (only if you allow it)",
      "Apple Health via an iOS Shortcut or the optional iPhone app",
      "Manual entry",
    ],
  },
  {
    id: "news",
    path: "/news",
    label: "News",
    icon: Newspaper,
    accent: "text-accent-red bg-accent-red/12",
    group: "Life",
    tagline: "World and local news from reputable sources.",
    phase: 8,
    planned: [
      "World, technology, science, business, politics and sports",
      "Local news and weather alerts for the city you choose",
      "Developing stories labeled as developing",
      "Source, time and a link to every original article",
    ],
  },
  {
    id: "productivity",
    path: "/productivity",
    label: "Productivity",
    icon: ListChecks,
    accent: "text-accent-green bg-accent-green/12",
    group: "Life",
    tagline: "Tasks, habits, goals and streaks.",
    phase: 9,
    planned: [
      "Daily tasks and weekly goals",
      "Habit tracking with streaks",
      "Progress charts and milestones",
    ],
  },
  {
    id: "ai",
    path: "/ai",
    label: "AI",
    icon: Sparkles,
    accent: "text-brand bg-brand-soft",
    group: "Assistant",
    tagline: "Ask about your day, grades, email and more.",
    phase: 10,
    planned: [
      "Chat that reads only the sections you allow",
      "Answers combine schedule, assignments, email and reminders",
      "Says clearly when a source isn't connected — never makes data up",
      "Daily planning and weekly summaries",
    ],
  },
  {
    id: "settings",
    path: "/settings",
    label: "Settings",
    icon: Settings,
    accent: "text-muted bg-surface-2",
    group: "System",
    tagline: "Profile, appearance, connections and privacy.",
    phase: 3,
    planned: [],
  },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s])) as Record<
  SectionId,
  Section
>;

export const GROUP_ORDER: SectionGroup[] = ["Today", "School", "Life", "Assistant"];

/** Sections that can be pinned to the phone's bottom bar (Home is always first). */
export const PINNABLE: SectionId[] = SECTIONS.filter(
  (s) => s.id !== "home" && s.id !== "settings",
).map((s) => s.id);

export const DEFAULT_PINS: SectionId[] = ["academics", "assignments", "ai"];
