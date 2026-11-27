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
const ROUTES = ["", "academics", "schedule", "assignments", "email", "health", "news", "calendar", "productivity", "ai", "settings", "account", "design"];
const CLOUD_PORT = 4175;

let failures = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${msg}`);
  if (!cond) failures++;
};

// Run Vite's own binary (not via npx) so killing it really stops the server.
const viteBin = path.join(root, "node_modules/vite/bin/vite.js");
const server = spawn(process.execPath, [viteBin, "preview", "--port", String(PORT), "--strictPort"], { cwd: root, stdio: "ignore" });
// Second build with cloud sync configured against a simulated Supabase API (see "Cloud" below).
const cloudServer = spawn(process.execPath, [viteBin, "preview", "--port", String(CLOUD_PORT), "--strictPort", "--outDir", "dist-cloud", "--bypass-lock"], { cwd: root, stdio: "ignore" });
const stop = () => { server.kill(); cloudServer.kill(); };
process.on("exit", stop);

async function waitForServer(url = URL) {
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(url)).ok) return;
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

// ---------------------------------------------------------------------------
// Simulated Supabase (Auth + PostgREST) — enough of the real API shapes to
// exercise sign-in, profile sync and account deletion end to end.
// ---------------------------------------------------------------------------
const SB = "https://test-project.supabase.co";
async function cloudChecks() {
  const USER = { id: "8b0f7a52-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "remy@example.com", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
  const calls = [];
  let row = {
    id: USER.id,
    display_name: "From Cloud",
    timezone: "UTC",
    theme: "dark",
    nav_pins: ["news", "health"],
    dashboard_layout: [{ id: "important", visible: true }],
    demo_mode: false,
    prefs_updated_at: "2026-11-01T00:00:00Z",
  };
  const ctx = await browser.newContext({ ...devices["iPhone 15"], serviceWorkers: "block" });
  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const u = new globalThis.URL(req.url());
    const body = req.postData() ? JSON.parse(req.postData()) : undefined;
    calls.push({ method: req.method(), path: u.pathname + u.search, body, auth: req.headers()["authorization"], apikey: req.headers()["apikey"] });
    const json = (status, data, headers = {}) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*", ...headers }, body: data === undefined ? "" : JSON.stringify(data) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (u.pathname === "/auth/v1/otp") return json(200, {});
    if (u.pathname === "/auth/v1/verify") {
      if (body?.token !== "123456") return json(403, { code: "otp_expired", error_code: "otp_expired", msg: "Token has expired or is invalid" });
      const now = Math.floor(Date.now() / 1000);
      return json(200, { access_token: "test-access", token_type: "bearer", expires_in: 3600, expires_at: now + 3600, refresh_token: "test-refresh", user: USER });
    }
    if (u.pathname === "/auth/v1/user") return json(200, USER);
    if (u.pathname === "/auth/v1/logout") return json(204);
    if (u.pathname === "/rest/v1/profiles" && req.method() === "GET") {
      const wantsObject = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
      return json(200, wantsObject ? row : [row]);
    }
    if (u.pathname === "/rest/v1/profiles" && req.method() === "PATCH") {
      row = { ...row, ...body };
      return json(204);
    }
    if (u.pathname === "/rest/v1/rpc/delete_my_account") return json(204);
    return json(404, { message: "not mocked" });
  });

  const c = await ctx.newPage();
  watch(c, "cloud");
  const CURL = `http://localhost:${CLOUD_PORT}/`;
  await c.goto(`${CURL}#/settings`);
  await settle(c);
  await c.fill("#name", "Local Remy");
  await c.getByRole("button", { name: "Save", exact: true }).click(); // local change made after the cloud copy → local should win
  await c.getByRole("button", { name: /Not signed in/ }).click();
  await settle(c, 300);
  await c.getByRole("textbox", { name: "Email" }).fill("not-an-email");
  await c.getByRole("button", { name: "Email me a code" }).click();
  ok(await c.getByText("Enter a valid email address.").isVisible(), "rejects an invalid email before calling the server");
  await c.getByRole("textbox", { name: "Email" }).fill("Remy@Example.com");
  await c.getByRole("button", { name: "Email me a code" }).click();
  await c.getByRole("textbox", { name: "Code" }).waitFor({ timeout: 3000 });
  const otp = calls.find((x) => x.path.startsWith("/auth/v1/otp"));
  ok(otp?.body?.email === "remy@example.com" && otp?.apikey === "test-anon-key", "sends a sign-in code to the normalized email with the public key");
  await c.getByRole("textbox", { name: "Code" }).fill("000000");
  await c.getByRole("button", { name: "Verify and sign in" }).click();
  ok(await c.getByText(/wrong or has expired/).waitFor({ timeout: 3000 }).then(() => true, () => false), "wrong code shows a helpful error");
  await c.getByRole("textbox", { name: "Code" }).fill("123456");
  await c.getByRole("button", { name: "Verify and sign in" }).click();
  await c.waitForURL(/#\/$/, { timeout: 4000 }).catch(() => {});
  await settle(c, 1500);
  ok(c.url().endsWith("#/"), "verified code signs in and returns Home");
  const patch1 = calls.find((x) => x.method === "PATCH");
  ok(patch1?.body?.display_name === "Local Remy" && patch1?.auth === "Bearer test-access", "newer device settings are pushed to the profile (authorized as the user)");
  ok(patch1?.path.includes(`id=eq.${USER.id}`), "update targets only the user's own row");

  await c.goto(`${CURL}#/settings`);
  await settle(c, 500);
  await c.getByRole("radio", { name: "Light" }).click();
  await c.waitForTimeout(1500);
  ok(row.theme === "light" && Date.parse(row.prefs_updated_at) > Date.parse("2026-11-02"), "changing a setting syncs it to the cloud");

  // Another device changed things more recently → this device takes the cloud copy.
  row = { ...row, display_name: "Changed Elsewhere", theme: "dark", prefs_updated_at: new Date(Date.now() + 60_000).toISOString() };
  await c.reload();
  await settle(c, 1500);
  ok((await c.inputValue("#name")) === "Changed Elsewhere", "newer cloud settings replace older device settings");
  ok(await c.evaluate(() => document.documentElement.classList.contains("dark")), "theme from the cloud copy applied");

  await c.goto(`${CURL}#/account`);
  await settle(c, 500);
  ok(await c.getByText("remy@example.com").isVisible(), "account page shows the signed-in email");
  if (SHOTS) await c.screenshot({ path: `${SHOTS}/phone-account-signed-in.png` });
  await c.getByRole("button", { name: "Delete account" }).click();
  await c.getByLabel('Type "DELETE" to confirm').fill("DELETE");
  await c.getByRole("dialog").getByRole("button", { name: "Delete account" }).click();
  await c.waitForTimeout(1500);
  ok(calls.some((x) => x.path === "/rest/v1/rpc/delete_my_account" && x.method === "POST" && x.auth === "Bearer test-access"), "delete account calls delete_my_account as the user");
  await settle(c, 800);
  ok(await c.evaluate(() => !Object.keys(localStorage).some((k) => k.startsWith("lt."))), "device data cleared after deleting the account");
  await ctx.close();
}

await waitForServer();
await waitForServer(`http://localhost:${CLOUD_PORT}/`);
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
  await p.getByRole("button", { name: "Save", exact: true }).click();
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

  console.log("\nHome: demo mode, schedule, briefing, customize (clock fixed to Wed 25 Nov 2026, 8:25 AM)");
  {
    const ctx = await browser.newContext({ ...devices["iPhone 15"] });
    const h = await ctx.newPage();
    watch(h, "home");
    await h.clock.setFixedTime(new Date(2026, 10, 25, 8, 25));
    await h.goto(URL);
    await settle(h);
    ok(await h.getByText("No accounts connected yet.").isVisible(), "live mode says nothing is connected");
    ok(await h.getByText(/Not included \(not connected\)/).isVisible(), "live briefing lists unavailable sources");
    await h.getByRole("button", { name: "Try demo data" }).click();
    await settle(h, 900);
    ok(await h.getByText("Everything below is sample data — not yours.").isVisible(), "demo banner shown");
    ok((await h.getByText("Demo", { exact: true }).count()) >= 7, "every stat card carries a Demo badge");
    ok(await h.getByText("Happening now").isVisible(), "current class indicator");
    ok(await h.locator("li[aria-current=time]").innerText().then((t) => t.includes("Biology")), "Biology highlighted as current class");
    ok(await h.getByText(/Next: Algebra II at 9:00/).isVisible(), "next class shown");
    ok(await h.getByRole("progressbar", { name: "Biology progress" }).getAttribute("aria-valuenow").then((v) => v === "50"), "class progress is 50%");
    ok(await h.getByRole("region", { name: "Important" }).getByRole("button", { name: /Chapter 12 reading questions/ }).innerText().then((t) => t.includes("Overdue")), "overdue assignment listed first in Important");
    ok(await h.getByText(/You have 6 classes today, starting with Biology at 8:00/).isVisible(), "briefing summary uses demo data");
    const v = await axe(h);
    ok(v.length === 0, `demo Home passes axe${v.length ? ": " + v.map((x) => `${x.id} (${x.nodes.length})`).join(", ") : ""}`);
    if (v.length) for (const x of v) for (const n of x.nodes.slice(0, 3)) console.log(`      ${x.id}: ${n.target.join(" ")} — ${n.failureSummary?.split("\n")[1]?.trim()}`);
    if (SHOTS) await h.screenshot({ path: `${SHOTS}/phone-home-demo.png`, fullPage: true });
    await h.getByRole("button", { name: /Read full briefing/ }).click();
    await h.waitForTimeout(600);
    const sheet = h.getByRole("dialog", { name: "Daily briefing" });
    ok(await sheet.getByText("Suggested priorities").isVisible(), "full briefing opens with priorities");
    ok(!(await sheet.getByText("Unavailable data").count()), "demo briefing has no unavailable sources");
    if (SHOTS) await h.screenshot({ path: `${SHOTS}/phone-briefing.png` });
    await h.keyboard.press("Escape");
    await sheet.waitFor({ state: "detached", timeout: 1500 }).catch(() => {});
    await h.getByRole("button", { name: "Customize Home" }).click();
    await h.waitForTimeout(500);
    for (let i = 0; i < 3; i++) await h.getByRole("button", { name: "Move Important up" }).click();
    await h.getByRole("switch", { name: "At a glance" }).click();
    if (SHOTS) await h.screenshot({ path: `${SHOTS}/phone-customize.png` });
    await h.keyboard.press("Escape");
    await h.reload();
    await settle(h, 700);
    const order = await h.locator("main section[aria-label], main section[aria-labelledby]").evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") || e.querySelector("h2")?.textContent),
    );
    const firstCard = order.find((x) => x !== "Greeting" && x !== "Install Life Tracker");
    ok(firstCard === "Important", `custom order persists after reload (first: ${firstCard})`);
    ok(!order.includes("At a glance"), "hidden section stays hidden");
    await h.getByRole("button", { name: "Turn off" }).click();
    await settle(h, 300);
    ok(await h.getByText("No accounts connected yet.").isVisible(), "demo mode turns off");
    await ctx.close();
  }

  console.log("\nAccount (cloud sync not configured)");
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const a = await ctx.newPage();
    watch(a, "account");
    await a.goto(`${URL}#/settings`);
    await settle(a);
    await a.fill("#name", "Remy");
    await a.getByRole("button", { name: "Save", exact: true }).click();
    await a.getByRole("button", { name: /Cloud sync not set up yet/ }).click();
    await settle(a, 300);
    ok(a.url().endsWith("#/account"), "Settings → Account");
    ok(await a.getByText("Cloud sync isn't set up yet").isVisible(), "explains cloud sync is waiting for setup");
    const [dl] = await Promise.all([a.waitForEvent("download"), a.getByRole("button", { name: "Export my data" }).click()]);
    const json = JSON.parse(readFileSync(await dl.path(), "utf8"));
    ok(json.app === "Life Tracker" && json.preferences.name === "Remy", "export downloads a JSON copy of your data");
    await a.getByRole("button", { name: "Clear data on this device" }).click();
    await a.waitForTimeout(400);
    const del = a.getByRole("dialog");
    ok(await del.getByRole("button", { name: "Clear data" }).isDisabled(), "delete stays disabled until DELETE is typed");
    await del.getByLabel('Type "DELETE" to confirm').fill("DELETE");
    await del.getByRole("button", { name: "Clear data" }).click();
    await a.waitForURL(/#\/$/, { timeout: 4000 }).catch(() => {});
    await settle(a, 500);
    ok(!(await a.locator("h1").first().innerText()).includes("Remy"), "device data cleared");
    await ctx.close();
  }

  console.log("\nCloud sync against a simulated Supabase API");
  await cloudChecks();

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

  // Expected: the simulated server rejecting the deliberately wrong sign-in code.
  const real = errors.filter((e) => !(e.startsWith("cloud:") && /status of 403/.test(e)));
  console.log("");
  ok(real.length === 0, `no console errors${real.length ? ":\n    " + real.join("\n    ") : ""}`);
} finally {
  await browser.close();
  stop();
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
