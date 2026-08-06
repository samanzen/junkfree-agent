// Phase 3: card-stack tables and touch charts.
//
// The load-bearing property in both is "desktop is unchanged". That is asserted
// directly here rather than eyeballed, because a regression in it would be
// invisible to anyone developing on a laptop.

import { test, expect } from "vitest";
import { responsiveTableCSS, BREAKPOINTS } from "./tokens";
import { chartSettings } from "./useChartTouch";
import { PORTAL_CSS } from "@/app/portal/portalTheme";

const VARS = {
  surface: "var(--surface)", line: "var(--line)", muted: "var(--muted)",
  text: "var(--text)", radius: "12px",
};

// ── Table CSS ───────────────────────────────────────────────────────────────
test("every rule is scoped to the surface it was generated for", () => {
  const portal = responsiveTableCSS(".portal", VARS);
  expect(portal).not.toContain(".sr ");
  expect(responsiveTableCSS(".sr", VARS)).not.toContain(".portal ");
});

test("the card layout applies only below sm — desktop keeps the real table", () => {
  const css = responsiveTableCSS(".sr", VARS);
  const beforeQuery = css.slice(0, css.indexOf("@media"));
  // Nothing outside the breakpoint may turn table elements into blocks.
  expect(beforeQuery).not.toMatch(/display:block/);
  expect(css).toContain(`(max-width:${BREAKPOINTS.sm - 1}px)`);
});

test("stacking converts the row structure to blocks", () => {
  const css = responsiveTableCSS(".sr", VARS);
  for (const el of ["table", "tbody", "tr", "td"]) {
    expect(css).toMatch(new RegExp(`\\.rt-stack ${el}`));
  }
});

test("headers are visually hidden, not removed from the a11y tree", () => {
  const css = responsiveTableCSS(".sr", VARS);
  const thead = css.slice(css.indexOf(".rt-stack thead"));
  // display:none would strip the column names from screen readers too.
  expect(thead).not.toMatch(/^\s*\.rt-stack thead \{[^}]*display:none/m);
  expect(thead).toMatch(/clip-path:inset\(50%\)/);
});

test("cells render their column name from the stamped attribute", () => {
  expect(responsiveTableCSS(".sr", VARS)).toMatch(/content:attr\(data-label\)/);
});

test("cells with no heading and full-width cells are not given fake labels", () => {
  const css = responsiveTableCSS(".sr", VARS);
  expect(css).toMatch(/td:not\(\[data-label\]\)/);
  expect(css).toMatch(/td\[data-full\]/);
});

test("scroll mode opts out of stacking and signals its overflow", () => {
  const css = responsiveTableCSS(".sr", VARS);
  expect(css).toMatch(/\.rt-scroll \{[\s\S]*?mask-image/);
  expect(css).toMatch(/\.rt-scroll table \{ min-width:max-content/);
});

test("surface colours are injected, never hardcoded", () => {
  const css = responsiveTableCSS(".portal", VARS);
  expect(css).toContain("var(--surface)");
  expect(css).not.toMatch(/#[0-9a-fA-F]{6}/);
});

test("the portal ships the generated table CSS", () => {
  expect(PORTAL_CSS).toContain(".portal .rt-stack td::before");
});

// ── Header label extraction ─────────────────────────────────────────────────
// Mirrors labelOf() in ResponsiveTable. Headers here are not plain text: sort
// arrows and MetricExplainer "?" buttons live inside them, and a naive
// textContent would put "Difficulty ?" or a sort-dependent "AI Score ↓" on
// every card.
function labelOf(html: string): string {
  return html
    .replace(/<(button|svg)\b[\s\S]*?<\/\1>/g, "")
    .replace(/<[^>]+aria-hidden="true"[^>]*>[\s\S]*?<\/[^>]+>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/[↓↑▲▼]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

test("a plain header is used as-is", () => {
  expect(labelOf("Keyword")).toBe("Keyword");
});

test("sort arrows never leak into the label", () => {
  expect(labelOf('AI Score <span style="color:#6C5CE7">↓</span>')).toBe("AI Score");
  expect(labelOf('AI Score <span style="color:#6C5CE7">↑</span>')).toBe("AI Score");
});

test("an explainer button inside a header is dropped", () => {
  expect(labelOf('Difficulty <button aria-label="What is Difficulty?">?</button>')).toBe("Difficulty");
});

test("an empty action column yields no label at all", () => {
  expect(labelOf("")).toBe("");
  expect(labelOf("<button>Track</button>")).toBe("");
});

// ── Chart settings ──────────────────────────────────────────────────────────
test("desktop charts keep hover — the existing behaviour", () => {
  expect(chartSettings(false).tooltip.trigger).toBe("hover");
});

test("touch charts switch to tap, which is the whole point", () => {
  expect(chartSettings(true).tooltip.trigger).toBe("click");
});

test("touch thins axis ticks so labels cannot collide", () => {
  expect(chartSettings(true).xAxis.minTickGap).toBeGreaterThan(chartSettings(false).xAxis.minTickGap);
});

test("both ends of the axis survive tick thinning", () => {
  expect(chartSettings(true).xAxis.interval).toBe("preserveStartEnd");
});

test("touch targets on the chart itself are larger", () => {
  expect(chartSettings(true).activeDot.r).toBeGreaterThan(chartSettings(false).activeDot.r);
});

test("desktop gets no extra legend styling — nothing changes for it", () => {
  expect(chartSettings(false).legend).toEqual({});
});
