import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import {
  buildPositionMetricsMap,
  isKeywordDbSort,
  isKeywordMetricSort,
  mergeKeywordWithMetrics,
  positionLookbackDate,
  sortKeywordRows,
  type PositionRow,
} from "@/lib/keywords";

export const maxDuration = 30;

/** Cap in-memory sort loads so a huge Managed brand can't OOM the route. */
const METRIC_SORT_CAP = 5000;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const sortParam = url.searchParams.get("sort") || "ai_opportunity_score";
  const ascending = url.searchParams.get("order") === "asc";
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50", 10));
  const offset = (page - 1) * limit;

  const metricSort = isKeywordMetricSort(sortParam);
  const dbSort = isKeywordDbSort(sortParam) ? sortParam : "ai_opportunity_score";

  const selectCols =
    "id,keyword,status,source,search_volume,keyword_difficulty,search_intent,cpc,ai_opportunity_score,ai_opportunity_reason,estimated_monthly_clicks,estimated_revenue_impact,best_position,best_position_date,worst_position,first_seen_date,last_seen_date,enriched_at";

  let q = db
    .from("tracked_keywords")
    .select(selectCols, { count: "exact" })
    .eq("brand_id", brandId)
    .neq("status", "lost");

  if (search) q = q.ilike("keyword", `%${search}%`);
  if (status) q = q.eq("status", status);

  if (metricSort) {
    // Need the full filtered set to sort by live position / change / clicks.
    q = q.order("ai_opportunity_score", { ascending: false, nullsFirst: false });
    q = q.range(0, METRIC_SORT_CAP - 1);
  } else {
    q = q.order(dbSort, { ascending, nullsFirst: false });
    q = q.range(offset, offset + limit - 1);
  }

  const { data: keywords, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = await attachLatestPositions(brandId, keywords || []);

  let pageRows = rows;
  let total = count || 0;

  if (metricSort) {
    const sorted = sortKeywordRows(rows, sortParam, ascending);
    total = count || sorted.length;
    pageRows = sorted.slice(offset, offset + limit);
  }

  return NextResponse.json({ keywords: pageRows, total, page, limit });
}

async function attachLatestPositions<T extends { id: string }>(
  brandId: string,
  keywords: T[],
) {
  const kwIds = keywords.map((k) => k.id);
  if (!kwIds.length) return [];

  const since = positionLookbackDate(90);
  const { data: positions } = await db
    .from("keyword_positions")
    .select("keyword_id, position, clicks, impressions, ctr, landing_page, captured_date")
    .eq("brand_id", brandId)
    .in("keyword_id", kwIds)
    .gte("captured_date", since)
    .order("captured_date", { ascending: false });

  const metricsMap = buildPositionMetricsMap((positions || []) as PositionRow[]);
  return keywords.map((kw) => mergeKeywordWithMetrics(kw, metricsMap.get(kw.id)));
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id, keyword } = await req.json().catch(() => ({}));
  if (!brand_id || !keyword) {
    return NextResponse.json({ error: "brand_id and keyword required" }, { status: 400 });
  }
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db.from("tracked_keywords").upsert({
    brand_id,
    keyword: keyword.trim().toLowerCase(),
    source: "manual",
    first_seen_date: today,
    status: "new",
  }, { onConflict: "brand_id,keyword" }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, keyword: data });
}
