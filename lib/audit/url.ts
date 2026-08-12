// SSRF GUARD for the public, unauthenticated site audit — SERVER ONLY.
//
// This module imports `dns/promises`, so it must never be reached from a client
// component. The pure syntax rules live in ./url-shape, which both sides share;
// this file adds the two things that need a server: DNS resolution and fetching.
//
// /api/audit accepts a URL from anyone on the internet and fetches it from our
// server. That is the textbook SSRF setup: without these checks a visitor could
// point us at http://169.254.169.254/ (cloud instance metadata), at an internal
// service reachable from the function, or at localhost, and read the response
// back through our own API.
//
// The rules, in order of what they stop:
//   1. Scheme allowlist        — no file://, gopher://, data:, ftp://
//   2. No embedded credentials — https://user:pass@host strips auth confusion
//   3. Port allowlist          — 80/443 only; no probing internal service ports
//   4. DNS resolution + IP check — the hostname's ACTUAL addresses must all be
//      public. This is what defeats a public name with a private A record
//      (e.g. localtest.me → 127.0.0.1), which a string check would never catch.
//   5. Manual redirect following — every hop is re-validated, because hop 1 can
//      be public and hop 2 can point at metadata.
//
// Residual risk, stated rather than hidden: DNS rebinding. We resolve, approve,
// then fetch, and Node re-resolves at connect time, so a record with a ~0 TTL
// could in principle flip between those two moments. Closing that fully means
// pinning the socket to the vetted IP with a custom agent. The exposure here is
// one GET whose body is parsed for SEO tags and never echoed raw to the caller,
// so the value of that attack is low; documenting it beats pretending.

import { lookup } from "dns/promises";
import { checkUrlShape, isBlockedIp, type UrlCheck, type UrlRejection } from "./url-shape";

export { checkUrlShape, isBlockedIp };
export type { UrlCheck, UrlRejection };

export const AUDIT_FETCH_TIMEOUT_MS = 8_000;
export const AUDIT_MAX_BYTES = 2_000_000; // 2 MB of HTML is far beyond any real page
export const AUDIT_MAX_REDIRECTS = 4;

/** Full check: shape, then DNS, then every resolved address. */
export async function assertPublicUrl(raw: string): Promise<UrlCheck> {
  const shape = checkUrlShape(raw);
  if (!shape.ok) return shape;

  let addresses: { address: string }[];
  try {
    addresses = await lookup(shape.url.hostname, { all: true });
  } catch {
    return {
      ok: false,
      reason: "dns",
      message: "We couldn't find that domain. Check the spelling and try again.",
    };
  }

  if (!addresses.length) {
    return { ok: false, reason: "dns", message: "We couldn't find that domain." };
  }
  // EVERY address must be public: one private record is enough to abuse.
  for (const { address } of addresses) {
    if (isBlockedIp(address)) {
      return { ok: false, reason: "private_host", message: "That address can't be checked." };
    }
  }

  return { ok: true, url: shape.url };
}

export type SafeFetchResult =
  | { ok: true; html: string; finalUrl: string; status: number; elapsedMs: number }
  | {
      ok: false;
      reason: UrlRejection | "http" | "timeout" | "too_large" | "not_html";
      message: string;
      status?: number;
    };

/**
 * Fetch a page with every redirect re-validated.
 *
 * `redirect: "manual"` is the point of this function: the platform's automatic
 * redirect following would happily walk from a public first hop to an internal
 * second hop without ever consulting our IP rules again.
 */
export async function safeFetchPage(raw: string): Promise<SafeFetchResult> {
  let current = raw;
  const startedAt = Date.now();

  for (let hop = 0; hop <= AUDIT_MAX_REDIRECTS; hop++) {
    const checked = await assertPublicUrl(current);
    if (!checked.ok) return { ok: false, reason: checked.reason, message: checked.message };

    let res: Response;
    try {
      res = await fetch(checked.url.toString(), {
        method: "GET",
        redirect: "manual",
        headers: {
          // Identify honestly so site owners can see us in their logs.
          "User-Agent": "SEO-Platform-Audit/1.0 (+public site audit)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(AUDIT_FETCH_TIMEOUT_MS),
      });
    } catch (e) {
      const timedOut = e instanceof Error && /timeout|aborted|timed out/i.test(e.message);
      return {
        ok: false,
        reason: timedOut ? "timeout" : "http",
        message: timedOut
          ? "That site took too long to respond. It may be slow or blocking automated checks."
          : "We couldn't reach that site.",
      };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) {
        return { ok: false, reason: "http", message: "That site returned an incomplete redirect.", status: res.status };
      }
      current = new URL(location, checked.url).toString();
      continue;
    }

    if (!res.ok) {
      return {
        ok: false,
        reason: "http",
        message: `That site responded with an error (${res.status}).`,
        status: res.status,
      };
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      return { ok: false, reason: "not_html", message: "That address doesn't return a web page." };
    }

    // Declared length is a hint, not a guarantee — the streaming cap below is
    // what actually protects memory when a server lies or omits the header.
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared && declared > AUDIT_MAX_BYTES) {
      return { ok: false, reason: "too_large", message: "That page is too large to analyse." };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return { ok: false, reason: "http", message: "That site returned an empty response." };
    }

    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > AUDIT_MAX_BYTES) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "too_large", message: "That page is too large to analyse." };
      }
      chunks.push(value);
    }

    const buf = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      buf.set(c, offset);
      offset += c.byteLength;
    }

    return {
      ok: true,
      html: new TextDecoder("utf-8").decode(buf),
      finalUrl: checked.url.toString(),
      status: res.status,
      elapsedMs: Date.now() - startedAt,
    };
  }

  return { ok: false, reason: "http", message: "That site redirected too many times." };
}
