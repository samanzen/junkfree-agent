// Feature 01 — rollback foundation for publish_executions.
// Only supports restore when previous state was captured and the adapter can
// perform the inverse operation. Never claims rollback for unsupported cases.

import { db } from "../supabase";
import { getBrandById } from "../brands";
import { executeChange, resolvePublishTarget } from "./engine";
import type { SiteChange } from "./types";
import { recordActivity } from "../agents/store";

const MIGRATION_MISSING = new Set(["PGRST205", "42P01"]);

export type RollbackEligibility =
  | { ok: true; executionId: string; change: SiteChange }
  | { ok: false; reason: string; code: "not_found" | "wrong_brand" | "unsupported" | "already" | "no_previous" };

export function buildRollbackChange(row: {
  change_type: string;
  target: string | null;
  previous: Record<string, unknown> | null;
  remote_id?: string | null;
}): SiteChange | null {
  if (row.change_type === "update_meta") {
    if (!row.previous || !row.target) return null;
    return {
      type: "update_meta",
      url: row.target,
      title: (row.previous.title as string | null | undefined) ?? null,
      metaDescription:
        (row.previous.metaDescription as string | null | undefined) ??
        (row.previous.excerpt as string | null | undefined) ??
        null,
    };
  }
  if (row.change_type === "upsert_page") {
    if (!row.target) return null;
    const title = row.previous?.title;
    const bodyMarkdown = row.previous?.bodyMarkdown;
    if (typeof title === "string" && typeof bodyMarkdown === "string") {
      return {
        type: "upsert_page",
        slug: row.target,
        title,
        metaDescription:
          (row.previous?.metaDescription as string | null | undefined) ?? null,
        bodyMarkdown,
      };
    }
    // Create (including canaries): delete the resource. Do not delete an
    // existing page whose previous state is HTML we cannot restore.
    if (!row.previous || row.previous.canary === true) {
      return {
        type: "delete_page",
        slug: row.target,
        remoteId: typeof row.remote_id === "string" && row.remote_id ? row.remote_id : null,
      };
    }
    return null;
  }
  return null;
}

export async function assessRollback(
  brandId: string,
  executionId: string
): Promise<RollbackEligibility> {
  const { data, error } = await db
    .from("publish_executions")
    .select("*")
    .eq("id", executionId)
    .maybeSingle();
  if (error && MIGRATION_MISSING.has(error.code)) {
    return { ok: false, reason: "Execution log migration not applied.", code: "unsupported" };
  }
  if (!data) return { ok: false, reason: "Execution not found.", code: "not_found" };
  if (data.brand_id !== brandId) {
    return { ok: false, reason: "Execution does not belong to this brand.", code: "wrong_brand" };
  }
  if (data.rollback_status === "rolled_back") {
    return { ok: false, reason: "Already rolled back.", code: "already" };
  }
  if (data.rollback_status === "rolling_back") {
    return { ok: false, reason: "Rollback already in progress.", code: "already" };
  }
  if (data.status !== "succeeded") {
    return { ok: false, reason: "Only successful executions can be rolled back.", code: "unsupported" };
  }
  const change = buildRollbackChange({
    change_type: data.change_type,
    target: data.target,
    previous: (data.previous as Record<string, unknown> | null) ?? null,
    remote_id: data.remote_id,
  });
  if (!change) {
    return {
      ok: false,
      reason: "Prior state is incomplete — automatic rollback is not supported for this change.",
      code: data.previous ? "unsupported" : "no_previous",
    };
  }

  const target = await resolvePublishTarget(brandId);
  if (!target.ok) {
    return {
      ok: false,
      reason: "Connected adapter cannot perform the inverse operation.",
      code: "unsupported",
    };
  }
  if (change.type !== "delete_page" && !target.adapter.capabilities.includes(change.type)) {
    return {
      ok: false,
      reason: "Connected adapter cannot perform the inverse operation.",
      code: "unsupported",
    };
  }

  return { ok: true, executionId, change };
}

export async function rollbackExecution(
  brandId: string,
  executionId: string
): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const eligibility = await assessRollback(brandId, executionId);
  if (!eligibility.ok) return { ok: false, error: eligibility.reason };

  const brand = await getBrandById(brandId);
  if (!brand) return { ok: false, error: "Brand not found." };

  // Atomic claim: only one rollback may proceed.
  const { data: claimed, error: claimErr } = await db
    .from("publish_executions")
    .update({ rollback_status: "rolling_back" })
    .eq("id", executionId)
    .eq("brand_id", brandId)
    .eq("rollback_status", "available")
    .select("id")
    .maybeSingle();
  if (claimErr || !claimed) {
    return { ok: false, error: claimErr?.message || "Rollback already in progress or unavailable." };
  }

  const outcome = await executeChange(brand, eligibility.change, {});
  if (outcome.status === "failed") {
    await db
      .from("publish_executions")
      .update({
        rollback_status: "failed",
        rollback_error: outcome.error,
        rollback_supported: true,
      })
      .eq("id", executionId)
      .eq("brand_id", brandId);
    await recordActivity({
      brandId,
      capability: "technical_execution",
      eventType: "rollback_failed",
      title: `Rollback failed for execution ${executionId}`,
      detail: outcome.error,
      status: "error",
    });
    return { ok: false, error: outcome.error };
  }

  await db
    .from("publish_executions")
    .update({
      rollback_status: "rolled_back",
      rolled_back_at: new Date().toISOString(),
      rollback_supported: true,
      rollback_error: null,
    })
    .eq("id", executionId)
    .eq("brand_id", brandId);

  await recordActivity({
    brandId,
    capability: "technical_execution",
    eventType: "rollback_succeeded",
    title: `Rolled back execution ${executionId}`,
    detail: outcome.url || eligibility.change.type,
    status: "success",
  });

  return { ok: true, url: outcome.url };
}

/** Mark a successful execution's rollback support based on captured previous state. */
export async function markRollbackSupport(
  executionId: string,
  brandId: string,
  previous: Record<string, unknown> | null,
  changeType: string
): Promise<void> {
  const supported = !!buildRollbackChange({
    change_type: changeType,
    target: "x",
    previous,
  });
  // For upsert_page we used a dummy target above — re-evaluate properly below
  // by reading the row is unnecessary; presence of restorable fields is enough.
  const reallySupported =
    !!previous &&
    (changeType === "update_meta" ||
      (changeType === "upsert_page" &&
        typeof previous.title === "string" &&
        typeof previous.bodyMarkdown === "string"));

  await db
    .from("publish_executions")
    .update({
      rollback_supported: reallySupported,
      rollback_status: reallySupported ? "available" : "unsupported",
    })
    .eq("id", executionId)
    .eq("brand_id", brandId);

  void supported;
}
