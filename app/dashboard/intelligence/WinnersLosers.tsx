"use client";
import { useEffect, useState } from "react";
import ActionButton from "./ActionButton";
import DataStatus, { type DataStatusKind } from "./DataStatus";

type Kw = { keyword: string; current_position?: number; previous_position?: number; change?: number; position?: number; last_position?: number; search_volume?: number; ai_opportunity_reason?: string; landing_page?: string };
type Data = { gains: Kw[]; drops: Kw[]; new_keywords: Kw[]; lost_keywords: Kw[]; almost_page_1: Kw[] };

export default function WinnersLosers({ brandId }: { brandId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<DataStatusKind>("ok");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"gains"|"drops"|"new"|"lost"|"page1">("gains");

  useEffect(() => {
    if (!brandId) return;
    Promise.all([
      fetch(`/api/intelligence/winners-losers?brand=${brandId}`).then((r) => r.json()),
      fetch(`/api/intelligence/overview?brand=${brandId}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([d, ov]) => { setData(d); setStatus(ov?.status || "ok"); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brandId]);

  if (loading) return <div className="wl-loading">Analysing keyword movements…</div>;
  if (!data) return null;

  const totalRows = data.gains.length + data.drops.length + data.new_keywords.length + data.lost_keywords.length + data.almost_page_1.length;
  if (totalRows === 0 && status !== "ok") return <DataStatus status={status} />;

  const tabs = [
    { key: "gains" as const, label: `↑ Gains`, count: data.gains.length, color: "#00B894" },
    { key: "drops" as const, label: `↓ Drops`, count: data.drops.length, color: "#FF6B6B" },
    { key: "new"   as const, label: `★ New`,   count: data.new_keywords.length, color: "#6C5CE7" },
    { key: "lost"  as const, label: `✕ Lost`,  count: data.lost_keywords.length, color: "#B2BAC8" },
    { key: "page1" as const, label: `⚡ Almost Page 1`, count: data.almost_page_1.length, color: "#F5B461" },
  ];

  const rows: Kw[] = tab === "gains" ? data.gains : tab === "drops" ? data.drops : tab === "new" ? data.new_keywords : tab === "lost" ? data.lost_keywords : data.almost_page_1;
  const activeColor = tabs.find((t) => t.key === tab)?.color || "#6C5CE7";

  return (
    <div className="wl">
      <div className="wl-tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`wl-tab ${tab === t.key ? "on" : ""}`}
            style={tab === t.key ? { borderBottomColor: t.color, color: t.color } : {}}
            onClick={() => setTab(t.key)}>
            {t.label} {t.count > 0 && <span className="wl-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="wl-empty">No data yet — run the agents to sync keyword positions.</div>
      ) : (
        <div className="wl-list">
          {rows.map((kw, i) => (
            <div key={i} className="wl-row">
              <div className="wl-row-left">
                <span className="wl-kw">{kw.keyword}</span>
                {kw.search_volume != null && <span className="wl-vol">{kw.search_volume.toLocaleString()} searches/mo</span>}
                {kw.ai_opportunity_reason && <span className="wl-reason">{kw.ai_opportunity_reason}</span>}
              </div>
              <div className="wl-row-right">
                {(kw.current_position != null || kw.position != null) && (
                  <span className="wl-pos">Pos {kw.current_position ?? kw.position}</span>
                )}
                {kw.change != null && (
                  <span className="wl-change" style={{ color: activeColor }}>
                    {tab === "drops" ? `▼ ${kw.change}` : `▲ ${kw.change}`}
                  </span>
                )}
                {tab === "page1" && kw.keyword && (
                  <ActionButton action="boost_page1" brandId={brandId}
                    payload={{ target_keyword: kw.keyword, target_url: kw.landing_page, event_label: "Page 1 boost" }}
                    label="⚡ Boost to Page 1" variant="teal" />
                )}
                {tab === "drops" && kw.keyword && (
                  <ActionButton action="improve_content" brandId={brandId}
                    payload={{ target_keyword: kw.keyword, target_url: kw.landing_page, event_label: "Content improved" }}
                    label="Fix this" variant="ghost" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
