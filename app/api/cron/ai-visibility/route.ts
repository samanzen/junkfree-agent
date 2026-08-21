import { NextRequest, NextResponse } from "next/server";
import { getActiveBrands, getBrandById } from "@/lib/brands";
import { clearStale } from "@/lib/queue";
import { triggerAiVisibility, drainBrand } from "@/lib/runner";
import { requireAuth, isAuthError, requireAdmin } from "@/lib/auth";
import { orderByLastCompletedJob, PER_BRAND_BUDGET_MS, TICK_BUDGET_MS } from "@/lib/scheduling";
import { selectedProviders } from "@/lib/ai-visibility/providers";

export const maxDuration = 60;

// Weekly cron (Tuesday 8am): seed + drain the AI-visibility sweep for every
// active brand — the questions people ask ChatGPT, Gemini, Claude, Perplexity
// and Google's AI Overview, and whether the brand is recommended in the answer.
//
// WHY WEEKLY, AND WHY ITS OWN CRON. Every check is a web-search-grounded model
// call, which is the most expensive call the platform makes, and the answers are
// non-deterministic: ask the same model the same question twice and the list of
// recommended businesses changes. The signal is therefore a rate across many
// prompts and repeated sweeps, not a daily reading. Folding this into the daily
// orchestrate cron would multiply cost sevenfold for a noisier number.
//
// GET  = Vercel Cron, authenticated via `Authorization: Bearer ${CRON_SECRET}`.
// POST = admin-only manual trigger for ONE brand, for the same reason
//        rank-enrich has one: an admin sometimes needs a fresh sweep without
//        waiting for the weekly tick, but the button must never be reachable by
//        a customer, whose click would spend real money on a metered vendor.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const adminErr = requireAdmin(auth);
  if (adminErr) return adminErr;

  const { brand_id } = await req.json().catch(() => ({}));
  if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });

  const brand = await getBrandById(brand_id);
  if (!brand || !brand.active) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  // Told plainly rather than silently seeding a sweep that would do nothing:
  // with no assistant credentials there is no one to ask.
  const providers = selectedProviders();
  if (!providers.length) {
    return NextResponse.json(
      {
        error: "no_assistants",
        message:
          "No AI assistant is configured. Set at least one of ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENAI_API_KEY, PERPLEXITY_API_KEY, or DataForSEO credentials for Google AI Overviews.",
      },
      { status: 400 }
    );
  }

  await clearStale(brand.id);
  const result = await triggerAiVisibility(brand);
  if (result.status === "locked") {
    return NextResponse.json(
      { error: "locked", message: "This brand already has a run starting elsewhere. Try again shortly." },
      { status: 409 }
    );
  }
  return NextResponse.json({
    ok: true,
    brand: brand.slug,
    queued: result.queued,
    assistants: providers.map((p) => p.id),
  });
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const providers = selectedProviders();
  if (!providers.length) {
    return NextResponse.json({
      ok: true,
      skipped: "no assistant credentials configured",
      queued: 0,
      results: [],
    });
  }

  await clearStale();
  const brands = await getActiveBrands();

  // Most-overdue brand first, so a brand skipped by this tick's shared budget
  // is first in line next week rather than skippable indefinitely.
  const ordered = await orderByLastCompletedJob(brands, "ai_visibility");

  const tickStart = Date.now();
  const results: Record<string, unknown>[] = [];

  for (const brand of ordered) {
    if (Date.now() - tickStart > TICK_BUDGET_MS) {
      results.push({ brand: brand.slug, skipped: "out of time this tick" });
      continue;
    }
    try {
      const seed = await triggerAiVisibility(brand);
      // A sweep enqueues its own continuations, so a brand whose sweep does not
      // finish inside this budget keeps its queued jobs. They drain on the next
      // tick, or sooner if anything else drains the brand's queue.
      const drain = await drainBrand(brand, PER_BRAND_BUDGET_MS);
      results.push({ brand: brand.slug, ...seed, ...drain });
    } catch (err) {
      results.push({ brand: brand.slug, error: String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    assistants: providers.map((p) => p.id),
    queued: brands.length,
    results,
  });
}
