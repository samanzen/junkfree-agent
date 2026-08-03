import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { strikingDistance, lowCtrPages } from "@/lib/gsc";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const { data: brand } = await db.from("brands").select("*").eq("id", brandId).single();

  // Fetch snapshots directly — avoid wrapper functions that may have issues
  const { data: snapshots } = await db.from("metric_snapshots")
    .select("*")
    .eq("brand_id", brandId)
    .order("captured_at", { ascending: false })
    .limit(32);

  const current = snapshots?.[0] || null;
  const previous = snapshots?.[1] || null;
  const series = [...(snapshots || [])].reverse();

  const [drafts, runs] = await Promise.all([
    db.from("drafts").select("task_type,status,created_at")
      .eq("brand_id", brandId).order("created_at", { ascending: false }).limit(200),
    db.from("runs").select("status,tasks_planned,drafts_produced,created_at")
      .eq("brand_id", brandId).order("created_at", { ascending: false }).limit(30),
  ]);

  const [keywords, lowCtr] = await Promise.all([
    brand?.gsc_property ? strikingDistance(brand.gsc_property).catch(() => []) : Promise.resolve([]),
    brand?.gsc_property ? lowCtrPages(brand.gsc_property).catch(() => []) : Promise.resolve([]),
  ]);

  const draftList = drafts.data || [];
  const runList = runs.data || [];
  const byType = draftList.reduce<Record<string, number>>((acc, d) => {
    acc[d.task_type] = (acc[d.task_type] || 0) + 1;
    return acc;
  }, {});
  const now = Date.now();
  const weeks: Record<string, number> = {};
  for (const d of draftList) {
    const age = (now - new Date(d.created_at).getTime()) / (7 * 864e5);
    if (age > 8) continue;
    const wk = `W-${Math.floor(age) === 0 ? "now" : Math.floor(age)}`;
    weeks[wk] = (weeks[wk] || 0) + 1;
  }

  return NextResponse.json({
    current,
    previous,
    series: series.map((s) => ({
      ...s,
      d: new Date(s.captured_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
    })),
    keywords: (keywords || []).slice(0, 15),
    lowCtrPages: (lowCtr || []).slice(0, 10),
    gscConnected: !!brand?.gsc_property,
    agent: {
      total_published: draftList.filter((d) => d.status === "published").length,
      pending_review: draftList.filter((d) => d.status === "pending_review").length,
      total_runs: runList.length,
      successful_runs: runList.filter((r) => r.status === "done").length,
      content_by_type: byType,
      weekly_activity: Object.entries(weeks).map(([week, count]) => ({ week, count })).reverse(),
    },
  });
}
