import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";
import { db } from "@/lib/supabase";
import { disconnectIntegration } from "@/lib/integrations";
import { INTEGRATION_SITE_PLATFORMS } from "@/lib/execution/registry";
import {
  newProxySiteToken,
  normalizeProxyNamespace,
  namespaceValidationError,
  parseProxyClaimCheck,
  isProxySiteToken,
} from "@/lib/execution/proxy-token";
import { claimAllowsSetup } from "@/lib/proxy/claim-check";
import { capabilityMapFor } from "@/lib/execution/site-capabilities";
import { proxyAdapter } from "@/lib/execution/adapters/proxy";
import { persistSourceOfTruth } from "@/lib/execution/source-of-truth";
import { invalidateProxyToken } from "@/lib/proxy/resolve";
import { rewriteSnippets, proxyAppOrigin, SNIPPET_HOSTS } from "@/lib/proxy/snippets";
import type { IntegrationProvider } from "@/lib/integrations";

export const maxDuration = 60;

/**
 * Mint/store proxy token + namespace after a clear claim check.
 * Does NOT set primary_writer — that happens when Prove publishing passes.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string;
    namespace?: string;
    rotate_token?: boolean;
  };
  const brandId = body.brand_id;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const limited = await enforceRate(brandId, "dispatch");
  if (limited) return limited;

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const nsErr = namespaceValidationError(body.namespace || brand.proxy_namespace || "");
  if (nsErr) return NextResponse.json({ error: nsErr }, { status: 400 });
  const namespace = normalizeProxyNamespace(body.namespace || brand.proxy_namespace || "");

  const claim = parseProxyClaimCheck(brand.proxy_claim_check);
  if (!claim || claim.namespace !== namespace || !claimAllowsSetup(claim.result)) {
    return NextResponse.json(
      { error: "Check that this path is free on your site first." },
      { status: 400 }
    );
  }

  const rotate = body.rotate_token === true || !isProxySiteToken(brand.proxy_site_token);
  if (rotate && brand.proxy_site_token) invalidateProxyToken(brand.proxy_site_token);
  const token = rotate ? newProxySiteToken() : (brand.proxy_site_token as string);
  const now = new Date().toISOString();

  // Disconnect CMS writers so Approve doesn't publish elsewhere mid-setup.
  for (const provider of INTEGRATION_SITE_PLATFORMS) {
    await disconnectIntegration(brandId, provider as IntegrationProvider);
  }

  const map = capabilityMapFor(proxyAdapter);
  const { error } = await db
    .from("brands")
    .update({
      proxy_site_token: token,
      proxy_namespace: namespace,
      proxy_token_rotated_at: rotate ? now : brand.proxy_token_rotated_at || now,
      // Pending until Prove — do not pin primary_writer yet.
      primary_writer: brand.primary_writer === "proxy" ? "proxy" : null,
      site_capabilities: map,
    })
    .eq("id", brandId);

  if (error) {
    return NextResponse.json(
      { error: `Could not save subdirectory publishing (${error.message}).` },
      { status: 500 }
    );
  }

  // Acknowledgment SoT — we own this namespace.
  await persistSourceOfTruth(brandId, {
    detected: "application_database",
    confidence: "high",
    signals: [{ id: "proxy_setup", evidence: `Pages under /${namespace}/ will be hosted for you.` }],
    detected_at: now,
    confirmed: "platform_proxy",
    confirmed_at: now,
  });

  let siteHost = "www.example.com";
  try {
    siteHost = new URL(brand.site_url).host;
  } catch {
    /* keep placeholder */
  }

  const snippets = rewriteSnippets({
    namespace,
    token,
    appOrigin: proxyAppOrigin(),
    siteHost,
  });

  return NextResponse.json({
    ok: true,
    token,
    namespace,
    appOrigin: proxyAppOrigin(),
    hosts: SNIPPET_HOSTS,
    snippets,
    message: "Add the rewrite on your host, then prove publishing.",
  });
}
