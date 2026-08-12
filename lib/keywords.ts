/**
 * Keyword rank helpers shared by the intelligence keywords API and UI.
 *
 * Position change convention matches Semrush / winners-losers:
 *   position_change = previous_position - current_position
 *   positive → improved (rank number went down)
 *   negative → declined
 */

export type PositionRow = {
  keyword_id: string;
  position: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  landing_page: string | null;
  captured_date: string;
};

export type KeywordPositionMetrics = {
  position: number | null;
  previous_position: number | null;
  position_change: number | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  landing_page: string | null;
  captured_date: string | null;
  previous_captured_date: string | null;
};

export const EMPTY_POSITION_METRICS: KeywordPositionMetrics = {
  position: null,
  previous_position: null,
  position_change: null,
  clicks: null,
  impressions: null,
  ctr: null,
  landing_page: null,
  captured_date: null,
  previous_captured_date: null,
};

/** Columns that live on tracked_keywords and can be sorted in Postgres. */
export const KEYWORD_DB_SORTS = [
  "ai_opportunity_score",
  "search_volume",
  "keyword_difficulty",
  "keyword",
  "status",
  "best_position",
  "cpc",
  "estimated_monthly_clicks",
] as const;

/** Columns derived from keyword_positions — sorted in memory after join. */
export const KEYWORD_METRIC_SORTS = [
  "position",
  "position_change",
  "clicks",
  "ctr",
  "impressions",
] as const;

export type KeywordDbSort = (typeof KEYWORD_DB_SORTS)[number];
export type KeywordMetricSort = (typeof KEYWORD_METRIC_SORTS)[number];

export function isKeywordDbSort(sort: string): sort is KeywordDbSort {
  return (KEYWORD_DB_SORTS as readonly string[]).includes(sort);
}

export function isKeywordMetricSort(sort: string): sort is KeywordMetricSort {
  return (KEYWORD_METRIC_SORTS as readonly string[]).includes(sort);
}

/** Rows must be newest-first for each keyword. */
export function pickLatestAndPrevious(rows: PositionRow[]): {
  latest: PositionRow | null;
  previous: PositionRow | null;
} {
  if (!rows.length) return { latest: null, previous: null };
  const latest = rows[0];
  const previous = rows.find((r) => r.captured_date !== latest.captured_date) ?? null;
  return { latest, previous };
}

export function computePositionChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | null {
  if (current == null || previous == null) return null;
  return previous - current;
}

export function metricsFromPositionHistory(rows: PositionRow[]): KeywordPositionMetrics {
  const { latest, previous } = pickLatestAndPrevious(rows);
  if (!latest) return { ...EMPTY_POSITION_METRICS };

  const position = latest.position == null ? null : Number(latest.position);
  const previousPosition = previous?.position == null ? null : Number(previous.position);

  return {
    position,
    previous_position: previousPosition,
    position_change: computePositionChange(position, previousPosition),
    clicks: latest.clicks,
    impressions: latest.impressions,
    ctr: latest.ctr == null ? null : Number(latest.ctr),
    landing_page: latest.landing_page,
    captured_date: latest.captured_date,
    previous_captured_date: previous?.captured_date ?? null,
  };
}

/** Group flat position rows (already newest-first overall) into per-keyword metrics. */
export function buildPositionMetricsMap(
  rows: PositionRow[],
): Map<string, KeywordPositionMetrics> {
  const byKw = new Map<string, PositionRow[]>();
  for (const row of rows) {
    const list = byKw.get(row.keyword_id);
    if (list) list.push(row);
    else byKw.set(row.keyword_id, [row]);
  }

  const out = new Map<string, KeywordPositionMetrics>();
  for (const [id, list] of byKw) {
    // Ensure newest-first even if caller didn't sort perfectly within a keyword.
    list.sort((a, b) => (a.captured_date < b.captured_date ? 1 : a.captured_date > b.captured_date ? -1 : 0));
    out.set(id, metricsFromPositionHistory(list));
  }
  return out;
}

export function mergeKeywordWithMetrics<T extends { id: string }>(
  keyword: T,
  metrics: KeywordPositionMetrics | undefined,
): T & KeywordPositionMetrics {
  return { ...keyword, ...(metrics || EMPTY_POSITION_METRICS) };
}

export function sortKeywordRows<T extends Record<string, unknown>>(
  rows: T[],
  sort: string,
  ascending: boolean,
): T[] {
  const dir = ascending ? 1 : -1;
  const copy = [...rows];
  copy.sort((a, b) => {
    const av = a[sort];
    const bv = b[sort];
    if (av == null && bv == null) return 0;
    if (av == null) return 1; // nulls last
    if (bv == null) return -1;
    if (typeof av === "string" && typeof bv === "string") {
      return av.localeCompare(bv) * dir;
    }
    return ((av as number) - (bv as number)) * dir;
  });
  return copy;
}

/** Short path for landing URL display (Semrush-style). */
export function shortLandingPath(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = url.startsWith("http") ? new URL(url) : new URL(url, "https://example.com");
    const path = u.pathname === "/" ? u.hostname + "/" : u.pathname;
    return path.length > 48 ? path.slice(0, 45) + "…" : path;
  } catch {
    return url.length > 48 ? url.slice(0, 45) + "…" : url;
  }
}

/** Lookback window when resolving latest + previous captures. */
export function positionLookbackDate(days = 90): string {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}
