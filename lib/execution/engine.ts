// THE ENGINE — resolves which adapter serves a brand, dispatches a change to
// it, and records what happened.
//
// This file contains no platform-specific knowledge whatsoever. It never names
// WordPress, never constructs a URL, never touches an HTTP header. Everything
// it does is: look up configuration, check the adapter can do the thing, hand
// it over, write down the result. That is what "platform-agnostic" has to mean
// to be real -- if adding Shopify required editing this file, the abstraction
// would be decorative.

import { db } from "../supabase";
import { getBrandById, type Brand } from "../brands";
import {
  findConnectedIntegration,
  getDecryptedCredentials,
  getIntegration,
  integrationsReachable,
  type BrandIntegration,
  type IntegrationProvider,
} from "../integrations";
import { getAdapter, isSitePlatform, SITE_PLATFORMS, INTEGRATION_SITE_PLATFORMS } from "./registry";
import { capabilityMapFor, parseCapabilityMap, persistBrandWriter } from "./site-capabilities";
import { supports, type PublishAdapter, type SiteChange, type SitePlatform } from "./types";
import { parseSourceOfTruth } from "./source-of-truth";

/** Postgres/PostgREST codes meaning the execution-log migration is not applied. */
const MIGRATION_MISSING = new Set(["PGRST205", "42P01"]);

export type ResolvedTarget =
  | { ok: true; platform: SitePlatform; adapter: PublishAdapter; credentials: Record<string, string>; config: Record<string, unknown> }
  | { ok: false; reason: string; code: "not_configured" | "unreadable" | "bad_credentials" | "unknown_platform" };

/**
 * Which platform publishes for this brand, with its secrets decrypted.
 * Distinguishes "no publishing configured" from "the credential store itself
 * is unreachable" -- those look identical from the outside and demand
 * completely different fixes.
 */
async function notConfiguredOrUnreadable(detail: string): Promise<ResolvedTarget> {
  const reach = await integrationsReachable();
  if (!reach.ok) {
    return {
      ok: false,
      code: "unreadable",
      reason: `The integration store could not be read (${reach.reason}). Publishing cannot be configured until that is fixed.`,
    };
  }
  return { ok: false, code: "not_configured", reason: detail };
}

async function targetFromIntegration(
  brandId: string,
  integration: BrandIntegration
): Promise<ResolvedTarget> {
  if (!isSitePlatform(integration.provider)) {
    return { ok: false, code: "unknown_platform", reason: `No adapter is registered for "${integration.provider}".` };
  }

  let credentials: Record<string, string> | null = null;
  try {
    credentials = await getDecryptedCredentials(brandId, integration.provider);
  } catch (e) {
    // A decryption failure means a wrong/rotated INTEGRATION_ENCRYPTION_KEY or
    // tampered ciphertext. Never treat that as "no credentials".
    return {
      ok: false,
      code: "bad_credentials",
      reason: `Stored credentials for ${integration.provider} could not be decrypted: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!credentials) {
    return {
      ok: false,
      code: "not_configured",
      reason: `${integration.provider} is marked connected but has no stored credentials.`,
    };
  }

  return {
    ok: true,
    platform: integration.provider,
    adapter: getAdapter(integration.provider),
    credentials,
    config: integration.metadata || {},
  };
}

async function targetFromProxyBrand(brand: Brand): Promise<ResolvedTarget> {
  const token = (brand.proxy_site_token || "").trim();
  const namespace = (brand.proxy_namespace || "").trim();
  if (!token || !namespace) {
    return {
      ok: false,
      code: "not_configured",
      reason:
        "Subdirectory publishing is selected but the token or path name is missing. Reconnect website publishing.",
    };
  }
  return {
    ok: true,
    platform: "proxy",
    adapter: getAdapter("proxy"),
    credentials: { siteToken: token },
    config: { namespace, siteUrl: brand.site_url },
  };
}

export async function resolvePublishTarget(brandId: string): Promise<ResolvedTarget> {
  const brand = await getBrandById(brandId).catch(() => null);
  const pinned =
    brand?.primary_writer && isSitePlatform(brand.primary_writer) ? brand.primary_writer : null;

  // Proxy has no brand_integrations row — resolve from brands columns.
  if (pinned === "proxy") {
    if (!brand) {
      return notConfiguredOrUnreadable("Brand not found for subdirectory publishing.");
    }
    return targetFromProxyBrand(brand);
  }

  if (pinned) {
    const integration = await getIntegration(brandId, pinned);
    if (!integration || integration.status !== "connected") {
      return notConfiguredOrUnreadable(
        `The chosen publishing connection (${pinned}) is not connected.`
      );
    }
    return targetFromIntegration(brandId, integration);
  }

  // Integration-backed writers only (proxy is never discovered via this table).
  // Pending proxy setup (token + SoT, primary_writer not pinned yet) wins here.
  if (brand?.proxy_site_token && brand?.proxy_namespace) {
    const sot = parseSourceOfTruth(brand.source_of_truth);
    if (sot.confirmed === "platform_proxy") {
      return targetFromProxyBrand(brand);
    }
  }

  const integration = await findConnectedIntegration(
    brandId,
    INTEGRATION_SITE_PLATFORMS as IntegrationProvider[]
  );

  if (!integration) {
    return notConfiguredOrUnreadable(
      `No publishing platform is connected for this brand. Connect one of: ${SITE_PLATFORMS.join(", ")}.`
    );
  }

  const target = await targetFromIntegration(brandId, integration);
  // Legacy brands have a connected writer but no pin. Stick it so a later
  // leftover row cannot silently take over. Do not overwrite an existing map.
  if (target.ok) {
    const existing = parseCapabilityMap(brand?.site_capabilities);
    const map = Object.keys(existing).length ? existing : capabilityMapFor(target.adapter);
    try {
      await persistBrandWriter(brandId, target.platform, map);
    } catch (e) {
      console.warn(
        `[execution] could not pin writer for brand ${brandId}: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }
  return target;
}

export type ExecutionOutcome =
  | { status: "succeeded"; platform: SitePlatform; url: string | null; remoteId: string | null; executionId: string | null }
  | { status: "failed"; platform: SitePlatform | null; error: string; retryable: boolean; executionId: string | null };

type ExecutionMeta = {
  draftId?: string | null;
  jobId?: string | null;
  canary?: { titleToken: string; bodyToken: string } | null;
};

/**
 * Apply one change to a brand's live site.
 *
 * Never throws: every failure path returns a `failed` outcome carrying a
 * reason a human can act on. A publish job that dies with a stack trace tells
 * the customer nothing, and this is the layer where the platform stops giving
 * advice and starts changing someone's website.
 */
export async function executeChange(
  brand: Brand,
  change: SiteChange,
  meta: ExecutionMeta = {}
): Promise<ExecutionOutcome> {
  const target = await resolvePublishTarget(brand.id);

  if (!target.ok) {
    const outcome: ExecutionOutcome = {
      status: "failed",
      platform: null,
      error: target.reason,
      // Only an unreachable credential store is worth retrying unattended;
      // the rest need a human to connect or re-enter something.
      retryable: target.code === "unreadable",
      executionId: null,
    };
    outcome.executionId = await recordExecution(brand.id, null, change, outcome, null, meta);
    return outcome;
  }

  if (!supports(target.adapter, change)) {
    const outcome: ExecutionOutcome = {
      status: "failed",
      platform: target.platform,
      error:
        `${target.adapter.label} cannot perform "${change.type}". ` +
        `It supports: ${target.adapter.capabilities.join(", ")}.`,
      retryable: false,
      executionId: null,
    };
    outcome.executionId = await recordExecution(brand.id, target.platform, change, outcome, null, meta);
    return outcome;
  }

  // Certification canaries must be publicly readable. A "save as draft"
  // preference for approved work must not hide the prove-publishing page.
  const config = meta.canary
    ? { ...target.config, status: "publish" }
    : target.config;

  const result = await target.adapter
    .apply({ brand, credentials: target.credentials, config }, change)
    .catch((e) => ({
      // An adapter is contractually required not to throw; if one does, that is
      // a bug in the adapter and must not take the job down with it.
      ok: false as const,
      error: `${target.adapter.label} adapter threw: ${e instanceof Error ? e.message : String(e)}`,
      retryable: false,
    }));

  const outcome: ExecutionOutcome = result.ok
    ? { status: "succeeded", platform: target.platform, url: result.url, remoteId: result.remoteId, executionId: null }
    : { status: "failed", platform: target.platform, error: result.error, retryable: result.retryable, executionId: null };

  const recordedPrevious =
    result.ok && meta.canary
      ? {
          ...(result.previous || {}),
          canary: true,
          titleToken: meta.canary.titleToken,
          bodyToken: meta.canary.bodyToken,
        }
      : result.ok
        ? result.previous
        : null;

  const executionId = await recordExecution(
    brand.id,
    target.platform,
    change,
    outcome,
    recordedPrevious,
    meta
  );

  return { ...outcome, executionId };
}

/** Slug or URL a change was aimed at — the useful identifier in a log. */
function targetOf(change: SiteChange): string {
  if (change.type === "update_meta") return change.url;
  return change.slug;
}

/**
 * Append to the durable execution log. Best-effort by the same convention
 * lib/steps.ts uses for page_audits: a brand whose database has not had
 * supabase/011 applied still publishes correctly, it just has no audit trail
 * yet. The write is never allowed to fail a successful publish.
 */
async function recordExecution(
  brandId: string,
  platform: SitePlatform | null,
  change: SiteChange,
  outcome: ExecutionOutcome,
  previous: Record<string, unknown> | null,
  meta: ExecutionMeta
): Promise<string | null> {
  try {
    const canRestoreMarkdown =
      change.type === "upsert_page" &&
      typeof previous?.title === "string" &&
      typeof previous?.bodyMarkdown === "string";
    const canDeleteCreate =
      change.type === "upsert_page" &&
      outcome.status === "succeeded" &&
      (!previous || previous.canary === true);
    const rollbackSupported =
      outcome.status === "succeeded" &&
      change.type !== "delete_page" &&
      ((change.type === "update_meta" && !!previous) || canRestoreMarkdown || canDeleteCreate);

    const row = {
      brand_id: brandId,
      draft_id: meta.draftId ?? null,
      job_id: meta.jobId ?? null,
      provider: platform,
      change_type: change.type,
      target: targetOf(change),
      status: outcome.status,
      remote_id: outcome.status === "succeeded" ? outcome.remoteId : null,
      result_url: outcome.status === "succeeded" ? outcome.url : null,
      error: outcome.status === "failed" ? outcome.error : null,
      previous,
      executed_at: new Date().toISOString(),
      rollback_supported: rollbackSupported,
      rollback_status: rollbackSupported
        ? "available"
        : outcome.status === "succeeded"
          ? "unsupported"
          : null,
    };

    const { data, error } = await db.from("publish_executions").insert(row).select("id").maybeSingle();
    if (!error) return (data?.id as string | undefined) || null;
    if (MIGRATION_MISSING.has(error.code)) return null;
    // Older schema without rollback columns — retry minimal insert.
    const { data: d2, error: e2 } = await db
      .from("publish_executions")
      .insert({
        brand_id: brandId,
        draft_id: meta.draftId ?? null,
        job_id: meta.jobId ?? null,
        provider: platform,
        change_type: change.type,
        target: targetOf(change),
        status: outcome.status,
        remote_id: outcome.status === "succeeded" ? outcome.remoteId : null,
        result_url: outcome.status === "succeeded" ? outcome.url : null,
        error: outcome.status === "failed" ? outcome.error : null,
        previous,
        executed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();
    if (e2 && !MIGRATION_MISSING.has(e2.code)) {
      console.warn(`[execution] could not record execution for brand ${brandId}: ${e2.message}`);
    }
    return (d2?.id as string | undefined) || null;
  } catch (e) {
    console.warn(`[execution] could not record execution for brand ${brandId}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/** Whether the execution log exists — surfaced by the status endpoint. */
export async function executionLogReachable(): Promise<{ ok: boolean; reason: string | null }> {
  const { error } = await db.from("publish_executions").select("id").limit(1);
  if (!error) return { ok: true, reason: null };
  if (MIGRATION_MISSING.has(error.code)) {
    return { ok: false, reason: "supabase/011_publish_executions.sql has not been applied." };
  }
  return { ok: false, reason: `${error.code || "error"}: ${error.message}` };
}
