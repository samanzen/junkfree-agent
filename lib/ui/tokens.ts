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

// ── Motion ──────────────────────────────────────────────────────────────────
/**
 * The same vocabulary as the CSS custom properties above, for Framer Motion.
 *
 * Kept in seconds because that is what Framer takes, and derived from the same
 * four steps so a CSS transition and a JS animation on the same element move
 * identically. `ease` is the cubic-bezier control points of --ease-out.
 */
export const MOTION = {
  fast: 0.12,
  base: 0.18,
  surface: 0.28,
  entrance: 0.42,
  /** Matches --ease-out. */
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  /** Matches --ease-inout. */
  easeInOut: [0.32, 0.72, 0, 1] as [number, number, number, number],
} as const;

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

  /* ── Motion vocabulary ──
     Before this there were 19 distinct CSS transition durations, 16 more in
     Framer Motion, and three competing easing curves (a bare ease keyword, one
     cubic-bezier in CSS and a different one in JS). Four durations and two
     curves cover everything this product does; anything outside them was
     incidental rather than intentional.

     ease-out is the same curve as MOTION.ease below, so a CSS transition and a
     Framer animation on the same element cannot disagree. */
  --dur-1:120ms;   /* micro: colour and border on hover */
  --dur-2:180ms;   /* default: most state changes */
  --dur-3:280ms;   /* surfaces: drawers, sheets, panels */
  --dur-4:420ms;   /* entrances: hero and page-level reveals */
  --ease-out:cubic-bezier(.16,1,.3,1);      /* decelerate — things arriving */
  --ease-inout:cubic-bezier(.32,.72,0,1);   /* both ends — things moving */
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
 * Form-field and loading rules for one scoped surface.
 *
 * Pairs with app/_components/Field.tsx. Colours are injected from the surface's
 * own tokens so a field looks native to the page it renders on rather than
 * introducing a third visual language. Sizing inherits the Phase 1 guarantees
 * (44px touch floor, 16px inputs) rather than restating them.
 */
export function fieldCSS(
  scope: string,
  vars: { surface: string; line: string; lineStrong: string; muted: string; text: string; accent: string; danger: string; radius: string }
): string {
  return `
${scope} .fld { display:flex; flex-direction:column; gap:6px; min-width:0; }
${scope} .fld-label {
  font-size:12.5px; font-weight:560; letter-spacing:-.005em; color:${vars.text};
  display:inline-flex; align-items:center; gap:3px;
}
${scope} .fld-label-inline { font-weight:500; color:${vars.muted}; cursor:pointer; }
${scope} .fld-req { color:${vars.danger}; font-weight:600; }

/* Visually hidden but present for assistive tech — used by hideLabel and by
   the "(required)" suffix, so "required" is announced rather than conveyed by
   an asterisk alone. */
${scope} .fld-sr {
  position:absolute; width:1px; height:1px; margin:-1px; padding:0;
  overflow:hidden; clip:rect(0 0 0 0); clip-path:inset(50%); white-space:nowrap;
}

${scope} .fld-control { position:relative; display:flex; }
${scope} .fld-input {
  width:100%; background:${vars.surface}; color:${vars.text};
  border:1px solid ${vars.line}; border-radius:${vars.radius};
  padding:10px 13px; font-family:inherit;
  transition:border-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out), background var(--dur-2) var(--ease-out);
}
${scope} .fld-input::placeholder { color:${vars.muted}; opacity:.8; }
${scope} .fld-input:hover:not(:disabled) { border-color:${vars.lineStrong}; }
${scope} .fld-input:focus {
  outline:none; border-color:${vars.accent};
  box-shadow:0 0 0 3px color-mix(in srgb, ${vars.accent} 18%, transparent);
}
${scope} .fld-input:disabled { opacity:.55; cursor:not-allowed; }
${scope} .fld-textarea { min-height:92px; resize:vertical; line-height:1.6; }
${scope} .fld-select { appearance:none; padding-right:34px; cursor:pointer;
  background-image:linear-gradient(45deg,transparent 50%,${vars.muted} 50%),linear-gradient(135deg,${vars.muted} 50%,transparent 50%);
  background-position:calc(100% - 17px) calc(50% + 1px), calc(100% - 12px) calc(50% + 1px);
  background-size:5px 5px, 5px 5px; background-repeat:no-repeat;
}

/* Error state is carried by colour AND by the message below it, never colour
   alone. */
${scope} .fld.is-error .fld-input { border-color:${vars.danger}; }
${scope} .fld.is-error .fld-input:focus {
  box-shadow:0 0 0 3px color-mix(in srgb, ${vars.danger} 18%, transparent);
}
${scope} .fld-helper { font-size:11.5px; line-height:1.5; color:${vars.muted}; margin:0; }
${scope} .fld-error {
  font-size:11.5px; line-height:1.5; color:${vars.danger}; margin:0;
  display:flex; align-items:flex-start; gap:5px;
}
${scope} .fld-error::before { content:"!"; font-weight:700; flex:none; }

/* ── Toggles ── */
${scope} .fld-toggle-row { display:flex; align-items:center; gap:9px; }
${scope} .fld-check, ${scope} .fld-switch { flex:none; cursor:pointer; accent-color:${vars.accent}; }
${scope} .fld-check { width:17px; height:17px; }
${scope} .fld-switch {
  appearance:none; width:38px; height:22px; border-radius:99px;
  background:${vars.line}; border:1px solid ${vars.line}; position:relative;
  transition:background var(--dur-2) var(--ease-out), border-color var(--dur-2) var(--ease-out);
}
${scope} .fld-switch::after {
  content:""; position:absolute; top:2px; left:2px; width:16px; height:16px;
  border-radius:50%; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.22);
  transition:transform var(--dur-2) var(--ease-inout);
}
${scope} .fld-switch:checked { background:${vars.accent}; border-color:${vars.accent}; }
${scope} .fld-switch:checked::after { transform:translateX(16px); }
${scope} .fld-switch:focus-visible, ${scope} .fld-check:focus-visible {
  outline:2px solid ${vars.accent}; outline-offset:2px;
}

/* ── Loading ── */
/* Reserves its own space so nothing reflows when it appears — a spinner that
   shifts the layout is worse than no spinner. */
${scope} .fld-spinner, ${scope} .ld-spinner {
  display:inline-block; width:14px; height:14px; flex:none;
  border:2px solid ${vars.line}; border-top-color:${vars.accent};
  border-radius:50%; animation:ldSpin .7s linear infinite;
}
${scope} .fld-spinner { position:absolute; right:12px; top:50%; margin-top:-7px; }
@keyframes ldSpin { to { transform:rotate(360deg); } }

/* Buttons keep their width while busy, so a label swapping to a spinner cannot
   make the row jump. */
${scope} [data-busy="true"] { position:relative; pointer-events:none; }
${scope} [data-busy="true"] > * { visibility:hidden; }
${scope} [data-busy="true"]::after {
  content:""; position:absolute; inset:0; margin:auto;
  width:15px; height:15px; border:2px solid currentColor; border-top-color:transparent;
  border-radius:50%; opacity:.75; animation:ldSpin .7s linear infinite;
}
`;
}

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
/* A visible focus ring on every focusable thing in this surface.
   Only the portal had one; the admin dashboard and login screen fell back to
   whatever the browser draws, which on a coloured button is often invisible.
   :focus-visible rather than :focus, so a mouse click does not leave a ring
   behind but a Tab always does. currentColor keeps it legible on any
   background without the surface having to declare a ring colour. */
${scope} :focus-visible {
  outline:2px solid currentColor;
  outline-offset:2px;
  border-radius:6px;
}
/* Skip link: present for keyboard users, out of the way for everyone else. */
${scope} .skip-link {
  position:absolute; left:12px; top:-60px; z-index:9500;
  padding:10px 16px; border-radius:10px;
  background:#16181D; color:#F2F4F7; font-size:13px; font-weight:560;
  text-decoration:none; transition:top var(--dur-2) var(--ease-out);
}
${scope} .skip-link:focus { top:12px; }

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
