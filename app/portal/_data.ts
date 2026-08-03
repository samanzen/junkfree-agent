"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";

// ── Row shapes (mirror the existing Supabase tables; see supabase/*.sql) ────
export type Draft = {
  id: string; brand_id: string; run_id: string | null; task_type: string;
  target_url: string | null; target_keyword: string | null;
  title: string; body: string; rationale: string | null;
  status: "pending_review" | "approved" | "published" | "dismissed" | string;
  created_at: string;
};
export type GbpPost = {
  id: string; brand_id: string; title: string | null; body: string;
  cta: string | null; status: string; created_at: string;
};
export type Citation = {
  id: string; brand_id: string; name: string; url: string | null;
  category: string | null; priority: number | null; rationale: string | null;
  status: "suggested" | "in_progress" | "live" | "skipped" | string;
  created_at: string;
};
export type ReviewResponse = {
  id: string; brand_id: string; reviewer_name: string | null; rating: number | null;
  review_text: string | null; draft_response: string; status: string; created_at: string;
};

export type PlatformData = {
  drafts: Draft[]; gbp: GbpPost[]; citations: Citation[]; reviews: ReviewResponse[];
};

// Single brand-scoped read of /api/platform. Reused by Dashboard, Content,
// Reviews and Local SEO instead of each page rolling its own fetch.
export function usePlatformData(brandId: string | undefined) {
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/platform?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setData({
          drafts: d.drafts || [], gbp: d.gbp || [],
          citations: d.citations || [], reviews: d.reviews || [],
        });
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  return { data, loading };
}

// ── /api/portal/summary ─────────────────────────────────────────────────────
export type PortalMetrics = {
  organic_traffic: number | null; organic_keywords: number | null;
  backlinks: number | null; referring_domains: number | null;
  striking_distance: number | null; avg_position: number | null;
  ai_visibility: number | null; site_health: number | null;
  traffic_delta: number | null; keywords_delta: number | null;
  backlinks_delta: number | null; position_delta: number | null;
};
export type PortalSummary = {
  brand: { name: string; site_url: string; service_area: string; business_model?: string };
  metrics: PortalMetrics;
  chart: { date: string; traffic: number; keywords: number }[];
  activity: {
    published_this_month: number;
    recent_content: { title: string; keyword: string | null; published_at: string }[];
    gbp_posts_drafted: number;
    citations_found: number;
    citations_live: number;
  };
  opportunities: { keyword: string; position: number; impressions: number }[];
  insights: string[];
};

export function usePortalSummary(brandId: string | undefined) {
  const [summary, setSummary] = useState<PortalSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/portal/summary?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setSummary(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  return { summary, loading };
}

// ── Mutations ───────────────────────────────────────────────────────────────
// Thin wrappers over the EXISTING brand-scoped endpoints the admin dashboard
// already uses. Every one of these enforces requireBrandAccess server-side,
// so a customer can only ever act on their own brand's rows.

export async function approveDraft(id: string): Promise<boolean> {
  const res = await authedFetch(`/api/drafts/${id}/approve`, { method: "POST" });
  return res.ok;
}

export async function dismissDraft(id: string): Promise<boolean> {
  const res = await authedFetch(`/api/drafts/${id}/approve?action=dismiss`, { method: "POST" });
  return res.ok;
}

export type PlatformTable = "gbp_posts" | "review_responses" | "citations";

export async function setRowStatus(table: PlatformTable, id: string, status: string): Promise<boolean> {
  const res = await authedFetch(`/api/platform/${table}/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return res.ok;
}

// ── Derived scores ──────────────────────────────────────────────────────────
// All composites below are computed from data we actually hold. Anything with
// no real signal returns null so the UI can show "Connect to unlock" rather
// than inventing a number.

/** Rankings-based SEO score: average position quality + keyword footprint. */
export function computeSeoScore(m: PortalMetrics): number | null {
  const parts: number[] = [];
  if (m.avg_position != null && m.avg_position > 0) {
    parts.push(Math.max(0, Math.min(100, 100 - ((m.avg_position - 1) / 99) * 100)));
  }
  if (m.organic_keywords != null) {
    parts.push(Math.min(100, m.organic_keywords));
  }
  if (!parts.length) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Local score from citation completion — the only local signal wired today. */
export function computeLocalScore(a: PortalSummary["activity"]): number | null {
  if (!a || !a.citations_found) return null;
  return Math.round((a.citations_live / a.citations_found) * 100);
}

export function computeOverallHealth(scores: (number | null)[]): number | null {
  const vals = scores.filter((s): s is number => s != null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function greeting(d = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
