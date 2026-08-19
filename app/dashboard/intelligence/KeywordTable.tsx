"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { authedFetch } from "@/lib/authedFetch";
import ActionButton from "./ActionButton";
import DataStatus, { type DataStatusKind } from "./DataStatus";
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import { useChartTouch } from "@/lib/ui/useChartTouch";
import { useDialog } from "@/lib/ui/useDialog";
import Field from "@/app/_components/Field";
import RankChange from "../_components/RankChange";

type Kw = {
  id: string;
  keyword: string;
  status: string;
  position: number | null;
  previous_position?: number | null;
  change?: number | null;
  best_position: number | null;
  worst_position: number | null;
  search_volume: number | null;
  keyword_difficulty: number | null;
  search_intent: string | null;
  cpc: number | null;
  landing_page: string | null;
  clicks: number | null;
  impressions: number | null;
  ctr: number | null;
  ai_opportunity_score: number | null;
  ai_opportunity_reason: string | null;
  estimated_monthly_clicks: number | null;
  estimated_revenue_impact: string | null;
  first_seen_date: string | null;
  enriched_at: string | null;
};

type Summary = {
  moved_up: number;
  moved_down: number;
  unchanged: number;
  newly_ranking: number;
  almost_page_1: number;
  tracked: number;
};

function shortUrl(u: string | null | undefined): string {
  if (!u) return "";
  try {
    const parsed = new URL(u.startsWith("http") ? u : `https://${u}`);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname.replace(/^www\./, "")}${path}`.slice(0, 48);
  } catch {
    return u.slice(0, 48);
  }
}

function difficultyTone(d: number): string {
  if (d <= 30) return "#00B894";
  if (d <= 60) return "#F5B461";
  return "#FF6B6B";
}

function posTone(p: number): { bg: string; color: string } {
  if (p <= 3) return { bg: "rgba(0,184,148,.12)", color: "#00B894" };
  if (p <= 10) return { bg: "rgba(255,106,61,.12)", color: "#E85A2E" };
  if (p <= 20) return { bg: "rgba(245,166,35,.15)", color: "#D97706" };
  return { bg: "rgba(99,102,241,.1)", color: "#6366F1" };
}

type MovementFilter = "up" | "down" | "unchanged" | "almost";

export default function KeywordTable({ brandId, days = 30 }: { brandId: string; days?: number }) {
  const [keywords, setKeywords] = useState<Kw[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("keyword");
  const [order, setOrder] = useState<"desc" | "asc">("asc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [movementFilters, setMovementFilters] = useState<MovementFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Kw | null>(null);
  const [addKw, setAddKw] = useState("");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<DataStatusKind>("ok");
  const [summary, setSummary] = useState<Summary | null>(null);
  const limit = 50;

  useEffect(() => {
    if (!brandId) return;
    Promise.all([
      authedFetch(`/api/intelligence/overview?brand=${brandId}&days=${days}`).then((r) => r.json()),
      authedFetch(`/api/intelligence/winners-losers?brand=${brandId}&days=${days}`).then((r) => r.json()),
    ])
      .then(([ov, wl]) => {
        setStatus(ov?.status || "ok");
        if (wl?.summary) setSummary(wl.summary);
      })
      .catch(() => {});
  }, [brandId, days]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      brand: brandId,
      sort,
      order,
      search,
      page: String(page),
      limit: String(limit),
      days: String(days),
    });
    if (statusFilter) params.set("status", statusFilter);
    if (movementFilters.length) params.set("movement", movementFilters.join(","));
    authedFetch(`/api/intelligence/keywords?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setKeywords(d.keywords || []);
        setTotal(d.total || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, sort, order, search, page, statusFilter, movementFilters, days]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleMovement(key: MovementFilter) {
    setMovementFilters((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setPage(1);
  }

  async function addKeyword() {
    if (!addKw.trim()) return;
    setAdding(true);
    await authedFetch("/api/intelligence/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand_id: brandId, keyword: addKw.trim() }),
    });
    setAddKw("");
    setAdding(false);
    load();
  }

  function sortBy(col: string) {
    if (sort === col) setOrder(order === "desc" ? "asc" : "desc");
    else {
      setSort(col);
      setOrder(col === "keyword" ? "asc" : "desc");
    }
    setPage(1);
  }

  function exportCsv() {
    const rows = [
      ["Position", "Keyword", "Previous", "Change", "Volume", "SEO Difficulty", "URL", "Status"],
      ...keywords.map((k) => [
        String(k.position ?? ""),
        k.keyword,
        String(k.previous_position ?? ""),
        String(k.change ?? ""),
        String(k.search_volume ?? ""),
        String(k.keyword_difficulty ?? ""),
        k.landing_page || "",
        k.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tracked-keywords.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const Th = ({ col, label, tip }: { col: string; label: string; tip?: string }) => {
    const active = sort === col;
    return (
      <th className="kt-th" aria-sort={active ? (order === "desc" ? "descending" : "ascending") : "none"}>
        <button type="button" className="kt-sort" onClick={() => sortBy(col)} data-touch="inline">
          {label}
          {tip && (
            <span className="kt-tip" title={tip}>
              ?
            </span>
          )}
          <span aria-hidden="true" className="kt-sort-arrow">
            {active ? (order === "desc" ? "↓" : "↑") : ""}
          </span>
        </button>
      </th>
    );
  };

  const rankBuckets = useMemo(() => {
    const top3 = keywords.filter((k) => k.position != null && k.position <= 3).length;
    const top10 = keywords.filter((k) => k.position != null && k.position > 3 && k.position <= 10).length;
    const top100 = keywords.filter((k) => k.position != null && k.position > 10 && k.position <= 100).length;
    const none = keywords.filter((k) => k.position == null || k.position > 100).length;
    return { top3, top10, top100, none };
  }, [keywords]);

  return (
    <div className="kt">
      <div className="kt-head">
        <div>
          <h3 className="kt-title">Rank Tracking</h3>
          <p className="kt-sub">
            Position, change, and the exact page ranking — last {days} days for movement cards.
          </p>
        </div>
        <span className="kt-count-pill">{total.toLocaleString()} tracked</span>
      </div>

      <div className="kt-cards" role="group" aria-label="Filter keywords by movement">
        {(
          [
            {
              key: "up" as const,
              label: "Keywords moved up",
              value: summary?.moved_up,
              className: "up",
              arrow: "▲",
            },
            {
              key: "down" as const,
              label: "Keywords moved down",
              value: summary?.moved_down,
              className: "down",
              arrow: "▼",
            },
            {
              key: "unchanged" as const,
              label: "Keywords unchanged",
              value: summary?.unchanged,
              className: "flat",
            },
            {
              key: "almost" as const,
              label: "Almost page 1",
              value: summary?.almost_page_1,
              className: "almost",
              hint: "Positions 11–20 — unique to your reports",
            },
          ] as const
        ).map((card) => {
          const on = movementFilters.includes(card.key);
          return (
            <button
              key={card.key}
              type="button"
              className={`kt-card ${card.className}${on ? " on" : ""}`}
              aria-pressed={on}
              onClick={() => toggleMovement(card.key)}
            >
              <div className="kt-card-top">
                <div className="kt-card-label">{card.label}</div>
                <span className={`kt-card-check${on ? " on" : ""}`} aria-hidden="true">
                  {on ? "✓" : ""}
                </span>
              </div>
              <div className="kt-card-n">
                {"arrow" in card && card.arrow ? <span className="kt-card-arrow">{card.arrow}</span> : null}
                {card.value ?? "—"}
              </div>
              {"hint" in card && card.hint ? <div className="kt-card-hint">{card.hint}</div> : null}
            </button>
          );
        })}
      </div>
      {movementFilters.length > 0 && (
        <div className="kt-filter-note">
          Showing {total.toLocaleString()} keyword{total === 1 ? "" : "s"} matching selected cards.{" "}
          <button type="button" className="kt-clear-filters" onClick={() => { setMovementFilters([]); setPage(1); }}>
            Clear filters
          </button>
        </div>
      )}

      <div className="kt-buckets">
        <span className="kt-bucket">
          <i style={{ background: "#00CEC9" }} /> Top 3 <b>{rankBuckets.top3}</b>
        </span>
        <span className="kt-bucket">
          <i style={{ background: "#F1C40F" }} /> Top 10 <b>{rankBuckets.top10}</b>
        </span>
        <span className="kt-bucket">
          <i style={{ background: "#74B9FF" }} /> Top 100 <b>{rankBuckets.top100}</b>
        </span>
        <span className="kt-bucket">
          <i style={{ background: "#FD79A8" }} /> Not ranking <b>{rankBuckets.none}</b>
        </span>
        <span className="kt-bucket-note">on this page · open Visibility for full site mix</span>
      </div>

      <div className="kt-toolbar">
        <button type="button" className="kt-btn kt-btn-primary" onClick={() => document.getElementById("kt-add-input")?.focus()}>
          + Add Keywords
        </button>
        <button type="button" className="kt-btn kt-btn-ghost" onClick={exportCsv} disabled={!keywords.length}>
          Export to CSV
        </button>
        <Field
          hideLabel
          label="Search keywords"
          type="search"
          className="kt-search-wrap"
          inputClassName="kt-search"
          placeholder="Search keywords…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Field
          as="select"
          hideLabel
          label="Filter by status"
          inputClassName="kt-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {["improving", "stable", "declining", "new", "recovered"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Field>
        <div className="kt-add">
          <Field
            hideLabel
            label="Add a keyword to track"
            className="kt-search-wrap"
            inputClassName="kt-search"
            id="kt-add-input"
            placeholder="Add keyword…"
            value={addKw}
            disabled={adding}
            onChange={(e) => setAddKw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()}
          />
          <button
            className="kt-add-btn"
            onClick={addKeyword}
            disabled={adding}
            data-busy={adding || undefined}
            aria-label="Add keyword"
          >
            <span>+</span>
          </button>
        </div>
      </div>

      <div className="kt-table-card">
        <div className="kt-table-label">Tracked Keywords [{total}]</div>
        <ResponsiveTable>
          <table className="kt-table">
            <thead>
              <tr>
                <Th col="best_position" label="Position" tip="Current Google rank for this keyword." />
                <Th col="keyword" label="Keyword" tip="The search term we track for you." />
                <th className="kt-th">
                  Change <span className="kt-tip" title="Movement since the previous ranking check.">?</span>
                </th>
                <Th col="search_volume" label="Vol" tip="Estimated monthly searches." />
                <Th col="keyword_difficulty" label="SEO Difficulty" tip="How hard it is to rank (0–100)." />
                <th className="kt-th">
                  URL <span className="kt-tip" title="The page that currently ranks for this keyword.">?</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(8)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="kt-skel-row">
                      <div className="kt-skel" />
                    </td>
                  </tr>
                ))
              ) : keywords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="kt-empty">
                    {status === "ok" && !search && !statusFilter ? (
                      "No keywords found. Run agents or add one above."
                    ) : status !== "ok" && !search && !statusFilter ? (
                      <DataStatus status={status} />
                    ) : (
                      "No keywords match this filter."
                    )}
                  </td>
                </tr>
              ) : (
                keywords.map((kw) => {
                  const tone = kw.position != null ? posTone(kw.position) : null;
                  return (
                    <tr
                      key={kw.id}
                      className="kt-row"
                      tabIndex={0}
                      aria-label={`Open details for ${kw.keyword}`}
                      onClick={() => setSelected(kw)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(kw);
                        }
                      }}
                    >
                      <td className="kt-td kt-center">
                        {kw.position != null && tone ? (
                          <span className="kt-pos-badge" style={{ background: tone.bg, color: tone.color }}>
                            {kw.position}
                          </span>
                        ) : (
                          <span className="kt-dash">No data</span>
                        )}
                      </td>
                      <td className="kt-td">
                        <div className="kt-kw">{kw.keyword}</div>
                        <div className="kt-kw-meta">
                          {kw.search_intent ? `${kw.search_intent} · ` : ""}
                          {kw.status}
                        </div>
                      </td>
                      <td className="kt-td">
                        {kw.change != null && kw.previous_position != null && kw.position != null ? (
                          <RankChange
                            previous={kw.previous_position}
                            current={kw.position}
                            change={kw.change}
                            label=""
                            size="sm"
                          />
                        ) : kw.position != null ? (
                          <RankChange current={kw.position} label="" size="sm" />
                        ) : (
                          <span className="kt-dash">—</span>
                        )}
                      </td>
                      <td className="kt-td kt-center">
                        {kw.search_volume?.toLocaleString() ?? <span className="kt-dash">—</span>}
                      </td>
                      <td className="kt-td">
                        {kw.keyword_difficulty != null ? (
                          <div className="kt-diff">
                            <div className="kt-diff-track">
                              <div
                                className="kt-diff-fill"
                                style={{
                                  width: `${kw.keyword_difficulty}%`,
                                  background: difficultyTone(kw.keyword_difficulty),
                                }}
                              />
                            </div>
                            <span>{kw.keyword_difficulty}</span>
                            {kw.enriched_at && (
                              <span className="kt-diff-when" title={new Date(kw.enriched_at).toLocaleString()}>
                                {Date.now() - new Date(kw.enriched_at).getTime() < 864e5 * 7 ? "✓" : "↻"}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="kt-dash">—</span>
                        )}
                      </td>
                      <td className="kt-td">
                        {kw.landing_page ? (
                          <a
                            className="kt-url"
                            href={kw.landing_page.startsWith("http") ? kw.landing_page : `https://${kw.landing_page}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {shortUrl(kw.landing_page)}
                          </a>
                        ) : (
                          <span className="kt-dash">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ResponsiveTable>
      </div>

      {total > limit && (
        <div className="kt-pages">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="kt-page-btn">
            ← Prev
          </button>
          <span className="kt-page-info">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            disabled={page >= Math.ceil(total / limit)}
            onClick={() => setPage(page + 1)}
            className="kt-page-btn"
          >
            Next →
          </button>
        </div>
      )}

      {selected && <KeywordDrawer kw={selected} brandId={brandId} onClose={() => setSelected(null)} />}
    </div>
  );
}

function KeywordDrawer({ kw, brandId, onClose }: { kw: Kw; brandId: string; onClose: () => void }) {
  const t = useChartTouch();
  const dialogRef = useDialog<HTMLDivElement>({ open: true, onClose });
  const [range, setRange] = useState("30");
  const [history, setHistory] = useState<
    { captured_date: string; position: number; clicks: number; impressions: number; ctr: number }[]
  >([]);
  const [events, setEvents] = useState<{ occurred_at: string; event_label: string; event_type: string }[]>([]);
  const [metric, setMetric] = useState<"position" | "clicks" | "impressions" | "ctr">("position");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authedFetch(
      `/api/intelligence/keyword-history?brand=${brandId}&keyword=${encodeURIComponent(kw.keyword)}&range=${range}`
    )
      .then((r) => r.json())
      .then((d) => {
        setHistory(d.history || []);
        setEvents(d.events || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, kw.keyword, range]);

  const chartData = history.map((h) => {
    const event = events.find((e) => e.occurred_at.slice(0, 10) === h.captured_date);
    return {
      date: new Date(h.captured_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value:
        metric === "ctr"
          ? Math.round(h.ctr * 1000) / 10
          : metric === "position"
            ? h.position
            : metric === "clicks"
              ? h.clicks
              : h.impressions,
      event: event?.event_label,
    };
  });

  const metricColor = { position: "#FF6A3D", clicks: "#00B894", impressions: "#0984E3", ctr: "#E84393" };

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 200 }}
      />
      <div
        ref={dialogRef}
        className="kd"
        role="dialog"
        aria-modal="true"
        aria-label={`Keyword detail: ${kw.keyword}`}
      >
        <div className="kd-head">
          <div>
            <div className="kd-kw">{kw.keyword}</div>
            <div className="kd-sub">
              {kw.position != null && <span>Pos {kw.position}</span>}
              {kw.search_volume != null && <span> · {kw.search_volume.toLocaleString()} searches/mo</span>}
              {kw.landing_page && <span> · {shortUrl(kw.landing_page)}</span>}
            </div>
          </div>
          <button onClick={onClose} className="kd-close">
            ✕
          </button>
        </div>

        {(kw.previous_position != null || kw.position != null) && (
          <div className="kd-rank">
            <RankChange
              previous={kw.previous_position}
              current={kw.position}
              change={kw.change}
              label="Google ranking"
            />
          </div>
        )}

        <div className="kd-mtabs">
          {(["position", "clicks", "impressions", "ctr"] as const).map((m) => (
            <button
              key={m}
              className={`kd-mtab ${metric === m ? "on" : ""}`}
              style={metric === m ? { borderBottomColor: metricColor[m], color: metricColor[m] } : {}}
              onClick={() => setMetric(m)}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
          <div className="kd-range">
            {["7", "30", "90", "180", "365"].map((r) => (
              <button key={r} className={`kd-rbtn ${range === r ? "on" : ""}`} onClick={() => setRange(r)}>
                {r}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="kd-loading">Loading history…</div>
        ) : chartData.length === 0 ? (
          <div className="kd-empty">No historical data yet — data builds up as the platform syncs daily.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
              <XAxis {...t.xAxis} dataKey="date" tick={{ fill: "#9AA3B2", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: "#9AA3B2", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                reversed={metric === "position"}
              />
              <Tooltip
                {...t.tooltip}
                contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 8, fontSize: 11 }}
                formatter={(v: unknown) => {
                  const n = v as number;
                  return [metric === "ctr" ? `${n}%` : metric === "position" ? `#${n}` : n.toLocaleString()];
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={metricColor[metric]}
                strokeWidth={2.5}
                dot={false}
                animationDuration={600}
              />
            </LineChart>
          </ResponsiveContainer>
        )}

        <div className="kd-meta">
          <div className="kd-meta-grid">
            {[
              { label: "Best ever", val: kw.best_position != null ? `#${kw.best_position}` : "–" },
              { label: "Worst ever", val: kw.worst_position != null ? `#${kw.worst_position}` : "–" },
              {
                label: "Difficulty",
                val: kw.keyword_difficulty != null ? `${kw.keyword_difficulty}/100` : "–",
              },
              { label: "CPC", val: kw.cpc != null ? `$${kw.cpc}` : "–" },
              {
                label: "Est. clicks",
                val: kw.estimated_monthly_clicks != null ? `${kw.estimated_monthly_clicks}/mo at #1` : "–",
              },
              { label: "AI score", val: kw.ai_opportunity_score != null ? String(kw.ai_opportunity_score) : "–" },
            ].map((m) => (
              <div key={m.label} className="kd-meta-item">
                <span className="kd-meta-label">{m.label}</span>
                <span className="kd-meta-val">{m.val}</span>
              </div>
            ))}
          </div>
          {kw.ai_opportunity_reason && (
            <div className="kd-ai-reason">
              <span style={{ color: "#FF6A3D", fontWeight: 700, fontSize: 11 }}>✦ AI</span> {kw.ai_opportunity_reason}
            </div>
          )}
        </div>

        <div className="kd-actions">
          {kw.position != null && kw.position >= 11 && kw.position <= 20 && (
            <ActionButton
              action="boost_page1"
              brandId={brandId}
              payload={{ target_keyword: kw.keyword, target_url: kw.landing_page, event_label: "Page 1 boost" }}
              label="⚡ Boost to Page 1"
            />
          )}
          <ActionButton
            action="improve_content"
            brandId={brandId}
            payload={{ target_keyword: kw.keyword, target_url: kw.landing_page, event_label: "Content improved" }}
            label="Improve content"
            variant="ghost"
          />
          <ActionButton
            action="fix_meta"
            brandId={brandId}
            payload={{ target_keyword: kw.keyword, target_url: kw.landing_page, event_label: "Meta updated" }}
            label="Fix meta"
            variant="ghost"
          />
        </div>
      </div>
    </>
  );
}
