import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { latestWithDelta, series } from "@/lib/metrics";
import { strikingDistance } from "@/lib/gsc";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

// Customer-facing data API. Returns plain-English summaries — no agent
// terminology, no raw markdown, no admin fields. Safe to expose to customers.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const { data: brand } = await db.from("brands").select("*").eq("id", brandId).single();
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const [{ current, previous }, ts, drafts, gbpPosts, citations, lessons] = await Promise.all([
    latestWithDelta(brandId),
    series(brandId, 12),
    db.from("drafts").select("title,task_type,status,created_at,target_keyword")
      .eq("brand_id", brandId).in("status", ["published", "approved"])
      .order("created_at", { ascending: false }).limit(10),
    db.from("gbp_posts").select("title,status,created_at")
      .eq("brand_id", brandId).order("created_at", { ascending: false }).limit(5),
    db.from("citations").select("name,url,category,status,priority")
      .eq("brand_id", brandId).order("priority", { ascending: false }).limit(8),
    db.from("lessons").select("lesson,created_at")
      .eq("brand_id", brandId).order("created_at", { ascending: false }).limit(3),
  ]);

  const keywords = brand.gsc_property
    ? await strikingDistance(brand.gsc_property).catch(() => [])
    : [];

  // Compute delta helpers
  const delta = (key: string) => {
    if (!current || !previous) return null;
    const c = (current as Record<string, unknown>)[key];
    const p = (previous as Record<string, unknown>)[key];
    if (c == null || p == null) return null;
    return (c as number) - (p as number);
  };

  // Published content this month
  const thisMonth = new Date();
  thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);
  const publishedThisMonth = (drafts.data || []).filter(
    (d) => new Date(d.created_at) >= thisMonth
  ).length;

  return NextResponse.json({
    brand: { name: brand.name, site_url: brand.site_url, service_area: brand.service_area, business_model: brand.business_model },
    metrics: {
      organic_traffic: current?.organic_traffic ?? null,
      organic_keywords: current?.organic_keywords ?? null,
      backlinks: current?.backlinks ?? null,
      referring_domains: current?.referring_domains ?? null,
      striking_distance: current?.striking_distance ?? null,
      avg_position: current?.avg_position ?? null,
      ai_visibility: current?.ai_visibility ?? null,
      site_health: current?.site_health ?? null,
      traffic_delta: delta("organic_traffic"),
      keywords_delta: delta("organic_keywords"),
      backlinks_delta: delta("backlinks"),
      position_delta: delta("avg_position"),
    },
    chart: ts.map((s) => ({
      date: new Date(s.captured_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" }),
      traffic: s.organic_traffic ?? 0,
      keywords: s.organic_keywords ?? 0,
    })),
    activity: {
      published_this_month: publishedThisMonth,
      recent_content: (drafts.data || []).slice(0, 5).map((d) => ({
        title: d.title.replace(/^(Blog|Page|New blog|New page):\s*/i, ""),
        keyword: d.target_keyword,
        published_at: d.created_at,
      })),
      gbp_posts_drafted: (gbpPosts.data || []).length,
      citations_found: (citations.data || []).length,
      citations_live: (citations.data || []).filter((c) => c.status === "live").length,
    },
    opportunities: keywords.slice(0, 5).map((k) => ({
      keyword: k.keyword,
      position: k.position,
      impressions: k.impressions,
    })),
    insights: (lessons.data || []).map((l) => l.lesson),
  });
}
