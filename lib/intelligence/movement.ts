/** Shared helpers for Intelligence keyword position / movement views. */

export type KeywordPosRow = {
  keyword_id: string;
  position: number;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  landing_page: string | null;
  captured_date: string;
};

export type NamedPosRow = {
  keyword: string;
  position: number;
  clicks: number | null;
  impressions: number | null;
  landing_page: string | null;
  captured_date: string;
};

/**
 * Pick latest and previous snapshot per keyword from a date-desc-capable list.
 * Avoids blank Position when rank_sync did not run today.
 */
export function pickLatestAndPrevious(rows: KeywordPosRow[]): Map<
  string,
  { latest: KeywordPosRow; previous: KeywordPosRow | null }
> {
  const byKw = new Map<string, KeywordPosRow[]>();
  for (const r of rows) {
    const list = byKw.get(r.keyword_id) || [];
    list.push(r);
    byKw.set(r.keyword_id, list);
  }
  const out = new Map<string, { latest: KeywordPosRow; previous: KeywordPosRow | null }>();
  for (const [id, list] of byKw) {
    list.sort((a, b) => (a.captured_date < b.captured_date ? 1 : -1));
    out.set(id, { latest: list[0], previous: list[1] || null });
  }
  return out;
}

/**
 * Build current vs prior maps from recent snapshots.
 * Prefer the latest date as "current", and the nearest earlier date as "previous"
 * — not an exact calendar D-7 that often has no rows when cron skipped a day.
 */
export function buildMovementMaps(rows: NamedPosRow[]): {
  currentDate: string | null;
  previousDate: string | null;
  curMap: Map<string, NamedPosRow>;
  prevMap: Map<string, number>;
} {
  const dates = [...new Set(rows.map((r) => r.captured_date))].sort().reverse();
  const currentDate = dates[0] || null;
  const previousDate = dates.find((d) => d !== currentDate) || null;
  return mapsForDates(rows, currentDate, previousDate);
}

/**
 * Period report: compare the oldest sync day in the window to the newest.
 * Used when the user picks Last 7 / 30 / 90 days — “where we were → where we are.”
 */
export function buildPeriodMovementMaps(rows: NamedPosRow[]): {
  currentDate: string | null;
  previousDate: string | null;
  curMap: Map<string, NamedPosRow>;
  prevMap: Map<string, number>;
} {
  const dates = [...new Set(rows.map((r) => r.captured_date))].sort();
  if (dates.length === 0) return mapsForDates(rows, null, null);
  if (dates.length === 1) return mapsForDates(rows, dates[0], null);
  return mapsForDates(rows, dates[dates.length - 1], dates[0]);
}

function mapsForDates(
  rows: NamedPosRow[],
  currentDate: string | null,
  previousDate: string | null
): {
  currentDate: string | null;
  previousDate: string | null;
  curMap: Map<string, NamedPosRow>;
  prevMap: Map<string, number>;
} {
  const curMap = new Map<string, NamedPosRow>();
  const prevMap = new Map<string, number>();
  for (const r of rows) {
    if (r.captured_date === currentDate && !curMap.has(r.keyword)) curMap.set(r.keyword, r);
    if (previousDate && r.captured_date === previousDate && !prevMap.has(r.keyword)) {
      prevMap.set(r.keyword, r.position);
    }
  }
  return { currentDate, previousDate, curMap, prevMap };
}
