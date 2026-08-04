import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 30;

// Read-only view over the persisted per-page audit dataset
// (supabase/010_page_audits.sql, written by lib/steps.ts stepAudit).
//
// Additive: no existing route or behaviour changes. Brand-scoped through the
// same requireBrandAccess used everywhere else, so a customer can only ever
// read their own brand's pages.
//
// Duplicate detection happens here rather than in the table because a
// duplicate is a property of a SET of pages, not of one page — storing it
// per-row would freeze an answer that changes as the site changes.

// PostgREST / Postgres codes meaning "the migration hasn't been applied yet".
const MIGRATION_MISSING = new Set(["PGRST205", "42P01"]);

type PageRow = {
  url: string;
  http_status: number | null;
  in_sitemap: boolean;
  title: string | null;
  meta_description: string | null;
  h1: string | null;
  canonical: string | null;
  robots_meta: string | null;
  word_count: number | null;
  missing_title: boolean;
  missing_meta_description: boolean;
  missing_h1: boolean;
  thin_content: boolean;
  fetched_at: string;
  audit_run_at: string;
};

/** Values appearing on more than one page in the same run, normalised. */
function duplicatesOf(rows: PageRow[], pick: (r: PageRow) => string | null): Set<string> {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const v = (pick(r) || "").trim().toLowerCase();
    if (!v) continue;
    seen.set(v, (seen.get(v) || 0) + 1);
  }
  return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([v]) => v));
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  // Most recent run for this brand.
  const { data: latest, error: latestErr } = await db
    .from("page_audits")
    .select("audit_run_at")
    .eq("brand_id", brandId)
    .order("audit_run_at", { ascending: false })
    .limit(1);

  if (latestErr) {
    // Table not created yet — report that plainly instead of failing, so the
    // UI can explain what's pending rather than showing an error.
    if (MIGRATION_MISSING.has(latestErr.code)) {
      return NextResponse.json({ available: false, reason: "not_migrated", pages: [], runs: [] });
    }
    return NextResponse.json({ error: latestErr.message }, { status: 500 });
  }

  const runAt = latest?.[0]?.audit_run_at;
  if (!runAt) {
    return NextResponse.json({ available: true, reason: "no_runs", pages: [], runs: [], summary: null });
  }

  const { data: pages } = await db
    .from("page_audits")
    .select("url, http_status, in_sitemap, title, meta_description, h1, canonical, robots_meta, word_count, missing_title, missing_meta_description, missing_h1, thin_content, fetched_at, audit_run_at")
    .eq("brand_id", brandId)
    .eq("audit_run_at", runAt)
    .order("url", { ascending: true });

  const rows = (pages || []) as PageRow[];

  const dupTitles = duplicatesOf(rows, (r) => r.title);
  const dupMetas = duplicatesOf(rows, (r) => r.meta_description);
  const dupH1s = duplicatesOf(rows, (r) => r.h1);

  const enriched = rows.map((r) => ({
    ...r,
    duplicate_title: !!r.title && dupTitles.has(r.title.trim().toLowerCase()),
    duplicate_meta_description: !!r.meta_description && dupMetas.has(r.meta_description.trim().toLowerCase()),
    duplicate_h1: !!r.h1 && dupH1s.has(r.h1.trim().toLowerCase()),
  }));

  // Distinct run timestamps, so the UI can show how much history exists.
  const { data: runRows } = await db
    .from("page_audits")
    .select("audit_run_at")
    .eq("brand_id", brandId)
    .order("audit_run_at", { ascending: false })
    .limit(400);
  const runs = [...new Set((runRows || []).map((r) => r.audit_run_at as string))].slice(0, 30);

  const count = (fn: (p: (typeof enriched)[number]) => boolean) => enriched.filter(fn).length;

  return NextResponse.json({
    available: true,
    reason: null,
    audit_run_at: runAt,
    runs,
    pages: enriched,
    summary: {
      pages_audited: enriched.length,
      missing_title: count((p) => p.missing_title),
      missing_meta_description: count((p) => p.missing_meta_description),
      missing_h1: count((p) => p.missing_h1),
      thin_content: count((p) => p.thin_content),
      duplicate_title: count((p) => p.duplicate_title),
      duplicate_meta_description: count((p) => p.duplicate_meta_description),
      duplicate_h1: count((p) => p.duplicate_h1),
      missing_canonical: count((p) => !p.canonical),
      noindex: count((p) => (p.robots_meta || "").toLowerCase().includes("noindex")),
      non_200: count((p) => p.http_status != null && p.http_status !== 200),
    },
  });
}
