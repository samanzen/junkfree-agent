import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const sort = url.searchParams.get("sort") || "ai_opportunity_score";
  const order = url.searchParams.get("order") === "asc";
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "50"));
  const offset = (page - 1) * limit;

  const safeSort = ["ai_opportunity_score","search_volume","keyword_difficulty","keyword","status","best_position"].includes(sort)
    ? sort : "ai_opportunity_score";

  let q = db.from("tracked_keywords")
    .select("id,keyword,status,source,search_volume,keyword_difficulty,search_intent,cpc,ai_opportunity_score,ai_opportunity_reason,estimated_monthly_clicks,estimated_revenue_impact,best_position,best_position_date,worst_position,first_seen_date,last_seen_date,enriched_at", { count: "exact" })
    .eq("brand_id", brandId)
    .neq("status", "lost");

  if (search) q = q.ilike("keyword", `%${search}%`);
  if (status) q = q.eq("status", status);
  q = q.order(safeSort, { ascending: order, nullsFirst: false });
  q = q.range(offset, offset + limit - 1);

  const { data: keywords, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch latest positions for these keywords
  const today = new Date().toISOString().slice(0, 10);
  const kwIds = (keywords || []).map((k) => k.id);
  const { data: positions } = kwIds.length
    ? await db.from("keyword_positions")
        .select("keyword_id, position, clicks, impressions, ctr, landing_page, captured_date")
        .in("keyword_id", kwIds)
        .eq("captured_date", today)
    : { data: [] };

  const posMap = new Map((positions || []).map((p) => [p.keyword_id, p]));

  const rows = (keywords || []).map((kw) => ({
    ...kw,
    ...(posMap.get(kw.id) || { position: null, clicks: null, impressions: null, ctr: null, landing_page: null }),
  }));

  return NextResponse.json({ keywords: rows, total: count || 0, page, limit });
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
