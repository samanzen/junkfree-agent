import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireCronSecret } from "@/lib/cronAuth";

export const maxDuration = 60;

// Daily housekeeping. Phase 1.6 left prune_rate_limits() with nothing calling
// it — without a schedule, rate_limits grows one row per tenant per bucket
// per window forever. This is that schedule.
//
// Authenticated via requireCronSecret (fails closed when CRON_SECRET is unset).
export async function GET(req: NextRequest) {
  const cronErr = requireCronSecret(req);
  if (cronErr) return cronErr;

  // Keep a full day of windows so a long-lived hour bucket near midnight is
  // never deleted while still current. The SQL function itself refuses
  // p_older_than_hours < 1.
  const { data, error } = await db.rpc("prune_rate_limits", { p_older_than_hours: 24 });

  if (error) {
    // Migration not applied yet — same fail-open convention as consumeRate.
    // Deploying this route before 012_rate_limits.sql must be harmless.
    const code = error.code || "";
    if (["PGRST202", "PGRST205", "42883", "42P01"].includes(code)) {
      return NextResponse.json({ ok: true, pruned: 0, skipped: "migration_missing" });
    }
    console.error("[cron/prune] prune_rate_limits failed:", code, error.message);
    return NextResponse.json({ error: "prune failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, pruned: data ?? 0 });
}
