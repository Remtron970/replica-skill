import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Link, RouterProvider, createBrowserRouter, createHashRouter, type RouteObject } from "react-router-dom";
import { SECTIONS } from "./app/sections";
import { AppShell } from "./components/AppShell";
import { PageTransition } from "./components/ui";
import { HomePage } from "./features/home/HomePage";
import { SectionPage } from "./features/section/SectionPage";
import { SettingsPage } from "./features/settings/SettingsPage";
import { PrefsProvider } from "./lib/prefs";
import "./styles.css";

function NotFound() {
  return (
    <PageTransition>
      <div className="py-20 text-center">
        <h1 className="text-[24px] font-bold">Page not found</h1>
        <Link to="/" className="mt-3 inline-block font-semibold text-brand">
          Back to Home
        </Link>
      </div>
    </PageTransition>
  );
}

const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "settings", element: <SettingsPage /> },
      ...SECTIONS.filter((s) => s.id !== "home" && s.id !== "settings").map((s) => ({
        path: s.path.slice(1),
        element: <SectionPage section={s} />,
      })),
      { path: "*", element: <NotFound /> },
    ],
  },
];

// Hash URLs (/#/academics) work on any static host with no server rewrites;
// set VITE_ROUTER=browser once hosting is configured for clean URLs.
const router =
  import.meta.env.VITE_ROUTER === "browser" ? createBrowserRouter(routes) : createHashRouter(routes);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrefsProvider>
      <RouterProvider router={router} />
    </PrefsProvider>
  </StrictMode>,
);
