import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { getBrandById } from "@/lib/brands";
import { domainOf } from "@/lib/metrics";
import { discoverCompetitors, geoOf } from "@/lib/dataforseo";
import { normalizeCompetitorDomain } from "@/lib/competitors/filter";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { enforceRate } from "@/lib/rateLimit";

export const maxDuration = 60;

// On-demand competitor auto-discovery (not run automatically on every cron —
// this hits a DataForSEO Labs endpoint, so it's a deliberate user action).
// Social networks and directories are stripped in discoverCompetitors().

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id } = await req.json().catch(() => ({}));
  if (!brand_id) return NextResponse.json({ error: "brand_id required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const limited = await enforceRate(brand_id!, "external");
  if (limited) return limited;

  const brand = await getBrandById(brand_id);
  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const found = await discoverCompetitors(domainOf(brand), geoOf(brand)).catch(() => []);
  if (!found.length) return NextResponse.json({ discovered: [] });

  const { data: existing } = await db
    .from("competitors")
    .select("domain")
    .eq("brand_id", brand_id);
  const known = new Set((existing || []).map((c) => normalizeCompetitorDomain(c.domain)));

  const rows = found
    .map((f) => {
      const domain = normalizeCompetitorDomain(f.domain);
      return {
        brand_id,
        domain,
        name: domain,
        active: true,
        last_keyword_count: f.keywordOverlap,
        last_checked_at: new Date().toISOString(),
      };
    })
    .filter((r) => r.domain && !known.has(r.domain));

  if (!rows.length) return NextResponse.json({ discovered: [] });

  const { data, error } = await db
    .from("competitors")
    .upsert(rows, { onConflict: "brand_id,domain" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ discovered: data || [] });
}
