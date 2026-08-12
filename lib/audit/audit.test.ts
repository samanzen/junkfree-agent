import { describe, expect, test } from "vitest";
import { checkUrlShape, isBlockedIp } from "./url";
import { extractFacts, runChecks, scoreChecks, scoreBand } from "./onpage";
import { buildReport, sortBySeverity, FREE_ISSUE_LIMIT } from "./report";

// ── SSRF guard ──────────────────────────────────────────────────────────────
describe("isBlockedIp", () => {
  test("blocks loopback, private, link-local and CGNAT ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "127.1.1.1",
      "10.0.0.5",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254", // cloud instance metadata — the one that matters most
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "240.0.0.1",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  test("allows ordinary public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "192.167.1.1"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });

  test("blocks IPv6 loopback, unique-local and link-local", () => {
    for (const ip of ["::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "[::1]"]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  test("blocks IPv4-mapped IPv6 that hides a private address", () => {
    expect(isBlockedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedIp("::ffff:169.254.169.254")).toBe(true);
    expect(isBlockedIp("2002:7f00:1::")).toBe(true);
  });

  test("allows a public IPv6 address", () => {
    expect(isBlockedIp("2606:4700:4700::1111")).toBe(false);
  });
});

describe("checkUrlShape", () => {
  test("assumes https when the scheme is omitted", () => {
    const r = checkUrlShape("example.com");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.url.protocol).toBe("https:");
  });

  test("refuses non-http schemes", () => {
    for (const raw of ["file:///etc/passwd", "ftp://example.com", "gopher://example.com"]) {
      const r = checkUrlShape(raw);
      expect(r.ok, raw).toBe(false);
      if (!r.ok) expect(r.reason).toBe("scheme");
    }
  });

  test("refuses embedded credentials", () => {
    const r = checkUrlShape("https://user:pass@example.com");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("credentials");
  });

  test("refuses non-standard ports used to probe internal services", () => {
    const r = checkUrlShape("http://example.com:6379");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("port");
  });

  test("refuses a private IP literal outright", () => {
    const r = checkUrlShape("http://169.254.169.254/latest/meta-data/");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("private_host");
  });

  test("refuses hostnames without a dot", () => {
    const r = checkUrlShape("http://localhost");
    expect(r.ok).toBe(false);
  });

  test("refuses empty input with a helpful message", () => {
    const r = checkUrlShape("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/Enter a website address/i);
  });
});

// ── On-page analysis ────────────────────────────────────────────────────────
const GOOD_HTML = `<!doctype html><html lang="en"><head>
<title>Affordable Junk Removal in Vancouver | Same Day Service</title>
<meta name="description" content="Same-day junk removal across Vancouver with upfront pricing, licensed crews and recycling-first disposal. Book online in under two minutes today.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://example.com/">
<link rel="icon" href="/favicon.ico">
<meta property="og:title" content="Junk Removal"><meta property="og:description" content="Same day"><meta property="og:image" content="/og.png">
<script type="application/ld+json">{"@type":"LocalBusiness"}</script>
</head><body>
<h1>Affordable junk removal in Vancouver</h1>
<h2>What we take</h2><h2>Pricing</h2>
<img src="a.jpg" alt="A crew loading a truck">
<a href="/pricing">Pricing</a><a href="/about">About</a><a href="/contact">Contact</a>
<p>${"word ".repeat(500)}</p>
</body></html>`;

const BAD_HTML = `<!doctype html><html><head>
<meta name="robots" content="noindex">
</head><body>
<img src="a.jpg"><img src="b.jpg">
<p>Too short.</p>
</body></html>`;

describe("extractFacts", () => {
  test("reads the tags a well-built page provides", () => {
    const f = extractFacts(GOOD_HTML, "https://example.com/", 300);
    expect(f.title).toMatch(/Affordable Junk Removal/);
    expect(f.metaDescription.length).toBeGreaterThan(70);
    expect(f.h1s).toHaveLength(1);
    expect(f.h2Count).toBe(2);
    expect(f.imgTotal).toBe(1);
    expect(f.imgWithAlt).toBe(1);
    expect(f.canonical).toBe("https://example.com/");
    expect(f.viewport).toMatch(/width=device-width/);
    expect(f.lang).toBe("en");
    expect(f.jsonLdBlocks).toBe(1);
    expect(f.isHttps).toBe(true);
    expect(f.internalLinks).toBe(3);
    expect(f.wordCount).toBeGreaterThan(400);
  });

  test("reports absence rather than guessing on a bare page", () => {
    const f = extractFacts(BAD_HTML, "http://example.com/", 3000);
    expect(f.title).toBe("");
    expect(f.metaDescription).toBe("");
    expect(f.h1s).toHaveLength(0);
    expect(f.imgWithAlt).toBe(0);
    expect(f.imgTotal).toBe(2);
    expect(f.isHttps).toBe(false);
    expect(f.robotsMeta).toMatch(/noindex/);
  });

  test("does not count script or style text as page content", () => {
    const html = `<html><body><script>${"junk ".repeat(300)}</script><p>Only these words count.</p></body></html>`;
    const f = extractFacts(html, "https://example.com/", 100);
    expect(f.wordCount).toBeLessThan(10);
  });

  test("separates internal from external links", () => {
    const html = `<html><body>
      <a href="https://example.com/a">a</a>
      <a href="https://www.example.com/b">b</a>
      <a href="https://other.com/c">c</a>
      <a href="/relative">d</a>
      <a href="#anchor">e</a>
      <a href="mailto:x@y.com">f</a>
    </body></html>`;
    const f = extractFacts(html, "https://example.com/", 100);
    expect(f.internalLinks).toBe(3);
    expect(f.externalLinks).toBe(1);
  });
});

describe("runChecks + scoreChecks", () => {
  test("a well-built page scores high with no failures", () => {
    const checks = runChecks(extractFacts(GOOD_HTML, "https://example.com/", 300));
    const score = scoreChecks(checks);
    expect(score).toBeGreaterThanOrEqual(90);
    expect(checks.filter((c) => c.status === "fail")).toHaveLength(0);
    expect(scoreBand(score).tone).toBe("good");
  });

  test("a broken page scores low and names the real failures", () => {
    const checks = runChecks(extractFacts(BAD_HTML, "http://example.com/", 3000));
    const score = scoreChecks(checks);
    expect(score).toBeLessThan(50);
    const failed = checks.filter((c) => c.status === "fail").map((c) => c.id);
    expect(failed).toContain("title");
    expect(failed).toContain("meta_description");
    expect(failed).toContain("h1");
    expect(failed).toContain("https");
    expect(failed).toContain("viewport");
    expect(failed).toContain("indexable");
  });

  test("every failing check tells the owner what to do", () => {
    const checks = runChecks(extractFacts(BAD_HTML, "http://example.com/", 3000));
    for (const c of checks) {
      if (c.status !== "pass") expect(c.fix.length, c.id).toBeGreaterThan(10);
    }
  });

  test("a page with no images is not penalised for alt text", () => {
    const html = `<html><body><p>No images here at all.</p></body></html>`;
    const alt = runChecks(extractFacts(html, "https://example.com/", 100)).find(
      (c) => c.id === "image_alt",
    );
    expect(alt?.status).toBe("pass");
  });

  test("score is bounded to 0-100", () => {
    for (const html of [GOOD_HTML, BAD_HTML, "<html></html>", ""]) {
      const s = scoreChecks(runChecks(extractFacts(html, "https://example.com/", 100)));
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});

// ── Free / gated split ──────────────────────────────────────────────────────
describe("buildReport", () => {
  test("worst issues surface first and passes never outrank problems", () => {
    const checks = runChecks(extractFacts(BAD_HTML, "http://example.com/", 3000));
    const sorted = sortBySeverity(checks);
    expect(sorted[0].status).toBe("fail");
    expect(sorted[0].impact).toBe("high");

    // Ordering is a property, not a fixed tail: this page happens to have no
    // passing checks at all, so assert the invariant instead of the last item.
    const rank = { fail: 0, warn: 1, pass: 2 } as const;
    for (let i = 1; i < sorted.length; i++) {
      expect(rank[sorted[i].status]).toBeGreaterThanOrEqual(rank[sorted[i - 1].status]);
    }

    // And on a page that does have passes, they land after the problems.
    const mixed = sortBySeverity(runChecks(extractFacts(GOOD_HTML, "https://example.com/", 300)));
    expect(mixed[mixed.length - 1].status).toBe("pass");
  });

  test("previews a fixed number of issues and withholds the exact remainder", () => {
    const checks = runChecks(extractFacts(BAD_HTML, "http://example.com/", 3000));
    const report = buildReport({
      url: "http://example.com/",
      finalUrl: "http://example.com/",
      checks,
      score: scoreChecks(checks),
    });

    expect(report.previewIssues.length).toBeLessThanOrEqual(FREE_ISSUE_LIMIT);
    // The withheld count must be exactly what was measured — never inflated.
    expect(report.previewIssues.length + report.lockedIssueCount).toBe(report.issuesFound);
    expect(report.lockedIssueLabels).toHaveLength(report.lockedIssueCount);
  });

  test("locked modules describe capability without inventing any metric", () => {
    const checks = runChecks(extractFacts(GOOD_HTML, "https://example.com/", 300));
    const report = buildReport({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      checks,
      score: scoreChecks(checks),
    });

    expect(report.lockedModules.length).toBeGreaterThan(3);
    for (const m of report.lockedModules) {
      expect(m.promise.length).toBeGreaterThan(10);
      expect(m.requires.length).toBeGreaterThan(10);
      // No fabricated figures hiding behind the lock.
      expect(m.promise).not.toMatch(/\b\d+(\.\d+)?%/);
      expect(m.promise).not.toMatch(/\b(DA|DR)\s*\d+/);
    }
  });

  test("a clean page does not manufacture problems to sell an upgrade", () => {
    const checks = runChecks(extractFacts(GOOD_HTML, "https://example.com/", 300));
    const report = buildReport({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      checks,
      score: scoreChecks(checks),
    });
    expect(report.issuesFound).toBe(report.previewIssues.length + report.lockedIssueCount);
    expect(report.passedChecks.length).toBeGreaterThan(8);
  });
});
