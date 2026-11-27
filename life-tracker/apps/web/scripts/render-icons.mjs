// Renders public/icon.svg into the PNG sizes iOS, Android and browsers need.
// Uses the pre-installed Playwright Chromium.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const svg = await readFile(path.join(root, "public/icon.svg"), "utf8");
const outDir = path.join(root, "public/icons");

const targets = [
  ["icon-1024.png", 1024], ["icon-512.png", 512], ["icon-192.png", 192],
  ["apple-touch-icon.png", 180], ["icon-167.png", 167], ["icon-152.png", 152],
  ["icon-120.png", 120], ["icon-32.png", 32],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size] of targets) {
  await page.setViewportSize({ width: size, height: size });
  // iOS applies its own rounded mask, so apple-touch-icon is drawn full-bleed (no rounded corners).
  const full = [180, 167, 152, 120].includes(size) ? svg.replace('rx="228"', 'rx="0"') : svg;
  await page.setContent(`<html><body style="margin:0;background:transparent">${full.replace("<svg", `<svg width="${size}" height="${size}"`)}</body></html>`);
  await page.screenshot({ path: path.join(outDir, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
// Maskable: full-bleed background with the glyph inside the 80% safe zone.
await page.setViewportSize({ width: 512, height: 512 });
const maskable = svg.replace('rx="228"', 'rx="0"').replace("<path", '<g transform="translate(102 102) scale(0.8)"><path').replace("</svg>", "</g></svg>");
await page.setContent(`<html><body style="margin:0">${maskable.replace("<svg", '<svg width="512" height="512"')}</body></html>`);
await page.screenshot({ path: path.join(outDir, "icon-maskable-512.png"), clip: { x: 0, y: 0, width: 512, height: 512 } });
await browser.close();
console.log("icons written to", outDir);
