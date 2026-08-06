import { NextRequest, NextResponse } from "next/server";
import { getBrandById } from "@/lib/brands";
import { buildLlmsTxt } from "@/lib/geo-agent";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 30;

// Exposes lib/geo-agent.ts's buildLlmsTxt(), which has existed since Sprint 5
// with zero callers — the generator worked, nothing ever served its output.
//
// This is the only new route in Phase 8A, and it exists because the generator
// cannot be reached any other way: buildLlmsTxt imports through lib/geo-agent,
// which pulls in the Anthropic wrapper, so it cannot run in the browser.
//
// It deliberately does NOT serve /llms.txt on this domain. llms.txt has to
// live at the CUSTOMER's domain to do anything — one served here would
// describe the platform, not the business. So this returns the file body for
// the customer to install on their own site, which is what the generator was
// always written to produce.
//
// No generation logic is duplicated or rewritten: this route resolves a brand,
// calls the existing function, and returns its string.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const brand = await getBrandById(brandId);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const body = await buildLlmsTxt(brand);

  return new NextResponse(body, {
    status: 200,
    headers: {
      // text/plain so the browser shows it rather than downloading it, and so
      // "view it, copy it, paste it at /llms.txt" is a two-step job.
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
