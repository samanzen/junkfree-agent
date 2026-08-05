// WEBHOOK ADAPTER — the universal escape hatch.
//
// Posts a signed, platform-neutral JSON envelope to an endpoint the customer
// controls. This is what makes the engine genuinely platform-agnostic today:
// any stack with no first-class adapter (Webflow, Shopify, HighLevel, a static
// site build hook, a bespoke CMS) can be served by a receiver the customer or
// we write, without changing anything in this repository.
//
// It claims BOTH capabilities because the receiver is custom code by
// definition -- unlike WordPress, there is no platform limitation to model
// here. A receiver that cannot handle a change type should reject it, and its
// error message is surfaced verbatim.
//
// Credentials: { signingSecret }
// Config:      { endpointUrl }

import { createHmac, timingSafeEqual } from "crypto";
import type { AdapterContext, PublishAdapter, PublishResult, SiteChange } from "../types";

type ReceiverResponse = {
  ok?: boolean;
  error?: string;
  remoteId?: string | number;
  url?: string;
  previous?: Record<string, unknown>;
};

// Hostnames that must never be reachable from a server-side fetch driven by
// customer-supplied configuration. This blocks the obvious SSRF literals; it is
// NOT a complete defence (a hostname resolving to a private address would still
// pass), which is why the endpoint is also required to be https and the
// response body is never echoed anywhere except an error string.
const BLOCKED_HOST = /^(localhost$|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0$|\[?::1\]?$|172\.(1[6-9]|2\d|3[01])\.)/i;

function endpointOf(ctx: AdapterContext): { url: URL } | { error: string } {
  const raw = (ctx.config.endpointUrl as string) || "";
  if (!raw.trim()) return { error: "endpointUrl is not configured." };
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "endpointUrl is not a valid URL." };
  }
  if (url.protocol !== "https:") return { error: "endpointUrl must use https://." };
  if (BLOCKED_HOST.test(url.hostname)) return { error: "endpointUrl must not point at a private or loopback address." };
  return { url };
}

/**
 * HMAC-SHA256 over the exact bytes sent. The receiver recomputes this to prove
 * the request came from us and was not altered in transit.
 */
export function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body, "utf8").digest("hex");
}

/** Constant-time comparison, exported so a receiver implementation can reuse it. */
export function verifySignature(body: string, secret: string, signature: string): boolean {
  const expected = Buffer.from(signPayload(body, secret), "utf8");
  const given = Buffer.from(signature || "", "utf8");
  if (expected.length !== given.length) return false;
  return timingSafeEqual(expected, given);
}

async function post(
  ctx: AdapterContext,
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body: ReceiverResponse | string | null; error?: string }> {
  const resolved = endpointOf(ctx);
  if ("error" in resolved) return { ok: false, status: 0, body: null, error: resolved.error };

  const secret = ctx.credentials.signingSecret;
  if (!secret) return { ok: false, status: 0, body: null, error: "signingSecret is not configured." };

  const raw = JSON.stringify(payload);

  try {
    const res = await fetch(resolved.url.toString(), {
      method: "POST",
      redirect: "error", // a redirect could send a signed payload somewhere unintended
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "SEO-Platform-Publisher",
        "X-Signature-256": `sha256=${signPayload(raw, secret)}`,
        "X-Brand-Slug": ctx.brand.slug,
      },
      body: raw,
    });
    const text = await res.text();
    let body: ReceiverResponse | string | null = null;
    try { body = text ? (JSON.parse(text) as ReceiverResponse) : null; } catch { body = text; }
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export const webhookAdapter: PublishAdapter = {
  provider: "webhook",
  label: "Custom webhook",
  capabilities: ["upsert_page", "update_meta"],

  async check(ctx) {
    const resolved = endpointOf(ctx);
    if ("error" in resolved) return { ok: false, detail: resolved.error };
    if (!ctx.credentials.signingSecret) return { ok: false, detail: "signingSecret is not configured." };

    const r = await post(ctx, { event: "check", brand: ctx.brand.slug, sentAt: new Date().toISOString() });
    if (r.ok) return { ok: true, detail: `Receiver at ${resolved.url.host} accepted the signed check request.` };
    if (r.error) return { ok: false, detail: r.error };
    return { ok: false, detail: `Receiver returned HTTP ${r.status}.` };
  },

  async apply(ctx, change: SiteChange): Promise<PublishResult> {
    const r = await post(ctx, {
      event: "apply",
      brand: ctx.brand.slug,
      site: ctx.brand.site_url,
      change,
      sentAt: new Date().toISOString(),
    });

    if (!r.ok) {
      const fromBody = typeof r.body === "object" && r.body?.error ? r.body.error : null;
      return {
        ok: false,
        error: r.error || fromBody || `Receiver returned HTTP ${r.status}.`,
        retryable: r.status === 0 || r.status >= 500 || r.status === 429,
      };
    }

    // A 2xx with { ok: false } is an explicit, non-retryable refusal.
    const body = typeof r.body === "object" && r.body ? r.body : {};
    if (body.ok === false) {
      return { ok: false, error: body.error || "Receiver refused the change.", retryable: false };
    }

    return {
      ok: true,
      remoteId: body.remoteId != null ? String(body.remoteId) : null,
      url: typeof body.url === "string" ? body.url : null,
      previous: body.previous && typeof body.previous === "object" ? body.previous : null,
    };
  },
};
