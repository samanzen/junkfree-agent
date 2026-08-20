import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";
import {
  upsertIntegrationCredentials,
  disconnectIntegration,
  getIntegration,
} from "@/lib/integrations";
import { getAdapter, isSitePlatform, SITE_PLATFORMS } from "@/lib/execution/registry";
import type { SitePlatform } from "@/lib/execution/types";
import { capabilityMapFor, clearBrandWriter, persistBrandWriter } from "@/lib/execution/site-capabilities";

export const maxDuration = 60;

// PUBLISHING CONNECT — WordPress, Shopify, or a coded-site receiver.
//
// Live adapter.check() runs BEFORE credentials are stored. A brand has one
// active publisher: connecting a second disconnects the first.

function httpsUrl(raw: string, label: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) return { ok: false, error: `${label} is required.` };
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: `${label} must be a valid address.` };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: `${label} must use https://.` };
  }
  return { ok: true, url: trimmed };
}

function normalizeShop(raw: string): { ok: true; shop: string } | { ok: false; error: string } {
  const trimmed = (raw || "").trim().toLowerCase();
  if (!trimmed) return { ok: false, error: "Shopify store is required." };
  const host = trimmed
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "")
    .replace(/\.myshopify\.com$/i, "");
  if (!/^[a-z0-9][a-z0-9-]*$/.test(host)) {
    return { ok: false, error: "Use your store name, e.g. mystore or mystore.myshopify.com." };
  }
  return { ok: true, shop: `${host}.myshopify.com` };
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
    shop?: string;
    accessToken?: string;
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
    return NextResponse.json(
      { error: "Choose WordPress, Shopify, or your own website." },
      { status: 400 }
    );
  }
  const platform: SitePlatform = platformRaw;
  const adapter = getAdapter(platform);

  if (action === "disconnect") {
    for (const provider of SITE_PLATFORMS) {
      await disconnectIntegration(brandId, provider);
    }
    await clearBrandWriter(brandId);
    return NextResponse.json({
      ok: true,
      message: "Website disconnected. Approved work will need publishing by hand.",
    });
  }

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
        {
          error:
            "Application password is required. Create one in WordPress under Users → Profile → Application Passwords.",
        },
        { status: 400 }
      );
    }
    credentials = { username, applicationPassword };
    config = {
      siteUrl: site.url,
      status: body.publishStatus === "draft" ? "draft" : "publish",
    };
  } else if (platform === "shopify") {
    const shop = normalizeShop(body.shop || "");
    if (!shop.ok) return NextResponse.json({ error: shop.error }, { status: 400 });
    const accessToken = (body.accessToken || "").trim();
    if (!accessToken || accessToken.length < 20) {
      return NextResponse.json(
        {
          error:
            "Admin access token is required. Create a custom app in Shopify admin and paste the token.",
        },
        { status: 400 }
      );
    }
    credentials = { accessToken };
    config = {
      shop: shop.shop,
      status: body.publishStatus === "draft" ? "draft" : "publish",
    };
  } else {
    const receiver = httpsUrl(body.endpointUrl || "", "Website address");
    if (!receiver.ok) return NextResponse.json({ error: receiver.error }, { status: 400 });
    const signingSecret = (body.signingSecret || "").trim();
    if (signingSecret.length < 16) {
      return NextResponse.json(
        { error: "Use the secret shown on this page — it has to match the code on your site." },
        { status: 400 }
      );
    }
    credentials = { signingSecret };
    config = { endpointUrl: receiver.url };
  }

  const check = await adapter.check({ brand, credentials, config }).catch((e) => ({
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

  await upsertIntegrationCredentials(brandId, platform, credentials, config);

  for (const other of SITE_PLATFORMS) {
    if (other === platform) continue;
    const prior = await getIntegration(brandId, other);
    if (prior?.status === "connected") {
      await disconnectIntegration(brandId, other);
    }
  }

  await persistBrandWriter(brandId, platform, capabilityMapFor(adapter));

  const messages: Record<SitePlatform, string> = {
    wordpress:
      "WordPress is reachable. We can send approved pages. Automatic publishing stays off until publishing is proven.",
    shopify:
      "Shopify is reachable. We can send approved pages. Automatic publishing stays off until publishing is proven.",
    webhook:
      "We can reach your website. Approved work can still be sent. Automatic publishing stays off until publishing is proven.",
  };

  return NextResponse.json({
    ok: true,
    platform,
    message: messages[platform],
    detail: check.detail || null,
  });
}
