import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, redirectUriFor, verifyState, fetchIdentity } from "@/lib/google/oauth";
import { linkAccount, selectResource } from "@/lib/google/store";
import { GOOGLE_PRODUCTS, isGoogleProduct, listResourcesFor } from "@/lib/google/registry";

export const maxDuration = 60;

// Step 2: Google sends the customer back here.
//
// Deliberately NOT protected by requireAuth. Google performs this redirect and
// cannot present the portal's bearer token, and the customer arrives via a
// top-level navigation. Trust comes from the HMAC-signed `state` instead, which
// carries the brand and was minted by /start only after that request passed
// both requireAuth and requireBrandAccess. An unsigned or tampered state is
// refused outright, so this endpoint cannot be used to attach an attacker's
// Google account to another customer's brand.
//
// Always ends in a redirect back to the portal, never a JSON body — the
// customer is in a browser tab, and a wall of JSON would be the least
// polished possible end to a sign-in.

function back(origin: string, params: Record<string, string>): NextResponse {
  const url = new URL("/portal/settings", origin);
  url.searchParams.set("tab", "connections");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return NextResponse.redirect(url.toString());
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const origin = url.origin;
  const code = url.searchParams.get("code");
  const rawState = url.searchParams.get("state") || "";
  const googleError = url.searchParams.get("error");

  const state = verifyState(rawState);
  if (!state || !isGoogleProduct(state.product)) {
    // Nothing trustworthy to return to, so keep it generic.
    return back(origin, { google: "failed", reason: "invalid" });
  }

  // The customer pressed Cancel on Google's screen. Not an error.
  if (googleError) {
    return back(state.origin || origin, {
      google: googleError === "access_denied" ? "cancelled" : "failed",
      product: state.product,
    });
  }
  if (!code) return back(state.origin || origin, { google: "failed", product: state.product });

  try {
    const tokens = await exchangeCode(code, redirectUriFor(state.origin || origin));

    if (!tokens.refreshToken) {
      // Without a refresh token the connection would work for an hour and then
      // die. Google only returns one when consent is forced, which authUrl()
      // does — so this means something is wrong rather than merely unlucky.
      console.error("[google/callback] no refresh token returned; check access_type/prompt.");
      return back(state.origin || origin, { google: "failed", product: state.product, reason: "norefresh" });
    }

    const identity = await fetchIdentity(tokens.accessToken);
    await linkAccount(
      state.brandId,
      { id: identity.id, email: identity.email, scopes: tokens.scopes },
      tokens.refreshToken
    );

    // If exactly one resource is available, select it automatically — asking a
    // customer to "choose" from a list of one is friction with no purpose.
    // Otherwise the portal shows a picker.
    try {
      const resources = await GOOGLE_PRODUCTS[state.product].listResources(tokens.accessToken);
      if (resources.length === 1) {
        await selectResource(state.brandId, state.product, {
          accountId: identity.id,
          resourceId: resources[0].id,
          label: resources[0].label,
        });
        return back(state.origin || origin, { google: "connected", product: state.product });
      }
      return back(state.origin || origin, {
        google: resources.length ? "choose" : "empty",
        product: state.product,
      });
    } catch (listErr) {
      // The account linked fine but its resources could not be read — most
      // often Business Profile at 0 quota pending Google's approval. The
      // account is kept so the customer does not have to sign in again.
      console.warn(`[google/callback] ${state.product} resource listing failed:`, listErr);
      return back(state.origin || origin, { google: "linked_no_access", product: state.product });
    }
  } catch (err) {
    console.error("[google/callback] exchange failed:", err);
    return back(state.origin || origin, { google: "failed", product: state.product });
  }
}
