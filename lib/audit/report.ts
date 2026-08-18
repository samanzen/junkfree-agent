// PUBLIC AUDIT REPORT — the free/gated split.
//
// The conversion mechanic and the honesty rule have to hold at the same time,
// so the line is drawn by what we can actually prove:
//
//   FREE   — everything we measured on the page we fetched. Real score, real
//            issue count, and the top issues in full with their fixes. A
//            visitor can act on this without ever signing up. That is the
//            point: the free thing must be genuinely useful, or the paid thing
//            is not believable.
//
//   GATED  — (a) the remaining detected issues, which we HAVE measured and are
//            withholding, so the count is exact and never inflated; and
//            (b) modules that need data we do not have for an anonymous
//            visitor — every page rather than one, Search Console rankings,
//            backlinks, competitor gaps. Those are described as what they are,
//            with no placeholder numbers standing in for them.
//
// A locked module never shows a fabricated figure. "Connect to unlock" is the
// truth; "your DA is 42" would not be.

import type { Check } from "./onpage";
import { countByStatus, scoreBand } from "./onpage";
import type { AuditDomainIntel } from "./enrich";
import { emptyDomainIntel } from "./enrich";

/** How many fully-detailed issues an anonymous visitor gets. */
export const FREE_ISSUE_LIMIT = 5;

export type LockedModule = {
  id: string;
  label: string;
  /** What it delivers, stated without inventing a value. */
  promise: string;
  /** Why it cannot run before signup — the honest reason, not a sales line. */
  requires: string;
};

/**
 * Off-page and sitewide capability. Each needs either the customer's own
 * Search Console grant or a metered data provider, so none of it can run for
 * an anonymous URL. Copy here is the same promise the product actually keeps.
 */
export const LOCKED_MODULES: LockedModule[] = [
  {
    id: "full_crawl",
    label: "Every page, not just this one",
    promise: "Crawls your whole site and ranks each page's issues by traffic at stake.",
    requires: "A full crawl takes minutes rather than seconds, so it runs on your account.",
  },
  {
    id: "rankings",
    label: "Your real keyword rankings",
    promise: "Positions, clicks and impressions for every term you already rank for.",
    requires: "Comes from your own Search Console property once you connect it.",
  },
  {
    id: "opportunities",
    label: "Keywords within reach of page 1",
    promise: "Terms sitting in positions 5–20 where a small push moves real traffic.",
    requires: "Needs your Search Console history to identify them honestly.",
  },
  {
    id: "backlinks",
    label: "Off-page authority and backlinks",
    promise: "Referring domains, link growth and the gap against your competitors.",
    requires: "Sourced from a paid link index, so it runs on an account rather than anonymously.",
  },
  {
    id: "competitors",
    label: "Competitor gap analysis",
    promise: "The keywords and pages your competitors win that you do not.",
    requires: "Needs your ranking data as the baseline to compare against.",
  },
  {
    id: "execution",
    label: "Fixes written and published for you",
    promise: "AI drafts the fix, you approve it, and it publishes to your site.",
    requires: "Publishing connects to your WordPress site or webhook after signup.",
  },
];

export type AuditReport = {
  url: string;
  finalUrl: string;
  fetchedAt: string;
  score: number;
  band: { label: string; tone: "good" | "mixed" | "poor" };
  counts: { pass: number; warn: number; fail: number };
  /** Total problems found (fail + warn). Exact — this is the honesty anchor. */
  issuesFound: number;
  /** Fully detailed issues, free to read. */
  previewIssues: Check[];
  /** Passing checks, shown as quick reassurance. */
  passedChecks: Check[];
  /** Count of measured issues withheld behind signup. Never inflated. */
  lockedIssueCount: number;
  /** Labels only, so the visitor sees the shape of what is withheld. */
  lockedIssueLabels: string[];
  lockedModules: LockedModule[];
  /** Off-page snapshot (DataForSEO when configured). Never fabricated. */
  domain: AuditDomainIntel;
};

const IMPACT_ORDER = { high: 0, medium: 1, low: 2 } as const;
const STATUS_ORDER = { fail: 0, warn: 1, pass: 2 } as const;

/** Worst first: high-impact failures lead, passes never outrank problems. */
export function sortBySeverity(checks: Check[]): Check[] {
  return [...checks].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    return IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact];
  });
}

export function buildReport(args: {
  url: string;
  finalUrl: string;
  checks: Check[];
  score: number;
  fetchedAt?: string;
  domain?: AuditDomainIntel;
}): AuditReport {
  const { url, finalUrl, checks, score } = args;
  const counts = countByStatus(checks);
  const ranked = sortBySeverity(checks);
  const issues = ranked.filter((c) => c.status !== "pass");
  const passed = ranked.filter((c) => c.status === "pass");
  const preview = issues.slice(0, FREE_ISSUE_LIMIT);
  const withheld = issues.slice(FREE_ISSUE_LIMIT);

  return {
    url,
    finalUrl,
    fetchedAt: args.fetchedAt || new Date().toISOString(),
    score,
    band: scoreBand(score),
    counts,
    issuesFound: issues.length,
    previewIssues: preview,
    passedChecks: passed,
    lockedIssueCount: withheld.length,
    lockedIssueLabels: withheld.map((c) => c.label),
    lockedModules: LOCKED_MODULES,
    domain: args.domain || emptyDomainIntel(),
  };
}

/** Headline sentence for the result screen. Never celebratory when it is bad. */
export function verdictLine(report: AuditReport): string {
  if (report.issuesFound === 0) {
    return "We found no on-page problems on this page — a genuinely strong result.";
  }
  const high = [...report.previewIssues, ...report.lockedIssueLabels].length;
  void high;
  const noun = report.issuesFound === 1 ? "issue" : "issues";
  return `We found ${report.issuesFound} on-page ${noun} on this page that are costing you search visibility.`;
}
