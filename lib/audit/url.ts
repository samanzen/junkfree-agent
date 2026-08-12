// SSRF GUARD for the public, unauthenticated site audit.
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

export const AUDIT_FETCH_TIMEOUT_MS = 8_000;
export const AUDIT_MAX_BYTES = 2_000_000; // 2 MB of HTML is far beyond any real page
export const AUDIT_MAX_REDIRECTS = 4;

export type UrlRejection =
  | "invalid"
  | "scheme"
  | "credentials"
  | "port"
  | "private_host"
  | "dns";

export type UrlCheck =
  | { ok: true; url: URL }
  | { ok: false; reason: UrlRejection; message: string };

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);
const ALLOWED_PORTS = new Set(["", "80", "443"]);

/** Parse an IPv4 dotted quad into its 32-bit value, or null if not IPv4. */
function ipv4ToLong(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = out * 256 + n;
  }
  return out >>> 0;
}

function inCidr(ipLong: number, base: string, bits: number): boolean {
  const baseLong = ipv4ToLong(base);
  if (baseLong == null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipLong & mask) === (baseLong & mask);
}

/**
 * Every IPv4 range that must never be reachable from a user-supplied URL.
 * Loopback, RFC1918, CGNAT, link-local (cloud metadata lives at 169.254.169.254),
 * benchmarking, documentation, multicast and reserved space.
 */
const BLOCKED_V4: [string, number][] = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

/** True when this literal address must not be fetched. */
export function isBlockedIp(ip: string): boolean {
  const raw = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!raw) return true;

  const v4 = ipv4ToLong(raw);
  if (v4 != null) {
    return BLOCKED_V4.some(([base, bits]) => inCidr(v4, base, bits));
  }

  // ── IPv6 ──
  if (!raw.includes(":")) return true; // neither v4 nor v6: refuse rather than guess

  // IPv4-mapped (::ffff:127.0.0.1) and IPv4-embedded translation prefixes carry
  // a v4 address inside a v6 literal — unwrap and apply the v4 rules.
  const embedded = raw.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (embedded) {
    const inner = ipv4ToLong(embedded[1]);
    if (inner != null && BLOCKED_V4.some(([base, bits]) => inCidr(inner, base, bits))) {
      return true;
    }
  }

  if (raw === "::" || raw === "::1") return true;
  // fc00::/7 unique-local, fe80::/10 link-local, ff00::/8 multicast.
  if (/^f[cd][0-9a-f]{2}:/.test(raw)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(raw)) return true;
  if (/^ff[0-9a-f]{2}:/.test(raw)) return true;
  // 2002::/16 (6to4) can tunnel a private IPv4; refuse the whole prefix.
  if (/^2002:/.test(raw)) return true;

  return false;
}

/** Syntactic checks only — no network. Exported so tests stay fast. */
export function checkUrlShape(raw: string): UrlCheck {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    return { ok: false, reason: "invalid", message: "Enter a website address." };
  }

  // People type "example.com". Assume https rather than rejecting them.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return { ok: false, reason: "invalid", message: "That doesn't look like a valid website address." };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "scheme", message: "Only http and https addresses can be checked." };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials", message: "Remove the username and password from the address." };
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    return { ok: false, reason: "port", message: "Only standard web ports (80 and 443) can be checked." };
  }
  if (!url.hostname || !url.hostname.includes(".")) {
    return { ok: false, reason: "invalid", message: "Enter a full domain, like example.com." };
  }
  // A bare IP is never a customer's marketing site and is the usual SSRF probe.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname) || url.hostname.includes(":")) {
    if (isBlockedIp(url.hostname)) {
      return { ok: false, reason: "private_host", message: "That address can't be checked." };
    }
  }

  return { ok: true, url };
}

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
  | { ok: false; reason: UrlRejection | "http" | "timeout" | "too_large" | "not_html"; message: string; status?: number };

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
