// Unit tests for the shared UI foundation.
//
// These assert on the CSS the modules actually emit, rather than on a rendered
// page, because the surfaces that carry most of this styling are client
// components behind an auth gate -- an unauthenticated HTTP request never
// renders their <style> at all, so a page-level check would silently pass
// against markup that was never styled.

import { test, expect } from "vitest";
import { GLOBAL_CSS, touchTargetCSS, BREAKPOINTS, TOUCH_MIN, INPUT_FONT_MIN, up, down } from "./tokens";
import { PORTAL_CSS } from "@/app/portal/portalTheme";

// ── Breakpoints ─────────────────────────────────────────────────────────────
test("three breakpoints, ordered, replacing the five ad-hoc ones", () => {
  expect(BREAKPOINTS).toEqual({ sm: 640, md: 900, lg: 1200 });
  expect(BREAKPOINTS.sm).toBeLessThan(BREAKPOINTS.md);
  expect(BREAKPOINTS.md).toBeLessThan(BREAKPOINTS.lg);
});

test("up/down queries do not overlap at the boundary", () => {
  // A 640px viewport must match up.sm and NOT down.sm, or rules collide.
  expect(up.sm).toContain("min-width:640px");
  expect(down.sm).toContain("max-width:639px");
});

// ── Global CSS ──────────────────────────────────────────────────────────────
test("global CSS defines the font stacks it promises", () => {
  expect(GLOBAL_CSS).toMatch(/--font-sans:\s*var\(--font-inter\)/);
  expect(GLOBAL_CSS).toMatch(/--font-mono:\s*ui-monospace/);
});

test("monospace is a pure system stack — no fourth webfont", () => {
  const mono = GLOBAL_CSS.match(/--font-mono:([^;]+);/)![1];
  expect(mono).not.toMatch(/JetBrains|var\(--font-/);
});

test("horizontal overflow backstop is present", () => {
  expect(GLOBAL_CSS).toMatch(/html,\s*body\s*\{[^}]*overflow-x:hidden/);
});

test("touch floor and spacing scale are exposed as tokens", () => {
  expect(GLOBAL_CSS).toContain(`--touch:${TOUCH_MIN}px`);
  expect(GLOBAL_CSS).toMatch(/--s-1:4px;\s*--s-2:8px;\s*--s-3:12px/);
});

test("reduced motion is honoured globally", () => {
  expect(GLOBAL_CSS).toMatch(/@media \(prefers-reduced-motion:reduce\)/);
});

// ── Per-surface rules ───────────────────────────────────────────────────────
test("touch rules are scoped to the surface they are generated for", () => {
  const css = touchTargetCSS(".portal");
  expect(css).toContain(".portal button");
  expect(css).not.toContain(".sr ");
  expect(touchTargetCSS(".sr")).toContain(".sr button");
});

test("44px floor applies only to coarse pointers, keeping desktop dense", () => {
  const css = touchTargetCSS(".sr");
  const coarse = css.slice(css.indexOf("@media (pointer:coarse)"));
  expect(coarse).toMatch(/min-height:var\(--touch\)/);
  // The floor must not leak outside the pointer query.
  const beforeCoarse = css.slice(0, css.indexOf("@media (pointer:coarse)"));
  expect(beforeCoarse).not.toMatch(/min-height:var\(--touch\)/);
});

test("inputs are 16px unconditionally — the iOS zoom threshold", () => {
  const css = touchTargetCSS(".portal");
  expect(css).toMatch(new RegExp(`font-size:${INPUT_FONT_MIN}px`));
  // and only relax above the md breakpoint, not on touch
  const relaxed = css.slice(css.indexOf(up.md));
  expect(relaxed).toMatch(/font-size:14px/);
});

test("checkboxes and radios are excluded from input sizing", () => {
  const css = touchTargetCSS(".sr");
  expect(css).toContain('input:not([type="checkbox"]):not([type="radio"])');
});

test("an inline opt-out exists for controls inside dense text", () => {
  expect(touchTargetCSS(".sr")).toContain('[data-touch="inline"]');
});

// ── Portal integration ──────────────────────────────────────────────────────
test("portal CSS no longer fetches fonts over the network", () => {
  expect(PORTAL_CSS).not.toMatch(/@import|fonts\.googleapis|fonts\.gstatic/);
});

test("portal uses the shared font tokens, not literal families", () => {
  expect(PORTAL_CSS).toContain("font-family:var(--font-sans)");
  expect(PORTAL_CSS).toContain("font-family:var(--font-mono)");
  expect(PORTAL_CSS).not.toMatch(/font-family:'(Inter|JetBrains Mono|Space Grotesk)'/);
});

test("portal embeds the generated touch rules", () => {
  expect(PORTAL_CSS).toContain("@media (pointer:coarse)");
  expect(PORTAL_CSS).toContain(".portal button");
});

test("sub-nav overflow is made visible rather than silently clipped", () => {
  expect(PORTAL_CSS).toMatch(/\.p-subnav \{[^}]*mask-image/);
  expect(PORTAL_CSS).toMatch(/\.p-subnav-btn \{[^}]*scroll-snap-align/);
});

test("the opportunity card collapses to one column, exactly once", () => {
  // Phase 1 added a second collapse rule for .p-opp-body under the mistaken
  // belief that it had none; it already collapsed at the old 760px breakpoint.
  // The duplicate is gone and the original is now on the shared md token.
  const rules = [...PORTAL_CSS.matchAll(/\.p-opp-body \{ grid-template-columns:1fr/g)];
  expect(rules).toHaveLength(1);
  const belowMd = PORTAL_CSS.slice(PORTAL_CSS.indexOf(down.md));
  expect(belowMd).toMatch(/\.p-opp-body \{ grid-template-columns:1fr/);
});

// ── Phase 2: navigation ─────────────────────────────────────────────────────
test("every ad-hoc breakpoint is gone — only the three tokens remain", () => {
  const mins = [...PORTAL_CSS.matchAll(/\(min-width:(\d+)px\)/g)].map((m) => Number(m[1]));
  const maxes = [...PORTAL_CSS.matchAll(/\(max-width:(\d+)px\)/g)].map((m) => Number(m[1]));
  const tokens: number[] = [BREAKPOINTS.sm, BREAKPOINTS.md, BREAKPOINTS.lg];

  expect([...new Set(mins)].filter((w) => !tokens.includes(w))).toEqual([]);
  // max-width must always be token-1, never the token itself: a rule at
  // max-width:640px and one at min-width:640px both match a 640px viewport,
  // so the two collide at exactly the boundary.
  expect([...new Set(maxes)].filter((w) => !tokens.includes(w + 1))).toEqual([]);
});

test("reduced motion is declared once, globally, not per surface", () => {
  expect(PORTAL_CSS).not.toMatch(/prefers-reduced-motion/);
  expect(GLOBAL_CSS).toMatch(/prefers-reduced-motion/);
});

test("bottom nav costs desktop nothing and only appears below md", () => {
  expect(PORTAL_CSS).toMatch(/\.p-bnav \{ display:none; \}/);
  const belowMd = PORTAL_CSS.slice(PORTAL_CSS.indexOf(down.md));
  expect(belowMd).toMatch(/\.p-bnav \{[\s\S]*?display:grid/);
});

test("bottom nav clears the iOS home indicator", () => {
  expect(PORTAL_CSS).toMatch(/\.p-bnav \{[\s\S]*?env\(safe-area-inset-bottom\)/);
});

test("page content is padded so the fixed bar never covers it", () => {
  expect(PORTAL_CSS).toMatch(/\.p-main \{ padding:22px 16px calc\(84px \+ env\(safe-area-inset-bottom\)\)/);
});

test("the drawer stacks above the bottom bar, not behind it", () => {
  const belowMd = PORTAL_CSS.slice(PORTAL_CSS.indexOf(down.md));
  const bnavZ = Number(belowMd.match(/\.p-bnav \{[\s\S]*?z-index:(\d+)/)![1]);
  const drawerZ = Number(belowMd.match(/\.p-side-mobile \{ z-index:(\d+)/)![1]);
  const scrimZ = Number(belowMd.match(/\.p-scrim \{ z-index:(\d+)/)![1]);
  expect(scrimZ).toBeGreaterThan(bnavZ);
  expect(drawerZ).toBeGreaterThan(scrimZ);
});

test("navigation chrome is hidden when printing a report", () => {
  expect(PORTAL_CSS).toMatch(/@media print \{ \.p-bnav \{ display:none !important/);
});
