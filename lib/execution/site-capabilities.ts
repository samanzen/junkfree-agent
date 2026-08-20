// Per-brand website execution state.
//
// This is NOT lib/capabilities.ts (plan/tier gating) and NOT agent_tasks.capability
// (specialist type). It is the Slice 0 map stored on brands.site_capabilities:
// what the primary writer can try, and whether that try has been proven live.
//
// Slice 0 never writes state "certified". isOperationCertified() exists so
// Autopilot can fail closed until Slice 1 certification exists.

import { db } from "../supabase";
import type { PublishAdapter, SitePlatform, AdapterCapability } from "./types";
import { getAdapter, isSitePlatform } from "./registry";

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
};

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
      "Your website can receive title and description updates. Publishing is not proven yet.",
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
      };
    } else {
      map[op] = {
        state: "unsupported",
        writer,
        reason: unverifiedReason(writer, op),
        certified_at: null,
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
    };
  }
  return map;
}

/** True only when Slice 1 (or later) has proven the op. Slice 0 is always false. */
export function isOperationCertified(
  map: SiteCapabilityMap | null | undefined,
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

/** Persist the chosen writer and Slice 0 capability map. Best-effort: missing columns must not fail connect. */
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
    console.warn(`[execution] could not persist writer for brand ${brandId}: ${error.message}`);
  }
}

export async function clearBrandWriter(brandId: string): Promise<void> {
  await persistBrandWriter(brandId, null, emptyCapabilityMap());
}
