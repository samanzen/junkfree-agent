import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";
import { db } from "@/lib/supabase";
import { runNamespaceClaimCheck, claimAllowsSetup } from "@/lib/proxy/claim-check";
import { normalizeProxyNamespace, namespaceValidationError } from "@/lib/execution/proxy-token";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as { brand_id?: string; namespace?: string };
  const brandId = body.brand_id;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const limited = await enforceRate(brandId, "dispatch");
  if (limited) return limited;

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const nsErr = namespaceValidationError(body.namespace || "");
  if (nsErr) return NextResponse.json({ error: nsErr }, { status: 400 });

  const namespace = normalizeProxyNamespace(body.namespace || "");
  const check = await runNamespaceClaimCheck(brand.site_url, namespace);

  const { error } = await db
    .from("brands")
    .update({
      proxy_namespace: namespace,
      proxy_claim_check: check,
    })
    .eq("id", brandId);

  if (error) {
    return NextResponse.json(
      { error: `Could not save the path check (${error.message}). Apply migration 022 if needed.` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    check,
    canContinue: claimAllowsSetup(check.result),
  });
}
