// SHARED UI FOUNDATION — one source of truth for the primitives both frontends
// need to agree on.
//
// Before this file, the admin dashboard (app/dashboard) and the customer portal
// (app/portal) each hardcoded their own palette, their own spacing values and
// their own breakpoints. Five different breakpoints were in use (1000, 900, 760,
// 640, 540px) with no relationship between them, and the same interactive
// control could be 34px tall in one surface and 37px in the other.
//
// This module does NOT restyle either surface. It defines the shared vocabulary
// -- breakpoints, the spacing scale, the touch-target floor, font stacks -- so
// both can reference the same values. Each surface keeps its own component CSS.

// ── Breakpoints ─────────────────────────────────────────────────────────────
// Three, chosen from what the layouts actually need rather than device names:
//   sm  the point below which multi-column layouts and wide tables stop working
//   md  the point below which the persistent sidebar stops fitting
//   lg  the point above which content should stop growing and start centring
export const BREAKPOINTS = { sm: 640, md: 900, lg: 1200 } as const;

/** Mobile-first: styles apply from this width UP. */
export const up = {
  sm: `@media (min-width:${BREAKPOINTS.sm}px)`,
  md: `@media (min-width:${BREAKPOINTS.md}px)`,
  lg: `@media (min-width:${BREAKPOINTS.lg}px)`,
} as const;

/**
 * Max-width queries, for the cases where retrofitting mobile-first onto an
 * existing desktop rule would mean rewriting the rule entirely. Prefer `up`.
 */
export const down = {
  sm: `@media (max-width:${BREAKPOINTS.sm - 1}px)`,
  md: `@media (max-width:${BREAKPOINTS.md - 1}px)`,
  lg: `@media (max-width:${BREAKPOINTS.lg - 1}px)`,
} as const;

// ── Touch ───────────────────────────────────────────────────────────────────
/** WCAG 2.5.5 Target Size (AAA) and Apple HIG both land on 44px. */
export const TOUCH_MIN = 44;

/**
 * Minimum font size for a text input. Mobile Safari zooms the viewport whenever
 * a focused input renders below 16px, which is why every search box in this app
 * currently zooms the page on an iPhone. This is not a preference -- 16px is the
 * threshold the browser enforces.
 */
export const INPUT_FONT_MIN = 16;

// ── Global CSS ──────────────────────────────────────────────────────────────
// Injected once from app/layout.tsx. Deliberately minimal: font plumbing, a
// spacing scale, and safety rules that should never have been per-surface.
// Nothing here sets colour, because the two surfaces have distinct palettes.
export const GLOBAL_CSS = `
:root {
  /* Font stacks. --font-sans is bound to the self-hosted next/font family in
     app/layout.tsx; the rest of the stack is the fallback while it swaps in.
     --font-mono is a pure system stack: every modern OS ships an excellent
     monospace, so shipping a webfont for label text was never worth the bytes
     (three surfaces were each downloading JetBrains Mono separately). */
  --font-sans: var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, 'SFMono-Regular', 'SF Mono', 'Cascadia Mono', 'Segoe UI Mono', Consolas, monospace;

  /* Spacing scale. Replaces the 19 distinct ad-hoc padding values previously
     in use across the two stylesheets. */
  --s-1:4px; --s-2:8px; --s-3:12px; --s-4:16px; --s-5:24px; --s-6:32px; --s-7:48px;

  /* The touch floor, referenced by both surfaces so it can never drift. */
  --touch:${TOUCH_MIN}px;
}

/* Horizontal-overflow backstop. A single unwrapped table or an over-wide flex
   row should degrade to a scrollable region, never to a page that slides
   sideways -- which is what the admin tab bar currently does. This is a safety
   net, not a substitute for fixing the offending element. */
html, body { max-width:100%; overflow-x:hidden; }

/* Long unbroken strings (URLs, slugs, keywords) are everywhere in this product
   and are the other common source of horizontal overflow. */
body { overflow-wrap:break-word; }

/* Momentum scrolling and no scroll-chaining for the horizontally scrollable
   regions this app relies on (tables, tab strips). */
[data-scroll-x] {
  overflow-x:auto;
  overscroll-behavior-x:contain;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:thin;
}

/* Respect the OS setting globally rather than per-surface. */
@media (prefers-reduced-motion:reduce) {
  *, *::before, *::after {
    animation-duration:.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:.01ms !important;
    scroll-behavior:auto !important;
  }
}
`;

/**
 * Card-stack table rules for one scoped surface.
 *
 * Pairs with app/_components/ResponsiveTable.tsx, which stamps each <td> with
 * its column's heading. Above `sm` this is inert -- the table renders exactly
 * as it always has, so desktop is untouched by definition rather than by
 * careful matching.
 *
 * `scope` is the surface's root class (".portal" or ".sr"); `cardBg`, `line`
 * and `muted` are the surface's own colour tokens, since the two frontends
 * name theirs differently and neither should hardcode the other's.
 */
export function responsiveTableCSS(
  scope: string,
  vars: { surface: string; line: string; muted: string; text: string; radius: string }
): string {
  return `
/* Both modes scroll horizontally above the card breakpoint, which is the
   existing behaviour every table already had. */
${scope} .rt { overflow-x:auto; overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch; }

${down.sm} {
  /* "scroll" mode opts out of stacking: kept for tables whose point is
     comparing values across rows, where separate cards destroy the comparison.
     A soft edge fade signals there is more to the right. */
  ${scope} .rt-scroll {
    -webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 24px),transparent);
            mask-image:linear-gradient(90deg,#000 calc(100% - 24px),transparent);
  }
  ${scope} .rt-scroll table { min-width:max-content; }

  /* ── Card stack ── */
  ${scope} .rt-stack { overflow-x:visible; }
  ${scope} .rt-stack table,
  ${scope} .rt-stack tbody,
  ${scope} .rt-stack tr,
  ${scope} .rt-stack td { display:block; width:100%; }

  /* Headings move into each cell as a label, so the row of <th> is redundant
     visually -- but it stays in the accessibility tree rather than being
     display:none'd, which would remove it for screen readers too. */
  ${scope} .rt-stack thead {
    position:absolute; width:1px; height:1px; margin:-1px; padding:0;
    overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap;
  }

  ${scope} .rt-stack tr {
    background:${vars.surface}; border:1px solid ${vars.line}; border-radius:${vars.radius};
    padding:13px 15px; margin-bottom:9px;
  }
  ${scope} .rt-stack tr:last-child { margin-bottom:0; }
  ${scope} .rt-stack tbody tr:hover td { background:none; }

  ${scope} .rt-stack td {
    display:flex; align-items:baseline; justify-content:space-between; gap:14px;
    padding:6px 0; border:0; text-align:right;
  }
  ${scope} .rt-stack td::before {
    content:attr(data-label);
    flex:0 0 auto; max-width:46%;
    text-align:left; font-size:11.5px; font-weight:600; letter-spacing:.01em;
    color:${vars.muted}; text-transform:none;
  }
  /* Cells with no column heading, and full-width cells (empty states, notes),
     render as ordinary blocks rather than pretending to be a labelled value. */
  ${scope} .rt-stack td:not([data-label]) { display:block; text-align:left; }
  ${scope} .rt-stack td[data-full] { text-align:left; padding:4px 0; }

  /* The first cell is the row's identity -- it reads as the card's heading
     rather than as one more label/value pair. */
  ${scope} .rt-stack td:first-child {
    display:block; text-align:left;
    font-size:14px; font-weight:600; color:${vars.text};
    padding:0 0 9px; margin-bottom:5px; border-bottom:1px solid ${vars.line};
    overflow-wrap:anywhere;
  }
  ${scope} .rt-stack td:first-child::before { display:none; }

  /* Action buttons in a card get room to be tapped rather than being squeezed
     against the right edge. */
  ${scope} .rt-stack td:last-child:not(:first-child) { padding-top:9px; }
}
`;
}

/**
 * Touch-target and input-sizing rules for one scoped surface.
 *
 * Generated rather than hand-written per surface because both frontends need
 * identical guarantees and the two stylesheets would otherwise drift again.
 * `scope` is the surface's root class (".portal" or ".sr").
 *
 * Uses min-height rather than height so nothing that is already taller shrinks,
 * and applies to the real elements rather than a utility class so it cannot be
 * forgotten on a new control.
 */
export function touchTargetCSS(scope: string): string {
  return `
/* Every interactive control clears the ${TOUCH_MIN}px floor on touch devices.
   Scoped to (pointer:coarse) so mouse-driven desktop layouts keep their tighter,
   more information-dense sizing -- a 44px floor everywhere would make the
   desktop tables and toolbars noticeably looser for no benefit. */
@media (pointer:coarse) {
  ${scope} button,
  ${scope} [role="button"],
  ${scope} a[class*="btn"],
  ${scope} input:not([type="checkbox"]):not([type="radio"]),
  ${scope} select,
  ${scope} textarea {
    min-height:var(--touch);
  }
  ${scope} button, ${scope} [role="button"] { min-width:var(--touch); }
  /* Controls that sit inside dense text runs opt out via this attribute. */
  ${scope} [data-touch="inline"] { min-height:0; min-width:0; }
}

/* 16px on every text-entry field, at every size, to stop mobile Safari zooming
   the viewport on focus. Applied outside the pointer query because the zoom
   behaviour keys off the rendered size, not the input device. */
${scope} input:not([type="checkbox"]):not([type="radio"]),
${scope} select,
${scope} textarea {
  font-size:${INPUT_FONT_MIN}px;
}
${up.md} {
  /* Above the sidebar breakpoint there is no mobile-zoom behaviour to defend
     against, so fields return to the denser scale the desktop layout was
     designed around. */
  ${scope} input:not([type="checkbox"]):not([type="radio"]),
  ${scope} select,
  ${scope} textarea { font-size:14px; }
}
`;
}
