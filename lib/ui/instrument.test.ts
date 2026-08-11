// "Instrument" direction — P1/P2/P3 guarantees.
//
// These lock in the fixes from the design audit so they cannot silently
// regress. The existing phase5 contrast tests check each colour against its
// SURFACE; the gap they left is the two places the product actually failed:
//
//   1. text sitting on a solid --accent fill (the primary CTA, user chat
//      bubbles, every gradient icon chip). White on the old gradient's light
//      stop was 2.67:1 in light mode, and the dark theme hardcoded the same
//      white onto a bright accent for roughly 1.4:1.
//   2. text sitting on its OWN -soft tint (delta chips, badges). Six pairs sat
//      at 4.0-4.4:1 because the soft backgrounds were picked for appearance
//      and never checked against their own foregrounds.
//
// A -soft token is a translucent rgba, so it is only meaningful composited
// over a real ground — each is checked against every surface it can land on.

import fs from "fs";
import { test, expect } from "vitest";
import { semanticVars, SEMANTIC, BRAND_COLOR, SYSTEM_COLOR, CHART } from "./tokens";
import { PORTAL_CSS } from "@/app/portal/portalTheme";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(`${ROOT}/${p}`, "utf8");

// ── Colour maths ────────────────────────────────────────────────────────────
function lum(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}
function parseVars(css: string) {
  const hex: Record<string, string> = {};
  const soft: Record<string, string> = {};
  for (const m of css.matchAll(/--([\w-]+):(#[0-9a-fA-F]{6})/g)) hex[m[1]] = m[2];
  // -soft tokens are OPAQUE now. They used to be rgba(), which composited with
  // whatever was behind them — the same chip measured 4.61:1 on --surface and
  // 4.05:1 on --surface3. An opaque step reads identically everywhere, which is
  // why this no longer needs to flatten against a ground.
  for (const m of css.matchAll(/--([\w-]+)-soft:(#[0-9a-fA-F]{6})/g)) soft[m[1]] = m[2];
  return { hex, soft };
}

const HUES = ["accent", "green", "amber", "red", "blue", "pink"] as const;

// Every ground a tinted chip can land on, per portalTheme's surface ladder.
const LIGHT_GROUNDS = ["#FFFFFF", "#F7F8FB", "#EFF1F6", "#F4F5F8"];
const DARK_GROUNDS = ["#101218", "#161921", "#1E222B", "#07080B"];

// ── 1. Text on its own soft tint ────────────────────────────────────────────
test.each(["light", "dark"] as const)(
  "%s: every hue clears 4.5:1 on its own soft tint",
  (mode) => {
    const { hex, soft } = parseVars(semanticVars(mode));
    const fails: string[] = [];
    for (const k of [...HUES, "accent", "system"]) {
      if (!hex[k] || !soft[k]) { fails.push(`--${k}: token missing`); continue; }
      const r = ratio(hex[k], soft[k]);
      if (r < 4.5) fails.push(`--${k} on --${k}-soft: ${r.toFixed(2)}:1`);
    }
    expect(fails).toEqual([]);
  },
);

// ── 1b. Muted neutrals on the surfaces they actually sit on ─────────────────
test("muted text clears 4.5:1 on every surface in the ladder, not just white", () => {
  // phase5 checks these against --surface only. They are mostly rendered on
  // --surface2 (panel interiors, KPI cards) and --surface3, where the previous
  // values dropped to 4.49 and 4.25:1.
  // Bounded by the block's closing brace — a fixed-width window spills into
  // the next rule the moment a block shrinks, and then silently compares one
  // theme's text against the other theme's surface.
  const block = (marker: string) => {
    const i = PORTAL_CSS.indexOf(marker);
    expect(i).toBeGreaterThan(-1);
    const end = PORTAL_CSS.indexOf("}", i);
    const b = PORTAL_CSS.slice(i, end < 0 ? undefined : end);
    const v: Record<string, string> = {};
    for (const m of b.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) v[m[1]] = m[2];
    return v;
  };
  const light = block(".portal {");
  const dark = block('.portal[data-theme="dark"] {');

  const fails: string[] = [];
  for (const [name, vars, grounds] of [
    ["light", light, ["surface", "surface2", "surface3"]],
    ["dark", dark, ["surface", "surface2", "surface3"]],
  ] as const) {
    for (const k of ["muted", "muted2", "text", "text2"]) {
      for (const g of grounds) {
        const r = ratio(vars[k], vars[g]);
        if (r < 4.5) fails.push(`${name} --${k} on --${g}: ${r.toFixed(2)}:1`);
      }
    }
  }
  expect(fails).toEqual([]);
});

// ── 2. Ink on a solid accent fill ───────────────────────────────────────────
test("--on-accent clears 4.5:1 on --accent in BOTH themes", () => {
  // The ink has to flip with the theme: the light brand is near-black (white
  // reads on it), the dark brand is near-white (white would be ~1.05:1).
  // darkVars() is emitted twice (the prefers-color-scheme block and the
  // explicit [data-theme] rule), so the occurrences are [light, dark, dark].
  const inks = [...PORTAL_CSS.matchAll(/--on-accent:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  expect(inks.length).toBeGreaterThanOrEqual(2);

  expect(ratio(inks[0], BRAND_COLOR.light.base)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(inks[1], BRAND_COLOR.dark.base)).toBeGreaterThanOrEqual(4.5);
  // Both dark emissions must agree, or the toggle and the OS default diverge.
  expect(new Set(inks.slice(1)).size).toBe(1);
});

test("the brand's hover and active steps stay legible under the same ink", () => {
  for (const mode of ["light", "dark"] as const) {
    const b = BRAND_COLOR[mode];
    for (const step of [b.hover, b.active]) {
      expect(ratio(b.on, step)).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("--on-system clears 4.5:1 on the azure system fill, both themes", () => {
  const inks = [...PORTAL_CSS.matchAll(/--on-system:(#[0-9A-Fa-f]{6})/g)].map((m) => m[1]);
  expect(inks.length).toBeGreaterThanOrEqual(2);
  expect(ratio(inks[0], SEMANTIC.light.blue)).toBeGreaterThanOrEqual(4.5);
  expect(ratio(inks[1], SEMANTIC.dark.blue)).toBeGreaterThanOrEqual(4.5);
});

// ── 2b. Pair separation — the check that was missing ────────────────────────
//
// The original audit scored every colour against its BACKGROUND and never
// against the other colours. That gap shipped a brand accent (spruce-teal
// #0B6E62) sitting dE 0.051 from positive-green #186640 — a 1.14:1 mutual
// contrast, so on the Intelligence tables a green upward delta beside a teal
// keyword link were very nearly the same colour.
//
// Contrast is necessary and NOT sufficient. In a product where colour carries
// data meaning, every pair a user can see at once must also be discriminable.

/** OKLab: perceptually uniform, so Euclidean distance tracks what the eye sees. */
function oklab(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}
function deltaE(a: string, b: string): number {
  const [x1, y1, z1] = oklab(a);
  const [x2, y2, z2] = oklab(b);
  return Math.hypot(x1 - x2, y1 - y2, z1 - z2);
}

/** Below this, two chips in the same table start being mistaken for each other. */
const MIN_SEPARATION = 0.10;

test.each(["light", "dark"] as const)(
  "%s: the three status colours are never confusable with each other",
  (mode) => {
    // A reader must never mistake "improving" for "needs attention" for
    // "failed". These are the pairs where a mix-up is most costly.
    const status = ["green", "amber", "red"] as const;
    const tooClose: string[] = [];
    for (let i = 0; i < status.length; i++) {
      for (let j = i + 1; j < status.length; j++) {
        const d = deltaE(SEMANTIC[mode][status[i]], SEMANTIC[mode][status[j]]);
        if (d < MIN_SEPARATION) tooClose.push(`${status[i]}/${status[j]} dE ${d.toFixed(3)}`);
      }
    }
    expect(tooClose).toEqual([]);
  },
);

test.each(["light", "dark"] as const)(
  "%s: no status colour can be mistaken for the brand or for AI activity",
  (mode) => {
    // This is the check the original audit lacked, and it is what caught the
    // retired spruce-teal (dE 0.051 from positive-green). A state and an
    // identity must never read as the same thing.
    const identities = { brand: BRAND_COLOR[mode].base, system: SYSTEM_COLOR[mode].base };
    const tooClose: string[] = [];
    for (const [iName, iHex] of Object.entries(identities)) {
      for (const s of ["green", "amber", "red"] as const) {
        const d = deltaE(iHex, SEMANTIC[mode][s]);
        if (d < MIN_SEPARATION) tooClose.push(`${iName}/${s} dE ${d.toFixed(3)}`);
      }
    }
    expect(tooClose).toEqual([]);
  },
);

test.each(["light", "dark"] as const)(
  "%s: AI activity is clearly distinguishable from the brand",
  (mode) => {
    // The whole point of a separate system hue is that a user can tell "the
    // platform did this" from "this is a button". If these converge, the
    // signal is gone.
    const d = deltaE(BRAND_COLOR[mode].base, SYSTEM_COLOR[mode].base);
    expect(d).toBeGreaterThan(MIN_SEPARATION);
  },
);

test.each(["light", "dark"] as const)(
  "%s: the categorical series stays separable in fixed order",
  (mode) => {
    // Adjacent pairs are what a stacked bar or a multi-line chart puts side by
    // side. The ORDER is load-bearing: gold sits between teal and magenta
    // because magenta next to teal collides under deuteranopia.
    const series = mode === "light" ? CHART.series : CHART.seriesDark;
    const tooClose: string[] = [];
    for (let i = 0; i < series.length - 1; i++) {
      const d = deltaE(series[i], series[i + 1]);
      if (d < MIN_SEPARATION) tooClose.push(`series ${i + 1}/${i + 2} dE ${d.toFixed(3)}`);
    }
    expect(tooClose).toEqual([]);
  },
);

// ── 3. No text-bearing gradient survives ────────────────────────────────────
test("no white text sits on a multi-stop accent gradient", () => {
  // The exact failing construct: a gradient fill paired with a text colour.
  for (const css of [PORTAL_CSS, read("app/dashboard/page.tsx"), read("app/login/page.tsx")]) {
    expect(css).not.toMatch(/background:linear-gradient\([^;]*\);\s*color:#fff/);
  }
  expect(PORTAL_CSS).not.toContain("linear-gradient(145deg,var(--accent3)");
});

test("the largest heading is painted, not clipped from a gradient", () => {
  // background-clip:text leaves colour undefined in forced-colors mode and
  // renders illegibly when selected. Comments are stripped first — the removal
  // is explained in a note that necessarily names the property.
  const css = PORTAL_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  expect(css).not.toMatch(/background-clip:\s*text/);
  // Standalone `color:transparent` only — border-color and tap-highlight-color
  // are legitimate and contain it as a substring.
  expect(css).not.toMatch(/(?<![\w-])color:\s*transparent/);
});

// ── 4. Ambient motion retired ───────────────────────────────────────────────
test("ambient animation loops are gone", () => {
  // pFloat/pBeacon (portal) and rise/scan (admin) ran forever and carried no
  // information. pShimmer and pPulse stay: both indicate real state.
  expect(PORTAL_CSS).not.toMatch(/@keyframes (pFloat|pBeacon)/);
  expect(PORTAL_CSS).not.toMatch(/animation:(pFloat|pBeacon)/);

  const dash = read("app/dashboard/page.tsx");
  expect(dash).not.toMatch(/@keyframes (rise|scan)/);
  expect(dash).not.toMatch(/animation:rise/);
  expect(PORTAL_CSS).toContain("@keyframes pShimmer");
});

// ── 5. One palette across surfaces ──────────────────────────────────────────
test("the old divergent per-surface colours are gone", () => {
  const stale = [
    // Retired brand indigos and the spruce-teal that replaced them.
    "#5B5FD6", "#6C5CE7", "#8B5CF6", "#0B6E62", "#4FC2AC",
    // Per-surface near-misses of the semantic set.
    "#0C8560", "#00856B", "#A46A08", "#9A6E00", "#D63D3D", "#DD3535", "#E14B4B",
    // The Intelligence tab's private scheme.
    "#00B894", "#F5B461", "#FF6B6B", "#0984E3", "#E84393", "#00CEC9", "#E1A100",
    // Greys that failed as text: 3.02:1, 2.80:1 and 1.95:1 on white.
    "#8A93A6", "#9AA3B2", "#B2BAC8",
  ];
  const files = [
    "app/portal/portalTheme.ts",
    "app/dashboard/page.tsx",
    "app/login/page.tsx",
    "app/_components/Notify.tsx",
    "app/dashboard/Overview.tsx",
    "app/dashboard/OverviewCharts.impl.tsx",
    "app/dashboard/intelligence/IntelligencePage.tsx",
    "app/dashboard/intelligence/KeywordTable.tsx",
    "app/dashboard/intelligence/IntelOverview.tsx",
    "app/dashboard/intelligence/PositionDistribution.tsx",
    "app/dashboard/intelligence/WinnersLosers.tsx",
    "app/dashboard/intelligence/AIRecommendations.tsx",
    "app/dashboard/intelligence/ActionButton.tsx",
    "app/dashboard/intelligence/ExecSummary.tsx",
    "app/dashboard/intelligence/CompetitorPanel.tsx",
    "app/dashboard/intelligence/DataStatus.tsx",
    "app/dashboard/intelligence/MetricExplainer.tsx",
  ];
  const found: string[] = [];
  for (const f of files) {
    // Strip comments first — several of these values are cited in the notes
    // explaining why they were retired.
    const src = read(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    for (const s of stale) if (src.includes(s)) found.push(`${f}: ${s}`);
  }
  expect(found).toEqual([]);
});

// ── 7. Azure discipline ─────────────────────────────────────────────────────
test("azure is reserved for machine activity, not general chrome", () => {
  // The whole value of the system hue is that it means something. If it starts
  // appearing on ordinary navigation or generic buttons it stops being a
  // signal, so the surfaces allowed to carry it are enumerated here.
  const css = PORTAL_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  const allowed = [
    "p-ai", "p-exec", "p-act", "p-live", "p-by-ai",
    "p-chat-welcome-icon", "p-msg-avatar", "--system",
  ];
  const offenders: string[] = [];
  for (const line of css.split("\n")) {
    if (!/var\(--system/.test(line)) continue;
    if (!allowed.some((a) => line.includes(a))) offenders.push(line.trim().slice(0, 70));
  }
  expect(offenders).toEqual([]);
});

test("the brand carries navigation and primary actions, not azure", () => {
  const css = PORTAL_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
  // The active nav pill and the primary button must be brand, never system.
  const navBlock = css.slice(css.indexOf(".p-nav-item.on"), css.indexOf(".p-nav-hl"));
  expect(navBlock).not.toMatch(/var\(--system/);
  const btnBlock = css.slice(css.indexOf(".p-btn.primary"), css.indexOf(".p-btn.ghost"));
  expect(btnBlock).toMatch(/var\(--accent\)/);
  expect(btnBlock).not.toMatch(/var\(--system/);
});

test("press states exist — a control must acknowledge being pressed", () => {
  expect(PORTAL_CSS).toMatch(/\.p-btn\.primary:active/);
  expect(PORTAL_CSS).toMatch(/\.p-btn\.ghost:active/);
  expect(read("app/login/page.tsx")).toMatch(/\.lg button:active/);
});

test("destructive actions read as destructive at rest, not only on hover", () => {
  // Previously .ghost.danger was a neutral bordered button until hovered, so a
  // touch user got no warning at all.
  expect(PORTAL_CSS).toMatch(/\.p-btn\.danger \{[^}]*background:var\(--red-soft\)/);
  expect(PORTAL_CSS).toMatch(/\.p-btn\.ghost\.danger \{[^}]*background:var\(--red-soft\)/);
});

// ── 6. First paint ──────────────────────────────────────────────────────────
test("no surface-foreign background is hardcoded on the document body", () => {
  // app/layout.tsx used to paint #0b0f14 — a dark navy belonging to neither
  // surface — so every cold load flashed it before the surface mounted.
  expect(read("app/layout.tsx")).not.toContain("#0b0f14");
});
