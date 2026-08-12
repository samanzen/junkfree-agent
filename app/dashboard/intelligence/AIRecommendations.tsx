"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import ActionButton, { ActionType } from "./ActionButton";
import { CAT_COLOR, SYSTEM, tint } from "./palette";

type Rec = { priority: number; category: string; title: string; explanation: string; estimated_impact: string; action_type: ActionType; action_label: string; action_payload: Record<string, unknown> };

export default function AIRecommendations({ brandId }: { brandId: string }) {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("all");
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!brandId) return;
    authedFetch(`/api/intelligence/recommendations?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => { setRecs(d.recommendations || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brandId]);

  const cats = ["all", ...new Set(recs.map((r) => r.category))];
  const visible = recs
    .filter((r, i) => !dismissed.has(i) && (catFilter === "all" || r.category === catFilter))
    .sort((a, b) => b.priority - a.priority);

  if (loading) return (
    <div className="air-loading">
      {[...Array(3)].map((_, i) => <div key={i} className="air-skel" style={{ animationDelay: `${i * 100}ms` }} />)}
    </div>
  );

  return (
    <div className="air">
      {cats.length > 2 && (
        <div className="air-cats">
          {cats.map((c) => (
            <button key={c} className={`air-cat ${catFilter === c ? "on" : ""}`}
              style={catFilter === c ? { background: CAT_COLOR[c] || SYSTEM, color: "#fff", borderColor: CAT_COLOR[c] || SYSTEM } : {}}
              onClick={() => setCatFilter(c)}>{c.charAt(0).toUpperCase() + c.slice(1)}</button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="air-empty">No recommendations yet — run the agents to generate AI insights.</div>
      ) : visible.map((rec, i) => (
        <div key={i} className="air-card">
          <div className="air-card-bar" style={{ background: CAT_COLOR[rec.category] || SYSTEM }} />
          <div className="air-card-body">
            <div className="air-card-head">
              <span className="air-cat-badge" style={{ background: tint(CAT_COLOR[rec.category] || SYSTEM), color: CAT_COLOR[rec.category] || SYSTEM }}>{rec.category}</span>
              <span className="air-priority">Priority {rec.priority}/10</span>
              <button className="air-dismiss" onClick={() => setDismissed(new Set([...dismissed, recs.indexOf(rec)]))}>✕</button>
            </div>
            <h4 className="air-title">{rec.title}</h4>
            <p className="air-explanation">{rec.explanation}</p>
            {rec.estimated_impact && <div className="air-impact">💡 {rec.estimated_impact}</div>}
            <div className="air-actions">
              <ActionButton action={rec.action_type} brandId={brandId} payload={{ ...rec.action_payload, event_label: rec.title }} label={rec.action_label || "Take action"} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
