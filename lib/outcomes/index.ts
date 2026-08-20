// Outcome reporter — staff under the Manager.
// After Search Console has had time, compare this URL/query vs before publish.
// Does not learn from drafts that never went live, or from a few days of data.

import { recordActivity } from "../agents/store";
import type { Brand } from "../brands";
import { db } from "../supabase";

export const OUTCOME_LAG_DAYS = 14;
export const BEFORE_WINDOW_DAYS = 14;

export type PositionSnapshot = {
  position: number | null;
  clicks: number;
  impressions: number;
  captured_date: string;
};

export type OutcomeVerdict = "won" | "lost" | "flat" | "too_soon" | "not_buyer";

export type ScoredOutcome = {
  verdict: OutcomeVerdict;
  lesson: string;
  clicksDelta: number;
  positionDelta: number | null;
};

const FREE_INTENT = /\bfree\b|\bwhat is\b|\bwiki\b|\bdefinition\b|\bmeaning\b/;

export function isBuyerIntentQuery(keyword: string, intentNotes?: string | null): boolean {
  const k = keyword.toLowerCase().trim();
  if (!k) return false;
  if (FREE_INTENT.test(k)) return false;
  const notes = (intentNotes || "").toLowerCase();
  if (notes) {
    for (const token of notes.split(/[,;/]+/).map((t) => t.trim()).filter(Boolean)) {
      if (token.length >= 3 && k.includes(token)) return false;
    }
  }
  return true;
}

export function scoreOutcome(
  before: PositionSnapshot | null,
  after: PositionSnapshot | null,
  opts: { keyword: string; buyerIntent: boolean; lagDays: number }
): ScoredOutcome {
  if (opts.lagDays < OUTCOME_LAG_DAYS || !after) {
    return {
      verdict: "too_soon",
      lesson: `Wait — ${opts.keyword} has not had ${OUTCOME_LAG_DAYS} days of Search Console data since publish.`,
      clicksDelta: 0,
      positionDelta: null,
    };
  }

  const beforeClicks = before?.clicks ?? 0;
  const afterClicks = after.clicks;
  const clicksDelta = afterClicks - beforeClicks;
  const beforePos = before?.position ?? null;
  const afterPos = after.position;
  const positionDelta =
    beforePos != null && afterPos != null ? Number((beforePos - afterPos).toFixed(1)) : null;

  if (!opts.buyerIntent) {
    return {
      verdict: "not_buyer",
      lesson: `Do not treat "${opts.keyword}" as a win — it is not a hire-ready search.`,
      clicksDelta,
      positionDelta,
    };
  }

  const movedUp = positionDelta != null && positionDelta >= 1;
  const movedDown = positionDelta != null && positionDelta <= -1;
  const moreClicks = clicksDelta >= 3;
  const fewerClicks = clicksDelta <= -3;

  if (movedUp || moreClicks) {
    return {
      verdict: "won",
      lesson: `Keep doing this: "${opts.keyword}" improved after publish (${clicksDelta >= 0 ? "+" : ""}${clicksDelta} clicks${positionDelta != null ? `, ${positionDelta > 0 ? "up" : "down"} ${Math.abs(positionDelta)} positions` : ""}).`,
      clicksDelta,
      positionDelta,
    };
  }
  if (movedDown || fewerClicks) {
    return {
      verdict: "lost",
      lesson: `Drop or rewrite the approach for "${opts.keyword}" — it lost ground after publish (${clicksDelta} clicks${positionDelta != null ? `, ${positionDelta > 0 ? "up" : "down"} ${Math.abs(positionDelta)} positions` : ""}).`,
      clicksDelta,
      positionDelta,
    };
  }
  return {
    verdict: "flat",
    lesson: `"${opts.keyword}" is flat after publish. Do not learn from this yet.`,
    clicksDelta,
    positionDelta,
  };
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso.slice(0, 10));
  const b = Date.parse(toIso.slice(0, 10));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.floor((b - a) / 86400000);
}

function pickNearest(
  rows: PositionSnapshot[],
  onOrBefore: string
): PositionSnapshot | null {
  const target = onOrBefore.slice(0, 10);
  const eligible = rows.filter((r) => r.captured_date <= target);
  return eligible[0] || null;
}

export async function reportOutcomes(brand: Brand): Promise<{ reported: number; lessons: string[] }> {
  if (!brand.gsc_property) return { reported: 0, lessons: [] };

  const { data: events, error } = await db
    .from("seo_action_events")
    .select("id, page_url, keyword_id, event_label, event_detail, occurred_at")
    .eq("brand_id", brand.id)
    .in("event_type", ["content_update", "meta_update", "new_page"])
    .order("occurred_at", { ascending: false })
    .limit(40);

  if (error || !events?.length) return { reported: 0, lessons: [] };

  const today = new Date().toISOString().slice(0, 10);
  const lessons: string[] = [];
  let reported = 0;

  for (const event of events) {
    const lag = daysBetween(event.occurred_at, today);
    if (lag < OUTCOME_LAG_DAYS) continue;

    const { data: already } = await db
      .from("outcome_reports")
      .select("id")
      .eq("brand_id", brand.id)
      .eq("event_id", event.id)
      .maybeSingle();
    if (already?.id) continue;

    let keyword = (event.event_detail || "").trim();
    if (event.keyword_id) {
      const { data: kw } = await db
        .from("tracked_keywords")
        .select("keyword")
        .eq("id", event.keyword_id)
        .eq("brand_id", brand.id)
        .maybeSingle();
      if (kw?.keyword) keyword = kw.keyword;
    }
    if (!keyword) continue;

    const publishDay = event.occurred_at.slice(0, 10);
    const beforeDay = new Date(Date.parse(publishDay) - BEFORE_WINDOW_DAYS * 86400000)
      .toISOString()
      .slice(0, 10);

    const { data: positions } = await db
      .from("keyword_positions")
      .select("position, clicks, impressions, captured_date")
      .eq("brand_id", brand.id)
      .eq("keyword", keyword)
      .order("captured_date", { ascending: false })
      .limit(60);

    const rows = (positions || []) as PositionSnapshot[];
    const after = pickNearest(rows, today);
    const before = pickNearest(
      rows.filter((r) => r.captured_date <= publishDay),
      beforeDay
    ) || pickNearest(rows.filter((r) => r.captured_date <= publishDay), publishDay);

    const scored = scoreOutcome(before, after, {
      keyword,
      buyerIntent: isBuyerIntentQuery(keyword, brand.intent_notes),
      lagDays: lag,
    });

    if (scored.verdict === "too_soon") continue;

    const { error: insertErr } = await db.from("outcome_reports").insert({
      brand_id: brand.id,
      event_id: event.id,
      page_url: event.page_url,
      keyword,
      verdict: scored.verdict,
      lesson: scored.lesson,
      clicks_delta: scored.clicksDelta,
      position_delta: scored.positionDelta,
      before: before || null,
      after: after || null,
    });
    if (insertErr) {
      console.warn(`[outcomes] skip store: ${insertErr.message}`);
      continue;
    }

    reported++;
    if (scored.verdict === "won" || scored.verdict === "lost") {
      lessons.push(scored.lesson);
      await db.from("lessons").insert({ brand_id: brand.id, lesson: scored.lesson.slice(0, 500) });
    }
  }

  if (reported) {
    await recordActivity({
      brandId: brand.id,
      capability: "outcome_reporter",
      eventType: "outcomes_reported",
      title: `Reported ${reported} publish outcome${reported === 1 ? "" : "s"}`,
      detail: lessons.slice(0, 3).join(" "),
      status: "info",
      metadata: { reported, lessons: lessons.length },
    });
  }

  return { reported, lessons };
}
