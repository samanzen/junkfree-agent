"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import Field from "@/app/_components/Field";

type Comp = {
  id: string;
  domain: string;
  name: string;
  last_keyword_count: number | null;
  last_checked_at: string | null;
};
type Gap = { keyword: string; position: number; volume: number | null };
type Overlap = {
  keyword: string;
  competitor_position: number;
  brand_position: number | null;
  volume: number | null;
};
type CompReport = {
  id: string;
  domain: string;
  name: string;
  gaps: Gap[];
  overlap: Overlap[];
  total_competitor_keywords: number;
};

export default function CompetitorPanel({ brandId }: { brandId: string }) {
  const [competitors, setCompetitors] = useState<Comp[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reports, setReports] = useState<CompReport[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);
  const [domain, setDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoverMsg, setDiscoverMsg] = useState("");
  const [view, setView] = useState<"head" | "gaps">("head");

  function load() {
    authedFetch(`/api/intelligence/competitors?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => setCompetitors(d.competitors || []));
  }

  useEffect(() => {
    if (brandId) load();
  }, [brandId]);

  async function add() {
    if (!domain.trim()) return;
    setAdding(true);
    await authedFetch("/api/intelligence/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand_id: brandId, domain: domain.trim() }),
    });
    setDomain("");
    setAdding(false);
    load();
  }

  function toggleSelect(id: string) {
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(0, 3)));
  }

  async function runComparison() {
    if (!selectedIds.length) return;
    setLoadingReport(true);
    setReports([]);
    const out: CompReport[] = [];
    for (const id of selectedIds) {
      const c = competitors.find((x) => x.id === id);
      if (!c) continue;
      const d = await authedFetch(`/api/intelligence/competitors/${id}`).then((r) => r.json());
      out.push({
        id,
        domain: c.domain,
        name: c.name || c.domain,
        gaps: d.gaps || [],
        overlap: d.overlap || [],
        total_competitor_keywords: d.total_competitor_keywords || 0,
      });
    }
    setReports(out);
    setLoadingReport(false);
  }

  async function remove(id: string) {
    await authedFetch(`/api/intelligence/competitors/${id}`, { method: "DELETE" });
    setSelectedIds((ids) => ids.filter((x) => x !== id));
    setReports((r) => r.filter((x) => x.id !== id));
    load();
  }

  async function discover() {
    setDiscovering(true);
    setDiscoverMsg("");
    try {
      const r = await authedFetch("/api/intelligence/competitors/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId }),
      }).then((res) => res.json());
      const n = (r.discovered || []).length;
      setDiscoverMsg(n ? `Found ${n} new competitor${n === 1 ? "" : "s"}.` : "No new competitors found.");
      if (n) load();
    } catch {
      setDiscoverMsg("Discovery failed — try again later.");
    }
    setDiscovering(false);
  }

  const mergedOverlap = (() => {
    const map = new Map<
      string,
      { keyword: string; volume: number | null; brand: number | null; rivals: { name: string; pos: number }[] }
    >();
    for (const rep of reports) {
      for (const o of rep.overlap) {
        const row = map.get(o.keyword) || {
          keyword: o.keyword,
          volume: o.volume,
          brand: o.brand_position,
          rivals: [],
        };
        row.rivals.push({ name: rep.name, pos: o.competitor_position });
        if (row.brand == null) row.brand = o.brand_position;
        map.set(o.keyword, row);
      }
    }
    return [...map.values()].sort((a, b) => (a.brand || 999) - (b.brand || 999)).slice(0, 40);
  })();

  const mergedGaps = reports
    .flatMap((r) => r.gaps.map((g) => ({ ...g, rival: r.name })))
    .sort((a, b) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 40);

  return (
    <div className="cp">
      <div className="cp-intro">
        Pick up to three competitors and generate a comparison report: where you rank vs them on the
        same searches, and opportunities they rank for that you don’t yet.
      </div>

      <div className="cp-add">
        <Field
          hideLabel
          label="Competitor domain"
          className="cp-input-wrap"
          inputClassName="cp-input"
          placeholder="competitor-domain.com"
          value={domain}
          disabled={adding}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <button className="cp-add-btn" onClick={add} disabled={adding} data-busy={adding || undefined}>
          <span>Add competitor</span>
        </button>
        <button className="cp-add-btn" onClick={discover} disabled={discovering} style={{ background: "#0984E3" }}>
          {discovering ? "Discovering…" : "Find competitors"}
        </button>
      </div>
      {discoverMsg && <div className="cp-meta">{discoverMsg}</div>}

      <div className="cp-list">
        {competitors.length === 0 ? (
          <div className="cp-empty">No competitors yet. Add a domain or run Find competitors.</div>
        ) : (
          competitors.map((c) => {
            const on = selectedIds.includes(c.id);
            return (
              <div key={c.id} className={`cp-row ${on ? "active" : ""}`}>
                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                  <Field
                    as="checkbox"
                    label={c.name || c.domain}
                    checked={on}
                    onChange={() => toggleSelect(c.id)}
                  />
                  <div className="cp-meta" style={{ marginTop: 0 }}>
                    {c.last_keyword_count != null && <span>{c.last_keyword_count.toLocaleString()} keywords</span>}
                    {c.last_checked_at && (
                      <span> · Checked {new Date(c.last_checked_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
                <button className="cp-remove" onClick={() => remove(c.id)} aria-label="Remove competitor">
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="cp-compare-actions">
        <button className="cp-add-btn" onClick={runComparison} disabled={!selectedIds.length || loadingReport}>
          {loadingReport ? "Building report…" : `Compare selected (${selectedIds.length}/3)`}
        </button>
      </div>

      {reports.length > 0 && (
        <div className="cp-report">
          <h4>Competitor comparison report</h4>
          <p>
            You vs {reports.map((r) => r.name).join(", ")}. Switch between head-to-head keywords and
            opportunities they have that you don’t.
          </p>
          <div className="cp-compare-actions" style={{ marginBottom: 12 }}>
            <button
              className="cp-gap-btn"
              style={view === "head" ? { background: "#4F46E5", color: "#fff" } : undefined}
              onClick={() => setView("head")}
            >
              Head-to-head
            </button>
            <button
              className="cp-gap-btn"
              style={view === "gaps" ? { background: "#4F46E5", color: "#fff" } : undefined}
              onClick={() => setView("gaps")}
            >
              Opportunities they have
            </button>
          </div>

          {view === "head" ? (
            mergedOverlap.length === 0 ? (
              <div className="cp-empty">No shared keywords found yet for the selected competitors.</div>
            ) : (
              <ResponsiveTable>
                <table className="cp-table">
                  <thead>
                    <tr>
                      <th>Search term</th>
                      <th>You</th>
                      {reports.map((r) => (
                        <th key={r.id}>{r.name}</th>
                      ))}
                      <th>Volume</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mergedOverlap.map((row) => (
                      <tr key={row.keyword}>
                        <td className="cp-kw">{row.keyword}</td>
                        <td>
                          <span className="cp-pos">{row.brand != null ? `#${row.brand}` : "—"}</span>
                        </td>
                        {reports.map((r) => {
                          const rival = row.rivals.find((x) => x.name === r.name);
                          const win =
                            rival && row.brand != null ? row.brand < rival.pos : false;
                          const lose =
                            rival && row.brand != null ? row.brand > rival.pos : false;
                          return (
                            <td key={r.id}>
                              {rival ? (
                                <span className={`cp-pos ${win ? "win" : lose ? "lose" : ""}`}>
                                  #{rival.pos}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          );
                        })}
                        <td>{row.volume?.toLocaleString() ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ResponsiveTable>
            )
          ) : mergedGaps.length === 0 ? (
            <div className="cp-empty">No clear opportunities found for these competitors.</div>
          ) : (
            <ResponsiveTable>
              <table className="cp-table">
                <thead>
                  <tr>
                    <th>Search term</th>
                    <th>Competitor</th>
                    <th>Their position</th>
                    <th>Volume</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {mergedGaps.map((g, i) => (
                    <tr key={`${g.rival}-${g.keyword}-${i}`}>
                      <td className="cp-kw">{g.keyword}</td>
                      <td>{g.rival}</td>
                      <td>
                        <span className="cp-pos">#{g.position}</span>
                      </td>
                      <td>{g.volume?.toLocaleString() ?? "–"}</td>
                      <td>
                        <button
                          className="cp-track-btn"
                          onClick={async () => {
                            await authedFetch("/api/intelligence/keywords", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ brand_id: brandId, keyword: g.keyword }),
                            });
                          }}
                        >
                          Track this
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          )}
        </div>
      )}
    </div>
  );
}
