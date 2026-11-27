// End-to-end smoke test against the production build.
//   npm run build && npm run smoke            (SHOTS=dir to save screenshots)
// Checks: every route renders on phone + desktop, axe accessibility scan
// (light + dark), navigation, settings persistence, dialog focus handling,
// toasts, and that the installed app shell opens offline.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const axeSource = readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const SHOTS = process.env.SHOTS;
const PORT = 4173;
const URL = `http://localhost:${PORT}/`;
const ROUTES = ["", "academics", "schedule", "assignments", "email", "health", "news", "calendar", "productivity", "ai", "settings", "design"];

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) failures++;
};

// Run Vite's own binary (not via npx) so killing it really stops the server.
const viteBin = path.join(root, "node_modules/vite/bin/vite.js");
const server = spawn(process.execPath, [viteBin, "preview", "--port", String(PORT), "--strictPort"], { cwd: root, stdio: "ignore" });
const stop = () => server.kill();
process.on("exit", stop);

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("preview server did not start");
}

async function axe(page) {
  await page.evaluate(axeSource);
  const res = await page.evaluate(() =>
    // eslint-disable-next-line no-undef
    axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }),
  );
  return res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
}

async function settle(page, ms = 500) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

await waitForServer();
const browser = await chromium.launch();
const errors = [];
const watch = (page, tag) => {
  page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${tag}: ${m.text()}`));
};

try {
  for (const scheme of ["light", "dark"]) {
    console.log(`\nPhone (${scheme})`);
    const ctx = await browser.newContext({ ...devices["iPhone 15"], colorScheme: scheme });
    const p = await ctx.newPage();
    watch(p, `phone-${scheme}`);
    for (const r of ROUTES) {
      await p.goto(`${URL}#/${r}`);
      await settle(p, 900);
      const h1 = (await p.locator("h1").first().innerText()).split("\n")[0];
      const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const v = await axe(p);
      ok(!!h1 && !overflow && v.length === 0, `/${r} → "${h1}"${overflow ? " HORIZONTAL SCROLL" : ""}${v.length ? " a11y: " + v.map((x) => `${x.id} (${x.nodes.length})`).join(", ") : ""}`);
      if (v.length) for (const x of v) for (const n of x.nodes.slice(0, 3)) console.log(`      ${x.id}: ${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim()}`);
      if (SHOTS && ["", "settings", "design", "academics"].includes(r))
        await p.screenshot({ path: `${SHOTS}/phone-${scheme}-${r || "home"}.png`, fullPage: r !== "design" });
    }
    await ctx.close();
  }

  console.log("\nPhone interactions");
  const ctx = await browser.newContext({ ...devices["iPhone 15"], colorScheme: "light" });
  const p = await ctx.newPage();
  watch(p, "phone");
  await p.goto(URL);
  await settle(p);
  await p.getByRole("button", { name: /Current GPA/ }).click();
  await settle(p, 300);
  ok(p.url().endsWith("#/academics"), "stat card opens Academics");
  await p.getByRole("navigation", { name: "Main" }).getByText("Assignments").click();
  await settle(p, 300);
  ok(p.url().endsWith("#/assignments"), "tab bar opens Assignments");
  await p.getByRole("button", { name: "More" }).click();
  await p.waitForTimeout(500);
  ok(await p.getByRole("dialog", { name: "All sections" }).isVisible(), "More sheet opens");
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/phone-more.png` });
  await p.keyboard.press("Escape");
  ok(await p.getByRole("dialog").waitFor({ state: "detached", timeout: 1000 }).then(() => true, () => false), "Escape closes the sheet");
  await p.getByRole("button", { name: "More" }).click();
  await p.waitForTimeout(400);
  await p.getByRole("dialog").getByText("Settings").click();
  await settle(p, 300);
  ok(p.url().endsWith("#/settings"), "More → Settings");
  await p.fill("#name", "Remy");
  await p.getByRole("button", { name: "Save" }).click();
  await p.waitForTimeout(300);
  ok(await p.getByText("Nice to meet you, Remy!").isVisible(), "save shows a toast");
  await p.getByRole("radio", { name: "Dark" }).click();
  await p.getByRole("button", { name: "AI", pressed: true }).click();
  await p.getByRole("button", { name: "Health", pressed: false }).click();
  await p.reload();
  await settle(p, 300);
  ok(await p.evaluate(() => document.documentElement.classList.contains("dark")), "theme persists after reload");
  ok((await p.inputValue("#name")) === "Remy", "name persists after reload");
  ok((await p.getByRole("navigation", { name: "Main" }).innerText()).includes("Health"), "pinned tab appears in tab bar");
  await p.goto(URL);
  await settle(p);
  ok((await p.locator("h1").first().innerText()).includes("Remy"), "greeting uses saved name");
  await ctx.close();

  console.log("\nDesktop");
  const d = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "light" })).newPage();
  watch(d, "desktop");
  await d.goto(URL);
  await settle(d);
  if (SHOTS) await d.screenshot({ path: `${SHOTS}/desktop-home.png` });
  await d.getByRole("navigation", { name: "Sections" }).getByRole("link", { name: "Health" }).click();
  await settle(d, 300);
  ok(d.url().endsWith("#/health"), "sidebar opens Health");
  await d.goto(`${URL}#/design`);
  await settle(d, 1200);
  if (SHOTS) await d.screenshot({ path: `${SHOTS}/desktop-design.png`, fullPage: true });
  ok((await d.locator("figure[role=img]").count()) >= 4, "design page renders 4 charts");
  await d.getByRole("button", { name: "Open dialog" }).click();
  await d.waitForTimeout(400);
  const dlg = d.getByRole("dialog", { name: "Disconnect Gmail?" });
  ok(await dlg.isVisible(), "dialog opens");
  ok(await d.evaluate(() => !!document.activeElement?.closest("[role=dialog]")), "focus moves into dialog");
  for (let i = 0; i < 5; i++) await d.keyboard.press("Tab");
  ok(await d.evaluate(() => !!document.activeElement?.closest("[role=dialog]")), "Tab stays inside dialog");
  await d.keyboard.press("Escape");
  ok(await dlg.waitFor({ state: "detached", timeout: 1000 }).then(() => true, () => false), "Escape closes dialog");
  ok(await d.evaluate(() => document.activeElement?.textContent === "Open dialog"), "focus returns to the opener");
  await d.getByRole("button", { name: "Show notification" }).click();
  await d.waitForTimeout(400);
  ok(await d.getByText("Biology lab due tomorrow").isVisible(), "notification toast appears");

  console.log("\nOffline");
  const octx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const o = await octx.newPage();
  watch(o, "offline");
  await o.goto(URL);
  await o.evaluate(() => navigator.serviceWorker.ready);
  await o.reload(); // now controlled by the service worker
  await settle(o, 500);
  ok(await o.evaluate(() => !!navigator.serviceWorker.controller), "service worker controls the page");
  await octx.setOffline(true);
  await o.reload();
  await settle(o, 500);
  ok((await o.locator("h1").first().innerText()).length > 0, "app opens with no network");
  await o.goto(`${URL}#/settings`);
  await settle(o, 300);
  ok((await o.locator("h1").first().innerText()) === "Settings", "navigation works offline");
  await octx.close();

  const real = errors.filter((e) => !/Failed to load resource/.test(e) || !/offline/.test(e));
  console.log("");
  ok(real.length === 0, `no console errors${real.length ? ":\n    " + real.join("\n    ") : ""}`);
} finally {
  await browser.close();
  stop();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
