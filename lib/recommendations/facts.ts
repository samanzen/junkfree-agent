import { db } from "../supabase";
import type { KeywordFacts } from "./preview";
import { factsKey, topicSlug } from "./topic";

type TrackedRow = {
  brand_id: string;
  keyword: string;
  search_volume: number | null;
  best_position: number | null;
  search_intent: string | null;
  ai_opportunity_reason: string | null;
  source: string | null;
};

export async function loadKeywordFacts(
  rows: { brand_id: string; target_keyword?: string | null }[]
): Promise<Record<string, KeywordFacts>> {
  const wanted = rows
    .map((r) => ({ brand_id: r.brand_id, keyword: (r.target_keyword || "").trim().toLowerCase() }))
    .filter((r) => r.keyword);
  if (!wanted.length) return {};

  const brandIds = [...new Set(wanted.map((r) => r.brand_id))];

  const { data: tracked } = await db.from("tracked_keywords")
    .select("brand_id, keyword, search_volume, best_position, search_intent, ai_opportunity_reason, source")
    .in("brand_id", brandIds);

  const trackedRows = (tracked || []) as TrackedRow[];
  const matched = new Map<string, TrackedRow>();
  for (const want of wanted) {
    const exact = factsKey(want.brand_id, want.keyword);
    if (matched.has(exact)) continue;
    const slug = topicSlug({ keyword: want.keyword });
    const row = trackedRows.find((t) => t.brand_id === want.brand_id && (
      factsKey(t.brand_id, t.keyword) === exact || topicSlug({ keyword: t.keyword }) === slug
    ));
    if (row) matched.set(exact, row);
  }

  const posKeywords = [...new Set([
    ...wanted.map((w) => w.keyword),
    ...[...matched.values()].map((r) => r.keyword),
  ])];

  const { data: positions } = posKeywords.length
    ? await db.from("keyword_positions")
      .select("brand_id, keyword, impressions, clicks, position, captured_date")
      .in("brand_id", brandIds)
      .in("keyword", posKeywords)
      .order("captured_date", { ascending: false })
    : { data: [] as { brand_id: string; keyword: string; impressions: number | null; clicks: number | null; position: number | null }[] };

  const latestPos = new Map<string, { impressions: number | null; clicks: number | null; position: number | null }>();
  for (const row of positions || []) {
    const key = factsKey(row.brand_id, row.keyword);
    if (!latestPos.has(key)) {
      latestPos.set(key, {
        impressions: row.impressions ?? null,
        clicks: row.clicks ?? null,
        position: row.position ?? null,
      });
    }
  }

  const out: Record<string, KeywordFacts> = {};
  for (const want of wanted) {
    const exact = factsKey(want.brand_id, want.keyword);
    const row = matched.get(exact);
    const pos = latestPos.get(exact)
      || (row ? latestPos.get(factsKey(row.brand_id, row.keyword)) : undefined);
    if (!row && !pos) continue;
    out[exact] = {
      volume: row?.search_volume ?? null,
      position: row?.best_position ?? pos?.position ?? null,
      impressions: pos?.impressions ?? null,
      clicks: pos?.clicks ?? null,
      intent: row?.search_intent ?? null,
      opportunity: row?.ai_opportunity_reason ?? null,
      source: row?.source ?? null,
    };
  }

  return out;
}
