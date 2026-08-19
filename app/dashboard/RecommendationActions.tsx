"use client";
/**
 * Actionable ranking opportunities inside AI Recommendations.
 * Reports stay read-only — fix / push lives here.
 */
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import ActionButton from "./intelligence/ActionButton";

type Kw = {
  keyword: string;
  current_position?: number;
  previous_position?: number;
  change?: number;
  position?: number;
  search_volume?: number;
  landing_page?: string;
  ai_opportunity_reason?: string;
};

type Mode = "issues" | "opportunities";

export default function RecommendationActions({
  brandId,
  mode,
}: {
  brandId: string;
  mode: Mode;
}) {
  const [rows, setRows] = useState<Kw[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    authedFetch(`/api/intelligence/winners-losers?brand=${brandId}&days=30`)
      .then((r) => r.json())
      .then((d) => {
        setRows(mode === "issues" ? d.drops || [] : d.almost_page_1 || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, mode]);

  if (loading) {
    return <p className="rec-action-loading">Scanning rankings…</p>;
  }

  if (!rows.length) {
    return (
      <div className="rec-action-empty">
        {mode === "issues"
          ? "No slipping keywords right now — nice. Check Reports → What changed anytime."
          : "Nothing sitting just off page 1 right now. When there is, it’ll show up here to push."}
      </div>
    );
  }

  return (
    <div className="rec-actions">
      <p className="rec-action-intro">
        {mode === "issues"
          ? "These searches slipped. Send them to the AI to rewrite / strengthen the page — results land back in Content for review (unless Autopilot is on)."
          : "These searches are almost on Google’s first page. Ask the AI to push them — work appears in Content / Meta for approval."}
      </p>
      <div className="rec-action-list">
        {rows.map((kw, i) => (
          <article key={`${kw.keyword}-${i}`} className={`rec-action-card ${mode}`}>
            <div className="rec-action-left">
              <div className="rec-action-kw">{kw.keyword}</div>
              <div className="rec-action-meta">
                {mode === "issues" && kw.previous_position != null && kw.current_position != null && (
                  <span>
                    Dropped #{kw.previous_position} → #{kw.current_position}
                    {kw.change != null ? ` (▼${kw.change})` : ""}
                  </span>
                )}
                {mode === "opportunities" && kw.position != null && (
                  <span>Currently #{kw.position} — one push from page 1</span>
                )}
                {kw.search_volume != null && (
                  <span> · ~{kw.search_volume.toLocaleString()}/mo</span>
                )}
              </div>
              {kw.ai_opportunity_reason && (
                <p className="rec-action-why">{kw.ai_opportunity_reason}</p>
              )}
            </div>
            <div className="rec-action-right">
              {mode === "issues" ? (
                <ActionButton
                  action="improve_content"
                  brandId={brandId}
                  payload={{
                    target_keyword: kw.keyword,
                    target_url: kw.landing_page,
                    event_label: "Fix slipping keyword",
                    rationale: `Ranking slipped for "${kw.keyword}"`,
                  }}
                  label="Ask AI to fix"
                  variant="primary"
                />
              ) : (
                <ActionButton
                  action="boost_page1"
                  brandId={brandId}
                  payload={{
                    target_keyword: kw.keyword,
                    target_url: kw.landing_page,
                    event_label: "Page 1 push",
                  }}
                  label="Ask AI to push"
                  variant="teal"
                />
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
