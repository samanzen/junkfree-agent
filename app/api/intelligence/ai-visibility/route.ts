import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import { buildReport, type CheckRow, type CitationRow, type RunRow } from "@/lib/ai-visibility/report";
import { isMissingMigration } from "@/lib/ai-visibility/store";
import { PROVIDERS } from "@/lib/ai-visibility/providers";

export const maxDuration = 30;

// Read-only view over the AI-visibility dataset (supabase/018_ai_visibility.sql,
// written by lib/ai-visibility/run.ts).
//
// Every aggregate is computed by lib/ai-visibility/report.ts, which is pure and
// unit tested, so "mention rate" has one definition rather than one per surface.
// This route's whole job is authorisation, fetching and shaping.
//
// Brand-scoped through the same requireBrandAccess used everywhere else: a
// customer can only ever read their own brand's checks.

/** How many runs back the report looks. Bounded so a brand with a long history
 *  does not turn one page load into a full-table scan. */
const DEFAULT_RUNS = 8;
const MAX_RUNS = 26;

const CHECK_COLUMNS =
  "id, prompt_key, prompt_text, intent, language, country, region, city, neighborhood, " +
  "locale_label, assistant, model, mentioned, rank, brands_named, sentiment, share_of_voice, " +
  "latency_ms, error, checked_at";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const requestedRuns = Number(url.searchParams.get("runs"));
  const runLimit = Number.isFinite(requestedRuns) && requestedRuns > 0
    ? Math.min(Math.floor(requestedRuns), MAX_RUNS)
    : DEFAULT_RUNS;

  // Which assistants COULD be asked, so the UI can explain a missing channel as
  // "not configured" rather than showing it as zero visibility.
  const configured = PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    requires: p.requires,
    available: p.available(),
  }));

  const { data: runRows, error: runsErr } = await db
    .from("ai_visibility_runs")
    .select("id, status, mention_rate, checks_completed, checks_failed, prompts_planned, assistants, started_at, finished_at")
    .eq("brand_id", brandId)
    .order("started_at", { ascending: false })
    .limit(runLimit);

  if (runsErr) {
    // Table not created yet — reported plainly so the UI can say what is
    // pending instead of rendering an error, the same contract
    // app/api/portal/technical uses for page_audits.
    if (isMissingMigration(runsErr)) {
      return NextResponse.json({
        available: false,
        reason: "not_migrated",
        detail: "Apply supabase/018_ai_visibility.sql to enable AI visibility.",
        assistants_configured: configured,
        report: null,
      });
    }
    return NextResponse.json({ error: runsErr.message }, { status: 500 });
  }

  const runs = (runRows || []) as RunRow[];
  if (!runs.length) {
    return NextResponse.json({
      available: true,
      reason: "no_runs",
      detail: configured.some((c) => c.available)
        ? "The first AI visibility sweep has not run yet."
        : "No AI assistant is configured, so nothing can be measured yet.",
      assistants_configured: configured,
      report: null,
    });
  }

  // Checks are read for the runs in scope rather than by date, so the report
  // always covers whole sweeps. A partial sweep would skew every rate.
  const runIds = runs.map((r) => r.id);

  const { data: checkRows, error: checksErr } = await db
    .from("ai_visibility_checks")
    .select(CHECK_COLUMNS)
    .eq("brand_id", brandId)
    .in("run_id", runIds)
    .order("checked_at", { ascending: false });

  if (checksErr) {
    if (isMissingMigration(checksErr)) {
      return NextResponse.json({
        available: false,
        reason: "not_migrated",
        assistants_configured: configured,
        report: null,
      });
    }
    return NextResponse.json({ error: checksErr.message }, { status: 500 });
  }

  // Cast through unknown: PostgREST types a select() built from a string of
  // columns as a union that includes its error shape, which does not overlap
  // CheckRow. The error case is already handled above.
  const checks = ((checkRows || []) as unknown) as CheckRow[];

  // Citations are joined in memory by check_id. Fetched by brand and filtered to
  // the checks in scope, because PostgREST cannot express the join and an `in`
  // list of every check id would be unbounded.
  const checkIds = new Set(checks.map((c) => c.id));
  const { data: citationRows } = await db
    .from("ai_visibility_citations")
    .select("check_id, url, domain, title, is_own")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .limit(5000);

  const citations = ((citationRows || []) as CitationRow[]).filter((c) => checkIds.has(c.check_id));

  // The analyst's written summary for the latest run, when it produced one.
  const { data: summaryRows } = await db
    .from("reports")
    .select("summary, created_at")
    .eq("brand_id", brandId)
    .eq("section", "ai_visibility_summary")
    .order("created_at", { ascending: false })
    .limit(1);

  const latest = runs[0];

  return NextResponse.json({
    available: true,
    reason: null,
    assistants_configured: configured,
    latest_run: {
      id: latest.id,
      status: latest.status,
      started_at: latest.started_at,
      finished_at: latest.finished_at,
      prompts_planned: latest.prompts_planned,
      checks_completed: latest.checks_completed,
      checks_failed: latest.checks_failed,
      mention_rate: latest.mention_rate == null ? null : Number(latest.mention_rate),
    },
    runs_in_scope: runs.length,
    summary: summaryRows?.[0]?.summary ?? null,
    summary_at: summaryRows?.[0]?.created_at ?? null,
    report: buildReport(checks, citations, runs),
  });
}
