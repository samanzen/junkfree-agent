import { NextRequest, NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { clearStale } from "@/lib/queue";
import { triggerBrandRun, drainBrand } from "@/lib/runner";
import { requireAuth, isAuthError, requireAdmin } from "@/lib/auth";
import { orderByLastCompletedRun, PER_BRAND_BUDGET_MS, TICK_BUDGET_MS } from "@/lib/scheduling";

export const maxDuration = 60;

// Daily cron trigger (Vercel Cron: 0 9 * * *). This route processes EVERY
// active brand in one pass, so unlike /api/run (brand-scoped, used by the
// dashboard) it is deliberately restricted to trusted callers only:
//
// GET  = Vercel Cron, authenticated via `Authorization: Bearer ${CRON_SECRET}`.
// POST = admin-only manual trigger for the full multi-brand cycle (e.g. to
//        run today's cron early) — requires a real admin session via
//        requireAuth/requireAdmin. No customer session can ever reach this;
//        customers (and admins acting on a single brand) use /api/run instead.
//
// Unlike the old version, this actually PROCESSES each brand's queue
// (seed + drain) instead of only enqueueing jobs and leaving them queued
// forever — previously nothing ever drained a cron-seeded queue unless a
// human happened to open the dashboard afterward.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return runQueue();
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  return runQueue();
}

async function runQueue() {
  await clearStale();
  const brands = await getActiveBrands();
  if (!brands.length) {
    return NextResponse.json({ error: "No active brands." }, { status: 400 });
  }

  // Sprint 6.4 Phase 1: process the most-overdue brand first, so a brand
  // skipped by today's shared time budget is first in line tomorrow instead
  // of being skippable indefinitely (see lib/scheduling.ts).
  const ordered = await orderByLastCompletedRun(brands);

  // Sprint 6.4 Phase 2: each brand gets its own fixed budget rather than a
  // shared countdown, so a slow brand can never reduce a later brand's share
  // to zero. Each brand is seeded + drained independently inside its own
  // try/catch, so one brand erroring (or using its full allotment) can never
  // stop the rest from being attempted — a brand that runs out of budget or
  // fails simply keeps its queued jobs for the next tick (daily) or a manual
  // "Run agents now" click.
  const tickStart = Date.now();
  const results: Record<string, unknown>[] = [];

  for (const brand of ordered) {
    if (Date.now() - tickStart > TICK_BUDGET_MS) {
      results.push({ brand: brand.slug, skipped: "out of time this tick" });
      continue;
    }
    try {
      const seed = await triggerBrandRun(brand);
      const drain = await drainBrand(brand, PER_BRAND_BUDGET_MS);
      results.push({ brand: brand.slug, ...seed, ...drain });
    } catch (err) {
      results.push({ brand: brand.slug, error: String(err) });
    }
  }

  return NextResponse.json({ ok: true, brands: results.length, results });
}
