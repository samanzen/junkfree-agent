import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getBrandById } from "@/lib/brands";
import { enqueue, pendingCount, type JobKind } from "@/lib/queue";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { describeConnections, type ConnectionKey } from "@/lib/connections";
import { disconnectIntegration } from "@/lib/integrations";
import type { SitePlatform } from "@/lib/execution/types";
import { listProperties } from "@/lib/gsc";

export const maxDuration = 60;

// CONNECTIONS API — the Integration Center's read and write surface.
//
// Before this, the Connections tab derived two booleans from brand columns and
// rendered them. It could not report freshness, could not act, and could not
// explain anything.
//
// Deliberately not a second version of anything: connection STATE is described
// once in lib/connections.ts, credentials live in lib/integrations.ts, adapter
// credential checks stay in /api/execution, and syncs go through lib/queue's
// enqueue() rather than running work inline. This route only authorises and
// dispatches.

// GET — every connection for a brand, with live status.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const connections = await describeConnections(brand);
  return NextResponse.json({ connections });
}

type Action = "connect" | "disconnect" | "reconnect" | "sync_now";

// Which job kind a "Sync now" maps to. Reuses the existing queue and steps —
// this never runs agent work inline, it only asks for it.
const SYNC_JOBS: Partial<Record<ConnectionKey, JobKind[]>> = {
  search_console: ["rank_sync"],
  keyword_data: ["rank_enrich"],
  website_publishing: ["publish"],
};

// POST — act on a connection.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string; key?: ConnectionKey; action?: Action; account?: string;
  };
  const { brand_id: brandId, key, action, account } = body;

  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;
  if (!key || !action) return NextResponse.json({ error: "key and action required" }, { status: 400 });

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  // ── Sync now ──────────────────────────────────────────────────────────────
  if (action === "sync_now") {
    const kinds = SYNC_JOBS[key];
    if (!kinds?.length) {
      return NextResponse.json(
        { error: "This connection doesn't have anything to sync." },
        { status: 400 }
      );
    }
    // Don't stack duplicate work if a sync is already waiting.
    const pending = await pendingCount(brandId, kinds);
    if (pending > 0) {
      return NextResponse.json({
        ok: true, queued: false,
        message: "A sync is already in progress — we'll use that one.",
      });
    }
    await enqueue(brandId, kinds[0], {});
    return NextResponse.json({
      ok: true, queued: true,
      message: "Sync started. Fresh data usually lands within a few minutes.",
    });
  }

  // ── Search Console: connect / reconnect / disconnect ──────────────────────
  if (key === "search_console") {
    if (action === "disconnect") {
      const { error } = await db.from("brands").update({ gsc_property: null }).eq("id", brandId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        ok: true,
        message: "Search Console disconnected. Ranking and traffic data will stop updating.",
      });
    }

    // connect / reconnect both mean: prove we can read the property, then record it.
    // There is no OAuth redirect — access is granted by adding our service
    // account as a user on the property in Search Console.
    let available: { siteUrl: string }[];
    try {
      available = await listProperties();
    } catch (e) {
      return NextResponse.json(
        {
          error: "Couldn't reach Search Console to verify access.",
          detail: e instanceof Error ? e.message : String(e),
        },
        { status: 502 }
      );
    }

    // Reconnect with nothing chosen just re-verifies what is already stored.
    const wanted = account || brand.gsc_property;
    if (!wanted) {
      return NextResponse.json({ error: "Choose a property to connect." }, { status: 400 });
    }
    if (!available.some((p) => p.siteUrl === wanted)) {
      return NextResponse.json(
        {
          error: "We don't have access to that property.",
          detail:
            "Add our service account as a user on the property in Search Console, then try again.",
        },
        { status: 403 }
      );
    }

    const { error } = await db.from("brands").update({ gsc_property: wanted }).eq("id", brandId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      message:
        action === "reconnect"
          ? "Reconnected — we can read this property."
          : "Connected. Your first data sync will start shortly.",
    });
  }

  // ── Website publishing ────────────────────────────────────────────────────
  if (key === "website_publishing") {
    if (action === "disconnect") {
      // Credentials are per-provider; clear whichever is currently stored.
      const provider = (account === "webhook" ? "webhook" : "wordpress") as SitePlatform;
      await disconnectIntegration(brandId, provider);
      return NextResponse.json({
        ok: true,
        message: "Website disconnected. Approved work will need publishing by hand.",
      });
    }
    // Connecting requires credentials, which are entered on the Website page's
    // existing publishing panel rather than duplicated here.
    return NextResponse.json({
      ok: false,
      redirect: "/portal/website",
      message: "Website publishing is set up on the Website page.",
    });
  }

  return NextResponse.json(
    { error: "That connection can't be changed from here." },
    { status: 400 }
  );
}
