import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";
import {
  upsertIntegrationCredentials,
  disconnectIntegration,
  getIntegration,
} from "@/lib/integrations";
import { getAdapter, isSitePlatform } from "@/lib/execution/registry";
import type { SitePlatform } from "@/lib/execution/types";

export const maxDuration = 60;

// PUBLISHING CONNECT — customer-facing setup for WordPress / webhook.
//
// The Connections tab used to redirect "Connect" to /portal/website, which had
// no credential form. This route is the missing write path: validate inputs,
// live-check the adapter, then encrypt credentials into brand_integrations.
// Secrets are never echoed back.

function httpsUrl(raw: string, label: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return { ok: false, error: `${label} is required.` };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: `${label} must be a valid URL.` };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: `${label} must use https://.` };
  }
  return { ok: true, url: trimmed };
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string;
    action?: "connect" | "disconnect" | "test";
    platform?: string;
    siteUrl?: string;
    username?: string;
    applicationPassword?: string;
    publishStatus?: "publish" | "draft";
    endpointUrl?: string;
    signingSecret?: string;
  };

  const brandId = body.brand_id;
  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const limited = await enforceRate(brandId, "dispatch");
  if (limited) return limited;

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const action = body.action || "connect";
  const platformRaw = body.platform || "wordpress";
  if (!isSitePlatform(platformRaw)) {
    return NextResponse.json({ error: "Choose WordPress or a webhook endpoint." }, { status: 400 });
  }
  const platform: SitePlatform = platformRaw;
  const adapter = getAdapter(platform);

  // ── Disconnect ────────────────────────────────────────────────────────────
  if (action === "disconnect") {
    await disconnectIntegration(brandId, platform);
    return NextResponse.json({
      ok: true,
      message: "Website disconnected. Approved work will need publishing by hand.",
    });
  }

  // ── Connect / test ────────────────────────────────────────────────────────
  let credentials: Record<string, string>;
  let config: Record<string, unknown>;

  if (platform === "wordpress") {
    const site = httpsUrl(body.siteUrl || brand.site_url || "", "Website address");
    if (!site.ok) return NextResponse.json({ error: site.error }, { status: 400 });
    const username = (body.username || "").trim();
    const applicationPassword = (body.applicationPassword || "").trim().replace(/\s+/g, "");
    if (!username) return NextResponse.json({ error: "WordPress username is required." }, { status: 400 });
    if (!applicationPassword) {
      return NextResponse.json(
        { error: "Application password is required. Create one in WordPress under Users → Profile → Application Passwords." },
        { status: 400 }
      );
    }
    credentials = { username, applicationPassword };
    config = {
      siteUrl: site.url,
      status: body.publishStatus === "draft" ? "draft" : "publish",
    };
  } else {
    const endpoint = httpsUrl(body.endpointUrl || "", "Webhook URL");
    if (!endpoint.ok) return NextResponse.json({ error: endpoint.error }, { status: 400 });
    const signingSecret = (body.signingSecret || "").trim();
    if (signingSecret.length < 16) {
      return NextResponse.json(
        { error: "Signing secret must be at least 16 characters." },
        { status: 400 }
      );
    }
    credentials = { signingSecret };
    config = { endpointUrl: endpoint.url };
  }

  const check = await adapter
    .check({ brand, credentials, config })
    .catch((e) => ({
      ok: false as const,
      detail: e instanceof Error ? e.message : String(e),
    }));

  if (!check.ok) {
    return NextResponse.json(
      {
        error: "We couldn't connect to that website.",
        detail: check.detail || "Check the details and try again.",
      },
      { status: 422 }
    );
  }

  if (action === "test") {
    return NextResponse.json({
      ok: true,
      platform,
      message: check.detail || "Connection looks good.",
    });
  }

  // Only store after a successful live check — never persist credentials that
  // cannot authenticate.
  await upsertIntegrationCredentials(brandId, platform, credentials, config);

  // A brand can only publish through one adapter at a time. If they switch
  // from WordPress to webhook (or the reverse), clear the other so status
  // reporting cannot claim two publishers.
  const other: SitePlatform = platform === "wordpress" ? "webhook" : "wordpress";
  const prior = await getIntegration(brandId, other);
  if (prior?.status === "connected") {
    await disconnectIntegration(brandId, other);
  }

  return NextResponse.json({
    ok: true,
    platform,
    message:
      platform === "wordpress"
        ? "WordPress connected. Approved pages can be published to your site."
        : "Webhook connected. Approved changes will be sent to your endpoint.",
    detail: check.detail || null,
  });
}
