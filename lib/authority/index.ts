// Feature 01 — Authority / backlink research capability.
// Intelligence + prioritization only. No automated outreach or link spam.

import { callClaude, extractJSON } from "../anthropic";
import { brandBlock, isLocalBusiness, type Brand } from "../brands";
import { backlinksSummary, isConfigured, referringDomainsList } from "../dataforseo";
import { findCitations } from "../local-agents";
import { domainOf } from "../metrics";
import { db } from "../supabase";
import {
  emptySpecialistResult,
  type AgentFinding,
  type ProposedAction,
  type SpecialistResult,
} from "../agents/contracts";
import { contextPromptBlock, type SharedAgentContext } from "../agents/context";
import { persistSpecialistResult, recordActivity } from "../agents/store";

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function runAuthorityResearch(
  brand: Brand,
  ctx: SharedAgentContext,
  opts: { runId?: string | null; taskId?: string | null } = {}
): Promise<SpecialistResult> {
  const errors: string[] = [];
  const findings: AgentFinding[] = [];
  const proposed: ProposedAction[] = [];

  const ourDomain = domainOf(brand);
  let ours: { backlinks: number | null; referring_domains: number | null } | null = null;
  const competitorAuthority: {
    domain: string;
    backlinks: number | null;
    referring_domains: number | null;
  }[] = [];

  if (isConfigured()) {
    ours = await safe(() => backlinksSummary(ourDomain));
    for (const c of ctx.competitors.slice(0, 3)) {
      const summary = await safe(() => backlinksSummary(c.domain));
      if (summary) competitorAuthority.push({ domain: c.domain, ...summary });
    }
  } else {
    errors.push("DataForSEO not configured — authority metrics unavailable.");
  }

  const ourReferring = isConfigured()
    ? (await safe(() => referringDomainsList(ourDomain))) || []
    : [];

  let citations: {
    name: string;
    url: string;
    category: string;
    priority: string | number;
    rationale: string;
  }[] = [];
  if (isLocalBusiness(brand)) {
    const { count } = await db
      .from("citations")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", brand.id);
    if (!count) {
      citations = (await safe(() => findCitations(brand))) || [];
      if (citations.length) {
        await db.from("citations").insert(
          citations.map((c) => ({
            brand_id: brand.id,
            name: c.name,
            url: c.url,
            category: c.category,
            priority: c.priority,
            rationale: c.rationale,
          }))
        );
      }
    } else {
      const { data } = await db
        .from("citations")
        .select("name, url, category, priority, rationale")
        .eq("brand_id", brand.id)
        .limit(20);
      citations = (data || []) as typeof citations;
    }
  }

  const gaps = competitorAuthority
    .filter((c) => (c.referring_domains ?? 0) > (ours?.referring_domains ?? 0))
    .map((c) => ({
      domain: c.domain,
      their_rd: c.referring_domains,
      our_rd: ours?.referring_domains ?? 0,
      delta: (c.referring_domains ?? 0) - (ours?.referring_domains ?? 0),
    }));

  findings.push({
    capability: "authority",
    finding_type: "backlink_gap",
    title: "Authority & backlink gap overview",
    summary: ours
      ? `Our RD≈${ours.referring_domains ?? "?"} vs competitors analyzed=${competitorAuthority.length}`
      : "Authority metrics unavailable",
    evidence: {
      ours,
      competitorAuthority,
      gaps,
      referring_sample: ourReferring.slice(0, 25),
      citations: citations.slice(0, 15),
      source: isConfigured() ? "dataforseo" : "none",
    },
    recommendations: [
      ...gaps.slice(0, 3).map((g) => `Close referring-domain gap vs ${g.domain} (Δ ${g.delta})`),
      ...citations.slice(0, 5).map((c) => `Citation opportunity: ${c.name}`),
    ],
    proposed_actions: [],
    confidence: ours ? 0.7 : 0.25,
    risk_level: "low",
  });

  const synth = await safe(() =>
    callClaude({
      maxTokens: 800,
      label: "authority_research",
      user: `${brandBlock(brand)}

CONTEXT:
${contextPromptBlock(ctx, "authority")}

EVIDENCE (do not invent backlink counts beyond this):
${JSON.stringify(findings[0].evidence, null, 2)}

Produce safe authority recommendations only: directories, digital PR angles, linkable content ideas, brand-mention opportunities.
Do NOT suggest spam, PBNs, paid link schemes, or automated outreach blasts.

Return ONLY JSON:
{"directories":["..."],"linkable_content":["..."],"digital_pr":["..."],"brand_mentions":["..."],"priority_actions":[{"title":"...","why":"...","risk":"low|medium"}]}`,
    })
  );

  const parsed = synth
    ? extractJSON<{
        directories?: string[];
        linkable_content?: string[];
        digital_pr?: string[];
        brand_mentions?: string[];
        priority_actions?: { title: string; why: string; risk: string }[];
      }>(synth)
    : null;

  if (parsed) {
    const actions: ProposedAction[] = (parsed.priority_actions || []).slice(0, 5).map((p) => ({
      type: "manual",
      rationale: `${p.title}: ${p.why}`,
      risk_level: p.risk === "medium" ? "medium" : "low",
      confidence: 0.55,
      reversible: true,
      requires_adapter: false,
    }));
    findings.push({
      capability: "authority",
      finding_type: "authority_plan",
      title: "Prioritized safe authority actions",
      summary: (parsed.priority_actions || []).slice(0, 3).map((p) => p.title).join("; "),
      evidence: parsed,
      recommendations: [
        ...(parsed.linkable_content || []).slice(0, 4),
        ...(parsed.digital_pr || []).slice(0, 3),
        ...(parsed.directories || []).slice(0, 4),
      ],
      proposed_actions: actions,
      confidence: 0.55,
      risk_level: "low",
    });
    proposed.push(...actions);
  }

  const result: SpecialistResult = {
    ...emptySpecialistResult({
      capability: "authority",
      brand_id: brand.id,
      run_id: opts.runId ?? null,
      task_id: opts.taskId ?? null,
      objective: "Authority and backlink gap research",
    }),
    findings,
    proposed_actions: proposed,
    recommendations: findings.flatMap((f) => f.recommendations).slice(0, 12),
    evidence: findings[0]?.evidence || {},
    confidence: ours ? 0.65 : 0.3,
    risk_level: "low",
    status: findings.length ? (ours ? "ok" : "degraded") : "degraded",
    errors,
  };

  await persistSpecialistResult(result);
  await recordActivity({
    brandId: brand.id,
    runId: opts.runId,
    taskId: opts.taskId,
    capability: "authority",
    eventType: "research_authority",
    title: "Authority research completed",
    detail: errors[0] || `${gaps.length} competitor RD gaps; ${citations.length} citations`,
    status: result.status === "ok" ? "success" : "warning",
  });
  return result;
}
