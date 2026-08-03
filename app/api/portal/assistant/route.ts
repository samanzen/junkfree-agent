import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { callClaude } from "@/lib/anthropic";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 60;

// Customer-facing AI assistant. The only new endpoint added for Portal 2.0 --
// an assistant cannot function without a server-side model call, and every
// existing route returns fixed-shape data rather than answering questions.
//
// Reuses lib/anthropic (callClaude) and lib/auth (requireBrandAccess) exactly
// like the existing /api/intelligence/exec-summary route. Read-only: it never
// writes, never enqueues work, and is scoped to the caller's own brand.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brand_id, question, history } = await req.json().catch(() => ({}));
  if (!brand_id || typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "brand_id and question required" }, { status: 400 });
  }
  const accessErr = requireBrandAccess(auth, brand_id);
  if (accessErr) return accessErr;

  const [{ data: brand }, { data: snap }, { data: keywords }, { data: drafts }] = await Promise.all([
    db.from("brands").select("name, services, service_area, site_url").eq("id", brand_id).single(),
    db.from("metric_snapshots")
      .select("organic_traffic, organic_keywords, backlinks, referring_domains, avg_position, site_health, captured_at")
      .eq("brand_id", brand_id).order("captured_at", { ascending: false }).limit(2),
    db.from("tracked_keywords")
      .select("keyword, best_position, search_volume, keyword_difficulty, search_intent, status, ai_opportunity_score")
      .eq("brand_id", brand_id).order("ai_opportunity_score", { ascending: false, nullsFirst: false }).limit(25),
    db.from("drafts").select("title, task_type, status, target_keyword")
      .eq("brand_id", brand_id).order("created_at", { ascending: false }).limit(10),
  ]);

  if (!brand) return NextResponse.json({ error: "brand not found" }, { status: 404 });

  const priorHistory = Array.isArray(history)
    ? history.slice(-6).map((m: { role?: string; text?: string }) =>
        `${m.role === "assistant" ? "You" : "Owner"}: ${String(m.text || "").slice(0, 600)}`
      ).join("\n")
    : "";

  const answer = await callClaude({
    maxTokens: 900,
    system: `You are the dedicated SEO advisor for ${brand.name}, a business offering ${brand.services || "local services"} in ${brand.service_area || "its local area"}.

You are speaking directly to the business OWNER, not to an SEO professional.

Rules:
- Plain English. No jargon. If you must use a term like "backlink", explain it in the same sentence.
- Be specific and use the real numbers provided below. Never invent data.
- If the data needed to answer isn't provided, say so plainly and explain what would need to be connected.
- Be concise: 2-4 short paragraphs maximum, or a short list. No preamble.
- Always end with one concrete next step.`,
    user: `CURRENT DATA FOR ${brand.name}
Latest snapshot: ${JSON.stringify(snap?.[0] ?? null)}
Previous snapshot (for comparison): ${JSON.stringify(snap?.[1] ?? null)}
Top keyword opportunities: ${JSON.stringify(keywords?.slice(0, 15) ?? [])}
Recent content: ${JSON.stringify(drafts ?? [])}
${priorHistory ? `\nEARLIER IN THIS CONVERSATION:\n${priorHistory}` : ""}

OWNER'S QUESTION: ${question.trim()}`,
  }).catch(() => null);

  if (!answer) {
    return NextResponse.json({ error: "The assistant is unavailable right now. Please try again." }, { status: 503 });
  }
  return NextResponse.json({ answer });
}
