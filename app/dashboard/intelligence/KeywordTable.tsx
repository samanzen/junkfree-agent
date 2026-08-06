"use client";
import { useCallback, useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { authedFetch } from "@/lib/authedFetch";
import ActionButton from "./ActionButton";
import MetricExplainer from "./MetricExplainer";
import DataStatus, { type DataStatusKind } from "./DataStatus";
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import { useChartTouch } from "@/lib/ui/useChartTouch";
import { useDialog } from "@/lib/ui/useDialog";
import Field from "@/app/_components/Field";

type Kw = {
  id: string; keyword: string; status: string;
  position: number|null; best_position: number|null; worst_position: number|null;
  search_volume: number|null; keyword_difficulty: number|null; search_intent: string|null;
  cpc: number|null; landing_page: string|null;
  clicks: number|null; impressions: number|null; ctr: number|null;
  ai_opportunity_score: number|null; ai_opportunity_reason: string|null;
  estimated_monthly_clicks: number|null; estimated_revenue_impact: string|null;
  first_seen_date: string|null; enriched_at: string|null;
};

const STATUS_COLOR: Record<string, string> = {
  improving: "#00B894", stable: "#F5B461", declining: "#FF6B6B", new: "#6C5CE7", lost: "#B2BAC8", recovered: "#00CEC9",
};
const INTENT_COLOR: Record<string, string> = {
  commercial: "#6C5CE7", transactional: "#00B894", informational: "#0984E3", navigational: "#9AA3B2",
};

export default function KeywordTable({ brandId }: { brandId: string }) {
  const [keywords, setKeywords] = useState<Kw[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("ai_opportunity_score");
  const [order, setOrder] = useState<"desc"|"asc">("desc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Kw | null>(null);
  const [addKw, setAddKw] = useState("");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState<DataStatusKind>("ok");
  const limit = 50;

  useEffect(() => {
    if (!brandId) return;
    authedFetch(`/api/intelligence/overview?brand=${brandId}`)
      .then((r) => r.json())
      .then((ov) => setStatus(ov?.status || "ok"))
      .catch(() => {});
  }, [brandId]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ brand: brandId, sort, order, search, page: String(page), limit: String(limit) });
    if (statusFilter) params.set("status", statusFilter);
    authedFetch(`/api/intelligence/keywords?${params}`)
      .then((r) => r.json())
      .then((d) => { setKeywords(d.keywords || []); setTotal(d.total || 0); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brandId, sort, order, search, page, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function addKeyword() {
    if (!addKw.trim()) return;
    setAdding(true);
    await authedFetch("/api/intelligence/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand_id: brandId, keyword: addKw.trim() }),
    });
    setAddKw(""); setAdding(false); load();
  }

  function sortBy(col: string) {
    if (sort === col) setOrder(order === "desc" ? "asc" : "desc");
    else { setSort(col); setOrder("desc"); }
    setPage(1);
  }

  const Th = ({ col, label }: { col: string; label: string }) => (
    <th className="kt-th" onClick={() => sortBy(col)} style={{ cursor: "pointer", userSelect: "none" as const }}>
      {label} {sort === col && <span style={{ color: "#6C5CE7" }}>{order === "desc" ? "↓" : "↑"}</span>}
    </th>
  );

  return (
    <div className="kt">
      {/* Toolbar */}
      <div className="kt-toolbar">
        {/* Labels are hidden visually — the toolbar has no room for them and
            the placeholders read fine — but they exist for screen readers,
            which a placeholder alone never gave. */}
        <Field
          hideLabel label="Search keywords" type="search"
          className="kt-search-wrap" inputClassName="kt-search"
          placeholder="Search keywords…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <Field
          as="select" hideLabel label="Filter by status" inputClassName="kt-filter"
          value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {["improving","stable","declining","new","recovered"].map((s) => <option key={s} value={s}>{s}</option>)}
        </Field>
        <div className="kt-add">
          <Field
            hideLabel label="Add a keyword to track"
            className="kt-search-wrap" inputClassName="kt-search"
            placeholder="Add keyword…" value={addKw} disabled={adding}
            onChange={(e) => setAddKw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addKeyword()} />
          <button
            className="kt-add-btn" onClick={addKeyword} disabled={adding}
            data-busy={adding || undefined} aria-label="Add keyword"
          ><span>+</span></button>
        </div>
        <span className="kt-count">{total.toLocaleString()} keywords</span>
      </div>

      {/* Table */}
      <ResponsiveTable>
        <table className="kt-table">
          <thead>
            <tr>
              <Th col="keyword" label="Keyword" />
              <Th col="best_position" label="Position" />
              <th className="kt-th">Change</th>
              <Th col="search_volume" label="Volume" />
              <th className="kt-th">Difficulty <MetricExplainer metric="difficulty" /></th>
              <th className="kt-th">Intent <MetricExplainer metric="search_intent" /></th>
              <Th col="ai_opportunity_score" label="AI Score" />
              <th className="kt-th">Clicks</th>
              <th className="kt-th">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}><td colSpan={9} className="kt-skel-row"><div className="kt-skel" /></td></tr>
              ))
            ) : keywords.length === 0 ? (
              <tr><td colSpan={9} className="kt-empty">
                {status === "ok" && !search && !statusFilter
                  ? "No keywords found. Run agents or add one above."
                  : status !== "ok" && !search && !statusFilter
                  ? <DataStatus status={status} />
                  : "No keywords match this filter."}
              </td></tr>
            ) : keywords.map((kw) => (
              <tr key={kw.id} className="kt-row" onClick={() => setSelected(kw)}>
                <td className="kt-td kt-kw">{kw.keyword}</td>
                <td className="kt-td kt-center">
                  {kw.position != null ? <span className="kt-pos-badge" style={{ background: (kw.position || 0) <= 3 ? "rgba(0,184,148,.12)" : (kw.position || 0) <= 10 ? "rgba(108,92,231,.1)" : "rgba(245,180,97,.12)", color: (kw.position || 0) <= 3 ? "#00B894" : (kw.position || 0) <= 10 ? "#6C5CE7" : "#E1A100" }}>{kw.position}</span> : <span className="kt-dash">–</span>}
                </td>
                <td className="kt-td kt-center">
                  {kw.best_position != null && kw.position != null && kw.position !== kw.best_position
                    ? <span style={{ color: kw.position < kw.best_position ? "#00B894" : "#FF6B6B", fontSize: 12, fontWeight: 600 }}>{kw.position < kw.best_position ? "▲" : "▼"} {Math.abs(kw.position - kw.best_position)}</span>
                    : <span className="kt-dash">–</span>}
                </td>
                <td className="kt-td kt-center">{kw.search_volume?.toLocaleString() ?? <span className="kt-dash">–</span>}</td>
                <td className="kt-td">
                  {kw.keyword_difficulty != null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 40, height: 5, background: "#EEF0F4", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${kw.keyword_difficulty}%`, height: "100%", background: kw.keyword_difficulty <= 30 ? "#00B894" : kw.keyword_difficulty <= 60 ? "#F5B461" : "#FF6B6B", borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 11.5, color: "#6A7280" }}>{kw.keyword_difficulty}</span>
                    </div>
                  ) : <span className="kt-dash">–</span>}
                </td>
                <td className="kt-td">
                  {kw.search_intent ? <span className="kt-intent-badge" style={{ background: `${INTENT_COLOR[kw.search_intent] || "#9AA3B2"}18`, color: INTENT_COLOR[kw.search_intent] || "#9AA3B2" }}>{kw.search_intent}</span> : <span className="kt-dash">–</span>}
                </td>
                <td className="kt-td kt-center">
                  {kw.ai_opportunity_score != null ? (
                    <span style={{ fontWeight: 700, color: kw.ai_opportunity_score >= 70 ? "#00B894" : kw.ai_opportunity_score >= 40 ? "#F5B461" : "#B2BAC8", fontSize: 13 }}>{kw.ai_opportunity_score}</span>
                  ) : <span className="kt-dash">–</span>}
                </td>
                <td className="kt-td kt-center">{kw.clicks?.toLocaleString() ?? <span className="kt-dash">–</span>}</td>
                <td className="kt-td">
                  <span className="kt-status" style={{ background: `${STATUS_COLOR[kw.status] || "#B2BAC8"}18`, color: STATUS_COLOR[kw.status] || "#B2BAC8" }}>{kw.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTable>

      {/* Pagination */}
      {total > limit && (
        <div className="kt-pages">
          <button disabled={page === 1} onClick={() => setPage(page - 1)} className="kt-page-btn">← Prev</button>
          <span className="kt-page-info">Page {page} of {Math.ceil(total / limit)}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(page + 1)} className="kt-page-btn">Next →</button>
        </div>
      )}

      {/* Keyword Drawer */}
      {selected && <KeywordDrawer kw={selected} brandId={brandId} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── Keyword Drawer ────────────────────────────────────────────
function KeywordDrawer({ kw, brandId, onClose }: { kw: Kw; brandId: string; onClose: () => void }) {
  const t = useChartTouch();
  // Shared with the portal's nav drawer (Phase 2): Escape to dismiss, focus
  // trapped inside, focus restored to the row that opened it, background scroll
  // locked. Previously this drawer had none of that -- it could only be closed
  // by pointer, and Tab walked straight out of it into the page behind.
  const dialogRef = useDialog<HTMLDivElement>({ open: true, onClose });
  const [range, setRange] = useState("30");
  const [history, setHistory] = useState<{ captured_date: string; position: number; clicks: number; impressions: number; ctr: number }[]>([]);
  const [events, setEvents] = useState<{ occurred_at: string; event_label: string; event_type: string }[]>([]);
  const [metric, setMetric] = useState<"position"|"clicks"|"impressions"|"ctr">("position");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authedFetch(`/api/intelligence/keyword-history?brand=${brandId}&keyword=${encodeURIComponent(kw.keyword)}&range=${range}`)
      .then((r) => r.json())
      .then((d) => { setHistory(d.history || []); setEvents(d.events || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [brandId, kw.keyword, range]);

  const chartData = history.map((h) => {
    const event = events.find((e) => e.occurred_at.slice(0, 10) === h.captured_date);
    return {
      date: new Date(h.captured_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      value: metric === "ctr" ? Math.round(h.ctr * 1000) / 10 : metric === "position" ? h.position : metric === "clicks" ? h.clicks : h.impressions,
      event: event?.event_label,
    };
  });

  const metricColor = { position: "#6C5CE7", clicks: "#00B894", impressions: "#0984E3", ctr: "#E84393" };

  return (
    <>
      {/* Scrim is presentational; the dialog below owns dismissal, so it is
          hidden from assistive tech rather than announced as a clickable region. */}
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
              {kw.search_intent && <span> · {kw.search_intent}</span>}
            </div>
          </div>
          <button onClick={onClose} className="kd-close">✕</button>
        </div>

        {/* Metric tabs */}
        <div className="kd-mtabs">
          {(["position","clicks","impressions","ctr"] as const).map((m) => (
            <button key={m} className={`kd-mtab ${metric === m ? "on" : ""}`}
              style={metric === m ? { borderBottomColor: metricColor[m], color: metricColor[m] } : {}}
              onClick={() => setMetric(m)}>{m.charAt(0).toUpperCase() + m.slice(1)}</button>
          ))}
          <div className="kd-range">
            {["7","30","90","180","365"].map((r) => (
              <button key={r} className={`kd-rbtn ${range === r ? "on" : ""}`} onClick={() => setRange(r)}>{r}d</button>
            ))}
          </div>
        </div>

        {/* Chart */}
        {loading ? <div className="kd-loading">Loading history…</div> : chartData.length === 0 ? (
          <div className="kd-empty">No historical data yet — data builds up as the platform syncs daily.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF0F4" vertical={false} />
              <XAxis {...t.xAxis} dataKey="date" tick={{ fill: "#9AA3B2", fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: "#9AA3B2", fontSize: 10 }} tickLine={false} axisLine={false} reversed={metric === "position"} />
              <Tooltip {...t.tooltip} contentStyle={{ background: "#fff", border: "1px solid #E7EAF0", borderRadius: 8, fontSize: 11 }}
                formatter={(v: unknown) => { const n = v as number; return [metric === "ctr" ? `${n}%` : metric === "position" ? `#${n}` : n.toLocaleString()]; }} />
              <Line type="monotone" dataKey="value" stroke={metricColor[metric]} strokeWidth={2.5} dot={false} animationDuration={600} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {/* Metadata */}
        <div className="kd-meta">
          <div className="kd-meta-grid">
            {[
              { label: "Best ever",    val: kw.best_position != null ? `#${kw.best_position}` : "–" },
              { label: "Worst ever",   val: kw.worst_position != null ? `#${kw.worst_position}` : "–" },
              { label: "Difficulty",   val: kw.keyword_difficulty != null ? `${kw.keyword_difficulty}/100` : "–" },
              { label: "CPC",          val: kw.cpc != null ? `$${kw.cpc}` : "–" },
              { label: "Est. clicks",  val: kw.estimated_monthly_clicks != null ? `${kw.estimated_monthly_clicks}/mo at #1` : "–" },
              { label: "Revenue est.", val: kw.estimated_revenue_impact || "Not configured" },
            ].map((m) => (
              <div key={m.label} className="kd-meta-item">
                <span className="kd-meta-label">{m.label}</span>
                <span className="kd-meta-val">{m.val}</span>
              </div>
            ))}
          </div>
          {kw.ai_opportunity_reason && (
            <div className="kd-ai-reason">
              <span style={{ color: "#6C5CE7", fontWeight: 700, fontSize: 11 }}>✦ AI</span> {kw.ai_opportunity_reason}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="kd-actions">
          {kw.position != null && kw.position >= 11 && kw.position <= 20 && (
            <ActionButton action="boost_page1" brandId={brandId}
              payload={{ target_keyword: kw.keyword, target_url: kw.landing_page, event_label: "Page 1 boost" }}
              label="⚡ Boost to Page 1" />
          )}
          <ActionButton action="improve_content" brandId={brandId}
            payload={{ target_keyword: kw.keyword, target_url: kw.landing_page, event_label: "Content improved" }}
            label="Improve content" variant="ghost" />
          <ActionButton action="fix_meta" brandId={brandId}
            payload={{ target_keyword: kw.keyword, target_url: kw.landing_page, event_label: "Meta updated" }}
            label="Fix meta" variant="ghost" />
        </div>
      </div>
    </>
  );
}
