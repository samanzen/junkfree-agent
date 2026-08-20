// Slice 1 certification — prove upsert_page on the confirmed Source of Truth.
//
// Reuses executeChange, adapters, publish_executions, publish_checks, rollback
// delete, and site_capabilities. Runs as a `certify` job, not a second queue.

import { randomBytes } from "crypto";
import { enqueue } from "../queue";
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
} from "./site-capabilities";
import { parseSourceOfTruth, sourceOfTruthMatchesWriter } from "./source-of-truth";
import type { SiteChange } from "./types";

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

async function preconditions(brand: Brand): Promise<{ ok: true } | { ok: false; error: string }> {
  const sot = parseSourceOfTruth(brand.source_of_truth);
  if (!sot.confirmed || sot.confirmed === "unknown") {
    return { ok: false, error: "Confirm where new pages are saved first." };
  }
  if (!sourceOfTruthMatchesWriter(sot, brand.primary_writer || null)) {
    return { ok: false, error: "The connected website does not match where pages are saved." };
  }
  const target = await resolvePublishTarget(brand.id);
  if (!target.ok) return { ok: false, error: target.reason };
  if (!target.adapter.capabilities.includes("upsert_page")) {
    return { ok: false, error: "This connection cannot publish pages." };
  }
  const check = await target.adapter
    .check({ brand, credentials: target.credentials, config: target.config })
    .catch((e) => ({ ok: false as const, detail: e instanceof Error ? e.message : String(e) }));
  if (!check.ok) return { ok: false, error: check.detail || "We couldn't reach that website." };
  return { ok: true };
}

async function recordCertFailure(
  brand: Brand,
  writer: "wordpress" | "shopify" | "webhook",
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
  const writer = brand.primary_writer;
  if (writer !== "wordpress" && writer !== "shopify" && writer !== "webhook") {
    throw new Error("stepCertify: no publishing connection is pinned.");
  }

  const ready = await preconditions(brand);
  if (!ready.ok) {
    await recordCertFailure(brand, writer, ready.error);
    throw new Error(`stepCertify: ${ready.error}`);
  }

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

  let phase: CertifyPhase = payload.phase || "write";
  let executionId = payload.executionId || null;
  let remoteId = payload.remoteId || null;
  let publicUrl = payload.publicUrl || null;
  const jobId = payload.jobId || null;
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
  };

  if (phase === "write") {
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
    publicUrl = publicCanaryUrl(fresh, writer, slug, outcome.url);
    if (!publicUrl) {
      await bestEffortDelete(fresh, slug, remoteId, jobId || undefined);
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
      { attempts: VERIFY_ATTEMPTS, delayMs: VERIFY_DELAY_MS }
    );
    if (!verified.ok) {
      if (phaseAttempts + 1 < MAX_PHASE_JOBS) {
        await continuePhase("verify_write");
        return;
      }
      await bestEffortDelete(fresh, slug, remoteId, jobId || undefined);
      await recordCertFailure(fresh, writer, FAILED_APPEAR_REASON, { last_execution_id: executionId });
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
      await recordCertFailure(fresh, writer, FAILED_REMOVE_REASON, { last_execution_id: executionId });
      throw new Error(`stepCertify: ${gone.reason}`);
    }
  }

  await patchOperationCapability(fresh.id, "upsert_page", {
    state: "certified",
    writer,
    reason: CERTIFIED_REASON,
    certified_at: new Date().toISOString(),
    last_execution_id: executionId,
    fail_count: 0,
  });
}
