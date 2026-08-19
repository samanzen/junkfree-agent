"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";

/**
 * Colorful “postcard” digest — designed to later become the weekly/monthly
 * customer email. Admin dashboard first; portal later.
 */
export default function DigestReport({
  brandId,
  brandName,
  days = 30,
}: {
  brandId: string;
  brandName?: string;
  days?: number;
}) {
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [activity, setActivity] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    Promise.all([
      authedFetch(`/api/intelligence/overview?brand=${brandId}&days=${days}`).then((r) => r.json()),
      authedFetch(`/api/intelligence/activity?brand=${brandId}&days=${days}`).then((r) => r.json()),
    ])
      .then(([ov, act]) => {
        setOverview(ov);
        setActivity(act);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, days]);

  if (loading) return <div className="dig-loading">Designing your digest…</div>;

  const clicks = (overview?.total_clicks as number) ?? 0;
  const imps = (overview?.total_impressions as number) ?? 0;
  const top10 = (overview?.top_10 as number) ?? 0;
  const deltas = (overview?.deltas as Record<string, number>) || {};
  const summary = (activity?.summary as Record<string, number>) || {};
  const periodLabel = days >= 90 ? "This quarter" : days >= 30 ? "This month" : `Last ${days} days`;

  return (
    <div className="dig">
      <article className="dig-card">
        <div className="dig-banner">
          <div className="dig-eyebrow">SEO digest · ready for customers later</div>
          <h2>{brandName || "Your brand"}</h2>
          <p>{periodLabel} — what the AI accomplished and how search is responding.</p>
        </div>

        <div className="dig-stats">
          <div className="dig-stat a">
            <div className="dig-stat-n">{imps.toLocaleString()}</div>
            <div className="dig-stat-l">Times you showed in Google</div>
            {deltas.total_impressions != null && deltas.total_impressions !== 0 && (
              <div className={`dig-delta ${deltas.total_impressions > 0 ? "up" : "down"}`}>
                {deltas.total_impressions > 0 ? "▲" : "▼"} {Math.abs(deltas.total_impressions).toLocaleString()}
              </div>
            )}
          </div>
          <div className="dig-stat b">
            <div className="dig-stat-n">{clicks.toLocaleString()}</div>
            <div className="dig-stat-l">Clicks to your site</div>
            {deltas.total_clicks != null && deltas.total_clicks !== 0 && (
              <div className={`dig-delta ${deltas.total_clicks > 0 ? "up" : "down"}`}>
                {deltas.total_clicks > 0 ? "▲" : "▼"} {Math.abs(deltas.total_clicks).toLocaleString()}
              </div>
            )}
          </div>
          <div className="dig-stat c">
            <div className="dig-stat-n">{top10}</div>
            <div className="dig-stat-l">Keywords on page 1</div>
          </div>
          <div className="dig-stat d">
            <div className="dig-stat-n">{summary.pages_published ?? 0}</div>
            <div className="dig-stat-l">Pages the AI published</div>
          </div>
        </div>

        <div className="dig-body">
          <h3>Highlights</h3>
          <ul>
            <li>
              The AI finished <strong>{summary.drafts_published ?? 0}</strong> publishable pieces and ran{" "}
              <strong>{summary.successful_runs ?? 0}</strong> successful agent sessions.
            </li>
            <li>
              <strong>{summary.keywords_touched ?? 0}</strong> keywords were actively worked (improving, new, or
              needing attention).
            </li>
            <li>
              {(deltas.improved_this_week as number) || 0} rankings moved up;{" "}
              {(deltas.declined_this_week as number) || 0} slipped — review Issues in AI Recommendations if needed.
            </li>
          </ul>
          <p className="dig-note">
            This postcard is what a weekly/monthly customer email will look like. For now it’s in the admin
            dashboard only — we’ll wire customer delivery after you approve the design.
          </p>
        </div>
      </article>
    </div>
  );
}
