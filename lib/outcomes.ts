// Outcome attribution — honest linkage from executed SEO work to later
// measurable Search Console movement.
//
// Design rules:
// 1. Never invent a win. Prefer "too early" / "insufficient data" over guessing.
// 2. Respect GSC lag (~2–3 days). Judging before that is marketing, not SEO.
// 3. Pure functions here so the API and tests share one source of truth.
// 4. Attribution is correlative, not causal — copy must stay humble.

export const GSC_LAG_DAYS = 3;
export const BASELINE_DAYS = 14;
export const MEASURE_DAYS = 14;
/** Days after the action before we will call improved/declined/unchanged. */
export const MIN_JUDGMENT_DAYS = GSC_LAG_DAYS + 7;
export const MIN_WINDOW_IMPRESSIONS = 30;
/** Average position must move by at least this many places to count. */
export const POSITION_DELTA_THRESHOLD = 1.0;
/** Relative CTR change (fraction) required when position is noisy. */
export const CTR_RELATIVE_THRESHOLD = 0.15;
/** Absolute click gain that can support an "improved" call with enough volume. */
export const CLICK_GAIN_THRESHOLD = 5;

export type OutcomeStatus =
  | "too_early"
  | "insufficient_data"
  | "improved"
  | "declined"
  | "unchanged"
  | "unlinked";

export type DailyMetric = {
  date: string; // YYYY-MM-DD
  position: number | null;
  clicks: number;
  impressions: number;
  ctr: number;
};

export type MetricWindow = {
  position: number | null;
  clicks: number;
  impressions: number;
  ctr: number;
  days: number;
};

export type ActionForAttribution = {
  id: string;
  occurredAt: string; // ISO
  eventType: string;
  eventLabel: string;
  eventDetail?: string | null;
  pageUrl?: string | null;
  keyword?: string | null;
};

export type AttributedOutcome = {
  actionId: string;
  occurredAt: string;
  eventType: string;
  eventLabel: string;
  eventDetail: string | null;
  pageUrl: string | null;
  keyword: string | null;
  status: OutcomeStatus;
  explanation: string;
  before: MetricWindow | null;
  after: MetricWindow | null;
  deltas: {
    position: number | null;
    clicks: number | null;
    ctr: number | null;
  } | null;
};

function dayString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(isoDay: string, days: number): string {
  const d = new Date(isoDay + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return dayString(d);
}

function daysBetween(a: string, b: string): number {
  const ms = Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z");
  return Math.floor(ms / 864e5);
}

/** Aggregate daily rows into an impression-weighted window. */
export function aggregateWindow(rows: DailyMetric[]): MetricWindow {
  let clicks = 0;
  let impressions = 0;
  let posWeight = 0;
  let posSum = 0;
  const days = new Set<string>();

  for (const r of rows) {
    days.add(r.date);
    clicks += r.clicks || 0;
    impressions += r.impressions || 0;
    if (r.position != null && r.impressions > 0) {
      posSum += r.position * r.impressions;
      posWeight += r.impressions;
    } else if (r.position != null) {
      posSum += r.position;
      posWeight += 1;
    }
  }

  const position = posWeight > 0 ? Math.round((posSum / posWeight) * 10) / 10 : null;
  const ctr = impressions > 0 ? clicks / impressions : 0;
  return { position, clicks, impressions, ctr, days: days.size };
}

export function filterWindow(
  history: DailyMetric[],
  startInclusive: string,
  endExclusive: string,
): DailyMetric[] {
  return history.filter((r) => r.date >= startInclusive && r.date < endExclusive);
}

/**
 * Decide the outcome from two windows. Pure — no clocks, no network.
 * `daysSinceAction` is supplied by the caller so tests stay deterministic.
 */
export function judgeWindows(
  before: MetricWindow | null,
  after: MetricWindow | null,
  daysSinceAction: number,
  linked: boolean,
): { status: OutcomeStatus; explanation: string; deltas: AttributedOutcome["deltas"] } {
  if (!linked) {
    return {
      status: "unlinked",
      explanation:
        "This change went live, but we don't yet have a keyword or page to measure against in Search Console.",
      deltas: null,
    };
  }

  if (daysSinceAction < MIN_JUDGMENT_DAYS) {
    const wait = MIN_JUDGMENT_DAYS - daysSinceAction;
    return {
      status: "too_early",
      explanation:
        wait <= 1
          ? "Search Console still needs a little more time before a result can be read honestly."
          : `Search Console usually lags 2–3 days. Check back in about ${wait} days for a fair read.`,
      deltas: null,
    };
  }

  if (!before || !after) {
    return {
      status: "insufficient_data",
      explanation:
        "There isn't enough ranking history around this change yet to compare before and after.",
      deltas: null,
    };
  }

  if (
    before.impressions < MIN_WINDOW_IMPRESSIONS ||
    after.impressions < MIN_WINDOW_IMPRESSIONS
  ) {
    return {
      status: "insufficient_data",
      explanation:
        "Impressions are too thin in the before/after windows to claim a result. Thin data lies.",
      deltas: {
        position:
          before.position != null && after.position != null
            ? Math.round((before.position - after.position) * 10) / 10
            : null,
        clicks: after.clicks - before.clicks,
        ctr: Math.round((after.ctr - before.ctr) * 10000) / 10000,
      },
    };
  }

  const posDelta =
    before.position != null && after.position != null
      ? Math.round((before.position - after.position) * 10) / 10 // positive = improved
      : null;
  const clickDelta = after.clicks - before.clicks;
  const ctrDelta = Math.round((after.ctr - before.ctr) * 10000) / 10000;
  const deltas = { position: posDelta, clicks: clickDelta, ctr: ctrDelta };

  const positionImproved = posDelta != null && posDelta >= POSITION_DELTA_THRESHOLD;
  const positionDeclined = posDelta != null && posDelta <= -POSITION_DELTA_THRESHOLD;
  const ctrImproved =
    before.ctr > 0 && after.ctr >= before.ctr * (1 + CTR_RELATIVE_THRESHOLD);
  const ctrDeclined =
    before.ctr > 0 && after.ctr <= before.ctr * (1 - CTR_RELATIVE_THRESHOLD);
  const clicksImproved = clickDelta >= CLICK_GAIN_THRESHOLD;
  const clicksDeclined = clickDelta <= -CLICK_GAIN_THRESHOLD;

  // Position is the primary SEO signal. Clicks/CTR can support when position
  // is flat, but cannot overturn a clear position decline.
  if (positionImproved || (posDelta != null && Math.abs(posDelta) < POSITION_DELTA_THRESHOLD && (ctrImproved || clicksImproved) && !positionDeclined)) {
    const bits: string[] = [];
    if (positionImproved) bits.push(`average position improved by ${posDelta}`);
    if (clicksImproved) bits.push(`clicks +${clickDelta}`);
    if (ctrImproved) bits.push(`CTR moved from ${(before.ctr * 100).toFixed(1)}% to ${(after.ctr * 100).toFixed(1)}%`);
    return {
      status: "improved",
      explanation:
        `Compared with the ${BASELINE_DAYS} days before publish, the next measured window looks better` +
        (bits.length ? `: ${bits.join("; ")}.` : ".") +
        " Correlation, not proof — other changes can move the same query.",
      deltas,
    };
  }

  if (positionDeclined || (posDelta != null && Math.abs(posDelta) < POSITION_DELTA_THRESHOLD && (ctrDeclined || clicksDeclined) && !positionImproved)) {
    const bits: string[] = [];
    if (positionDeclined) bits.push(`average position slipped by ${Math.abs(posDelta!)}`);
    if (clicksDeclined) bits.push(`clicks ${clickDelta}`);
    if (ctrDeclined) bits.push(`CTR moved from ${(before.ctr * 100).toFixed(1)}% to ${(after.ctr * 100).toFixed(1)}%`);
    return {
      status: "declined",
      explanation:
        `Compared with the ${BASELINE_DAYS} days before publish, the next measured window looks weaker` +
        (bits.length ? `: ${bits.join("; ")}.` : ".") +
        " Worth a refresh — not every publish wins.",
      deltas,
    };
  }

  return {
    status: "unchanged",
    explanation:
      "Before and after sit within normal noise. No clear win or loss yet — keep watching the next sync.",
    deltas,
  };
}

/** Attribute one action against a keyword/page history series. */
export function attributeAction(
  action: ActionForAttribution,
  history: DailyMetric[],
  now: Date = new Date(),
): AttributedOutcome {
  const actionDay = action.occurredAt.slice(0, 10);
  const today = dayString(now);
  const daysSince = daysBetween(actionDay, today);
  const linked = !!(action.keyword || action.pageUrl);

  const baselineStart = addDays(actionDay, -BASELINE_DAYS);
  const measureStart = addDays(actionDay, GSC_LAG_DAYS);
  const measureEnd = addDays(measureStart, MEASURE_DAYS);

  const beforeRows = filterWindow(history, baselineStart, actionDay);
  const afterRows = filterWindow(history, measureStart, measureEnd);
  const before = beforeRows.length ? aggregateWindow(beforeRows) : null;
  const after = afterRows.length ? aggregateWindow(afterRows) : null;

  const judged = judgeWindows(before, after, daysSince, linked);

  return {
    actionId: action.id,
    occurredAt: action.occurredAt,
    eventType: action.eventType,
    eventLabel: action.eventLabel,
    eventDetail: action.eventDetail ?? null,
    pageUrl: action.pageUrl ?? null,
    keyword: action.keyword ?? null,
    status: judged.status,
    explanation: judged.explanation,
    before,
    after,
    deltas: judged.deltas,
  };
}

export type OutcomeSummary = {
  improved: number;
  declined: number;
  unchanged: number;
  too_early: number;
  insufficient_data: number;
  unlinked: number;
  total: number;
};

export function summariseOutcomes(items: AttributedOutcome[]): OutcomeSummary {
  const s: OutcomeSummary = {
    improved: 0,
    declined: 0,
    unchanged: 0,
    too_early: 0,
    insufficient_data: 0,
    unlinked: 0,
    total: items.length,
  };
  for (const i of items) s[i.status] += 1;
  return s;
}

/** Human label for status chips — never celebratory for uncertain states. */
export function outcomeStatusLabel(status: OutcomeStatus): string {
  switch (status) {
    case "improved":
      return "Improved";
    case "declined":
      return "Declined";
    case "unchanged":
      return "No clear change";
    case "too_early":
      return "Too early";
    case "insufficient_data":
      return "Not enough data";
    case "unlinked":
      return "Not linked yet";
  }
}
