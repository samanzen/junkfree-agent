/** Shared date ranges for the Reports (ex-Intelligence) UI. */

export const REPORT_RANGES = [
  { days: 3, label: "Last 3 days" },
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
  { days: 90, label: "Last 3 months" },
] as const;

export type ReportRangeDays = (typeof REPORT_RANGES)[number]["days"];

export function parseReportDays(raw: string | null, fallback: ReportRangeDays = 30): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.max(Math.round(n), 1), 365);
}

export function lookbackDateISO(days: number): string {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}
