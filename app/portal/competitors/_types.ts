// Shapes returned by the EXISTING competitor endpoints. Nothing here is
// invented — each field maps 1:1 to something the API already sends.

/** GET /api/intelligence/competitors?brand= */
export type CompetitorRow = {
  id: string;
  brand_id: string;
  domain: string;
  name: string | null;
  active: boolean;
  /** Snapshot of how many keywords they rank for. Null until first analysed. */
  last_keyword_count: number | null;
  last_checked_at: string | null;
  added_at: string;
  gap_available: boolean;
};

/** A keyword the competitor ranks for and we don't. */
export type GapRow = {
  keyword: string;
  position: number;
  volume: number | null;
};

/** A keyword we both rank for, with both positions. */
export type OverlapRow = {
  keyword: string;
  competitor_position: number;
  brand_position: number | null;
  volume: number | null;
};

/** GET /api/intelligence/competitors/[id] */
export type CompetitorAnalysis = {
  competitor: { domain: string; name: string | null };
  total_competitor_keywords: number;
  gaps: GapRow[];
  overlap: OverlapRow[];
  gap_count: number;
};

/** Overlap rows where they currently outrank us — the head-to-head losses. */
export function losingRows(overlap: OverlapRow[]): OverlapRow[] {
  return overlap
    .filter((o) => o.brand_position != null && o.competitor_position < o.brand_position)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0));
}

/** Overlap rows where we currently outrank them. */
export function winningRows(overlap: OverlapRow[]): OverlapRow[] {
  return overlap
    .filter((o) => o.brand_position != null && o.competitor_position > o.brand_position)
    .sort((a, b) => (b.volume || 0) - (a.volume || 0));
}
