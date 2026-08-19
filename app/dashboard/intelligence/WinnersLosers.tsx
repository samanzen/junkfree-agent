"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import DataStatus, { type DataStatusKind } from "./DataStatus";
import RankChange from "../_components/RankChange";

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
  summary?: {
    moved_up: number;
    moved_down: number;
    unchanged: number;
    newly_ranking: number;
    almost_page_1: number;
  };
  compared?: { current_date: string | null; previous_date: string | null; days?: number };
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "the start of this period";
  return new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function shortUrl(u: string | null | undefined): string {
  if (!u) return "";
  try {
    const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname.replace(/^www\./, "")}${path}`.slice(0, 52);
  } catch {
    return u.slice(0, 52);
  }
}

function plainLine(tab: string, kw: Kw): string {
  if (tab === "gains") return "Moved up — more people can find you for this search.";
  if (tab === "drops") return "Slipped. Fix these in AI Recommendations → Issues.";
  if (tab === "new") return "New ranking — you weren’t showing for this before.";
  if (tab === "lost" && kw.last_position != null) {
    return `Used to rank around #${Math.round(kw.last_position)}, now missing from recent results.`;
  }
  if (tab === "page1") return "One push from Google’s first page. Push in AI Recommendations → Almost page 1.";
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
    { key: "drops" as const, label: "Slipped", count: data.drops.length, color: "#E17055" },
    { key: "new" as const, label: "Newly ranking", count: data.new_keywords.length, color: "#6C5CE7" },
    { key: "lost" as const, label: "Stopped ranking", count: data.lost_keywords.length, color: "#94A3B8" },
    { key: "page1" as const, label: "Almost page 1", count: data.almost_page_1.length, color: "#F5A623" },
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

  return (
    <div className="wl">
      <div className="wl-cards">
        <div className="wl-card up">
          <div className="wl-card-label">Moved up</div>
          <div className="wl-card-n">
            <span>▲</span> {data.summary?.moved_up ?? data.gains.length}
          </div>
        </div>
        <div className="wl-card down">
          <div className="wl-card-label">Moved down</div>
          <div className="wl-card-n">
            <span>▼</span> {data.summary?.moved_down ?? data.drops.length}
          </div>
        </div>
        <div className="wl-card flat">
          <div className="wl-card-label">Unchanged</div>
          <div className="wl-card-n">{data.summary?.unchanged ?? "—"}</div>
        </div>
      </div>

      <p className="wl-intro">
        Read-only change report from <strong>{fmtDate(data.compared?.previous_date)}</strong> to{" "}
        <strong>{fmtDate(data.compared?.current_date)}</strong>
        {data.compared?.days ? ` (last ${data.compared.days} days)` : ""}. To fix slips or push almost-page-1
        terms, use <strong>AI Recommendations</strong>.
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
            <div key={i} className={`wl-row tone-${tab}`}>
              <div className="wl-row-left">
                <span className="wl-kw">{kw.keyword}</span>
                <span className="wl-plain">{plainLine(tab, kw)}</span>
                <div className="wl-meta-row">
                  {kw.search_volume != null && (
                    <span className="wl-vol">~{kw.search_volume.toLocaleString()} searches / month</span>
                  )}
                  {kw.landing_page && (
                    <a
                      className="wl-url"
                      href={
                        kw.landing_page.startsWith("http") ? kw.landing_page : `https://${kw.landing_page}`
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      {shortUrl(kw.landing_page)}
                    </a>
                  )}
                </div>
              </div>
              <div className="wl-row-right">
                {(tab === "gains" || tab === "drops") &&
                kw.previous_position != null &&
                kw.current_position != null ? (
                  <RankChange
                    previous={kw.previous_position}
                    current={kw.current_position}
                    change={kw.change}
                    direction={tab === "gains" ? "up" : "down"}
                    label="Google ranking"
                  />
                ) : (
                  <RankChange
                    current={kw.current_position ?? kw.position ?? kw.last_position}
                    label="Google ranking"
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
