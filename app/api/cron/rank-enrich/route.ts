import { NextRequest, NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { clearStale } from "@/lib/queue";
import { triggerRankEnrich, drainBrand } from "@/lib/runner";
import { orderByLastCompletedJob, PER_BRAND_BUDGET_MS, TICK_BUDGET_MS } from "@/lib/scheduling";

export const maxDuration = 60;

// Weekly cron (Monday 7am): seed + drain rank_enrich for every active brand.
// Enrichment = DataForSEO difficulty/intent + AI opportunity scoring. Runs
// weekly to control DataForSEO API cost. Each brand is processed
// independently — one brand failing (or running out of this tick's time
// budget) never blocks the rest.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await clearStale();
  const brands = await getActiveBrands();

  // Sprint 6.4 Phase 1: most-overdue brand first (see lib/scheduling.ts).
  const ordered = await orderByLastCompletedJob(brands, "rank_enrich");

  // Sprint 6.4 Phase 2: fixed per-brand budget instead of a shared countdown
  // (see lib/scheduling.ts).
  const tickStart = Date.now();
  const results: Record<string, unknown>[] = [];

  for (const brand of ordered) {
    if (Date.now() - tickStart > TICK_BUDGET_MS) {
      results.push({ brand: brand.slug, skipped: "out of time this tick" });
      continue;
    }
    try {
      const seed = await triggerRankEnrich(brand);
      const drain = await drainBrand(brand, PER_BRAND_BUDGET_MS);
      results.push({ brand: brand.slug, ...seed, ...drain });
    } catch (err) {
      results.push({ brand: brand.slug, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, queued: brands.length, results });
}
