// URL VALIDATION — the pure half, with no Node built-ins.
//
// Split out of url.ts because both sides need it. The signup page re-validates
// the ?site= parameter in the BROWSER, and url.ts imports `dns/promises` at
// module scope, so importing the server module from a client component pulled a
// Node built-in into the browser bundle and broke the build.
//
// The fix is one implementation, not two: everything here is pure string and
// arithmetic work that runs identically on both sides, and lib/audit/url.ts
// layers DNS resolution and fetching on top for server use. A second copy of
// these rules would drift, and the copy that drifted would be the security one.

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

/** Syntactic checks only — no network, so this is safe in the browser. */
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
