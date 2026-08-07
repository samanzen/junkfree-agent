import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { googleConfigured, authUrl, redirectUriFor, signState } from "@/lib/google/oauth";
import { GOOGLE_PRODUCTS, isGoogleProduct } from "@/lib/google/registry";
import { randomBytes } from "crypto";

// Step 1 of the customer-facing sign-in: hand back the Google sign-in URL.
//
// Returns JSON rather than a 302, and that is deliberate. The portal
// authenticates with a bearer token held in localStorage, so a top-level
// browser navigation to this route would arrive with no Authorization header
// and be rejected by requireAuth. The panel therefore fetches this URL with
// credentials and then navigates the browser to the `url` it returns — the
// customer still lands on Google's own consent screen, which is the part that
// matters.
//
// Authorisation happens here, once: the caller must be signed in and must have
// access to the brand. The brand is then sealed into an HMAC-signed state, so
// the public callback cannot be tricked into attaching a Google account to
// someone else's brand.

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  const product = url.searchParams.get("product") || "";

  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  if (!isGoogleProduct(product)) {
    return NextResponse.json({ error: "Unknown connection." }, { status: 400 });
  }
  if (!googleConfigured()) {
    // Configuration is the platform's job, never the customer's, so this is a
    // server fault rather than something to explain to them.
    console.error("[google/start] GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.");
    return NextResponse.json(
      { error: "Connecting to Google isn't available right now. Please try again shortly." },
      { status: 503 }
    );
  }

  const origin = url.origin;
  const state = signState({
    brandId,
    product,
    origin,
    nonce: randomBytes(12).toString("base64url"),
  });

  // Ask only for what this product needs. Google merges previously granted
  // scopes via include_granted_scopes, so connecting a second product does not
  // discard the first product's access.
  const target = authUrl(GOOGLE_PRODUCTS[product].scopes, redirectUriFor(origin), state);
  return NextResponse.json({ url: target });
}
