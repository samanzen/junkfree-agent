import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { enqueue } from "@/lib/queue";

export const maxDuration = 30;

// One-click action bridge: maps UI action types to existing queue jobs.
// No new execution logic — purely routes to existing agent capabilities.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.action || !body?.brand_id) {
    return NextResponse.json({ error: "action and brand_id required" }, { status: 400 });
  }

  const { action, brand_id, payload = {} } = body;

  try {
    switch (action) {
      case "improve_content":
        await enqueue(brand_id, "content", {
          task_type: "improve_content",
          target_url: payload.target_url,
          target_keyword: payload.target_keyword,
          rationale: payload.rationale || `AI recommended: improve ranking for "${payload.target_keyword}"`,
        });
        break;

      case "fix_meta":
        await enqueue(brand_id, "content", {
          task_type: "fix_meta",
          target_url: payload.target_url,
          target_keyword: payload.target_keyword,
          rationale: payload.rationale || `Low CTR — rewrite title/meta for "${payload.target_keyword}"`,
        });
        break;

      case "rewrite_page":
        await enqueue(brand_id, "content", {
          task_type: "new_page",
          target_url: payload.target_url,
          target_keyword: payload.target_keyword,
          rationale: payload.rationale || `Full page rewrite to improve ranking for "${payload.target_keyword}"`,
        });
        break;

      case "generate_faq":
        await enqueue(brand_id, "geo", {
          target_keyword: payload.target_keyword,
          rationale: payload.rationale || `Generate FAQ content for "${payload.target_keyword}"`,
        });
        break;

      case "build_backlinks":
        await enqueue(brand_id, "citations", {
          target_keyword: payload.target_keyword,
          rationale: payload.rationale || `Find backlink opportunities for "${payload.target_keyword}"`,
        });
        break;

      case "boost_page1":
        // Both improve_content + fix_meta for the best chance of page 1
        await enqueue(brand_id, "content", {
          task_type: "improve_content",
          target_url: payload.target_url,
          target_keyword: payload.target_keyword,
          rationale: `Page 1 push: content improvement for "${payload.target_keyword}"`,
        });
        await enqueue(brand_id, "content", {
          task_type: "fix_meta",
          target_url: payload.target_url,
          target_keyword: payload.target_keyword,
          rationale: `Page 1 push: meta optimization for "${payload.target_keyword}"`,
        });
        break;

      case "track_keyword":
        await db.from("tracked_keywords").upsert({
          brand_id,
          keyword: (payload.keyword as string).trim().toLowerCase(),
          source: "manual",
          first_seen_date: new Date().toISOString().slice(0, 10),
          status: "new",
        }, { onConflict: "brand_id,keyword" });
        break;

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    // Log the action as an SEO event for timeline markers
    if (payload.target_keyword || payload.target_url) {
      const { data: kw } = payload.target_keyword
        ? await db.from("tracked_keywords").select("id")
            .eq("brand_id", brand_id).eq("keyword", payload.target_keyword).single()
        : { data: null };

      await db.from("seo_action_events").insert({
        brand_id,
        keyword_id: kw?.id || null,
        page_url: payload.target_url || null,
        event_type: action,
        event_label: payload.event_label || action.replace(/_/g, " "),
        event_detail: payload.rationale || null,
        occurred_at: new Date().toISOString(),
      }).catch(() => {}); // non-critical
    }

    return NextResponse.json({ ok: true, action, queued: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
