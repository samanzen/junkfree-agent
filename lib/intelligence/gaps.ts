import { topicSlug } from "../recommendations/topic";

export type RankedCompetitorKeyword = {
  keyword: string;
  position: number;
  volume: number | null;
  competitor: string;
};

export type PlannerGap = {
  keyword: string;
  volume: number;
  why?: string;
  page_type?: string;
};

export type SourcedGap = PlannerGap & {
  competitor?: string;
  competitor_position?: number;
};

/** Re-attach the measured competitor rank the recon agent picked from. */
export function attachGapSources(
  gaps: PlannerGap[],
  ranked: RankedCompetitorKeyword[]
): SourcedGap[] {
  return gaps.map((g) => {
    const slug = topicSlug({ keyword: g.keyword });
    const hits = ranked.filter((k) => topicSlug({ keyword: k.keyword }) === slug);
    const best = [...hits].sort((a, b) => a.position - b.position)[0];
    const volume = (best?.volume != null && best.volume > 0) ? best.volume : g.volume;
    return {
      ...g,
      volume,
      competitor: best?.competitor,
      competitor_position: best?.position,
    };
  });
}
