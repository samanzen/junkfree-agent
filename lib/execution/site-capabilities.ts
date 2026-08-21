// Per-brand website execution state.
//
// This is NOT lib/capabilities.ts (plan/tier gating) and NOT agent_tasks.capability
// (specialist type). It is the map stored on brands.site_capabilities: what the
// primary writer can try, and whether that try has been proven live.
//
// Connect writes supported_unverified | unsupported. Prove publishing
// (lib/execution/certify.ts) is what writes state "certified".

import { db } from "../supabase";
import type { PublishAdapter, SitePlatform, AdapterCapability } from "./types";
import { getAdapter, isSitePlatform } from "./registry";
import { invalidateProxyToken } from "../proxy/resolve";

export type OperationState =
  | "unsupported"
  | "supported_unverified"
  | "certified"
  | "stale"
  | "temporarily_failed"
  | "revoked";

export type OperationCapability = {
  state: OperationState;
  writer: SitePlatform;
  /** Customer-facing; never implementation vocabulary. */
  reason: string;
  certified_at: string | null;
  last_execution_id: string | null;
  fail_count: number;
};

export const CERTIFIED_REASON = "Working";
export const UNVERIFIED_NEEDS_PROOF = "Publishing is not proven yet.";
export const STALE_REASON = "Publishing needs to be proven again.";
export const FAILED_APPEAR_REASON = "We reached the site, but the test page never appeared.";
export const FAILED_REMOVE_REASON = "The test page could not be removed.";

export type SiteCapabilityMap = Partial<Record<AdapterCapability, OperationCapability>>;

export type ExecutionGrade = "none" | "transport" | "partial" | "full";

const ALL_OPS: readonly AdapterCapability[] = ["upsert_page", "update_meta"];

const UNSUPPORTED_REASON: Record<SitePlatform, Record<AdapterCapability, string>> = {
  wordpress: {
    upsert_page: "WordPress can receive new pages. Publishing is not proven yet.",
    update_meta:
      "WordPress cannot update titles and descriptions until an SEO plugin is connected.",
  },
  shopify: {
    upsert_page: "Shopify can receive new pages. Publishing is not proven yet.",
    update_meta: "Shopify cannot update titles and descriptions from this connection yet.",
  },
  webhook: {
    upsert_page: "Your website can receive new pages. Publishing is not proven yet.",
    update_meta:
      "Your website receiver only handles new pages today. Title and description updates are not supported yet.",
  },
  proxy: {
    upsert_page:
      "New pages under your chosen path are served by this platform. Publishing is not proven yet.",
    update_meta:
      "Editing existing pages needs a CMS connection (WordPress or Shopify).",
  },
};

function unverifiedReason(writer: SitePlatform, op: AdapterCapability): string {
  return UNSUPPORTED_REASON[writer][op];
}

/** Build the Slice 0 map from an adapter's static claims. Nothing is certified. */
export function capabilityMapFor(adapter: PublishAdapter): SiteCapabilityMap {
  const writer = adapter.provider;
  const claimed = new Set(adapter.capabilities);
  const map: SiteCapabilityMap = {};
  for (const op of ALL_OPS) {
    if (claimed.has(op)) {
      map[op] = {
        state: "supported_unverified",
        writer,
        reason: unverifiedReason(writer, op),
        certified_at: null,
        last_execution_id: null,
        fail_count: 0,
      };
    } else {
      map[op] = {
        state: "unsupported",
        writer,
        reason: unverifiedReason(writer, op),
        certified_at: null,
        last_execution_id: null,
        fail_count: 0,
      };
    }
  }
  return map;
}

export function capabilityMapForWriter(writer: SitePlatform): SiteCapabilityMap {
  return capabilityMapFor(getAdapter(writer));
}

export function parseCapabilityMap(raw: unknown): SiteCapabilityMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const map: SiteCapabilityMap = {};
  for (const op of ALL_OPS) {
    const row = src[op];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    if (!isSitePlatform(r.writer)) continue;
    const state = r.state;
    if (
      state !== "unsupported" &&
      state !== "supported_unverified" &&
      state !== "certified" &&
      state !== "stale" &&
      state !== "temporarily_failed" &&
      state !== "revoked"
    ) {
      continue;
    }
    map[op] = {
      state,
      writer: r.writer,
      reason: typeof r.reason === "string" && r.reason.trim() ? r.reason : unverifiedReason(r.writer, op),
      certified_at: typeof r.certified_at === "string" ? r.certified_at : null,
      last_execution_id: typeof r.last_execution_id === "string" ? r.last_execution_id : null,
      fail_count: typeof r.fail_count === "number" && Number.isFinite(r.fail_count) ? r.fail_count : 0,
    };
  }
  return map;
}

/** True only when Slice 1 (or later) has proven the op. Slice 0 is always false. */
export function isOperationCertified(
  map: SiteCapabilityMap | null | undefined | unknown,
  op: AdapterCapability
): boolean {
  return parseCapabilityMap(map)[op]?.state === "certified";
}

export function executionGrade(
  map: SiteCapabilityMap | null | undefined,
  connected: boolean
): ExecutionGrade {
  if (!connected) return "none";
  const parsed = parseCapabilityMap(map);
  const claimed = ALL_OPS.filter((op) => {
    const state = parsed[op]?.state;
    return state && state !== "unsupported";
  });
  // Reachable writer with an empty/legacy map is still only transport.
  if (!claimed.length) return "transport";
  const certified = claimed.filter((op) => parsed[op]?.state === "certified");
  if (certified.length === claimed.length) return "full";
  if (certified.length > 0) return "partial";
  return "transport";
}

/**
 * Which writer operation a draft task would perform live.
 * improve_content is an audit report and must never map to a write.
 */
export function capabilityForTaskType(taskType: string): AdapterCapability | null {
  if (taskType === "new_page" || taskType === "new_blog" || taskType === "geo_answers") {
    return "upsert_page";
  }
  if (taskType === "fix_meta" || taskType === "technical_fix") return "update_meta";
  return null;
}

export function emptyCapabilityMap(): SiteCapabilityMap {
  return {};
}

/**
 * Persist the chosen writer and capability map.
 * Fails hard when migration 020 is missing — a "connected" badge without a pin
 * would lie about publishing being set up.
 */
export async function persistBrandWriter(
  brandId: string,
  writer: SitePlatform | null,
  capabilities: SiteCapabilityMap
): Promise<void> {
  const { error } = await db
    .from("brands")
    .update({
      primary_writer: writer,
      site_capabilities: capabilities,
    })
    .eq("id", brandId);
  if (error) {
    throw new Error(
      `Could not save the publishing connection (${error.message}). Apply supabase/020_execution_honesty.sql in Supabase, then try again.`
    );
  }
}

export async function clearBrandWriter(brandId: string): Promise<void> {
  const { data: prior } = await db
    .from("brands")
    .select("proxy_site_token")
    .eq("id", brandId)
    .maybeSingle();
  invalidateProxyToken(prior?.proxy_site_token);

  const { error } = await db
    .from("brands")
    .update({
      primary_writer: null,
      site_capabilities: emptyCapabilityMap(),
      source_of_truth: {},
      proxy_site_token: null,
      proxy_namespace: null,
      proxy_claim_check: {},
      proxy_token_rotated_at: null,
    })
    .eq("id", brandId);
  if (error) {
    // Older DBs may lack 022 columns — still clear the honesty pin.
    await persistBrandWriter(brandId, null, emptyCapabilityMap());
  }
}

export async function patchOperationCapability(
  brandId: string,
  op: AdapterCapability,
  patch: Partial<OperationCapability> & Pick<OperationCapability, "state" | "writer">
): Promise<SiteCapabilityMap> {
  const { data } = await db
    .from("brands")
    .select("primary_writer, site_capabilities")
    .eq("id", brandId)
    .maybeSingle();
  const map = parseCapabilityMap(data?.site_capabilities);
  const prev = map[op];
  map[op] = {
    state: patch.state,
    writer: patch.writer,
    reason: patch.reason ?? prev?.reason ?? unverifiedReason(patch.writer, op),
    certified_at: patch.certified_at === undefined ? prev?.certified_at ?? null : patch.certified_at,
    last_execution_id:
      patch.last_execution_id === undefined ? prev?.last_execution_id ?? null : patch.last_execution_id,
    fail_count: patch.fail_count === undefined ? prev?.fail_count ?? 0 : patch.fail_count,
  };
  const writer =
    data?.primary_writer && isSitePlatform(data.primary_writer) ? data.primary_writer : patch.writer;
  await persistBrandWriter(brandId, writer, map);
  return map;
}

/** Previously certified ops become stale. Unverified rows are left alone. */
export async function markCertifiedOperationsStale(brandId: string): Promise<void> {
  const { data } = await db
    .from("brands")
    .select("primary_writer, site_capabilities")
    .eq("id", brandId)
    .maybeSingle();
  const map = parseCapabilityMap(data?.site_capabilities);
  let changed = false;
  for (const op of ALL_OPS) {
    const row = map[op];
    if (!row || row.state !== "certified") continue;
    map[op] = { ...row, state: "stale", reason: STALE_REASON };
    changed = true;
  }
  if (!changed) return;
  const writer =
    data?.primary_writer && isSitePlatform(data.primary_writer) ? data.primary_writer : null;
  await persistBrandWriter(brandId, writer, map);
}

export function failedCertificationState(failCount: number): OperationState {
  return failCount >= 3 ? "temporarily_failed" : "supported_unverified";
}
