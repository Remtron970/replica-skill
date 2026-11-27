import { MotionConfig } from "motion/react";
import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { Link, RouterProvider, createBrowserRouter, createHashRouter, createMemoryRouter, type RouteObject } from "react-router-dom";
import { SECTIONS } from "./app/sections";
import { AppShell } from "./components/AppShell";
import { SkeletonCard, ToastProvider } from "./components/ui";
import { HomePage } from "./features/home/HomePage";
import { SectionPage } from "./features/section/SectionPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { AuthProvider } from "./lib/auth";
import { PrefsProvider } from "./lib/prefs";
import { StoreProvider } from "./lib/store/StoreProvider";
import "./styles.css";

// Heavier screens (charts) load on first visit so the app opens fast.
const DesignPage = lazy(() => import("./features/design/DesignPage").then((m) => ({ default: m.DesignPage })));
const AccountPage = lazy(() => import("./features/account/AccountPage").then((m) => ({ default: m.AccountPage })));
const AcademicsPage = lazy(() => import("./features/academics/AcademicsPage").then((m) => ({ default: m.AcademicsPage })));
const CoursePage = lazy(() => import("./features/academics/CoursePage").then((m) => ({ default: m.CoursePage })));
const SchedulePage = lazy(() => import("./features/schedule/SchedulePage").then((m) => ({ default: m.SchedulePage })));
const AssignmentsPage = lazy(() => import("./features/assignments/AssignmentsPage").then((m) => ({ default: m.AssignmentsPage })));
const EmailPage = lazy(() => import("./features/email/EmailPage").then((m) => ({ default: m.EmailPage })));
const ImportPage = lazy(() => import("./features/academics/ImportPage").then((m) => ({ default: m.ImportPage })));

const page = (el: React.ReactNode) => <Suspense fallback={<PageLoading />}>{el}</Suspense>;

function PageLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-[24px] font-bold">Page not found</h1>
      <Link to="/" className="mt-3 inline-block font-semibold text-brand-ink">
        Back to Home
      </Link>
    </div>
  );
}

const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "account", element: page(<AccountPage />) },
      { path: "academics", element: page(<AcademicsPage />) },
      { path: "academics/import", element: page(<ImportPage />) },
      { path: "academics/:courseId", element: page(<CoursePage />) },
      { path: "schedule", element: page(<SchedulePage />) },
      { path: "assignments", element: page(<AssignmentsPage />) },
      { path: "email", element: page(<EmailPage />) },
      {
        path: "design",
        element: (
          <Suspense fallback={<PageLoading />}>
            <DesignPage />
          </Suspense>
        ),
      },
      ...SECTIONS.filter((s) => !["home", "settings", "academics", "schedule", "assignments", "email"].includes(s.id)).map((s) => ({
        path: s.path.slice(1),
        element: <SectionPage section={s} />,
      })),
      { path: "*", element: <NotFound /> },
    ],
  },
];

// Hash URLs (/#/academics) work on any static host with no server rewrites;
// set VITE_ROUTER=browser once hosting is configured for clean URLs.
// "memory" is used by the shareable preview build, where the host page owns the URL.
const router =
  import.meta.env.VITE_ROUTER === "browser"
    ? createBrowserRouter(routes)
    : import.meta.env.VITE_ROUTER === "memory"
      ? createMemoryRouter(routes)
      : createHashRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* reducedMotion="user": honors the iPhone's Reduce Motion setting everywhere. */}
    <MotionConfig reducedMotion="user">
      <AuthProvider>
        <PrefsProvider>
          <StoreProvider>
            <ToastProvider>
              <RouterProvider router={router} />
            </ToastProvider>
          </StoreProvider>
        </PrefsProvider>
      </AuthProvider>
    </MotionConfig>
  </StrictMode>,
);
