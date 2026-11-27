// Copies the web app from ../parley into www/ for Capacitor. The web app stays the single source.
import { cpSync, rmSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "..", "parley");
const out = join(here, "..", "www");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ["index.html", "styles.css", "app.js", "create.js", "idb.js", "attachments.js", "llm-worker.js", "image-worker.js", "manifest.webmanifest", "sw.js", "icons", "vendor"]) {
  cpSync(join(src, f), join(out, f), { recursive: true });
}
console.log("Copied web app to", out);
