"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import ActionButton from "./ActionButton";
import DataStatus, { type DataStatusKind } from "./DataStatus";

type Kw = {
  keyword: string;
  current_position?: number;
  previous_position?: number;
  change?: number;
  position?: number;
  last_position?: number;
  search_volume?: number;
  ai_opportunity_reason?: string;
  landing_page?: string;
};
type Data = {
  gains: Kw[];
  drops: Kw[];
  new_keywords: Kw[];
  lost_keywords: Kw[];
  almost_page_1: Kw[];
  compared?: { current_date: string | null; previous_date: string | null; days?: number };
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "the start of this period";
  return new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function plainLine(tab: string, kw: Kw): string {
  if (tab === "gains" && kw.previous_position != null && kw.current_position != null) {
    return `Moved up from #${kw.previous_position} to #${kw.current_position} — more people can find you for this search.`;
  }
  if (tab === "drops" && kw.previous_position != null && kw.current_position != null) {
    return `Slipped from #${kw.previous_position} to #${kw.current_position}. Worth a closer look.`;
  }
  if (tab === "new" && kw.position != null) {
    return `New ranking at #${kw.position} — you weren’t showing for this before.`;
  }
  if (tab === "lost" && kw.last_position != null) {
    return `Used to rank around #${kw.last_position}, now missing from recent results.`;
  }
  if (tab === "page1" && kw.position != null) {
    return `Sitting at #${kw.position} — one push could put this on Google’s first page.`;
  }
  return kw.ai_opportunity_reason || "";
}

export default function WinnersLosers({ brandId, days = 30 }: { brandId: string; days?: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<DataStatusKind>("ok");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"gains" | "drops" | "new" | "lost" | "page1">("gains");

  useEffect(() => {
    if (!brandId) return;
    setLoading(true);
    Promise.all([
      authedFetch(`/api/intelligence/winners-losers?brand=${brandId}&days=${days}`).then((r) => r.json()),
      authedFetch(`/api/intelligence/overview?brand=${brandId}&days=${days}`).then((r) => r.json()).catch(() => null),
    ])
      .then(([d, ov]) => {
        setData(d);
        setStatus(ov?.status || "ok");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, days]);

  if (loading) return <div className="wl-loading">Writing your change report…</div>;
  if (!data) return null;

  const totalRows =
    data.gains.length +
    data.drops.length +
    data.new_keywords.length +
    data.lost_keywords.length +
    data.almost_page_1.length;
  if (totalRows === 0 && status !== "ok") return <DataStatus status={status} />;

  const tabs = [
    { key: "gains" as const, label: "Moved up", count: data.gains.length, color: "#00B894" },
    { key: "drops" as const, label: "Slipped", count: data.drops.length, color: "#FF6B6B" },
    { key: "new" as const, label: "Newly ranking", count: data.new_keywords.length, color: "#4F46E5" },
    { key: "lost" as const, label: "Stopped ranking", count: data.lost_keywords.length, color: "#B2BAC8" },
    { key: "page1" as const, label: "Almost page 1", count: data.almost_page_1.length, color: "#D97706" },
  ];

  const rows: Kw[] =
    tab === "gains"
      ? data.gains
      : tab === "drops"
        ? data.drops
        : tab === "new"
          ? data.new_keywords
          : tab === "lost"
            ? data.lost_keywords
            : data.almost_page_1;
  const activeColor = tabs.find((t) => t.key === tab)?.color || "#4F46E5";

  return (
    <div className="wl">
      <p className="wl-intro">
        This is a plain-English report of ranking changes from{" "}
        <strong>{fmtDate(data.compared?.previous_date)}</strong> to{" "}
        <strong>{fmtDate(data.compared?.current_date)}</strong>.
        {data.compared?.days ? ` (last ${data.compared.days} days)` : ""} The AI already did the work —
        use this to see what improved, what slipped, and what is close to page 1.
      </p>
      <div className="wl-tabs">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`wl-tab ${tab === t.key ? "on" : ""}`}
            style={tab === t.key ? { borderBottomColor: t.color, color: t.color } : {}}
            onClick={() => setTab(t.key)}
          >
            {t.label} {t.count > 0 && <span className="wl-count">{t.count}</span>}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="wl-empty">
          {data.compared?.previous_date
            ? "Nothing big moved in this period — check again after the next ranking update."
            : "We need at least two ranking updates in this period before a change report can be written."}
        </div>
      ) : (
        <div className="wl-list">
          {rows.map((kw, i) => (
            <div key={i} className="wl-row">
              <div className="wl-row-left">
                <span className="wl-kw">{kw.keyword}</span>
                <span className="wl-plain">{plainLine(tab, kw)}</span>
                {kw.search_volume != null && (
                  <span className="wl-vol">~{kw.search_volume.toLocaleString()} searches / month</span>
                )}
                {kw.ai_opportunity_reason && tab !== "gains" && tab !== "drops" && (
                  <span className="wl-reason">{kw.ai_opportunity_reason}</span>
                )}
              </div>
              <div className="wl-row-right">
                {(kw.current_position != null || kw.position != null) && (
                  <span className="wl-pos">Now #{kw.current_position ?? kw.position}</span>
                )}
                {kw.change != null && (
                  <span className="wl-change" style={{ color: activeColor }}>
                    {tab === "drops" ? `▼ ${kw.change}` : `▲ ${kw.change}`}
                  </span>
                )}
                {tab === "page1" && kw.keyword && (
                  <ActionButton
                    action="boost_page1"
                    brandId={brandId}
                    payload={{
                      target_keyword: kw.keyword,
                      target_url: kw.landing_page,
                      event_label: "Page 1 boost",
                    }}
                    label="Ask AI to push this"
                    variant="teal"
                  />
                )}
                {tab === "drops" && kw.keyword && (
                  <ActionButton
                    action="improve_content"
                    brandId={brandId}
                    payload={{
                      target_keyword: kw.keyword,
                      target_url: kw.landing_page,
                      event_label: "Content improved",
                    }}
                    label="Ask AI to fix"
                    variant="ghost"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
