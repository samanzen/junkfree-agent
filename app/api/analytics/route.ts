import { NextRequest, NextResponse } from "next/server";
import { series, latestWithDelta } from "@/lib/metrics";
import { db } from "@/lib/supabase";
import { strikingDistance, lowCtrPages } from "@/lib/gsc";

// Feeds the admin Overview dashboard.
// Returns: KPIs + deltas, time series, top keywords, low-CTR pages,
// recent runs, and agent activity summary.
export async function GET(req: NextRequest) {
  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });

  const { data: brand } = await db.from("brands").select("*").eq("id", brandId).single();

  const [{ current, previous }, ts, allSnapshots, drafts, runs] = await Promise.all([
    latestWithDelta(brandId),
    series(brandId, 30),
    series(brandId, 90),     // 90 days for the full trend
    db.from("drafts").select("task_type,status,created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(200),
    db.from("runs").select("status,tasks_planned,drafts_produced,created_at")
      .eq("brand_id", brandId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const [keywords, lowCtr] = await Promise.all([
    brand?.gsc_property ? strikingDistance(brand.gsc_property).catch(() => []) : Promise.resolve([]),
    brand?.gsc_property ? lowCtrPages(brand.gsc_property).catch(() => []) : Promise.resolve([]),
  ]);

  // Agent activity stats
  const draftList = drafts.data || [];
  const runList = runs.data || [];
  const totalPublished = draftList.filter((d) => d.status === "published").length;
  const totalPending = draftList.filter((d) => d.status === "pending_review").length;
  const totalRuns = runList.length;
  const successfulRuns = runList.filter((r) => r.status === "done").length;

  // Content breakdown by type
  const byType = draftList.reduce<Record<string, number>>((acc, d) => {
    acc[d.task_type] = (acc[d.task_type] || 0) + 1;
    return acc;
  }, {});

  // Weekly activity bucketed (last 8 weeks)
  const weeklyActivity = buildWeeklyActivity(draftList);

  return NextResponse.json({
    current,
    previous,
    series: ts,
    allSnapshots,
    keywords: (keywords || []).slice(0, 15),
    lowCtrPages: (lowCtr || []).slice(0, 10),
    agent: {
      total_published: totalPublished,
      pending_review: totalPending,
      total_runs: totalRuns,
      successful_runs: successfulRuns,
      content_by_type: byType,
      weekly_activity: weeklyActivity,
    },
  });
}

function buildWeeklyActivity(drafts: { created_at: string; status: string }[]) {
  const weeks: Record<string, number> = {};
  const now = Date.now();
  for (const d of drafts) {
    const age = (now - new Date(d.created_at).getTime()) / (7 * 864e5);
    if (age > 8) continue;
    const wk = Math.floor(age);
    const label = `W-${wk === 0 ? "now" : wk}`;
    weeks[label] = (weeks[label] || 0) + 1;
  }
  return Object.entries(weeks)
    .map(([week, count]) => ({ week, count }))
    .reverse();
}
