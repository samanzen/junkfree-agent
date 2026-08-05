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

test("the one uncollapsed two-column grid now collapses below sm", () => {
  const belowSm = PORTAL_CSS.slice(PORTAL_CSS.lastIndexOf(down.sm));
  expect(belowSm).toMatch(/\.p-opp-body \{ grid-template-columns:1fr/);
});
