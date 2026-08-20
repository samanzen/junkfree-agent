import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";
import { enqueue, pendingCount } from "@/lib/queue";
import { newCanary } from "@/lib/execution/certify";
import { parseSourceOfTruth, sourceOfTruthMatchesWriter } from "@/lib/execution/source-of-truth";
import { isSitePlatform } from "@/lib/execution/registry";
import { parseCapabilityMap } from "@/lib/execution/site-capabilities";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const body = (await req.json().catch(() => ({}))) as { brand_id?: string };
  const brandId = body.brand_id;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;
  const limited = await enforceRate(brandId, "dispatch");
  if (limited) return limited;

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const sot = parseSourceOfTruth(brand.source_of_truth);
  const writer = brand.primary_writer && isSitePlatform(brand.primary_writer) ? brand.primary_writer : null;
  if (!sot.confirmed || sot.confirmed === "unknown") {
    return NextResponse.json({ error: "Confirm where new pages are saved first." }, { status: 400 });
  }
  if (!writer || !sourceOfTruthMatchesWriter(sot, writer)) {
    return NextResponse.json(
      { error: "The connected website does not match where pages are saved." },
      { status: 400 }
    );
  }
  const map = parseCapabilityMap(brand.site_capabilities);
  if (map.upsert_page?.state === "unsupported") {
    return NextResponse.json({ error: "This connection cannot publish pages." }, { status: 400 });
  }

  const pending = await pendingCount(brandId, ["certify"]);
  if (pending > 0) {
    return NextResponse.json({ ok: true, queued: false, message: "A publishing test is already running." });
  }

  const canary = newCanary();
  await enqueue(brandId, "certify", {
    operation: "upsert_page",
    phase: "write",
    ...canary,
    phaseAttempts: 0,
  });

  return NextResponse.json({
    ok: true,
    queued: true,
    message: "Testing publishing now. This usually takes a minute.",
  });
}
