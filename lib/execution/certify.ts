// Slice 1 certification — prove upsert_page on the confirmed Source of Truth.
//
// Reuses executeChange, adapters, publish_executions, publish_checks, rollback
// delete, and site_capabilities. Runs as a `certify` job, not a second queue.

import { randomBytes } from "crypto";
import { enqueue } from "../queue";
import { db } from "../supabase";
import type { Brand } from "../brands";
import { getBrandById } from "../brands";
import { executeChange, resolvePublishTarget } from "./engine";
import { absolutePageUrl, checkCertificationPage } from "../publish-check";
import {
  CERTIFIED_REASON,
  FAILED_APPEAR_REASON,
  FAILED_REMOVE_REASON,
  failedCertificationState,
  parseCapabilityMap,
  patchOperationCapability,
  persistBrandWriter,
  capabilityMapForWriter,
} from "./site-capabilities";
import { parseSourceOfTruth, sourceOfTruthMatchesWriter, persistSourceOfTruth } from "./source-of-truth";
import type { SiteChange, SitePlatform } from "./types";
import { isSitePlatform } from "./registry";
import { submitSitemap } from "../gsc";

export type CertifyPhase = "write" | "verify_write" | "rollback" | "verify_rollback";

export type CertifyPayload = {
  operation?: "upsert_page";
  phase?: CertifyPhase;
  slug?: string;
  title?: string;
  titleToken?: string;
  bodyToken?: string;
  bodyMarkdown?: string;
  executionId?: string | null;
  remoteId?: string | null;
  publicUrl?: string;
  phaseAttempts?: number;
  jobId?: string;
};

const VERIFY_ATTEMPTS = 3;
const VERIFY_DELAY_MS = 3000;
const MAX_PHASE_JOBS = 3;

export function isCanarySlug(slug: string | null | undefined): boolean {
  return typeof slug === "string" && /^seo-cert-[a-f0-9]{8}$/i.test(slug);
}

export type OrphanCanary = { executionId: string; slug: string; remoteId: string | null };

/** Pure filter so leftover canaries can be reclaimed without a new table. */
export function orphanCanariesFromRows(
  rows: Array<{
    id?: unknown;
    target?: unknown;
    remote_id?: unknown;
    previous?: unknown;
    rollback_status?: unknown;
  }> | null | undefined
): OrphanCanary[] {
  if (!rows?.length) return [];
  const out: OrphanCanary[] = [];
  for (const row of rows) {
    if (row.rollback_status !== "available") continue;
    const prev = row.previous && typeof row.previous === "object" && !Array.isArray(row.previous)
      ? (row.previous as Record<string, unknown>)
      : null;
    if (!prev || prev.canary !== true) continue;
    const slug = typeof row.target === "string" ? row.target : "";
    if (!isCanarySlug(slug)) continue;
    if (typeof row.id !== "string" || !row.id) continue;
    out.push({
      executionId: row.id,
      slug,
      remoteId: typeof row.remote_id === "string" && row.remote_id ? row.remote_id : null,
    });
  }
  return out;
}

async function reclaimOrphanCanaries(brand: Brand, jobId?: string | null): Promise<void> {
  try {
    const { data, error } = await db
      .from("publish_executions")
      .select("id, target, remote_id, previous, rollback_status")
      .eq("brand_id", brand.id)
      .eq("change_type", "upsert_page")
      .eq("status", "succeeded")
      .eq("rollback_status", "available")
      .order("executed_at", { ascending: false })
      .limit(20);
    if (error || !data) return;
    for (const orphan of orphanCanariesFromRows(data)) {
      const outcome = await executeChange(
        brand,
        { type: "delete_page", slug: orphan.slug, remoteId: orphan.remoteId },
        { jobId: jobId || null }
      );
      if (outcome.status !== "succeeded") continue;
      await db
        .from("publish_executions")
        .update({
          rollback_status: "rolled_back",
          rolled_back_at: new Date().toISOString(),
        })
        .eq("id", orphan.executionId)
        .eq("brand_id", brand.id);
    }
  } catch (e) {
    console.warn(
      `[certify] could not reclaim leftover test pages for brand ${brand.id}: ${
        e instanceof Error ? e.message : String(e)
      }`
    );
  }
}

export function newCanary(): {
  slug: string;
  title: string;
  titleToken: string;
  bodyToken: string;
  bodyMarkdown: string;
} {
  const id = randomBytes(4).toString("hex");
  const titleToken = `CT-${randomBytes(6).toString("hex")}`;
  const bodyToken = `CB-${randomBytes(12).toString("hex")}`;
  const slug = `seo-cert-${id}`;
  return {
    slug,
    title: `Publishing test ${titleToken}`,
    titleToken,
    bodyToken,
    bodyMarkdown: [
      "Temporary publishing test — please ignore.",
      "",
      bodyToken,
      "",
      '<meta name="robots" content="noindex,nofollow" />',
    ].join("\n"),
  };
}

export function publicCanaryUrl(brand: Brand, writer: string, slug: string, adapterUrl: string | null): string | null {
  if (writer === "proxy") {
    const ns = typeof brand.proxy_namespace === "string" ? brand.proxy_namespace.trim() : "";
    if (!ns) return null;
    return absolutePageUrl(brand.site_url, `${ns}/${slug}`);
  }
  if (writer === "shopify") {
    const handle = slug.replace(/^blog\//, "").replace(/^\/+|\/+$/g, "");
    return absolutePageUrl(brand.site_url, `pages/${handle}`);
  }
  if (adapterUrl && /^https?:\/\//i.test(adapterUrl)) {
    try {
      const pageHost = new URL(adapterUrl).hostname.replace(/^www\./i, "").toLowerCase();
      const siteHost = new URL(brand.site_url).hostname.replace(/^www\./i, "").toLowerCase();
      if (pageHost === siteHost) return adapterUrl;
    } catch {
      /* construct below */
    }
  }
  return absolutePageUrl(brand.site_url, slug);
}

/** Writer used for Prove — includes pending proxy (token set, primary_writer not yet pinned). */
export function resolveCertWriter(brand: Brand): SitePlatform | null {
  if (brand.primary_writer && isSitePlatform(brand.primary_writer)) {
    return brand.primary_writer;
  }
  if (brand.proxy_site_token && brand.proxy_namespace) {
    const sot = parseSourceOfTruth(brand.source_of_truth);
    if (sot.confirmed === "platform_proxy") return "proxy";
  }
  return null;
}

async function preconditions(brand: Brand): Promise<{ ok: true; writer: SitePlatform } | { ok: false; error: string }> {
  const sot = parseSourceOfTruth(brand.source_of_truth);
  if (!sot.confirmed || sot.confirmed === "unknown") {
    return { ok: false, error: "Confirm where new pages are saved first." };
  }
  const writer = resolveCertWriter(brand);
  if (!writer) {
    return { ok: false, error: "Connect a website before proving publishing." };
  }
  if (writer === "proxy") {
    if (sot.confirmed !== "platform_proxy") {
      return { ok: false, error: "Confirm that new pages are hosted on a path on your domain." };
    }
  } else if (!sourceOfTruthMatchesWriter(sot, brand.primary_writer || null)) {
    return { ok: false, error: "The connected website does not match where pages are saved." };
  }
  const target = await resolvePublishTarget(brand.id);
  if (!target.ok) return { ok: false, error: target.reason };
  if (target.platform !== writer) {
    return { ok: false, error: "The connected website does not match where pages are saved." };
  }
  if (!target.adapter.capabilities.includes("upsert_page")) {
    return { ok: false, error: "This connection cannot publish pages." };
  }
  const check = await target.adapter
    .check({ brand, credentials: target.credentials, config: target.config })
    .catch((e) => ({ ok: false as const, detail: e instanceof Error ? e.message : String(e) }));
  if (!check.ok) return { ok: false, error: check.detail || "We couldn't reach that website." };
  return { ok: true, writer };
}

async function recordCertFailure(
  brand: Brand,
  writer: "wordpress" | "shopify" | "webhook" | "proxy",
  reason: string,
  extra?: { last_execution_id?: string | null }
): Promise<void> {
  const map = parseCapabilityMap(brand.site_capabilities);
  const prev = map.upsert_page;
  const failCount = (prev?.fail_count || 0) + 1;
  await patchOperationCapability(brand.id, "upsert_page", {
    state: failedCertificationState(failCount),
    writer,
    reason,
    certified_at: prev?.state === "certified" ? prev.certified_at : null,
    last_execution_id: extra?.last_execution_id ?? prev?.last_execution_id ?? null,
    fail_count: failCount,
  });
}

async function bestEffortDelete(
  brand: Brand,
  slug: string,
  remoteId: string | null,
  jobId?: string
): Promise<void> {
  const change: SiteChange = { type: "delete_page", slug, remoteId };
  await executeChange(brand, change, { jobId: jobId || null });
}

export async function stepCertify(brand: Brand, payload: CertifyPayload): Promise<void> {
  const incomingPhase: CertifyPhase = payload.phase || "write";
  const jobId = payload.jobId || null;
  let remoteId = payload.remoteId || null;
  // Continuation and crash-recovery jobs may already have created the page.
  let needsCleanup = incomingPhase !== "write" && isCanarySlug(payload.slug);

  const cleanup = async () => {
    if (!needsCleanup || !payload.slug) return;
    needsCleanup = false;
    await bestEffortDelete(brand, payload.slug, remoteId, jobId || undefined);
  };

  try {
    const ready = await preconditions(brand);
    if (!ready.ok) {
      const fallbackWriter = resolveCertWriter(brand) || "proxy";
      await recordCertFailure(brand, fallbackWriter, ready.error);
      throw new Error(`stepCertify: ${ready.error}`);
    }
    const writer = ready.writer;

    // Re-read after preconditions so we patch the latest map.
    const fresh = (await getBrandById(brand.id)) || brand;
    const slug = payload.slug;
    const title = payload.title;
    const titleToken = payload.titleToken;
    const bodyToken = payload.bodyToken;
    const bodyMarkdown = payload.bodyMarkdown;
    if (!slug || !title || !titleToken || !bodyToken || !bodyMarkdown) {
      throw new Error("stepCertify: canary payload is incomplete.");
    }

    let phase: CertifyPhase = incomingPhase;
    let executionId = payload.executionId || null;
    let publicUrl = payload.publicUrl || null;
    const phaseAttempts = payload.phaseAttempts || 0;

    const continuePhase = async (next: CertifyPhase, extra: Partial<CertifyPayload> = {}) => {
      await enqueue(brand.id, "certify", {
        operation: "upsert_page",
        phase: next,
        slug,
        title,
        titleToken,
        bodyToken,
        bodyMarkdown,
        executionId,
        remoteId,
        publicUrl,
        phaseAttempts: next === phase ? phaseAttempts + 1 : 0,
        ...extra,
      });
      needsCleanup = false;
    };

    if (phase === "write") {
      await reclaimOrphanCanaries(fresh, jobId);
      const outcome = await executeChange(
        fresh,
        {
          type: "upsert_page",
          slug,
          title,
          metaDescription: "Temporary publishing test — please ignore.",
          bodyMarkdown,
        },
        { jobId, canary: { titleToken, bodyToken } }
      );
      if (outcome.status === "failed") {
        await recordCertFailure(fresh, writer, outcome.error);
        throw new Error(`stepCertify: ${outcome.error}`);
      }
      executionId = outcome.executionId;
      remoteId = outcome.remoteId;
      needsCleanup = true;
      publicUrl = publicCanaryUrl(fresh, writer, slug, outcome.url);
      if (!publicUrl) {
        await recordCertFailure(fresh, writer, "The test page had no live address to check.", {
          last_execution_id: executionId,
        });
        throw new Error("stepCertify: write succeeded but no live address was returned.");
      }
      phase = "verify_write";
    }

    if (phase === "verify_write") {
      if (!publicUrl) publicUrl = publicCanaryUrl(fresh, writer, slug, null);
      if (!publicUrl) throw new Error("stepCertify: missing public URL.");
      const verified = await checkCertificationPage(
        fresh,
        { url: publicUrl, siteUrl: fresh.site_url, titleToken, bodyToken, mode: "present" },
        {
          attempts: VERIFY_ATTEMPTS,
          delayMs: VERIFY_DELAY_MS,
          proxyDiagnostics: writer === "proxy",
        }
      );
      if (!verified.ok) {
        if (phaseAttempts + 1 < MAX_PHASE_JOBS) {
          await continuePhase("verify_write");
          return;
        }
        const appearReason =
          writer === "proxy" && verified.reason
            ? verified.reason
            : FAILED_APPEAR_REASON;
        await recordCertFailure(fresh, writer, appearReason, { last_execution_id: executionId });
        throw new Error(`stepCertify: ${verified.reason}`);
      }
      phase = "rollback";
    }

    if (phase === "rollback") {
      const outcome = await executeChange(
        fresh,
        { type: "delete_page", slug, remoteId },
        { jobId }
      );
      if (outcome.status === "failed") {
        await recordCertFailure(fresh, writer, FAILED_REMOVE_REASON, { last_execution_id: executionId });
        throw new Error(`stepCertify: ${outcome.error}`);
      }
      // Delete already ran; do not delete again on the success path.
      needsCleanup = false;
      phase = "verify_rollback";
    }

    if (phase === "verify_rollback") {
      if (!publicUrl) publicUrl = publicCanaryUrl(fresh, writer, slug, null);
      if (!publicUrl) throw new Error("stepCertify: missing public URL.");
      const gone = await checkCertificationPage(
        fresh,
        { url: publicUrl, siteUrl: fresh.site_url, titleToken, bodyToken, mode: "absent" },
        { attempts: VERIFY_ATTEMPTS, delayMs: VERIFY_DELAY_MS }
      );
      if (!gone.ok) {
        if (phaseAttempts + 1 < MAX_PHASE_JOBS) {
          await continuePhase("verify_rollback");
          return;
        }
        needsCleanup = true;
        await recordCertFailure(fresh, writer, FAILED_REMOVE_REASON, { last_execution_id: executionId });
        throw new Error(`stepCertify: ${gone.reason}`);
      }
    }

    needsCleanup = false;
    await patchOperationCapability(fresh.id, "upsert_page", {
      state: "certified",
      writer,
      reason: CERTIFIED_REASON,
      certified_at: new Date().toISOString(),
      last_execution_id: executionId,
      fail_count: 0,
    });

    if (writer === "proxy") {
      const map = capabilityMapForWriter("proxy");
      map.upsert_page = {
        state: "certified",
        writer: "proxy",
        reason: CERTIFIED_REASON,
        certified_at: new Date().toISOString(),
        last_execution_id: executionId,
        fail_count: 0,
      };
      await persistBrandWriter(fresh.id, "proxy", map);
      await persistSourceOfTruth(fresh.id, {
        confirmed: "platform_proxy",
        confirmed_at: new Date().toISOString(),
      });
      if (fresh.gsc_property && fresh.proxy_namespace) {
        const sitemapUrl = absolutePageUrl(fresh.site_url, `${fresh.proxy_namespace}/sitemap.xml`);
        if (sitemapUrl) {
          const submitted = await submitSitemap(fresh.gsc_property, sitemapUrl);
          if (!submitted.ok && !submitted.skipped) {
            console.warn(`[certify] sitemap submit failed for ${fresh.id}: ${submitted.error}`);
          }
        }
      }
    }
  } finally {
    await cleanup();
  }
}
