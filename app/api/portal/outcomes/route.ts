import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { requireAuth, isAuthError, requireBrandAccess } from "@/lib/auth";
import {
  attributeAction,
  summariseOutcomes,
  type ActionForAttribution,
  type DailyMetric,
} from "@/lib/outcomes";

export const maxDuration = 60;

// Outcome attribution — connect executed publishes to later GSC movement.
// Read-only. Uses existing seo_action_events + keyword_positions (+ drafts for
// keyword labels). No new tables, no live schema changes.

type EventRow = {
  id: string;
  occurred_at: string;
  event_type: string;
  event_label: string;
  event_detail: string | null;
  page_url: string | null;
  keyword_id: string | null;
};

type KwRow = { id: string; keyword: string };

function urlsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const norm = (u: string) =>
    u.replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
  return norm(a) === norm(b) || norm(a).endsWith(norm(b)) || norm(b).endsWith(norm(a));
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (isAuthError(auth)) return auth;

  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId) return NextResponse.json({ error: "brand required" }, { status: 400 });
  const accessErr = requireBrandAccess(auth, brandId);
  if (accessErr) return accessErr;

  const since = new Date(Date.now() - 120 * 864e5).toISOString();

  const { data: events, error: evErr } = await db
    .from("seo_action_events")
    .select("id, occurred_at, event_type, event_label, event_detail, page_url, keyword_id")
    .eq("brand_id", brandId)
    .gte("occurred_at", since)
    .order("occurred_at", { ascending: false })
    .limit(40);

  if (evErr) {
    // Table may not exist yet in every environment — degrade honestly.
    if (/does not exist|relation|42P01/i.test(evErr.message)) {
      return NextResponse.json({
        available: false,
        reason: "seo_action_events is not available in this environment yet.",
        items: [],
        summary: summariseOutcomes([]),
      });
    }
    return NextResponse.json({ error: evErr.message }, { status: 500 });
  }

  const rows = (events || []) as EventRow[];
  if (!rows.length) {
    return NextResponse.json({
      available: true,
      items: [],
      summary: summariseOutcomes([]),
      note: "No published actions to attribute yet. Approve and publish work to start an outcome trail.",
    });
  }

  const keywordIds = [...new Set(rows.map((r) => r.keyword_id).filter(Boolean))] as string[];
  let kwById = new Map<string, string>();
  if (keywordIds.length) {
    const { data: kws } = await db
      .from("tracked_keywords")
      .select("id, keyword")
      .eq("brand_id", brandId)
      .in("id", keywordIds);
    kwById = new Map(((kws || []) as KwRow[]).map((k) => [k.id, k.keyword]));
  }

  // Fall back: drafts that share the event_detail title → target_keyword.
  const titles = [...new Set(rows.map((r) => r.event_detail).filter(Boolean))] as string[];
  let keywordByTitle = new Map<string, string>();
  if (titles.length) {
    const { data: drafts } = await db
      .from("drafts")
      .select("title, target_keyword")
      .eq("brand_id", brandId)
      .in("title", titles)
      .not("target_keyword", "is", null)
      .limit(80);
    for (const d of drafts || []) {
      if (d.title && d.target_keyword) keywordByTitle.set(d.title, d.target_keyword);
    }
  }

  const actions: ActionForAttribution[] = rows.map((r) => {
    const fromKw = r.keyword_id ? kwById.get(r.keyword_id) || null : null;
    const fromTitle = r.event_detail ? keywordByTitle.get(r.event_detail) || null : null;
    return {
      id: r.id,
      occurredAt: r.occurred_at,
      eventType: r.event_type,
      eventLabel: r.event_label,
      eventDetail: r.event_detail,
      pageUrl: r.page_url,
      keyword: fromKw || fromTitle,
    };
  });

  const keywords = [...new Set(actions.map((a) => a.keyword).filter(Boolean))] as string[];
  const pageUrls = [...new Set(actions.map((a) => a.pageUrl).filter(Boolean))] as string[];

  // Pull a generous history window; attribution windows are computed per action.
  const historySince = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  let historyRows: {
    keyword: string;
    captured_date: string;
    position: number | null;
    clicks: number;
    impressions: number;
    ctr: number;
    landing_page: string | null;
  }[] = [];

  if (keywords.length) {
    const { data } = await db
      .from("keyword_positions")
      .select("keyword, captured_date, position, clicks, impressions, ctr, landing_page")
      .eq("brand_id", brandId)
      .in("keyword", keywords)
      .gte("captured_date", historySince)
      .order("captured_date", { ascending: true });
    historyRows = data || [];
  }

  // If we only have page URLs, match on landing_page. Try an exact IN filter
  // first so Postgres does the work; the broad scan is the last resort, since
  // every row it returns is function time we pay for on a serverless platform.
  if (!historyRows.length && pageUrls.length) {
    const { data: exact } = await db
      .from("keyword_positions")
      .select("keyword, captured_date, position, clicks, impressions, ctr, landing_page")
      .eq("brand_id", brandId)
      .in("landing_page", pageUrls)
      .gte("captured_date", historySince)
      .order("captured_date", { ascending: true });
    historyRows = exact || [];

    if (!historyRows.length) {
      const { data } = await db
        .from("keyword_positions")
        .select("keyword, captured_date, position, clicks, impressions, ctr, landing_page")
        .eq("brand_id", brandId)
        .gte("captured_date", historySince)
        .order("captured_date", { ascending: true })
        .limit(2000);
      historyRows = (data || []).filter((r) =>
        pageUrls.some((u) => urlsMatch(u, r.landing_page)),
      );
    }
  }

  const byKeyword = new Map<string, DailyMetric[]>();
  const byPage = new Map<string, DailyMetric[]>();
  for (const r of historyRows) {
    const point: DailyMetric = {
      date: r.captured_date,
      position: r.position,
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
    };
    if (r.keyword) {
      const list = byKeyword.get(r.keyword) || [];
      list.push(point);
      byKeyword.set(r.keyword, list);
    }
    if (r.landing_page) {
      const list = byPage.get(r.landing_page) || [];
      list.push(point);
      byPage.set(r.landing_page, list);
    }
  }

  const now = new Date();
  const items = actions.map((action) => {
    let history: DailyMetric[] = [];
    if (action.keyword && byKeyword.has(action.keyword)) {
      history = byKeyword.get(action.keyword)!;
    } else if (action.pageUrl) {
      for (const [page, rowsForPage] of byPage) {
        if (urlsMatch(page, action.pageUrl)) {
          history = rowsForPage;
          break;
        }
      }
    }
    return attributeAction(action, history, now);
  });

  return NextResponse.json({
    available: true,
    items,
    summary: summariseOutcomes(items),
  });
}
