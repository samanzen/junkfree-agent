import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "@/lib/anthropic";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";

export const maxDuration = 30;

// Generates a 2-3 sentence executive summary for a dashboard section.
// Called by ExecSummary component after recommendations are loaded.
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const { brandId, section, brandName, recommendations, data } = await req.json().catch(() => ({}));
  if (!brandId) return NextResponse.json({ error: "brandId required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const topRec = (recommendations || [])[0];
  const summary = await callClaude({
    maxTokens: 200,
    user: `Write a 2-3 sentence executive briefing for the ${section} section of ${brandName || "this business"}'s SEO dashboard.
${topRec ? `Top priority: ${topRec.title} — ${topRec.explanation}` : ""}
${data ? `Context: ${JSON.stringify(data).slice(0, 400)}` : ""}

Rules: speak directly to the business owner (not an SEO expert). Start with what happened, then what it means, then the single most important next step. Plain English only. No bullet points. Max 60 words.`,
  }).catch(() => null);

  return NextResponse.json({ summary: summary?.trim() || null });
}
