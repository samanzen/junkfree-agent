// AI Action Engine — turns data the platform ALREADY holds into a ranked list
// of concrete next actions.
//
// Hard rule: every number surfaced here is read from an existing API response.
// Nothing is estimated, projected or invented. Where a figure isn't available
// (difficulty for a long-tail keyword, revenue for an unenriched keyword) the
// field is simply omitted rather than filled with a guess.
//
// `effort` is the one non-data field: it is a fixed, typical time-to-complete
// for that KIND of task, identical for every customer, and is labelled in the
// UI as "typical effort" — never presented as a measurement of their business.

export type Priority = "critical" | "high" | "medium" | "low";
export type Difficulty = "easy" | "moderate" | "hard" | "unknown";

/** Action types accepted by the existing /api/intelligence/action endpoint. */
export type EngineAction =
  | "improve_content" | "fix_meta" | "rewrite_page"
  | "generate_faq" | "build_backlinks" | "boost_page1";

export type OpportunityAction = {
  label: string;
  /** Runs via the existing action endpoint. */
  action?: EngineAction;
  payload?: Record<string, unknown>;
  /** Navigates to an existing page instead of running a job. */
  href?: string;
  /** No API exists for this yet — rendered disabled. */
  comingSoon?: boolean;
  primary?: boolean;
};

export type Opportunity = {
  id: string;
  kind: string;
  category: "rankings" | "content" | "reputation" | "local" | "setup";
  title: string;
  subject?: string;
  priority: Priority;
  difficulty: Difficulty;
  effort: string;
  why: string;
  /** Real, source-attributed figures. Empty when we hold none. */
  impact: string[];
  steps: string[];
  actions: OpportunityAction[];
  score: number;
};

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  critical: 400, high: 300, medium: 200, low: 100,
};

function difficultyFrom(kd: number | null | undefined): Difficulty {
  if (kd == null) return "unknown";
  if (kd < 30) return "easy";
  if (kd < 60) return "moderate";
  return "hard";
}

const n = (v: number) => v.toLocaleString();

// ── Input shapes (subsets of what the existing endpoints already return) ────
export type KeywordRow = {
  id: string; keyword: string; status?: string | null;
  search_volume?: number | null; keyword_difficulty?: number | null;
  ai_opportunity_score?: number | null; ai_opportunity_reason?: string | null;
  estimated_monthly_clicks?: number | null; estimated_revenue_impact?: string | null;
  best_position?: number | null; position?: number | null;
};
export type MoveRow = {
  keyword: string; current_position?: number; previous_position?: number;
  change?: number; last_position?: number; position?: number;
  search_volume?: number | null; landing_page?: string | null;
};
export type LowCtrRow = { page: string; impressions: number; ctr: number };
export type StrikingRow = { keyword: string; page: string; impressions: number; position: number; ctr: number };
export type CountsInput = {
  pendingDrafts: number;
  pendingReviews: number;
  openCitations: number;
  gscConnected: boolean;
  gbpConnected: boolean;
};

// ── Builders ────────────────────────────────────────────────────────────────

/** Keywords sitting just off page 1 — the highest-leverage ranking work. */
function fromStrikingDistance(rows: StrikingRow[], meta: Map<string, KeywordRow>): Opportunity[] {
  return rows
    .filter((r) => r.position >= 5 && r.position <= 20)
    .map((r) => {
      const kw = meta.get(r.keyword.toLowerCase());
      const impact: string[] = [`${n(r.impressions)} impressions in the last 28 days`];
      if (kw?.search_volume != null) impact.push(`${n(kw.search_volume)} searches/month`);
      if (kw?.estimated_monthly_clicks != null) impact.push(`~${n(kw.estimated_monthly_clicks)} clicks/month at #1`);
      if (kw?.estimated_revenue_impact) impact.push(kw.estimated_revenue_impact);

      const nearlyThere = r.position <= 12;
      const priority: Priority =
        r.impressions >= 500 ? "critical" : nearlyThere || r.impressions >= 100 ? "high" : "medium";

      return {
        id: `striking:${r.keyword}`,
        kind: "Striking distance",
        category: "rankings" as const,
        title: `Push "${r.keyword}" onto page 1`,
        subject: r.keyword,
        priority,
        difficulty: difficultyFrom(kw?.keyword_difficulty),
        effort: "1–2 hours",
        why: `You already rank #${r.position} for this. Moving from just off page 1 into the top 10 is where click-through rises most sharply, because almost nobody scrolls to page 2.`,
        impact,
        steps: [
          "Rewrite the page title to lead with this keyword",
          "Strengthen the H1 and opening paragraph",
          "Add an FAQ section answering related questions",
          "Add internal links from your other pages",
          "Expand thin sections with specific local detail",
        ],
        actions: [
          { label: "Run page 1 push", action: "boost_page1", payload: { target_keyword: r.keyword, target_url: r.page }, primary: true },
          { label: "Improve content", action: "improve_content", payload: { target_keyword: r.keyword, target_url: r.page } },
          { label: "Generate FAQ", action: "generate_faq", payload: { target_keyword: r.keyword } },
        ],
        score: PRIORITY_WEIGHT[priority] + Math.min(99, r.impressions / 10),
      };
    });
}

/** Pages Google shows a lot but nobody clicks — usually a weak title/meta. */
function fromLowCtr(rows: LowCtrRow[]): Opportunity[] {
  return rows.map((r) => {
    const priority: Priority = r.impressions >= 500 ? "high" : "medium";
    const path = r.page.replace(/^https?:\/\/[^/]+/, "") || "/";
    return {
      id: `lowctr:${r.page}`,
      kind: "Low click-through",
      category: "content" as const,
      title: `Rewrite the search listing for ${path}`,
      subject: path,
      priority,
      difficulty: "easy" as Difficulty,
      effort: "15–30 min",
      why: `This page was shown ${n(r.impressions)} times but only ${(r.ctr * 100).toFixed(1)}% of people clicked. The ranking is already there — the title and description just aren't compelling enough to earn the click.`,
      impact: [
        `${n(r.impressions)} impressions in the last 28 days`,
        `Currently ${(r.ctr * 100).toFixed(1)}% click-through`,
      ],
      steps: [
        "Rewrite the title tag to lead with the benefit",
        "Write a description that answers the searcher's question",
        "Include the location where it reads naturally",
      ],
      actions: [
        { label: "Rewrite title & meta", action: "fix_meta", payload: { target_url: r.page }, primary: true },
      ],
      score: PRIORITY_WEIGHT[priority] + Math.min(99, r.impressions / 10),
    };
  });
}

/** Keywords that slipped over the last 7 days. */
function fromDeclining(rows: MoveRow[], meta: Map<string, KeywordRow>): Opportunity[] {
  return rows.map((r) => {
    const drop = r.change ?? 0;
    const kw = meta.get(r.keyword.toLowerCase());
    const priority: Priority = drop >= 5 ? "high" : "medium";
    const impact: string[] = [`Fell ${drop} place${drop === 1 ? "" : "s"} in 7 days (#${r.previous_position} → #${r.current_position})`];
    if (kw?.search_volume != null) impact.push(`${n(kw.search_volume)} searches/month`);

    return {
      id: `declining:${r.keyword}`,
      kind: "Losing ground",
      category: "rankings" as const,
      title: `Recover "${r.keyword}"`,
      subject: r.keyword,
      priority,
      difficulty: difficultyFrom(kw?.keyword_difficulty),
      effort: "1–2 hours",
      why: `This keyword dropped ${drop} place${drop === 1 ? "" : "s"} in the last week. Acting while the decline is recent is far easier than trying to win the position back months later.`,
      impact,
      steps: [
        "Refresh the page's content and dates",
        "Check whether a competitor published something stronger",
        "Add depth the current page is missing",
      ],
      actions: [
        { label: "Improve content", action: "improve_content", payload: { target_keyword: r.keyword, target_url: r.landing_page || undefined }, primary: true },
        { label: "Rewrite the page", action: "rewrite_page", payload: { target_keyword: r.keyword, target_url: r.landing_page || undefined } },
      ],
      score: PRIORITY_WEIGHT[priority] + Math.min(99, drop * 6),
    };
  });
}

/** Keywords that dropped out of the top 100 entirely. */
function fromLost(rows: MoveRow[], meta: Map<string, KeywordRow>): Opportunity[] {
  return rows.map((r) => {
    const kw = meta.get(r.keyword.toLowerCase());
    const impact: string[] = [`Last seen at position ${r.last_position}`];
    if (kw?.search_volume != null) impact.push(`${n(kw.search_volume)} searches/month`);
    return {
      id: `lost:${r.keyword}`,
      kind: "Lost ranking",
      category: "rankings" as const,
      title: `Win back "${r.keyword}"`,
      subject: r.keyword,
      priority: "medium" as Priority,
      difficulty: difficultyFrom(kw?.keyword_difficulty),
      effort: "2–3 hours",
      why: "You used to rank for this and no longer appear in the top 100. That usually means the page was outclassed rather than penalised — a substantially stronger page can recover it.",
      impact,
      steps: [
        "Rebuild the page around current search intent",
        "Cover the sub-topics competitors now answer",
        "Add internal links to rebuild authority",
      ],
      actions: [
        { label: "Rewrite the page", action: "rewrite_page", payload: { target_keyword: r.keyword }, primary: true },
        { label: "Improve content", action: "improve_content", payload: { target_keyword: r.keyword } },
      ],
      score: PRIORITY_WEIGHT.medium + (kw?.search_volume ? Math.min(99, kw.search_volume / 20) : 0),
    };
  });
}

/** Work already done by the agents that is blocked on a human decision. */
function fromCounts(c: CountsInput): Opportunity[] {
  const out: Opportunity[] = [];

  if (!c.gscConnected) {
    out.push({
      id: "setup:gsc", kind: "Setup", category: "setup",
      title: "Connect Google Search Console",
      priority: "critical", difficulty: "easy", effort: "10 min",
      why: "Search Console is where your ranking, click and impression data comes from. Without it connected, most of this platform has nothing to analyse.",
      impact: [], steps: ["Link your Search Console property", "Grant read access to the platform"],
      actions: [{ label: "View connections", href: "/portal/settings", primary: true }],
      score: PRIORITY_WEIGHT.critical + 99,
    });
  }

  if (!c.gbpConnected) {
    out.push({
      id: "setup:gbp", kind: "Setup", category: "local",
      title: "Connect your Google Business Profile",
      priority: "high", difficulty: "easy", effort: "10 min",
      why: "Your Business Profile drives the local map pack — the three results Google shows above everything else. It's the single biggest lever for a local business, and it isn't connected yet.",
      impact: [], steps: ["Link your Business Profile location", "Confirm categories and service area"],
      actions: [{ label: "View connections", href: "/portal/settings", primary: true }],
      score: PRIORITY_WEIGHT.high + 90,
    });
  }

  if (c.pendingDrafts > 0) {
    out.push({
      id: "content:pending", kind: "Awaiting you", category: "content",
      title: `Approve ${c.pendingDrafts} piece${c.pendingDrafts === 1 ? "" : "s"} of content`,
      priority: "high", difficulty: "easy", effort: "5 min each",
      why: "Your agents have already written this content. It does nothing for your rankings until you approve it and it goes live.",
      impact: [`${c.pendingDrafts} draft${c.pendingDrafts === 1 ? "" : "s"} ready to publish`],
      steps: ["Read each draft", "Approve or send back for a revision"],
      actions: [{ label: "Review content", href: "/portal/content", primary: true }],
      score: PRIORITY_WEIGHT.high + 80,
    });
  }

  if (c.pendingReviews > 0) {
    out.push({
      id: "reviews:pending", kind: "Awaiting you", category: "reputation",
      title: `Publish ${c.pendingReviews} review repl${c.pendingReviews === 1 ? "y" : "ies"}`,
      priority: "high", difficulty: "easy", effort: "2 min each",
      why: "Responding to every review is a genuine local ranking signal, and the replies are already drafted for you. This is among the fastest wins available.",
      impact: [`${c.pendingReviews} repl${c.pendingReviews === 1 ? "y" : "ies"} drafted and waiting`],
      steps: ["Read the review and the drafted reply", "Approve it or adjust the tone"],
      actions: [{ label: "Review replies", href: "/portal/reviews", primary: true }],
      score: PRIORITY_WEIGHT.high + 70,
    });
  }

  if (c.openCitations > 0) {
    out.push({
      id: "local:citations", kind: "Local listings", category: "local",
      title: `Complete ${c.openCitations} directory listing${c.openCitations === 1 ? "" : "s"}`,
      priority: "medium", difficulty: "easy", effort: "10 min each",
      why: "Consistent listings across the directories Google trusts are one of the strongest local ranking signals, and one of the few things competitors can't take from you.",
      impact: [`${c.openCitations} listing${c.openCitations === 1 ? "" : "s"} outstanding`],
      steps: ["Open each directory", "Submit or correct your details", "Keep name, address and phone identical everywhere"],
      actions: [
        { label: "View listings", href: "/portal/local-seo", primary: true },
        { label: "Auto-submit listings", comingSoon: true },
      ],
      score: PRIORITY_WEIGHT.medium + 40,
    });
  }

  return out;
}

// ── Assembly ────────────────────────────────────────────────────────────────
export function buildOpportunities(input: {
  striking: StrikingRow[];
  lowCtr: LowCtrRow[];
  declining: MoveRow[];
  lost: MoveRow[];
  keywords: KeywordRow[];
  counts: CountsInput;
}): Opportunity[] {
  const meta = new Map<string, KeywordRow>();
  for (const k of input.keywords) meta.set(k.keyword.toLowerCase(), k);

  const all = [
    ...fromCounts(input.counts),
    ...fromStrikingDistance(input.striking, meta),
    ...fromLowCtr(input.lowCtr),
    ...fromDeclining(input.declining, meta),
    ...fromLost(input.lost, meta),
  ];

  // Stable de-dupe (a keyword can surface from more than one signal; the
  // higher-scoring framing wins).
  const best = new Map<string, Opportunity>();
  for (const o of all) {
    const key = o.subject ? `${o.category}:${o.subject.toLowerCase()}` : o.id;
    const existing = best.get(key);
    if (!existing || o.score > existing.score) best.set(key, o);
  }

  return [...best.values()].sort((a, b) => b.score - a.score);
}
