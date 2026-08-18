// Feature 01 — structured shared agent context with per-specialist projection.
// Never dump the full blob into every LLM prompt.

import { db } from "../supabase";
import type { Brand } from "../brands";
import { describeConnections } from "../connections";
import { listActiveFindings } from "./store";
import { resolveExecutionMode } from "../policy";
import type { AgentCapability, ExecutionMode } from "./contracts";
import { FRESH_FINDING_HOURS } from "./contracts";

export type SharedAgentContext = {
  brand_id: string;
  business_name: string;
  business_model: string;
  vertical: string;
  products_services: string | null;
  locations: string | null;
  service_areas: string | null;
  brand_voice: string | null;
  site_url: string;
  execution_mode: ExecutionMode;
  autopilot_enabled: boolean;
  connected_integrations: string[];
  existing_pages: { slug: string; title: string }[];
  open_drafts: { id: string; title: string; task_type: string; target_keyword: string | null }[];
  tracked_keywords: { keyword: string; status: string | null; intent: string | null }[];
  competitors: { domain: string; name: string | null }[];
  recent_findings: {
    id?: string;
    capability: string;
    finding_type: string;
    title: string;
    summary: string | null;
    created_at: string;
    proposed_actions?: unknown;
  }[];
  lessons: string[];
  recent_audits: { url: string; word_count: number | null; title: string | null }[];
  current_run_id: string | null;
  current_objective: string | null;
};

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export async function buildSharedContext(
  brand: Brand & { execution_mode?: string | null; autopilot_enabled?: boolean | null },
  opts: { runId?: string | null; objective?: string | null } = {}
): Promise<SharedAgentContext> {
  const brandId = brand.id;
  const [
    content,
    drafts,
    keywords,
    competitors,
    findings,
    lessons,
    audits,
    connections,
  ] = await Promise.all([
    safe(async () => {
      const { data } = await db
        .from("content")
        .select("slug, title")
        .eq("brand_id", brandId)
        .limit(80);
      return (data || []) as { slug: string; title: string }[];
    }, []),
    safe(async () => {
      const { data } = await db
        .from("drafts")
        .select("id, title, task_type, target_keyword")
        .eq("brand_id", brandId)
        .in("status", ["pending_review", "approved"])
        .order("created_at", { ascending: false })
        .limit(40);
      return (data || []) as {
        id: string;
        title: string;
        task_type: string;
        target_keyword: string | null;
      }[];
    }, []),
    safe(async () => {
      const { data } = await db
        .from("tracked_keywords")
        .select("keyword, status, search_intent")
        .eq("brand_id", brandId)
        .order("added_at", { ascending: false })
        .limit(60);
      return ((data || []) as { keyword: string; status: string | null; search_intent: string | null }[]).map(
        (k) => ({ keyword: k.keyword, status: k.status, intent: k.search_intent })
      );
    }, []),
    safe(async () => {
      const { data } = await db
        .from("competitors")
        .select("domain, name")
        .eq("brand_id", brandId)
        .eq("active", true)
        .limit(20);
      return (data || []) as { domain: string; name: string | null }[];
    }, []),
    safe(() => listActiveFindings(brandId, undefined, 25), []),
    safe(async () => {
      const { data } = await db
        .from("lessons")
        .select("lesson")
        .eq("brand_id", brandId)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(10);
      return ((data || []) as { lesson: string }[]).map((l) => l.lesson);
    }, []),
    safe(async () => {
      const { data } = await db
        .from("page_audits")
        .select("url, word_count, title")
        .eq("brand_id", brandId)
        .order("audit_run_at", { ascending: false })
        .limit(20);
      return (data || []) as { url: string; word_count: number | null; title: string | null }[];
    }, []),
    safe(async () => {
      const states = await describeConnections(brand);
      return states.filter((s) => s.status === "connected").map((s) => s.key);
    }, [] as string[]),
  ]);

  const cutoff = Date.now() - FRESH_FINDING_HOURS * 3600_000;
  const recentFindings = findings
    .filter((f) => new Date(f.created_at).getTime() >= cutoff)
    .map((f) => ({
      id: f.id,
      capability: f.capability,
      finding_type: f.finding_type,
      title: f.title,
      summary: f.summary,
      created_at: f.created_at,
      // Keep proposed_actions so Manager can convert research into real work.
      proposed_actions: f.proposed_actions,
    }));

  return {
    brand_id: brandId,
    business_name: brand.name,
    business_model: brand.business_model,
    vertical: brand.business_model,
    products_services: brand.services,
    locations: brand.service_area,
    service_areas: brand.service_area,
    brand_voice: brand.voice,
    site_url: brand.site_url,
    execution_mode: resolveExecutionMode(brand),
    autopilot_enabled: brand.autopilot_enabled !== false,
    connected_integrations: connections,
    existing_pages: content,
    open_drafts: drafts,
    tracked_keywords: keywords,
    competitors,
    recent_findings: recentFindings,
    lessons,
    recent_audits: audits,
    current_run_id: opts.runId ?? null,
    current_objective: opts.objective ?? null,
  };
}

/** Compact projection for a specialist prompt — only relevant slices. */
export function projectContextFor(
  ctx: SharedAgentContext,
  capability: AgentCapability
): Record<string, unknown> {
  const base = {
    brand: ctx.business_name,
    business_model: ctx.business_model,
    services: ctx.products_services,
    service_area: ctx.service_areas,
    voice: ctx.brand_voice,
    site_url: ctx.site_url,
    execution_mode: ctx.execution_mode,
    objective: ctx.current_objective,
  };

  switch (capability) {
    case "seo_manager":
    case "planner":
      return {
        ...base,
        lessons: ctx.lessons.slice(0, 8),
        competitors: ctx.competitors.slice(0, 10),
        keywords: ctx.tracked_keywords.slice(0, 25),
        open_drafts: ctx.open_drafts.slice(0, 15),
        existing_pages: ctx.existing_pages.slice(0, 30),
        findings: ctx.recent_findings.slice(0, 15).map((f) => ({
          id: f.id,
          capability: f.capability,
          finding_type: f.finding_type,
          title: f.title,
          summary: f.summary,
          proposed_actions: f.proposed_actions,
        })),
        integrations: ctx.connected_integrations,
      };
    case "competitor_research":
      return {
        ...base,
        competitors: ctx.competitors,
        keywords: ctx.tracked_keywords.slice(0, 20),
        findings: ctx.recent_findings.filter((f) => f.capability === "competitor_research"),
      };
    case "keyword_intent":
      return {
        ...base,
        keywords: ctx.tracked_keywords,
        existing_pages: ctx.existing_pages.slice(0, 40),
        open_drafts: ctx.open_drafts,
        findings: ctx.recent_findings.filter((f) =>
          ["keyword_intent", "serp_research", "competitor_research"].includes(f.capability)
        ),
      };
    case "serp_research":
      return {
        ...base,
        competitors: ctx.competitors.slice(0, 8),
        keywords: ctx.tracked_keywords.slice(0, 15),
      };
    case "content":
    case "geo":
      return {
        ...base,
        existing_pages: ctx.existing_pages.slice(0, 25),
        open_drafts: ctx.open_drafts.slice(0, 10),
        findings: ctx.recent_findings.filter((f) =>
          ["serp_research", "keyword_intent", "competitor_research", "qa_critic"].includes(f.capability)
        ),
        lessons: ctx.lessons.slice(0, 5),
      };
    case "audit":
    case "technical_execution":
      return {
        ...base,
        recent_audits: ctx.recent_audits,
        findings: ctx.recent_findings.filter((f) =>
          ["audit", "technical_execution", "serp_research"].includes(f.capability)
        ),
      };
    case "authority":
    case "citations":
      return {
        ...base,
        competitors: ctx.competitors,
        findings: ctx.recent_findings.filter((f) =>
          ["authority", "citations", "competitor_research"].includes(f.capability)
        ),
      };
    case "qa_critic":
      return {
        ...base,
        existing_pages: ctx.existing_pages.slice(0, 20),
        services: ctx.products_services,
        service_area: ctx.service_areas,
        lessons: ctx.lessons.slice(0, 5),
      };
    case "performance":
      return {
        ...base,
        lessons: ctx.lessons,
        findings: ctx.recent_findings.slice(0, 10),
      };
    default:
      return base;
  }
}

export function contextPromptBlock(
  ctx: SharedAgentContext,
  capability: AgentCapability
): string {
  return JSON.stringify(projectContextFor(ctx, capability), null, 2);
}
