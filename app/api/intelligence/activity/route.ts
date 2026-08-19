import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { lookbackDateISO, parseReportDays } from "@/lib/intelligence/reportRange";

export const maxDuration = 30;

/**
 * Reports → AI Work: what the agents published and which keywords they touched.
 * Built for the colorful activity / digest views (and future weekly emails).
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const days = parseReportDays(url.searchParams.get("days"), 30);
  const since = lookbackDateISO(days);
  const sinceIso = new Date(Date.now() - days * 864e5).toISOString();

  const [
    { data: publishedDrafts },
    { data: contentRows },
    { data: keywordRows },
    { data: gbpRows },
    { data: runs },
  ] = await Promise.all([
    db
      .from("drafts")
      .select("id, title, task_type, target_keyword, status, created_at, rationale")
      .eq("brand_id", brandId)
      .eq("status", "published")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(50),
    db
      .from("content")
      .select("slug, title, published_at")
      .eq("brand_id", brandId)
      .gte("published_at", sinceIso)
      .order("published_at", { ascending: false })
      .limit(50),
    db
      .from("tracked_keywords")
      .select("keyword, best_position, status, search_volume, ai_opportunity_score, last_seen_date")
      .eq("brand_id", brandId)
      .in("status", ["improving", "new", "declining"])
      .order("ai_opportunity_score", { ascending: false, nullsFirst: false })
      .limit(40),
    db
      .from("gbp_posts")
      .select("id, title, status, created_at")
      .eq("brand_id", brandId)
      .in("status", ["approved", "published", "posted"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(20),
    db
      .from("runs")
      .select("status, drafts_produced, created_at")
      .eq("brand_id", brandId)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const drafts = publishedDrafts || [];
  const pages = contentRows || [];
  const keywords = keywordRows || [];
  const gbp = gbpRows || [];
  const runList = runs || [];

  const byType = drafts.reduce<Record<string, number>>((acc, d) => {
    acc[d.task_type] = (acc[d.task_type] || 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    days,
    since,
    summary: {
      pages_published: pages.length,
      drafts_published: drafts.length,
      google_posts: gbp.length,
      keywords_touched: keywords.length,
      agent_runs: runList.length,
      successful_runs: runList.filter((r) => r.status === "done").length,
      by_type: byType,
    },
    published_pages: pages,
    published_drafts: drafts,
    google_posts: gbp,
    keywords_worked: keywords,
  });
}
