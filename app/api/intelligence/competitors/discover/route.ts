import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getBrandById } from "@/lib/brands";
import { domainOf } from "@/lib/metrics";
import { discoverCompetitors } from "@/lib/dataforseo";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 60;

// On-demand competitor auto-discovery (not run automatically on every cron —
// this hits an unverified DataForSEO Labs endpoint, so it's a deliberate
// user action, same cost model as the manual "Add competitor" flow). Finds
// organic competitors for the brand's own domain, skips anything already
// tracked, and upserts the rest as normal (editable/removable) competitor
// rows via the existing add/remove endpoints.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id } = await req.json().catch(() => ({}));
  if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const brand = await getBrandById(brand_id);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const found = await discoverCompetitors(domainOf(brand)).catch(() => []);
  if (!found.length) return NextResponse.json({ discovered: [] });

  const { data: existing } = await db
    .from("competitors")
    .select("domain")
    .eq("brand_id", brand_id);
  const known = new Set((existing || []).map((c) => c.domain));

  const rows = found
    .map((f) => ({
      brand_id,
      domain: f.domain.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, ""),
      name: f.domain,
      active: true,
    }))
    .filter((r) => r.domain && !known.has(r.domain));

  if (!rows.length) return NextResponse.json({ discovered: [] });

  const { data, error } = await db
    .from("competitors")
    .upsert(rows, { onConflict: "brand_id,domain" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ discovered: data || [] });
}
