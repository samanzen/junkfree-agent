// SITE EXECUTION LAYER — the contract every publishing adapter implements.
//
// Naming note: lib/runner.ts calls itself the "execution engine" and drives the
// JOB queue (claim -> run -> finish). This module is a different layer: it is
// what a job ultimately does to a customer's LIVE WEBSITE. The queue decides
// when work runs; an adapter here decides how a change reaches WordPress, a
// webhook, Shopify, Webflow or anything added later.
//
// The whole point of this file is that lib/execution/engine.ts never knows
// which platform it is talking to. Adding a platform means adding one file
// under adapters/ and one line in registry.ts -- nothing else changes.

import type { Brand } from "../brands";

/** Platforms with an adapter today. Extend the union, add the file, register it. */
export type SitePlatform = "wordpress" | "webhook";

/**
 * What an adapter is able to do. Declared per adapter and checked BEFORE a
 * change is dispatched, so an adapter is never handed work it cannot perform.
 * WordPress core, for example, has no meta-description field (that belongs to
 * an SEO plugin), so its adapter deliberately does not claim "update_meta".
 */
export type AdapterCapability = "upsert_page" | "update_meta";

/**
 * A platform-neutral description of a change to make to a site.
 *
 * Deliberately NOT "here is a draft row" -- a draft is this platform's internal
 * shape, and leaking it into every adapter would make each adapter re-derive
 * slugs, strip front matter and decide what is publishable. lib/execution/
 * changes.ts does that translation once, and adapters receive only finished,
 * already-validated instructions.
 */
export type SiteChange =
  | {
      type: "upsert_page";
      /** Site-relative path with no leading slash, e.g. "blog/junk-removal-cost". */
      slug: string;
      title: string;
      metaDescription: string | null;
      bodyMarkdown: string;
    }
  | {
      type: "update_meta";
      /** Absolute URL of the existing page whose listing is being rewritten. */
      url: string;
      title: string | null;
      metaDescription: string | null;
    };

/** Everything an adapter needs, resolved by the engine before it is called. */
export type AdapterContext = {
  brand: Brand;
  /** Decrypted secrets from brand_integrations. Never logged, never returned. */
  credentials: Record<string, string>;
  /** Non-secret provider config (site URL, post type, author id, ...). */
  config: Record<string, unknown>;
};

export type PublishResult =
  | {
      ok: true;
      /** The platform's own identifier for the affected resource, if it has one. */
      remoteId: string | null;
      /** Where the change is now live, if the platform reports it. */
      url: string | null;
      /**
       * The values this change overwrote. Recorded so a future phase can offer
       * one-click rollback; captured now because it is only knowable at the
       * moment of the write. Null when the platform cannot report prior state.
       */
      previous: Record<string, unknown> | null;
    }
  | {
      ok: false;
      error: string;
      /**
       * True for transport/rate-limit/5xx failures that a later retry could
       * plausibly fix; false for auth, permission and validation failures,
       * which will fail identically forever until a human changes something.
       */
      retryable: boolean;
    };

export interface PublishAdapter {
  readonly provider: SitePlatform;
  /** Human-facing name, used in API responses and any future settings UI. */
  readonly label: string;
  readonly capabilities: readonly AdapterCapability[];
  /**
   * Verify credentials and configuration WITHOUT writing anything. Used by the
   * status endpoint so a misconfiguration surfaces before it is discovered by a
   * failed publish halfway through a customer's content queue.
   */
  check(ctx: AdapterContext): Promise<{ ok: boolean; detail: string }>;
  /** Perform the change. Must never throw -- return { ok: false } instead. */
  apply(ctx: AdapterContext, change: SiteChange): Promise<PublishResult>;
}

export function supports(adapter: PublishAdapter, change: SiteChange): boolean {
  return adapter.capabilities.includes(change.type);
}
