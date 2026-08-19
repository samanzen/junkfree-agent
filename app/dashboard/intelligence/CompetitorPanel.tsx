"use client";
import { useCallback, useEffect, useMemo, useRef, useState, Fragment } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { authedFetch } from "@/lib/authedFetch";
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import Field from "@/app/_components/Field";

type YouReport = {
  domain: string;
  name: string;
  organic_traffic: number | null;
  organic_keywords: number | null;
  backlinks: number | null;
  history: { date: string; organic_traffic: number }[];
};

type Comp = {
  id: string;
  domain: string;
  name: string | null;
  last_keyword_count: number | null;
  last_organic_traffic: number | null;
  last_backlinks: number | null;
  last_common_keywords: number | null;
  last_keyword_gap: number | null;
  last_checked_at: string | null;
};

type KwRow = {
  keyword: string;
  url: string | null;
  volume: number | null;
  position: number;
  etv: number | null;
  cpc: number | null;
  competition: number | null;
  difficulty: number | null;
  brand_position?: number | null;
  competitor_position?: number;
};

const YOU_COLOR = "#FF6A3D";
const COMP_COLORS = ["#F1C40F", "#00B894", "#0984E3", "#6C5CE7", "#E17055", "#00CEC9", "#FD79A8", "#2D3436"];
const PAGE_SIZE = 10;

function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `$${n.toFixed(2)}`;
}

function fmtScore(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  // competition often arrives 0–1 from DataForSEO
  const score = n <= 1 ? Math.round(n * 100) : Math.round(n);
  return String(score);
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CompetitorPanel({ brandId }: { brandId: string }) {
  const [you, setYou] = useState<YouReport | null>(null);
  const [competitors, setCompetitors] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [domain, setDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [suggestions, setSuggestions] = useState<{ domain: string; reason: string; title?: string | null }[]>([]);
  const [suggestQuery, setSuggestQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);

  // Inline expand (Ubersuggest-style master/detail)
  const [expandId, setExpandId] = useState<string | null>(null);
  const [expandTab, setExpandTab] = useState<"common" | "gap">("common");
  const [expandLoading, setExpandLoading] = useState(false);
  const [gaps, setGaps] = useState<KwRow[]>([]);
  const [overlap, setOverlap] = useState<KwRow[]>([]);
  const [page, setPage] = useState(0);
  const autoRefreshTried = useRef(false);

  const load = useCallback(async () => {
    if (!brandId) return;
    setLoading(true);
    try {
      const d = await authedFetch(`/api/intelligence/competitors/report?brand=${brandId}`).then((r) =>
        r.json()
      );
      setYou(d.you || null);
      setCompetitors(d.competitors || []);
    } catch {
      setStatusMsg("Couldn’t load competitor report.");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshReport() {
    setRefreshing(true);
    setStatusMsg("");
    try {
      const r = await authedFetch("/api/intelligence/competitors/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId }),
      }).then((res) => res.json());
      if (r.error) setStatusMsg(r.error);
      else {
        setStatusMsg(r.message || "Report refreshed.");
        await load();
      }
    } catch {
      setStatusMsg("Refresh failed — try again later.");
    }
    setRefreshing(false);
  }

  // Pull live metrics once when the table is empty (after add / first visit).
  useEffect(() => {
    if (loading || refreshing || !competitors.length || autoRefreshTried.current) return;
    const empty = competitors.every(
      (c) =>
        c.last_organic_traffic == null &&
        c.last_backlinks == null &&
        c.last_common_keywords == null &&
        c.last_keyword_gap == null
    );
    if (!empty) return;
    autoRefreshTried.current = true;
    let cancelled = false;
    (async () => {
      setRefreshing(true);
      try {
        const r = await authedFetch("/api/intelligence/competitors/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brand_id: brandId }),
        }).then((res) => res.json());
        if (!cancelled) {
          setStatusMsg(r.message || (r.error ? String(r.error) : "Report refreshed."));
          await load();
        }
      } catch {
        if (!cancelled) setStatusMsg("Couldn’t auto-refresh metrics — click Refresh report.");
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandId, competitors, loading, refreshing, load]);

  useEffect(() => {
    autoRefreshTried.current = false;
  }, [brandId]);

  const trafficBars = useMemo(() => {
    const rows: { name: string; traffic: number; fill: string; you?: boolean }[] = [];
    if (you?.organic_traffic != null && you.organic_traffic > 0) {
      rows.push({
        name: `${you.domain} (You)`,
        traffic: you.organic_traffic,
        fill: YOU_COLOR,
        you: true,
      });
    }
    competitors.forEach((c, i) => {
      if (c.last_organic_traffic != null && c.last_organic_traffic > 0) {
        rows.push({
          name: c.domain,
          traffic: c.last_organic_traffic,
          fill: COMP_COLORS[i % COMP_COLORS.length],
        });
      }
    });
    return rows.sort((a, b) => b.traffic - a.traffic);
  }, [you, competitors]);

  const youHistory = useMemo(() => {
    return (you?.history || [])
      .filter((h) => h.organic_traffic != null && h.organic_traffic > 0)
      .map((h) => ({
        date: h.date,
        label: shortDate(h.date),
        traffic: h.organic_traffic,
      }));
  }, [you]);

  async function add(explicitDomain?: string, confirmed = false) {
    const raw = (explicitDomain || domain).trim();
    if (!raw) return;
    setAdding(true);
    setStatusMsg("");
    if (!confirmed) setSuggestions([]);
    try {
      const res = await authedFetch("/api/intelligence/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          domain: raw,
          confirm: confirmed || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.needs_confirmation && Array.isArray(d.suggestions)) {
        setSuggestions(d.suggestions);
        setSuggestQuery(d.query || raw);
        setStatusMsg(d.message || "Did you mean one of these?");
      } else if (!res.ok) {
        setStatusMsg(d.error || "Couldn’t add that competitor.");
      } else {
        setDomain("");
        setSuggestions([]);
        setSuggestQuery("");
        setStatusMsg(
          d.resolved_domain && d.resolved_domain !== raw
            ? `Added ${d.resolved_domain}.`
            : "Competitor added."
        );
        await load();
      }
    } finally {
      setAdding(false);
    }
  }

  async function discover() {
    setDiscovering(true);
    setStatusMsg("");
    setSuggestions([]);
    try {
      const r = await authedFetch("/api/intelligence/competitors/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId }),
      }).then((res) => res.json());
      const n = (r.discovered || []).length;
      setStatusMsg(
        n
          ? `Found ${n} new competitor${n === 1 ? "" : "s"} in your industry.`
          : r.message || "No new competitors found."
      );
      if (n) await load();
    } catch {
      setStatusMsg("Discovery failed — try again later.");
    }
    setDiscovering(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  function toggleSelectAll() {
    if (selectedIds.length === competitors.length) setSelectedIds([]);
    else setSelectedIds(competitors.map((c) => c.id));
  }

  async function removeSelected() {
    if (!selectedIds.length) return;
    setRemoving(true);
    await Promise.all(
      selectedIds.map((id) => authedFetch(`/api/intelligence/competitors/${id}`, { method: "DELETE" }))
    );
    if (expandId && selectedIds.includes(expandId)) hideAll();
    setSelectedIds([]);
    await load();
    setRemoving(false);
  }

  function exportTableCsv() {
    downloadCsv(`competitors-${you?.domain || "report"}.csv`, [
      ["Competitor Domain", "Common Keywords", "Keywords Gap", "Estimated Traffic", "Backlinks"],
      ...competitors.map((c) => [
        c.domain,
        String(c.last_common_keywords ?? ""),
        String(c.last_keyword_gap ?? ""),
        String(c.last_organic_traffic ?? ""),
        String(c.last_backlinks ?? ""),
      ]),
    ]);
  }

  function hideAll() {
    setExpandId(null);
    setGaps([]);
    setOverlap([]);
    setPage(0);
  }

  async function viewAll(id: string, tab: "common" | "gap") {
    if (expandId === id && expandTab === tab && !expandLoading) {
      hideAll();
      return;
    }
    setExpandId(id);
    setExpandTab(tab);
    setPage(0);
    setExpandLoading(true);
    setGaps([]);
    setOverlap([]);
    try {
      const d = await authedFetch(`/api/intelligence/competitors/${id}`).then((r) => r.json());
      setGaps(d.gaps || []);
      setOverlap(d.overlap || []);
      // Keep summary counts fresh after live fetch
      if (typeof d.common_count === "number" || typeof d.gap_count === "number") {
        setCompetitors((list) =>
          list.map((c) =>
            c.id === id
              ? {
                  ...c,
                  last_common_keywords: d.common_count ?? c.last_common_keywords,
                  last_keyword_gap: d.gap_count ?? c.last_keyword_gap,
                  last_keyword_count: d.total_competitor_keywords ?? c.last_keyword_count,
                }
              : c
          )
        );
      }
    } catch {
      setStatusMsg("Couldn’t load keyword details.");
    }
    setExpandLoading(false);
  }

  const expandRows = expandTab === "common" ? overlap : gaps;
  const pageCount = Math.max(1, Math.ceil(expandRows.length / PAGE_SIZE));
  const pageRows = expandRows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function exportExpandedCsv() {
    const c = competitors.find((x) => x.id === expandId);
    downloadCsv(`${c?.domain || "keywords"}-${expandTab}.csv`, [
      ["Keyword", "URL", "Volume", "Position", "Est. Visits", "CPC", "Paid Difficulty", "SEO Difficulty"],
      ...expandRows.map((k) => [
        k.keyword,
        k.url || "",
        String(k.volume ?? ""),
        String(k.position ?? k.competitor_position ?? ""),
        String(k.etv ?? ""),
        k.cpc != null ? String(k.cpc) : "",
        k.competition != null ? fmtScore(k.competition) : "",
        k.difficulty != null ? fmtScore(k.difficulty) : "",
      ]),
    ]);
  }

  const needsRefresh = competitors.some(
    (c) =>
      c.last_organic_traffic == null &&
      c.last_backlinks == null &&
      c.last_common_keywords == null &&
      c.last_keyword_gap == null
  );

  return (
    <div className="cp">
      <div className="cp-head">
        <div>
          <h3 className="cp-title">Competitor Tracking</h3>
          <p className="cp-sub">Here are the domains that are your competitors.</p>
        </div>
        <div className="cp-head-actions">
          <button
            type="button"
            className="cp-btn cp-btn-ghost"
            onClick={refreshReport}
            disabled={refreshing || !competitors.length}
          >
            {refreshing ? "Refreshing…" : "Refresh report"}
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-primary"
            onClick={() => document.getElementById("cp-add-input")?.focus()}
          >
            + Add Competitors
          </button>
        </div>
      </div>

      <div className="cp-add">
        <Field
          hideLabel
          label="Competitor domain"
          className="cp-input-wrap"
          inputClassName="cp-input"
          id="cp-add-input"
          placeholder="competitor.com or business name"
          value={domain}
          disabled={adding}
          onChange={(e) => {
            setDomain(e.target.value);
            if (suggestions.length) {
              setSuggestions([]);
              setSuggestQuery("");
            }
          }}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="cp-btn cp-btn-primary" onClick={() => add()} disabled={adding}>
          {adding ? "Adding…" : "Add"}
        </button>
        <button className="cp-btn cp-btn-blue" onClick={discover} disabled={discovering}>
          {discovering ? "Discovering…" : "Find competitors"}
        </button>
      </div>
      {suggestions.length > 0 && (
        <div className="cp-suggest">
          <div className="cp-suggest-label">
            Did you mean{suggestQuery ? ` “${suggestQuery}”` : ""}?
          </div>
          <div className="cp-suggest-list">
            {suggestions.map((s) => (
              <button
                key={s.domain}
                type="button"
                className="cp-suggest-btn"
                disabled={adding}
                onClick={() => add(s.domain, true)}
              >
                <strong>{s.domain}</strong>
                {s.title ? <span>{s.title}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}
      {statusMsg && <div className="cp-status">{statusMsg}</div>}
      {needsRefresh && competitors.length > 0 && (
        <div className="cp-hint">
          Metrics look empty — click <strong>Refresh report</strong> to pull traffic, backlinks, and keyword gaps.
        </div>
      )}

      <section className="cp-card">
        <div className="cp-card-head">
          <h4>Organic Traffic</h4>
          {you && (
            <span className="cp-you-pill">
              {you.domain} (You): {fmtNum(you.organic_traffic)}
            </span>
          )}
        </div>
        {loading || refreshing ? (
          <div className="cp-empty">{refreshing ? "Pulling live traffic from DataForSEO…" : "Loading chart…"}</div>
        ) : trafficBars.length === 0 && youHistory.length === 0 ? (
          <div className="cp-empty">
            Add competitors and click <strong>Refresh report</strong> to pull estimated organic traffic.
            We never show fake zeros — empty means metrics haven’t been fetched yet.
          </div>
        ) : (
          <div className="cp-charts">
            {trafficBars.length > 0 && (
              <div className="cp-chart">
                <div className="cp-chart-label">Estimated monthly organic traffic (you vs rivals)</div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trafficBars} margin={{ top: 8, right: 12, left: 0, bottom: 48 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#6B768D" }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9AA3B2" }}
                      tickFormatter={(v) => fmtNum(Number(v))}
                      width={52}
                    />
                    <Tooltip formatter={(value) => [fmtNum(Number(value)), "Est. traffic"]} />
                    <Bar dataKey="traffic" radius={[4, 4, 0, 0]}>
                      {trafficBars.map((r) => (
                        <Cell key={r.name} fill={r.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {youHistory.length > 1 && (
              <div className="cp-chart">
                <div className="cp-chart-label">Your organic traffic over time</div>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={youHistory} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEF1F6" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9AA3B2" }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#9AA3B2" }}
                      tickFormatter={(v) => fmtNum(Number(v))}
                      width={52}
                    />
                    <Tooltip
                      formatter={(value) => [fmtNum(Number(value)), "Your traffic"]}
                      labelFormatter={(_, payload) => {
                        const raw = payload?.[0]?.payload?.date;
                        return raw ? shortDate(String(raw)) : "";
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type="monotone"
                      dataKey="traffic"
                      name={`${you?.domain || "You"} (You)`}
                      stroke={YOU_COLOR}
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
            {trafficBars.length === 0 && youHistory.length > 0 && (
              <div className="cp-hint" style={{ marginTop: 8 }}>
                Rival traffic isn’t loaded yet — click <strong>Refresh report</strong>.
              </div>
            )}
          </div>
        )}
      </section>

      <section className="cp-card">
        <div className="cp-card-head">
          <h4>Tracked Competitors</h4>
          <div className="cp-table-actions">
            <button type="button" className="cp-btn cp-btn-ghost" onClick={exportTableCsv} disabled={!competitors.length}>
              Export
            </button>
            <button
              type="button"
              className="cp-btn cp-btn-danger"
              onClick={removeSelected}
              disabled={!selectedIds.length || removing}
            >
              {removing ? "Removing…" : "Remove Selected"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="cp-empty">Loading competitors…</div>
        ) : competitors.length === 0 ? (
          <div className="cp-empty">No competitors yet. Add a domain or run Find competitors.</div>
        ) : (
          <ResponsiveTable>
            <table className="cp-table">
              <thead>
                <tr>
                  <th className="cp-check-col">
                    <Field
                      as="checkbox"
                      hideLabel
                      label="Select all competitors"
                      className="cp-check-field"
                      checked={selectedIds.length === competitors.length && competitors.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>
                    Competitor Domain <span className="cp-tip" title="Domains you are tracking as rivals.">?</span>
                  </th>
                  <th>
                    Common Keywords{" "}
                    <span className="cp-tip" title="Keywords both you and this competitor rank for.">?</span>
                  </th>
                  <th>
                    Keywords Gap{" "}
                    <span className="cp-tip" title="Keywords they rank for (top 20) that you are not tracking yet.">?</span>
                  </th>
                  <th>
                    Estimated Traffic{" "}
                    <span className="cp-tip" title="Estimated monthly organic visits.">?</span>
                  </th>
                  <th>
                    Backlinks <span className="cp-tip" title="Live backlink count for this domain.">?</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {competitors.map((c, i) => {
                  const on = selectedIds.includes(c.id);
                  const color = COMP_COLORS[i % COMP_COLORS.length];
                  const expanded = expandId === c.id;
                  return (
                    <Fragment key={c.id}>
                      <tr className={on || expanded ? "selected" : undefined}>
                        <td className="cp-check-col">
                          <Field
                            as="checkbox"
                            hideLabel
                            label={`Select ${c.domain}`}
                            className="cp-check-field"
                            checked={on}
                            onChange={() => toggleSelect(c.id)}
                          />
                        </td>
                        <td>
                          <div className="cp-domain-cell">
                            <span className="cp-dot" style={{ background: color }} />
                            <span className="cp-domain">{c.domain}</span>
                          </div>
                        </td>
                        <td>
                          <div className="cp-metric-cell">
                            <span>{fmtNum(c.last_common_keywords)}</span>
                            <button
                              type="button"
                              className={`cp-view-all ${expanded && expandTab === "common" ? "on" : ""}`}
                              onClick={() => viewAll(c.id, "common")}
                            >
                              View All
                            </button>
                          </div>
                        </td>
                        <td>
                          <div className="cp-metric-cell">
                            <span>{fmtNum(c.last_keyword_gap)}</span>
                            <button
                              type="button"
                              className={`cp-view-all ${expanded && expandTab === "gap" ? "on" : ""}`}
                              onClick={() => viewAll(c.id, "gap")}
                            >
                              View All
                            </button>
                          </div>
                        </td>
                        <td className="cp-num">{fmtNum(c.last_organic_traffic)}</td>
                        <td className="cp-num">{fmtNum(c.last_backlinks)}</td>
                      </tr>
                      {expanded && (
                        <tr className="cp-expand-row">
                          <td colSpan={6}>
                            <div className="cp-expand">
                              <div className="cp-expand-tabs">
                                <button
                                  type="button"
                                  className={`cp-tab ${expandTab === "common" ? "on" : ""}`}
                                  onClick={() => {
                                    setExpandTab("common");
                                    setPage(0);
                                  }}
                                >
                                  Common keywords
                                </button>
                                <button
                                  type="button"
                                  className={`cp-tab ${expandTab === "gap" ? "on" : ""}`}
                                  onClick={() => {
                                    setExpandTab("gap");
                                    setPage(0);
                                  }}
                                >
                                  Keywords gap
                                </button>
                              </div>

                              {expandLoading ? (
                                <div className="cp-empty">Loading keywords…</div>
                              ) : expandRows.length === 0 ? (
                                <div className="cp-empty">
                                  {expandTab === "common"
                                    ? "No shared keywords found yet."
                                    : "No clear keyword gaps found yet."}
                                </div>
                              ) : (
                                <>
                                  <table className="cp-kw-table">
                                    <thead>
                                      <tr>
                                        <th>Keyword</th>
                                        <th>Volume</th>
                                        <th>Position</th>
                                        {expandTab === "common" && <th>You</th>}
                                        <th>Est. Visits</th>
                                        <th>CPC</th>
                                        <th>Paid Difficulty</th>
                                        <th>SEO Difficulty</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {pageRows.map((k) => (
                                        <tr key={k.keyword}>
                                          <td>
                                            <div className="cp-kw">{k.keyword}</div>
                                            {k.url && (
                                              <a
                                                className="cp-kw-url"
                                                href={k.url.startsWith("http") ? k.url : `https://${k.url}`}
                                                target="_blank"
                                                rel="noreferrer"
                                              >
                                                {k.url.replace(/^https?:\/\//, "")}
                                              </a>
                                            )}
                                          </td>
                                          <td>{fmtNum(k.volume)}</td>
                                          <td>#{k.position ?? k.competitor_position}</td>
                                          {expandTab === "common" && (
                                            <td>{k.brand_position != null ? `#${k.brand_position}` : "—"}</td>
                                          )}
                                          <td>{fmtNum(k.etv)}</td>
                                          <td>{fmtMoney(k.cpc)}</td>
                                          <td>{fmtScore(k.competition)}</td>
                                          <td>{fmtScore(k.difficulty)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>

                                  <div className="cp-expand-foot">
                                    <div className="cp-pager">
                                      {Array.from({ length: pageCount }, (_, pi) => (
                                        <button
                                          key={pi}
                                          type="button"
                                          className={`cp-page ${page === pi ? "on" : ""}`}
                                          onClick={() => setPage(pi)}
                                        >
                                          {pi + 1}
                                        </button>
                                      ))}
                                    </div>
                                    <div className="cp-expand-actions">
                                      <button type="button" className="cp-btn cp-btn-ghost" onClick={exportExpandedCsv}>
                                        Export All to CSV
                                      </button>
                                      <button type="button" className="cp-btn cp-btn-primary" onClick={hideAll}>
                                        Hide All
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </section>
    </div>
  );
}
