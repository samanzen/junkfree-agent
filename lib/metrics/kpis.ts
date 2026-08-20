export type SnapshotKpis = {
  organic_traffic: number | null;
  organic_keywords: number | null;
  backlinks: number | null;
  referring_domains: number | null;
  striking_distance: number | null;
  avg_position: number | null;
  ai_visibility: number | null;
  site_health: number | null;
};

export const KPI_KEYS = [
  "organic_traffic",
  "organic_keywords",
  "backlinks",
  "referring_domains",
  "striking_distance",
  "avg_position",
  "ai_visibility",
  "site_health",
] as const;

export type KpiKey = (typeof KPI_KEYS)[number];

function asKpiNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Latest snapshot often has nulls for a field when GSC, a sweep, or the
 * health report missed that run. Show the most recent real measurement
 * instead of an empty card. Never invents a number that was never stored.
 */
export function fillSnapshotGaps<T extends Partial<SnapshotKpis>>(
  current: T,
  historyNewestFirst: T[]
): T {
  const filled = { ...current };
  for (const key of KPI_KEYS) {
    if (asKpiNumber(filled[key]) != null) continue;
    for (const row of historyNewestFirst) {
      const n = asKpiNumber(row[key]);
      if (n != null) {
        (filled as SnapshotKpis)[key] = n;
        break;
      }
    }
  }
  return filled;
}

/** Delta between the two most recent non-null values for one KPI. */
export function kpiDelta<T extends Partial<SnapshotKpis>>(
  historyNewestFirst: T[],
  key: KpiKey
): number | null {
  let latest: number | null = null;
  let previous: number | null = null;
  for (const row of historyNewestFirst) {
    const n = asKpiNumber(row[key]);
    if (n == null) continue;
    if (latest == null) latest = n;
    else {
      previous = n;
      break;
    }
  }
  if (latest == null || previous == null) return null;
  return latest - previous;
}
