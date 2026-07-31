"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";

type Comp = { id: string; domain: string; name: string; last_keyword_count: number | null; last_checked_at: string | null };
type Gap = { keyword: string; position: number; volume: number | null };

export default function CompetitorPanel({ brandId }: { brandId: string }) {
  const [competitors, setCompetitors] = useState<Comp[]>([]);
  const [selected, setSelected] = useState<Comp | null>(null);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [gapLoading, setGapLoading] = useState(false);
  const [domain, setDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [discoverMsg, setDiscoverMsg] = useState("");

  function load() {
    authedFetch(`/api/intelligence/competitors?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => setCompetitors(d.competitors || []));
  }

  useEffect(() => { if (brandId) load(); }, [brandId]);

  async function add() {
    if (!domain.trim()) return;
    setAdding(true);
    await authedFetch("/api/intelligence/competitors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand_id: brandId, domain: domain.trim() }),
    });
    setDomain(""); setAdding(false); load();
  }

  async function loadGaps(comp: Comp) {
    setSelected(comp); setGapLoading(true); setGaps([]);
    const d = await authedFetch(`/api/intelligence/competitors/${comp.id}`).then((r) => r.json());
    setGaps(d.gaps || []); setGapLoading(false);
  }

  async function remove(id: string) {
    await authedFetch(`/api/intelligence/competitors/${id}`, { method: "DELETE" });
    setSelected(null); setGaps([]); load();
  }

  async function discover() {
    setDiscovering(true); setDiscoverMsg("");
    try {
      const r = await authedFetch("/api/intelligence/competitors/discover", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id: brandId }),
      }).then((res) => res.json());
      const n = (r.discovered || []).length;
      setDiscoverMsg(n ? `Found ${n} new competitor${n === 1 ? "" : "s"}.` : "No new competitors found.");
      if (n) load();
    } catch {
      setDiscoverMsg("Discovery failed — try again later.");
    }
    setDiscovering(false);
  }

  return (
    <div className="cp">
      {/* Add competitor */}
      <div className="cp-add">
        <input className="cp-input" placeholder="competitor-domain.com" value={domain} onChange={(e) => setDomain(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="cp-add-btn" onClick={add} disabled={adding}>{adding ? "Adding…" : "Add competitor"}</button>
        <button className="cp-add-btn" onClick={discover} disabled={discovering} style={{ background: "#0984E3" }}>
          {discovering ? "Discovering…" : "🔍 Discover competitors"}
        </button>
      </div>
      {discoverMsg && <div className="cp-meta" style={{ marginTop: -4 }}>{discoverMsg}</div>}

      {/* Competitor list */}
      <div className="cp-list">
        {competitors.length === 0 ? (
          <div className="cp-empty">No competitors added yet. Add a competitor domain above to see keyword gap analysis.</div>
        ) : competitors.map((c) => (
          <div key={c.id} className={`cp-row ${selected?.id === c.id ? "active" : ""}`} onClick={() => loadGaps(c)}>
            <div>
              <div className="cp-domain">{c.name || c.domain}</div>
              <div className="cp-meta">
                {c.last_keyword_count != null && <span>{c.last_keyword_count.toLocaleString()} keywords</span>}
                {c.last_checked_at && <span> · Checked {new Date(c.last_checked_at).toLocaleDateString()}</span>}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button className="cp-gap-btn">{selected?.id === c.id ? "Viewing gaps" : "View gaps"}</button>
              <button className="cp-remove" onClick={(e) => { e.stopPropagation(); remove(c.id); }}>✕</button>
            </div>
          </div>
        ))}
      </div>

      {/* Gap analysis */}
      {selected && (
        <div className="cp-gaps">
          <h4 className="cp-gaps-title">Keyword gaps — {selected.name || selected.domain}</h4>
          <p className="cp-gaps-sub">Keywords they rank for (top 20) that you currently don't track.</p>
          {gapLoading ? <div className="cp-empty">Fetching gap analysis from DataForSEO…</div> : gaps.length === 0 ? (
            <div className="cp-empty">No gaps found, or DataForSEO returned no data for this domain.</div>
          ) : (
            <table className="cp-table">
              <thead><tr><th>Keyword</th><th>Their position</th><th>Volume</th><th></th></tr></thead>
              <tbody>
                {gaps.map((g, i) => (
                  <tr key={i}>
                    <td className="cp-kw">{g.keyword}</td>
                    <td style={{ textAlign: "center" as const }}><span className="cp-pos">{g.position}</span></td>
                    <td style={{ textAlign: "center" as const }}>{g.volume?.toLocaleString() ?? "–"}</td>
                    <td>
                      <button className="cp-track-btn" onClick={async () => {
                        await authedFetch("/api/intelligence/keywords", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id: brandId, keyword: g.keyword }) });
                        setGaps(gaps.filter((x) => x.keyword !== g.keyword));
                      }}>Track this</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
