import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthError, requireBrandAccess, requireAdmin } from "@/lib/auth";
import { assessRollback, rollbackExecution } from "@/lib/execution/rollback";
import { db } from "@/lib/supabase";

export const maxDuration = 60;

// List recent publish executions (with rollback eligibility) for a brand.
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const { data, error } = await db
    .from("publish_executions")
    .select(
      "id, brand_id, draft_id, provider, change_type, target, status, result_url, error, previous, rollback_supported, rollback_status, rolled_back_at, executed_at"
    )
    .eq("brand_id", brandId)
    .order("executed_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message, executions: [] }, { status: 200 });

  const executions = await Promise.all(
    (data || []).map(async (row) => {
      const eligibility = await assessRollback(brandId, row.id);
      return {
        ...row,
        // Never expose full previous payload to customers — only whether restore is possible.
        previous: undefined,
        has_previous: !!row.previous,
        can_rollback: eligibility.ok,
        rollback_reason: eligibility.ok ? null : eligibility.reason,
      };
    })
  );

  return NextResponse.json({ executions });
}

// Rollback a supported execution. Admins or brand owners.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const body = await req.json().catch(() => ({}));
  const brandId = body.brand_id as string | undefined;
  const executionId = body.execution_id as string | undefined;
  if (!brandId || !executionId) {
    return NextResponse.json({ error: "brand_id and execution_id required" }, { status: 400 });
  }
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  // Customers can request rollback for their brand; no admin-only restriction,
  // but requireBrandAccess already scopes tenants.
  void requireAdmin;

  const result = await rollbackExecution(brandId, executionId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 409 });
  return NextResponse.json({ ok: true, url: result.url });
}
