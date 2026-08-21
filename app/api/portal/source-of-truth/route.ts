import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";
import {
  CONFIRMED_OPTIONS,
  confirmSourceOfTruth,
  isConfirmedSourceOfTruth,
  parseSourceOfTruth,
  probeSourceOfTruth,
  persistSourceOfTruth,
  writerForConfirmed,
} from "@/lib/execution/source-of-truth";
import { isSitePlatform } from "@/lib/execution/registry";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;
  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const limited = await enforceRate(brandId, "dispatch");
  if (limited) return limited;

  let sot = parseSourceOfTruth(brand.source_of_truth);
  if (!sot.detected) {
    const probe = await probeSourceOfTruth(
      brand.site_url,
      brand.primary_writer && isSitePlatform(brand.primary_writer) ? brand.primary_writer : null
    );
    sot = {
      ...sot,
      detected: probe.detected,
      confidence: probe.confidence,
      signals: probe.signals,
      detected_at: new Date().toISOString(),
    };
    await persistSourceOfTruth(brandId, sot);
  }

  return NextResponse.json({
    source_of_truth: sot,
    options: CONFIRMED_OPTIONS,
    writer_for_confirmed: writerForConfirmed(sot.confirmed),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;
  const body = (await req.json().catch(() => ({}))) as { brand_id?: string; confirmed?: string };
  const brandId = body.brand_id;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;
  const limited = await enforceRate(brandId, "dispatch");
  if (limited) return limited;
  if (!isConfirmedSourceOfTruth(body.confirmed)) {
    return NextResponse.json({ error: "Choose where new pages are saved." }, { status: 400 });
  }
  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const next = await confirmSourceOfTruth(brandId, body.confirmed);
  const needed = writerForConfirmed(next.confirmed);
  const pinned = brand.primary_writer && isSitePlatform(brand.primary_writer) ? brand.primary_writer : null;
  const matches = !needed || needed === pinned;

  return NextResponse.json({
    ok: true,
    source_of_truth: next,
    matches_writer: matches,
    message: next.confirmed === "unknown"
      ? "We can reach the website, but we need to know where new pages are saved before publishing can be proven."
      : matches
        ? "Saved. You can prove publishing next."
        : "Saved. Connect the matching website before proving publishing.",
  });
}
