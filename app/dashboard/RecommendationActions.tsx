"use client";
/**
 * Issues / Almost page 1 — actionable ranking work inside AI Recommendations.
 * Respects per-tab "I'll choose" vs "Do automatically".
 */
import { useEffect, useRef, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import ActionButton from "./intelligence/ActionButton";
import RankChange from "./_components/RankChange";

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
  doAutomatically,
}: {
  brandId: string;
  mode: Mode;
  doAutomatically: boolean;
}) {
  const [rows, setRows] = useState<Kw[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoMsg, setAutoMsg] = useState("");
  const queuedOnce = useRef<string>("");

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

  // When "Do automatically" is on, queue current items once per brand+mode load.
  useEffect(() => {
    if (!doAutomatically || loading || !rows.length) return;
    const key = `${brandId}:${mode}:${rows.map((r) => r.keyword).join("|")}`;
    if (queuedOnce.current === key) return;
    queuedOnce.current = key;

    let cancelled = false;
    (async () => {
      let n = 0;
      for (const kw of rows) {
        const action = mode === "issues" ? "improve_content" : "boost_page1";
        const res = await authedFetch("/api/intelligence/action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            brand_id: brandId,
            payload: {
              target_keyword: kw.keyword,
              target_url: kw.landing_page,
              event_label: mode === "issues" ? "Auto-fix slip" : "Auto page-1 push",
              rationale:
                mode === "issues"
                  ? `Autopilot Issues: ranking slipped for "${kw.keyword}"`
                  : `Autopilot Almost page 1: push "${kw.keyword}"`,
            },
          }),
        }).catch(() => null);
        if (res?.ok) n++;
      }
      if (!cancelled) {
        setAutoMsg(
          n
            ? `Sent ${n} to the AI automatically. Drafts will show under Content / Meta.`
            : "Tried to send these to the AI — check again shortly."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [doAutomatically, loading, rows, brandId, mode]);

  if (loading) {
    return <p className="rec-action-loading">Scanning rankings…</p>;
  }

  if (!rows.length) {
    return (
      <div className="rec-action-empty">
        {mode === "issues"
          ? "No slipping keywords right now."
          : "Nothing sitting just off page 1 right now."}
      </div>
    );
  }

  return (
    <div className="rec-actions">
      {doAutomatically ? (
        <p className="rec-action-intro auto">
          <strong>Do automatically</strong> is on for this tab.{" "}
          {autoMsg || "Sending these to the AI…"}
        </p>
      ) : (
        <p className="rec-action-intro">
          <strong>I&apos;ll choose</strong> is on — click a button on any row to send it to the AI.
          Results come back under Content / Meta for approval (unless those tabs are also automatic).
        </p>
      )}
      <div className="rec-action-list">
        {rows.map((kw, i) => (
          <article key={`${kw.keyword}-${i}`} className={`rec-action-card ${mode}`}>
            <div className="rec-action-left">
              <div className="rec-action-kw">{kw.keyword}</div>
              <div className="rec-action-rank">
                {mode === "issues" && kw.previous_position != null && kw.current_position != null ? (
                  <RankChange
                    previous={kw.previous_position}
                    current={kw.current_position}
                    change={kw.change}
                    direction="down"
                  />
                ) : mode === "opportunities" && kw.position != null ? (
                  <RankChange current={kw.position} />
                ) : null}
              </div>
              {kw.search_volume != null && (
                <div className="rec-action-vol">~{kw.search_volume.toLocaleString()} searches / month</div>
              )}
              {kw.ai_opportunity_reason && (
                <p className="rec-action-why">{kw.ai_opportunity_reason}</p>
              )}
            </div>
            <div className="rec-action-right">
              {doAutomatically ? (
                <span className="rec-action-auto-badge">Queued automatically</span>
              ) : mode === "issues" ? (
                <ActionButton
                  action="improve_content"
                  brandId={brandId}
                  payload={{
                    target_keyword: kw.keyword,
                    target_url: kw.landing_page,
                    event_label: "Fix slipping keyword",
                    rationale: `Ranking slipped for "${kw.keyword}"`,
                  }}
                  label="Send to AI"
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
                  label="Send to AI"
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
