// Accessibility check: WCAG 2.2 contrast ratios for the colour pairs the UI actually uses, read from app/globals.css
// so the test can't drift from the real theme. Normal text needs 4.5:1 (AA); large text / UI components 3:1.
import fs from "node:fs";
import path from "node:path";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

const css = fs.readFileSync(path.join(process.cwd(), "app", "globals.css"), "utf8");
const block = (sel: string) => {
  const m = css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.]/g, "\\.")}\\s*\\{([^}]*)\\}`));
  const out: Record<string, string> = {};
  for (const [, k, v] of (m?.[1] ?? "").matchAll(/--([\w-]+):\s*([^;]+);/g)) out[k] = v.trim();
  return out;
};
const light = block(":root");
const dark = { ...light, ...block(".theme-dark") };

function rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16)) as [number, number, number];
}
const lin = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const pair = (name: string, fg: string, bg: string, min: number) => {
  const r = ratio(fg, bg);
  check(`${name} (${fg} on ${bg})`, r >= min, `${r.toFixed(2)}:1 (needs ${min})`);
};

// ---- light theme (the app pages) ----
const L = light;
pair("body text on page", L.ivory, L.ink, 4.5);
pair("body text on card", L.ivory, L.panel, 4.5);
pair("muted text on card", L.muted, L.panel, 4.5);
pair("muted text on page background", L.muted, L.ink, 4.5);
pair("muted text on soft panel", L.muted, L["panel-2"], 4.5);
pair("brand-red text on card", L["gold-soft"], L.panel, 4.5);
pair("brand-red text on page background", L["gold-soft"], L.ink, 4.5);
pair("veg mark on card", L.veg, L.panel, 3);
pair("non-veg mark on card", L.nonveg, L.panel, 3);
pair("error text (red-600) on card", "#dc2626", L.panel, 4.5);
pair("brand button: white on gradient start", "#ffffff", L["btn-start"], 4.5);
pair("brand button: white on gradient middle", "#ffffff", L["btn-mid"], 4.5);
pair("brand button: white on gradient end", "#ffffff", L["btn-end"], 4.5);
pair("selected toggle: white on brand red (bg-gold)", "#ffffff", L.gold, 4.5);
pair("brand red as a UI outline on card", L.gold, L.panel, 3);
pair("brand red text on tinted notice (#fff1ee)", L["gold-soft"], "#fff1ee", 4.5);
pair("muted text on tinted notice (#fff1ee)", L.muted, "#fff1ee", 4.5);
pair("text on green order card (#effaf2)", L.ivory, "#effaf2", 4.5);

// ---- dark photo sections ----
const D = dark;
pair("dark: text on dark panel", D.ivory, D.panel, 4.5);
pair("dark: muted text on dark panel", D.muted, D.panel, 4.5);
pair("dark: brand-red text on dark panel", D["gold-soft"], D.panel, 4.5);
pair("dark: white button text on gradient start", "#ffffff", D["btn-start"], 4.5);
pair("dark: focus outline (white) on dark panel", "#ffffff", D.panel, 3);

console.log(fails ? `\n${fails} FAILED` : "\nAll contrast checks passed");
process.exit(fails ? 1 : 0);
