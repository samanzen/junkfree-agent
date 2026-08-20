// Feature 01 — Competitor / Keyword-Intent / SERP research capabilities.
// Extends lib/intelligence.ts rather than replacing it. Persists findings for
// later runs. Never fabricates DataForSEO/SERP data when integrations fail.

import { callClaude, extractJSON } from "../anthropic";
import { brandBlock, type Brand } from "../brands";
import {
  discoverCompetitors,
  geoOf,
  isConfigured,
  serpTop,
  keywordIdeas,
  classifySearchIntent,
  keywordVolumes,
} from "../dataforseo";
import { domainOf } from "../metrics";
import { competitorGaps, keywordStrategy, serpBlueprint } from "../intelligence";
import { db } from "../supabase";
import {
  clampConfidence,
  emptySpecialistResult,
  normalizeRisk,
  type AgentFinding,
  type ProposedAction,
  type SpecialistResult,
} from "./contracts";
import { contextPromptBlock, type SharedAgentContext } from "./context";
import { persistSpecialistResult, recordActivity } from "./store";

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function normalizeDomain(d: string): string {
  return d.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "").toLowerCase();
}

/** Discover + analyze competitors; upsert into competitors table; persist findings. */
export async function runCompetitorResearch(
  brand: Brand,
  ctx: SharedAgentContext,
  opts: { runId?: string | null; taskId?: string | null } = {}
): Promise<SpecialistResult> {
  const errors: string[] = [];
  const findings: AgentFinding[] = [];
  const proposed: ProposedAction[] = [];

  const domain = domainOf(brand);
  let discovered: { domain: string; keywordOverlap: number | null }[] = [];
  if (isConfigured()) {
    discovered = (await safe(() => discoverCompetitors(domain, geoOf(brand)))) || [];
  } else {
    errors.push("DataForSEO not configured — skipped live competitor discovery.");
  }

  if (discovered.length) {
    const { data: existing } = await db
      .from("competitors")
      .select("domain")
      .eq("brand_id", brand.id);
    const known = new Set((existing || []).map((c) => normalizeDomain(c.domain)));
    const rows = discovered
      .map((f) => ({
        brand_id: brand.id,
        domain: normalizeDomain(f.domain),
        name: f.domain,
        active: true,
      }))
      .filter((r) => r.domain && !known.has(r.domain))
      .slice(0, 10);
    if (rows.length) {
      await db.from("competitors").upsert(rows, { onConflict: "brand_id,domain" });
    }
    findings.push({
      capability: "competitor_research",
      finding_type: "organic_competitors",
      title: `Discovered ${discovered.length} organic competitors`,
      summary: discovered
        .slice(0, 8)
        .map((d) => `${d.domain}${d.keywordOverlap != null ? ` (overlap ${d.keywordOverlap})` : ""}`)
        .join(", "),
      evidence: { discovered, source: isConfigured() ? "dataforseo" : "none" },
      recommendations: ["Review discovered competitors and keep high-overlap domains active."],
      proposed_actions: [],
      confidence: discovered.length ? 0.75 : 0.2,
      risk_level: "low",
    });
  }

  // Reuse existing gap analysis (brands.competitors CSV + DataForSEO ranked keywords).
  const gaps = (await safe(() => competitorGaps(brand))) || { competitors: [], gaps: [] };
  for (const g of (gaps.gaps || []).slice(0, 8)) {
    const action: ProposedAction = {
      type: g.page_type === "new_blog" ? "new_blog" : g.page_type === "improve_existing" ? "improve_content" : "new_page",
      target_keyword: g.keyword,
      rationale: g.why || `Competitor gap for ${g.keyword}`,
      risk_level: "medium",
      confidence: 0.65,
      reversible: false,
      requires_adapter: true,
    };
    proposed.push(action);
  }
  if ((gaps.gaps || []).length) {
    findings.push({
      capability: "competitor_research",
      finding_type: "keyword_gaps",
      title: `${gaps.gaps.length} competitor keyword gaps`,
      summary: gaps.gaps
        .slice(0, 5)
        .map((g) => g.keyword)
        .join(", "),
      evidence: { gaps: gaps.gaps, competitors: gaps.competitors },
      recommendations: gaps.gaps.slice(0, 5).map((g) => g.why || `Cover ${g.keyword}`),
      proposed_actions: proposed.slice(0, 5),
      confidence: 0.7,
      risk_level: "medium",
    });
  }

  // Structured synthesis when we have something to reason over.
  if (findings.length) {
    const synth = await safe(() =>
      callClaude({
        maxTokens: 900,
        label: "competitor_research",
        user: `${brandBlock(brand)}

CONTEXT:
${contextPromptBlock(ctx, "competitor_research")}

FINDINGS SO FAR:
${JSON.stringify(findings, null, 2)}

Summarise strengths/weaknesses/opportunities. Do NOT invent SERP or backlink numbers.
Return ONLY JSON:
{"strengths":["..."],"weaknesses":["..."],"opportunities":["..."],"content_gaps":["..."],"geo_patterns":["..."]}`,
      })
    );
    const parsed = synth
      ? extractJSON<{
          strengths?: string[];
          weaknesses?: string[];
          opportunities?: string[];
          content_gaps?: string[];
          geo_patterns?: string[];
        }>(synth)
      : null;
    if (parsed) {
      findings.push({
        capability: "competitor_research",
        finding_type: "competitive_synthesis",
        title: "Competitive strengths, weaknesses, opportunities",
        summary: (parsed.opportunities || []).slice(0, 3).join("; ") || "See evidence.",
        evidence: parsed,
        recommendations: [
          ...(parsed.opportunities || []).slice(0, 5),
          ...(parsed.content_gaps || []).slice(0, 3),
        ],
        proposed_actions: [],
        confidence: 0.6,
        risk_level: "low",
      });
    }
  }

  const result: SpecialistResult = {
    ...emptySpecialistResult({
      capability: "competitor_research",
      brand_id: brand.id,
      run_id: opts.runId ?? null,
      task_id: opts.taskId ?? null,
      objective: "Discover and analyze search competitors",
    }),
    findings,
    proposed_actions: proposed,
    recommendations: findings.flatMap((f) => f.recommendations).slice(0, 10),
    evidence: { discovered_count: discovered.length, gap_count: gaps.gaps?.length || 0 },
    confidence: findings.length ? 0.7 : 0.2,
    risk_level: "low",
    status: errors.length && !findings.length ? "degraded" : findings.length ? "ok" : "degraded",
    errors,
  };

  await persistSpecialistResult(result);
  await recordActivity({
    brandId: brand.id,
    runId: opts.runId,
    taskId: opts.taskId,
    capability: "competitor_research",
    eventType: "research_competitors",
    title: findings.length
      ? `Competitor research: ${discovered.length} discovered, ${gaps.gaps?.length || 0} gaps`
      : "Competitor research completed with limited data",
    detail: errors[0] || null,
    status: result.status === "ok" ? "success" : "warning",
  });
  return result;
}

/** Keyword discovery, clustering, intent, cannibalization / missing-page signals. */
export async function runKeywordIntentStrategy(
  brand: Brand,
  ctx: SharedAgentContext,
  opts: { runId?: string | null; taskId?: string | null } = {}
): Promise<SpecialistResult> {
  const errors: string[] = [];
  const strategy = (await safe(() => keywordStrategy(brand))) || null;
  if (!strategy) errors.push("keywordStrategy returned no data");

  // Intent classification for a sample of tracked keywords when DataForSEO is up.
  let intents: { keyword: string; intent: string | null }[] = [];
  if (isConfigured() && ctx.tracked_keywords.length) {
    intents =
      (await safe(() =>
        classifySearchIntent(
          ctx.tracked_keywords.slice(0, 40).map((k) => k.keyword),
          geoOf(brand)
        )
      )) || [];
  }

  // Expansion ideas
  let ideas: { keyword: string; volume: number | null }[] = [];
  if (isConfigured()) {
    const seed = (brand.services || "").split(",")[0]?.trim() || brand.name;
    ideas = ((await safe(() => keywordIdeas(seed, geoOf(brand)))) || [])
      .filter((k) => (k.volume ?? 0) > 0)
      .slice(0, 25)
      .map((k) => ({ keyword: k.keyword, volume: k.volume }));
  }

  // Cannibalization: same normalized keyword appearing on multiple open drafts/pages.
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const pageKeys = new Map<string, string[]>();
  for (const p of ctx.existing_pages) {
    const key = norm(p.title);
    if (!key) continue;
    pageKeys.set(key, [...(pageKeys.get(key) || []), p.slug]);
  }
  const cannibalization = [...pageKeys.entries()]
    .filter(([, urls]) => urls.length > 1)
    .slice(0, 10)
    .map(([topic, urls]) => ({ topic, urls }));

  const missingPages = (strategy?.targets || [])
    .filter((t) => t.page_type === "new_page" || t.page_type === "new_blog")
    .filter((t) => !ctx.existing_pages.some((p) => norm(p.title).includes(norm(t.keyword))))
    .slice(0, 8);

  const clusters = (strategy?.pillars || []).map((pillar) => ({
    pillar,
    keywords: (strategy?.targets || [])
      .filter((t) => norm(t.keyword).includes(norm(pillar).split(" ")[0] || "") || t.why.toLowerCase().includes(norm(pillar).slice(0, 12)))
      .map((t) => t.keyword)
      .slice(0, 8),
  }));

  const proposed: ProposedAction[] = missingPages.map((t) => ({
    type: t.page_type === "new_blog" ? "new_blog" : "new_page",
    target_keyword: t.keyword,
    rationale: t.why,
    risk_level: normalizeRisk("medium"),
    confidence: 0.65,
    reversible: false,
    requires_adapter: true,
  }));

  const findings: AgentFinding[] = [
    {
      capability: "keyword_intent",
      finding_type: "keyword_strategy",
      title: "Keyword strategy & topical pillars",
      summary: (strategy?.pillars || []).join(", ") || "No pillars produced",
      evidence: {
        strategy,
        intents: intents.slice(0, 40),
        ideas: ideas.slice(0, 25),
        clusters,
        cannibalization,
        missing_pages: missingPages,
      },
      recommendations: [
        ...missingPages.slice(0, 5).map((m) => `Missing page opportunity: ${m.keyword}`),
        ...cannibalization.slice(0, 3).map((c) => `Possible cannibalization on "${c.topic}"`),
      ],
      proposed_actions: proposed.slice(0, 5),
      confidence: strategy ? 0.75 : 0.3,
      risk_level: cannibalization.length ? "medium" : "low",
    },
  ];

  // Persist intent onto tracked_keywords when we have labels (best-effort).
  if (intents.length) {
    for (const row of intents.filter((i) => i.intent).slice(0, 40)) {
      await db
        .from("tracked_keywords")
        .update({ search_intent: row.intent })
        .eq("brand_id", brand.id)
        .eq("keyword", row.keyword);
    }
  }

  // Optional volume refresh for idea seeds (bounded).
  if (isConfigured() && ideas.length) {
    await safe(() => keywordVolumes(ideas.slice(0, 20).map((i) => i.keyword), geoOf(brand)));
  }

  const result: SpecialistResult = {
    ...emptySpecialistResult({
      capability: "keyword_intent",
      brand_id: brand.id,
      run_id: opts.runId ?? null,
      task_id: opts.taskId ?? null,
      objective: "Build keyword/intent strategy and detect gaps",
    }),
    findings,
    proposed_actions: proposed,
    recommendations: findings[0].recommendations,
    evidence: findings[0].evidence,
    confidence: clampConfidence(findings[0].confidence),
    risk_level: findings[0].risk_level,
    status: strategy ? "ok" : "degraded",
    errors,
  };

  await persistSpecialistResult(result);
  await recordActivity({
    brandId: brand.id,
    runId: opts.runId,
    taskId: opts.taskId,
    capability: "keyword_intent",
    eventType: "research_keywords",
    title: `Keyword strategy: ${(strategy?.targets || []).length} targets, ${missingPages.length} missing pages`,
    status: result.status === "ok" ? "success" : "warning",
  });
  return result;
}

/** Structured SERP research for a small set of target queries. */
export async function runSerpResearch(
  brand: Brand,
  ctx: SharedAgentContext,
  opts: {
    runId?: string | null;
    taskId?: string | null;
    keywords?: string[];
  } = {}
): Promise<SpecialistResult> {
  const keywords =
    (opts.keywords && opts.keywords.length
      ? opts.keywords
      : ctx.tracked_keywords.slice(0, 3).map((k) => k.keyword)
    ).slice(0, 3);

  const errors: string[] = [];
  const findings: AgentFinding[] = [];
  const proposed: ProposedAction[] = [];

  if (!keywords.length) {
    const result = emptySpecialistResult({
      capability: "serp_research",
      brand_id: brand.id,
      run_id: opts.runId ?? null,
      task_id: opts.taskId ?? null,
      objective: "SERP research",
      status: "skipped",
      errors: ["No keywords available for SERP research"],
    });
    await recordActivity({
      brandId: brand.id,
      runId: opts.runId,
      capability: "serp_research",
      eventType: "research_serp",
      title: "SERP research skipped — no keywords",
      status: "info",
    });
    return result;
  }

  for (const keyword of keywords) {
    let serp: { position: number; title: string; url: string; description: string }[] = [];
    if (isConfigured()) {
      serp = (await safe(() => serpTop(keyword, geoOf(brand)))) || [];
    }
    // Reuse existing blueprint helper (may use Claude web search if no SERP API).
    const blueprint = await safe(() => serpBlueprint(brand, keyword));
    if (!serp.length && !blueprint) {
      errors.push(`No SERP data for "${keyword}"`);
      continue;
    }
    findings.push({
      capability: "serp_research",
      finding_type: "serp_blueprint",
      title: `SERP requirements for "${keyword}"`,
      summary: blueprint?.dominant_angle || `Top results analyzed: ${serp.length}`,
      evidence: {
        keyword,
        serp: serp.slice(0, 10),
        blueprint,
        source: serp.length ? "dataforseo" : blueprint ? "model_assisted" : "none",
      },
      recommendations: [
        ...(blueprint?.must_cover || []).slice(0, 5),
        ...(blueprint?.gaps_to_exploit || []).slice(0, 3),
      ],
      proposed_actions: [
        {
          type: "new_page",
          target_keyword: keyword,
          rationale: blueprint?.dominant_angle || `Compete for ${keyword}`,
          risk_level: "medium",
          confidence: serp.length ? 0.75 : 0.45,
          reversible: false,
          requires_adapter: true,
        },
      ],
      confidence: serp.length ? 0.8 : blueprint ? 0.5 : 0.2,
      risk_level: "low",
    });
    proposed.push(...findings[findings.length - 1].proposed_actions);
  }

  const result: SpecialistResult = {
    ...emptySpecialistResult({
      capability: "serp_research",
      brand_id: brand.id,
      run_id: opts.runId ?? null,
      task_id: opts.taskId ?? null,
      objective: `SERP research for ${keywords.join(", ")}`,
    }),
    findings,
    proposed_actions: proposed.slice(0, 5),
    recommendations: findings.flatMap((f) => f.recommendations).slice(0, 12),
    evidence: { keywords },
    confidence: findings.length ? 0.7 : 0.2,
    risk_level: "low",
    status: findings.length ? "ok" : "degraded",
    errors,
    // Mark ranked competitors from SERP when present.
    artifacts: findings.map((f) => ({
      kind: "serp_finding",
      label: f.title,
    })),
  };

  // Also capture ranking competitor domains into evidence-only (no auto-insert
  // beyond discover path — avoids polluting competitors with one-off SERP noise).
  await persistSpecialistResult(result);
  await recordActivity({
    brandId: brand.id,
    runId: opts.runId,
    taskId: opts.taskId,
    capability: "serp_research",
    eventType: "research_serp",
    title: `SERP research: ${findings.length}/${keywords.length} queries analyzed`,
    detail: errors[0] || null,
    status: result.status === "ok" ? "success" : "warning",
  });
  return result;
}
