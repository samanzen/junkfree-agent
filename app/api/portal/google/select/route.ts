import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { isGoogleProduct, listResourcesFor, type GoogleProductKey } from "@/lib/google/registry";
import { readGoogle, selectResource, clearSelection, unlinkAccount, refreshTokenFor } from "@/lib/google/store";
import { revokeToken } from "@/lib/google/oauth";
import { forgetTokens, GoogleReauthRequired } from "@/lib/google/tokens";

export const maxDuration = 60;

// Step 3: what the customer can choose or change after signing in.
//
// GET  — the resources they may pick (websites, properties, locations)
// POST — save a choice, or disconnect
//
// The sign-in itself lives in ../start and ../callback. Everything here is a
// normal authenticated portal call.

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  const product = url.searchParams.get("product") || "";
  const accountId = url.searchParams.get("account") || "";

  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;
  if (!isGoogleProduct(product)) return NextResponse.json({ error: "Unknown connection." }, { status: 400 });

  const google = await readGoogle(brandId);
  // Default to the account already chosen for this product, else the most
  // recently linked one, so the common single-account case needs no argument.
  const chosen =
    accountId ||
    google.selections[product]?.accountId ||
    google.accounts[google.accounts.length - 1]?.id;

  if (!chosen) {
    return NextResponse.json({ accounts: [], resources: [], reason: "not_signed_in" });
  }

  try {
    const resources = await listResourcesFor(brandId, product, chosen);
    return NextResponse.json({
      accounts: google.accounts.map((a) => ({ id: a.id, email: a.email })),
      accountId: chosen,
      resources,
      selected: google.selections[product]?.resourceId || null,
    });
  } catch (err) {
    if (err instanceof GoogleReauthRequired) {
      return NextResponse.json({ accounts: [], resources: [], reason: "reauth_required" }, { status: 200 });
    }
    console.warn(`[google/select] listing ${product} failed:`, err);

    // These read alike in a log and mean opposite things to a customer:
    //
    //   429 / quota   Google has not approved this project's access yet.
    //                 Nothing the customer can do — measured on Business
    //                 Profile, which sits at 0 requests per minute until then.
    //
    //   403 scopes    The signed-in account never granted this permission,
    //                 because it signed in for a different product. Fixed by
    //                 reconnecting, which re-asks with the right scope.
    //
    // Reporting the second as "waiting on Google" would leave someone waiting
    // for something that is never going to arrive.
    const msg = err instanceof Error ? err.message : String(err);
    const reason = /insufficient authentication scopes|Insufficient Permission|ACCESS_TOKEN_SCOPE/i.test(msg)
      ? "scope_missing"
      : "unavailable";
    return NextResponse.json({ accounts: [], resources: [], reason }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = (await req.json().catch(() => ({}))) as {
    brand_id?: string;
    product?: string;
    action?: "select" | "disconnect" | "unlink";
    account_id?: string;
    resource_id?: string;
    label?: string;
  };
  const { brand_id: brandId, product, action = "select" } = body;

  if (!brandId) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;
  if (!isGoogleProduct(product || "")) return NextResponse.json({ error: "Unknown connection." }, { status: 400 });
  const key = product as GoogleProductKey;

  // ── Disconnect one product ────────────────────────────────────────────────
  if (action === "disconnect") {
    await clearSelection(brandId, key);
    // Search Console's selection is mirrored onto brands.gsc_property, which is
    // what every existing query reads. Clearing one without the other would
    // leave the platform still pulling data the customer just disconnected.
    if (key === "search_console") {
      await db.from("brands").update({ gsc_property: null }).eq("id", brandId);
    }
    forgetTokens(brandId);
    return NextResponse.json({ ok: true, message: "Disconnected." });
  }

  // ── Sign out of a Google account entirely ─────────────────────────────────
  if (action === "unlink") {
    const accountId = body.account_id;
    if (!accountId) return NextResponse.json({ error: "account_id required" }, { status: 400 });
    const token = await refreshTokenFor(brandId, accountId);
    if (token) await revokeToken(token); // end access at Google too, not just here
    const before = await readGoogle(brandId);
    await unlinkAccount(brandId, accountId);
    if (before.selections.search_console?.accountId === accountId) {
      await db.from("brands").update({ gsc_property: null }).eq("id", brandId);
    }
    forgetTokens(brandId);
    return NextResponse.json({ ok: true, message: "Google account removed." });
  }

  // ── Choose a resource ─────────────────────────────────────────────────────
  const { account_id: accountId, resource_id: resourceId } = body;
  if (!accountId || !resourceId) {
    return NextResponse.json({ error: "Choose an option to continue." }, { status: 400 });
  }

  // Never trust an id from the browser: confirm the customer actually has
  // access to it before storing.
  let label = body.label || resourceId;
  try {
    const resources = await listResourcesFor(brandId, key, accountId);
    const match = resources.find((r) => r.id === resourceId);
    if (!match) {
      return NextResponse.json(
        { error: "That option is no longer available on your Google account." },
        { status: 403 }
      );
    }
    label = match.label;
  } catch (err) {
    if (err instanceof GoogleReauthRequired) {
      return NextResponse.json(
        { error: "Please reconnect your Google account and try again." },
        { status: 409 }
      );
    }
    console.warn(`[google/select] verify ${key} failed:`, err);
    return NextResponse.json({ error: "We couldn't confirm that with Google. Please try again." }, { status: 502 });
  }

  await selectResource(brandId, key, { accountId, resourceId, label });

  // Keep brands.gsc_property in step, so existing Search Console reads pick the
  // customer's choice up without any other code changing.
  if (key === "search_console") {
    await db.from("brands").update({ gsc_property: resourceId }).eq("id", brandId);
  }

  return NextResponse.json({ ok: true, message: "Connected.", label });
}
