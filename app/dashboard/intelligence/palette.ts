// Chart and status colours for the Intelligence tab.
//
// These files previously carried their own private scheme — a mint #00B894, a
// sand #F5B461, a coral #FF6B6B, an indigo #6C5CE7 and a grey #9AA3B2 spread
// across nine files with no relationship to anything else in the product. Two
// of those greys (#9AA3B2 at 2.8:1, #B2BAC8 at 1.95:1) were also unreadable as
// text on white.
//
// Recharts takes literal colour strings for fill and stroke, so these cannot be
// CSS custom properties. They are re-exported from the shared palette instead,
// which is what keeps the charts and the rest of the product in step.

import { SEMANTIC, BRAND_COLOR, SYSTEM_COLOR, CHART } from "@/lib/ui/tokens";

const L = SEMANTIC.light;
/** The validated categorical order — data identity, not decoration. */
export const SERIES = CHART.series;

/** AI/system: work the platform did on its own. Its own hue, not the brand's. */
export const SYSTEM = SYSTEM_COLOR.light.base;
export const ON_SYSTEM = SYSTEM_COLOR.light.on;
/** Brand ink, for chrome inside charts (active pills, primary buttons). */
export const BRAND = BRAND_COLOR.light.base;
export const ON_BRAND = BRAND_COLOR.light.on;

export const POSITIVE = L.green;
export const ATTENTION = L.amber;
export const NEGATIVE = L.red;
export const ACCENT_ALT = L.pink;

/** Readable as TEXT on white (4.5:1), unlike the greys these replace. */
export const MUTED = "#5F6B7D";
/** Axis ticks and gridlines — non-text, so the 3:1 floor applies. */
export const AXIS = CHART.axis;
export const GRID = CHART.grid;
/** Inactive / "lost" series. */
export const INACTIVE = MUTED;

/** Keyword movement status. */
export const STATUS_COLOR: Record<string, string> = {
  improving: POSITIVE,
  stable: ATTENTION,
  declining: NEGATIVE,
  new: SYSTEM,
  lost: INACTIVE,
  recovered: POSITIVE,
};

/** Search intent — categorical, so it draws from the validated series order. */
export const INTENT_COLOR: Record<string, string> = {
  commercial: SERIES[0],
  transactional: SERIES[2],
  informational: SERIES[5],
  navigational: MUTED,
};

/** Recommendation category — categorical identity, one hue per category. */
export const CAT_COLOR: Record<string, string> = {
  keyword: SERIES[0],
  content: SERIES[4],
  backlink: SERIES[3],
  technical: SERIES[1],
  local: SERIES[2],
};

/** Soft tint of any of the above, for badge backgrounds. Matches the 9% used
 *  by the shared palette's -soft tokens rather than the old ad-hoc "18" hex
 *  suffix, which produced a 9.4% alpha by coincidence. */
export function tint(hex: string, alpha = 0.09): string {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}
