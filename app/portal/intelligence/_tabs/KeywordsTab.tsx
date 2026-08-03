"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { Panel, PanelHead } from "../../_components/Panel";
import EmptyState from "../../_components/EmptyState";

type Row = {
  id: string; keyword: string; status: string | null;
  search_volume: number | null; keyword_difficulty: number | null;
  search_intent: string | null; ai_opportunity_score: number | null;
  ai_opportunity_reason: string | null; best_position: number | null;
  position: number | null; clicks: number | null; impressions: number | null;
};

const SORTS = [
  { key: "ai_opportunity_score", label: "Opportunity" },
  { key: "search_volume", label: "Volume" },
  { key: "keyword_difficulty", label: "Difficulty" },
  { key: "best_position", label: "Best pos." },
  { key: "keyword", label: "Keyword" },
];
const PAGE_SIZE = 25;

export default function KeywordsTab({ brandId }: { brandId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("ai_opportunity_score");
  const [asc, setAsc] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({
      brand: brandId, sort, order: asc ? "asc" : "desc",
      page: String(page), limit: String(PAGE_SIZE),
    });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);

    const t = setTimeout(() => {
      authedFetch(`/api/intelligence/keywords?${params}`)
        .then((r) => r.json())
        .then((d) => {
          if (cancelled) return;
          setRows(d.keywords || []); setTotal(d.total || 0); setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    }, search ? 300 : 0); // debounce typing only

    return () => { cancelled = true; clearTimeout(t); };
  }, [brandId, sort, asc, page, search, status]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSort(key: string) {
    if (sort === key) setAsc((a) => !a);
    else { setSort(key); setAsc(key === "keyword" || key === "best_position"); }
    setPage(1);
  }

  return (
    <Panel>
      <PanelHead title="Your keywords" badge={total || undefined} sub="Every keyword we track for your business, ranked by opportunity." />

      <div className="p-toolbar">
        <input
          className="p-input" placeholder="Search keywords…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <select className="p-select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="improving">Improving</option>
          <option value="declining">Declining</option>
          <option value="stable">Stable</option>
          <option value="new">New</option>
        </select>
      </div>

      {loading ? (
        <div className="p-stack">
          {[...Array(6)].map((_, i) => <div key={i} className="p-skel" style={{ height: 44 }} />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="🔍"
          title={search || status ? "No keywords match that filter" : "No keywords tracked yet"}
          sub={search || status
            ? "Try a different search term or clear the filter."
            : "Keywords appear here after your first Search Console sync."}
        />
      ) : (
        <>
          <div className="p-table-wrap">
            <table className="p-table">
              <thead>
                <tr>
                  {SORTS.map((s) => (
                    <th key={s.key}>
                      <button className={`p-table-sort ${sort === s.key ? "on" : ""}`} onClick={() => toggleSort(s.key)}>
                        {s.label}{sort === s.key ? (asc ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                  <th>Intent</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="p-kwcell" title={r.keyword}>{r.keyword}</div>
                      {r.ai_opportunity_reason && (
                        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2, maxWidth: 320 }}>
                          {r.ai_opportunity_reason}
                        </div>
                      )}
                    </td>
                    <td>{r.search_volume != null ? r.search_volume.toLocaleString() : <span className="p-na">—</span>}</td>
                    <td>{r.keyword_difficulty != null ? r.keyword_difficulty : <span className="p-na">—</span>}</td>
                    <td>{posBadge(r.best_position)}</td>
                    <td>{r.ai_opportunity_score != null ? <b>{r.ai_opportunity_score}</b> : <span className="p-na">—</span>}</td>
                    <td>{r.search_intent ? <span className="p-chip">{r.search_intent}</span> : <span className="p-na">—</span>}</td>
                    <td>{r.status ? <span className="p-chip">{r.status}</span> : <span className="p-na">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-pager">
            <span>Page {page} of {pages} · {total.toLocaleString()} keywords</span>
            <div className="p-pager-btns">
              <button className="p-pager-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <button className="p-pager-btn" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

function posBadge(pos: number | null) {
  if (pos == null) return <span className="p-na">—</span>;
  const cls = pos <= 3 ? "top3" : pos <= 10 ? "top10" : pos <= 20 ? "top20" : "";
  return <span className={`p-pos ${cls}`}>{pos}</span>;
}
