// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Guards WCAG 2.1 AA text contrast (4.5:1) for every token pair the UI uses
 * for text, in both themes. If a color change breaks contrast, this fails.
 */

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function block(selector: string) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  const vars: Record<string, string> = {};
  for (const m of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) vars[m[1]] = m[2].toLowerCase();
  return vars;
}

type RGB = [number, number, number];
const hex = (h: string): RGB => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
const lum = ([r, g, b]: RGB) => {
  const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: RGB, b: RGB) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Color `fg` at `alpha` painted over `bg` (how Tailwind's /12 tints render). */
const over = (fg: RGB, alpha: number, bg: RGB): RGB => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as RGB;

const themes = { light: block(":root"), dark: { ...block(":root"), ...block(".dark") } };

describe.each(Object.entries(themes))("%s theme contrast", (_, t) => {
  const c = (name: string) => {
    expect(t[name], `token --${name} missing`).toBeDefined();
    return hex(t[name]);
  };
  const white: RGB = [255, 255, 255];

  const pairs: [string, RGB, RGB][] = [
    ["text on bg", c("text"), c("bg")],
    ["text on surface", c("text"), c("surface")],
    ["text on surface-2", c("text"), c("surface-2")],
    ["muted on bg", c("text-muted"), c("bg")],
    ["muted on surface", c("text-muted"), c("surface")],
    ["muted on surface-2", c("text-muted"), c("surface-2")],
    ["brand-ink on bg", c("brand-ink"), c("bg")],
    ["brand-ink on surface", c("brand-ink"), c("surface")],
    ["brand-ink on brand-soft", c("brand-ink"), c("brand-soft")],
    ["brand-ink on surface-2", c("brand-ink"), c("surface-2")],
    ["on-brand on brand-strong", c("on-brand"), c("brand-strong")],
    ["white on hero-from", white, c("hero-from")],
    ["white on hero-to", white, c("hero-to")],
  ];
  for (const a of ["blue", "purple", "green", "yellow", "red"]) {
    pairs.push([`${a} on surface`, c(`accent-${a}`), c("surface")]);
    pairs.push([`${a} on bg`, c(`accent-${a}`), c("bg")]);
  }
  // Badge tints (see components/ui/Badge.tsx)
  for (const [a, alpha] of [["green", 0.12], ["yellow", 0.14], ["red", 0.1], ["blue", 0.1], ["purple", 0.1]] as const) {
    pairs.push([`${a} badge`, c(`accent-${a}`), over(c(`accent-${a}`), alpha, c("surface"))]);
  }

  it.each(pairs)("%s ≥ 4.5:1", (_, fg, bg) => {
    expect(ratio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
