"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { Panel, PanelHead } from "../../_components/Panel";
import EmptyState from "../../_components/EmptyState";
import { Stagger, StaggerItem } from "../../_components/motion";
import { IconSparkle, IconCheck } from "../../icons";

type Rec = {
  priority?: number; category?: string; title?: string; explanation?: string;
  estimated_impact?: string; action_type?: string; action_label?: string;
  action_payload?: { target_keyword?: string; target_url?: string };
};
type AlmostRow = {
  keyword: string; position?: number; search_volume?: number | null;
  landing_page?: string | null; ai_opportunity_reason?: string | null;
};

export default function OpportunitiesTab({ brandId }: { brandId: string }) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [almost, setAlmost] = useState<AlmostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queued, setQueued] = useState<Record<number, "loading" | "done">>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      authedFetch(`/api/intelligence/recommendations?brand=${brandId}`).then((r) => r.json()).catch(() => ({})),
      authedFetch(`/api/intelligence/winners-losers?brand=${brandId}`).then((r) => r.json()).catch(() => ({})),
    ])
      .then(([rec, wl]) => {
        if (cancelled) return;
        setRecs(Array.isArray(rec?.recommendations) ? rec.recommendations : []);
        setAlmost(Array.isArray(wl?.almost_page_1) ? wl.almost_page_1 : []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  async function runAction(i: number, rec: Rec) {
    if (!rec.action_type) return;
    setQueued((q) => ({ ...q, [i]: "loading" }));
    try {
      const res = await authedFetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: rec.action_type, brand_id: brandId, payload: rec.action_payload || {} }),
      });
      setQueued((q) => ({ ...q, [i]: res.ok ? "done" : "loading" }));
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || "Couldn't start that task. Please try again.");
        setQueued((q) => { const n = { ...q }; delete n[i]; return n; });
      }
    } catch {
      alert("Couldn't start that task. Please try again.");
      setQueued((q) => { const n = { ...q }; delete n[i]; return n; });
    }
  }

  if (loading) {
    return (
      <div className="p-stack">
        {[...Array(3)].map((_, i) => <div key={i} className="p-skel" style={{ height: 120 }} />)}
      </div>
    );
  }

  return (
    <div className="p-stack">
      <Panel>
        <PanelHead
          title="Recommended next steps"
          badge={recs.length || undefined}
          sub="Prioritised by your AI strategist from your live ranking data."
        />
        {recs.length === 0 ? (
          <EmptyState icon="✦" title="No recommendations yet" sub="Recommendations are generated from your keyword data — they'll appear once enough ranking history exists." />
        ) : (
          <Stagger className="p-rec-list">
            {recs.map((r, i) => (
              <StaggerItem key={i} className="p-rec">
                <div className="p-rec-top">
                  <span className="p-rec-icon"><IconSparkle size={15} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="p-rec-title">{r.title || "Recommended action"}</div>
                    {r.category && <span className="p-chip" style={{ marginTop: 4, display: "inline-block" }}>{r.category}</span>}
                  </div>
                </div>
                {r.explanation && <p className="p-rec-text">{r.explanation}</p>}
                <div className="p-rec-foot">
                  {r.estimated_impact && <span className="p-rec-impact">📈 {r.estimated_impact}</span>}
                  {r.action_type && (
                    queued[i] === "done" ? (
                      <span className="p-badge green" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <IconCheck size={13} /> Added to your queue
                      </span>
                    ) : (
                      <button
                        className="p-btn primary"
                        style={{ padding: "8px 14px", fontSize: 12.5 }}
                        disabled={queued[i] === "loading"}
                        onClick={() => runAction(i, r)}
                      >
                        {queued[i] === "loading" ? "Starting…" : (r.action_label || "Do this")}
                      </button>
                    )
                  )}
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Panel>

      <Panel>
        <PanelHead
          title="Almost on page 1"
          badge={almost.length || undefined}
          badgeTone="amber"
          sub="Keywords sitting in positions 11–20. These are usually the fastest wins."
        />
        {almost.length === 0 ? (
          <EmptyState icon="⚡" title="Nothing in striking distance right now" sub="Keywords ranking between positions 11 and 20 will show up here." />
        ) : (
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr><th>Keyword</th><th>Position</th><th>Searches / mo</th><th>Page</th></tr>
              </thead>
              <tbody>
                {almost.map((r, i) => (
                  <tr key={i}>
                    <td><div className="p-kwcell" title={r.keyword}>{r.keyword}</div></td>
                    <td><span className="p-pos top20">{r.position}</span></td>
                    <td>{r.search_volume != null ? r.search_volume.toLocaleString() : <span className="p-na">—</span>}</td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                      {r.landing_page ? r.landing_page.replace(/^https?:\/\/[^/]+/, "") || "/" : <span className="p-na">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
