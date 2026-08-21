import { NextRequest, NextResponse } from "next/server";
import { getActiveBrands } from "@/lib/brands";
import { db } from "@/lib/supabase";
import { runNamespaceClaimCheck } from "@/lib/proxy/claim-check";
import { isProxyNamespace } from "@/lib/execution/proxy-token";

export const maxDuration = 60;

/**
 * Re-run namespace claim checks for proxy brands as a health signal.
 * Sites add routes later; collision/loop after certify should surface in
 * proxy_claim_check without blocking publishing mid-flight.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const brands = await getActiveBrands();
  const targets = brands.filter(
    (b) =>
      !!b.proxy_site_token &&
      isProxyNamespace(b.proxy_namespace) &&
      (b.primary_writer === "proxy" || !!b.proxy_namespace)
  );

  const results: Array<{ brand: string; result: string; detail: string }> = [];
  const budgetMs = 50_000;
  const started = Date.now();

  for (const brand of targets) {
    if (Date.now() - started > budgetMs) {
      results.push({ brand: brand.slug, result: "skipped", detail: "out of time this tick" });
      continue;
    }
    try {
      const check = await runNamespaceClaimCheck(brand.site_url, brand.proxy_namespace!);
      const { error } = await db
        .from("brands")
        .update({ proxy_claim_check: check })
        .eq("id", brand.id);
      if (error) {
        results.push({ brand: brand.slug, result: "error", detail: error.message });
      } else {
        results.push({ brand: brand.slug, result: check.result, detail: check.detail });
      }
    } catch (e) {
      results.push({
        brand: brand.slug,
        result: "error",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({ ok: true, checked: results.length, results });
}
