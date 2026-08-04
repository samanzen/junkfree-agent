"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { m } from "framer-motion";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import { usePlatformData } from "../_data";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import EmptyState from "../_components/EmptyState";
import ConnectCard from "../_components/ConnectCard";
import StatTile from "../_components/StatTile";
import ExecutionPanel from "../_components/ExecutionPanel";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger, fadeUp, EASE } from "../_components/motion";
import KeywordBattleTable, { type BattleRow } from "./_KeywordBattleTable";
import {
  losingRows, winningRows,
  type CompetitorRow, type CompetitorAnalysis,
} from "./_types";
import {
  IconIntelligence, IconSparkle, IconLink, IconWebsite, IconTarget, IconClose,
} from "../icons";

type Tab = "battle" | "gaps" | "backlinks" | "visibility";

const TABS: { key: Tab; label: string }[] = [
  { key: "battle", label: "Head to head" },
  { key: "gaps", label: "Keyword gaps" },
  { key: "backlinks", label: "Backlinks" },
  { key: "visibility", label: "Visibility" },
];

export default function CompetitorsPage() {
  const { brand } = usePortalAuth();
  const { data: platform } = usePlatformData(brand?.id);

  const [competitors, setCompetitors] = useState<CompetitorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<CompetitorAnalysis | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [tab, setTab] = useState<Tab>("battle");
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const loadCompetitors = useCallback(async () => {
    if (!brand?.id) return;
    setLoading(true);
    try {
      const d = await (await authedFetch(`/api/intelligence/competitors?brand=${brand.id}`)).json();
      setCompetitors(Array.isArray(d.competitors) ? d.competitors : []);
    } catch { /* leave list as-is */ } finally { setLoading(false); }
  }, [brand?.id]);

  useEffect(() => { loadCompetitors(); }, [loadCompetitors]);

  // Deliberately on demand: this endpoint performs a live ranked-keywords
  // lookup per competitor, so it runs when the customer picks one rather
  // than for every competitor on page load.
  async function analyse(c: CompetitorRow) {
    setSelectedId(c.id);
    setAnalysis(null);
    setAnalysing(true);
    try {
      const d = await (await authedFetch(`/api/intelligence/competitors/${c.id}`)).json();
      setAnalysis(d?.gaps ? d : null);
    } catch { setAnalysis(null); } finally { setAnalysing(false); }
  }

  async function addCompetitor() {
    const domain = newDomain.trim();
    if (!domain || !brand?.id) return;
    setAdding(true);
    try {
      const res = await authedFetch("/api/intelligence/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand.id, domain }),
      });
      if (res.ok) { setNewDomain(""); await loadCompetitors(); }
      else {
        const e = await res.json().catch(() => ({}));
        alert(e.error || "Couldn't add that competitor.");
      }
    } finally { setAdding(false); }
  }

  async function discover() {
    if (!brand?.id) return;
    setDiscovering(true);
    try {
      const res = await authedFetch("/api/intelligence/competitors/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand.id }),
      });
      const d = await res.json().catch(() => ({}));
      await loadCompetitors();
      if (Array.isArray(d.discovered) && d.discovered.length === 0) {
        alert("No new competitors found beyond the ones you already track.");
      }
    } finally { setDiscovering(false); }
  }

  async function remove(c: CompetitorRow) {
    if (!confirm(`Stop tracking ${c.domain}?`)) return;
    await authedFetch(`/api/intelligence/competitors/${c.id}`, { method: "DELETE" });
    if (selectedId === c.id) { setSelectedId(null); setAnalysis(null); }
    await loadCompetitors();
  }

  const selected = competitors.find((c) => c.id === selectedId) || null;
  const losing = useMemo(() => (analysis ? losingRows(analysis.overlap) : []), [analysis]);
  const winning = useMemo(() => (analysis ? winningRows(analysis.overlap) : []), [analysis]);

  const losingBattle: BattleRow[] = losing.map((o) => ({
    keyword: o.keyword, ours: o.brand_position, theirs: o.competitor_position, volume: o.volume,
  }));
  const gapBattle: BattleRow[] = (analysis?.gaps ?? []).map((g) => ({
    keyword: g.keyword, ours: null, theirs: g.position, volume: g.volume,
  }));

  // Citations are the platform's real backlink/citation opportunity store.
  const citations = platform?.citations ?? [];
  const openCitations = citations.filter((c) => c.status !== "live" && c.status !== "skipped");

  if (!brand) return null;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Competitor Intelligence"
        title="Who you're up against"
        sub="Track the businesses competing for your customers, see exactly which searches they beat you on, and put your AI to work closing the gap."
        action={
          <button className="p-btn ghost" onClick={discover} disabled={discovering}>
            <IconSparkle size={14} /> {discovering ? "Searching…" : "Auto-discover"}
          </button>
        }
      />

      {/* Roster */}
      <Panel>
        <PanelHead
          title="Tracked competitors"
          badge={competitors.length || undefined}
          sub="Pick one to run a full head-to-head analysis against your own rankings."
        />

        <div className="p-toolbar">
          <input
            className="p-input"
            placeholder="Add a competitor domain, e.g. example.ca"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCompetitor(); }}
          />
          <button className="p-btn primary" onClick={addCompetitor} disabled={adding || !newDomain.trim()}>
            {adding ? "Adding…" : "Add competitor"}
          </button>
        </div>

        {loading ? (
          <div className="p-stack">
            {[...Array(3)].map((_, i) => <div key={i} className="p-skel" style={{ height: 62 }} />)}
          </div>
        ) : competitors.length === 0 ? (
          <EmptyState
            icon={<IconIntelligence size={22} />}
            title="No competitors tracked yet"
            sub="Add the businesses you compete with, or let your AI find the domains already ranking for the same searches as you."
          />
        ) : (
          <Stagger className="p-comp-grid" stagger={0.04}>
            {competitors.map((c) => (
              <m.div
                key={c.id}
                className={`p-comp ${selectedId === c.id ? "on" : ""}`}
                variants={fadeUp}
                whileHover={{ y: -2, transition: { duration: 0.18, ease: EASE } }}
              >
                <button className="p-comp-main" onClick={() => analyse(c)}>
                  <span className="p-comp-avatar">{c.domain.slice(0, 2).toUpperCase()}</span>
                  <span className="p-comp-info">
                    <span className="p-comp-domain">{c.domain}</span>
                    <span className="p-comp-meta">
                      {c.last_keyword_count != null
                        ? `${c.last_keyword_count.toLocaleString()} keywords ranked`
                        : "Not analysed yet"}
                    </span>
                  </span>
                </button>
                <button className="p-comp-remove" onClick={() => remove(c)} aria-label={`Stop tracking ${c.domain}`}>
                  <IconClose size={14} />
                </button>
              </m.div>
            ))}
          </Stagger>
        )}
      </Panel>

      {/* Head-to-head */}
      {selected && (
        <>
          <SubNav items={TABS} value={tab} onChange={setTab} />

          {analysing ? (
            <div className="p-stack">
              <div className="p-skel" style={{ height: 96 }} />
              <div className="p-skel" style={{ height: 280 }} />
            </div>
          ) : !analysis ? (
            <EmptyState
              icon={<IconIntelligence size={22} />}
              title={`We couldn't analyse ${selected.domain}`}
              sub="Their ranking data wasn't available this time. This usually means the domain has little or no organic presence in our index yet."
            />
          ) : (
            <>
              <Panel>
                <PanelHead
                  title={`You vs ${analysis.competitor.domain}`}
                  sub="Based on their live ranked keywords compared against the keywords we track for you."
                />
                <div className="p-stat-grid">
                  <StatTile label="Their keywords" value={analysis.total_competitor_keywords.toLocaleString()} tone="accent" />
                  <StatTile label="They beat you on" value={losing.length || "—"} tone={losing.length ? "red" : "muted"} />
                  <StatTile label="You beat them on" value={winning.length || "—"} tone={winning.length ? "green" : "muted"} />
                  <StatTile label="Gaps to close" value={analysis.gap_count || "—"} tone={analysis.gap_count ? "amber" : "muted"} />
                </div>
              </Panel>

              {tab === "battle" && (
                <Panel>
                  <PanelHead
                    title="Searches they beat you on"
                    badge={losing.length || undefined}
                    badgeTone="red"
                    sub="You both rank for these, but they sit higher. Closing these is usually faster than winning a keyword from scratch, because you already have a page Google trusts."
                  />
                  <KeywordBattleTable
                    rows={losingBattle}
                    brandId={brand.id}
                    action="boost_page1"
                    actionLabel="Fight back"
                    competitorDomain={analysis.competitor.domain}
                    emptyTitle="They don't outrank you anywhere"
                    emptySub="On every keyword you both target, you're currently ahead."
                  />
                </Panel>
              )}

              {tab === "gaps" && (
                <Panel>
                  <PanelHead
                    title="Keywords they rank for and you don't"
                    badge={analysis.gap_count || undefined}
                    badgeTone="amber"
                    sub="They appear in the top 20 for these searches and you don't appear at all — each one is demand you're currently invisible for."
                  />
                  <KeywordBattleTable
                    rows={gapBattle}
                    brandId={brand.id}
                    action="rewrite_page"
                    actionLabel="Create page"
                    competitorDomain={analysis.competitor.domain}
                    emptyTitle="No gaps found"
                    emptySub="You already rank for everything they do in the top 20."
                  />
                </Panel>
              )}

              {tab === "backlinks" && (
                <div className="p-stack">
                  <Panel>
                    <PanelHead
                      title="Backlink & citation opportunities"
                      badge={openCitations.length || undefined}
                      sub="Directories and sites your agents have identified as worth earning a link from."
                    />
                    {openCitations.length === 0 ? (
                      <EmptyState
                        icon={<IconLink size={22} />}
                        title="No open link opportunities"
                        sub="Every opportunity your agents have found is either live or intentionally skipped. Run a fresh search below to look for more."
                      />
                    ) : (
                      <div className="p-table-wrap">
                        <table className="p-table">
                          <thead><tr><th>Site</th><th>Category</th><th>Status</th><th>Why</th></tr></thead>
                          <tbody>
                            {openCitations.slice(0, 20).map((c) => (
                              <tr key={c.id}>
                                <td>
                                  {c.url
                                    ? <a href={c.url} target="_blank" rel="noreferrer" className="p-kwcell" style={{ color: "var(--accent)", textDecoration: "none" }}>{c.name}</a>
                                    : <span className="p-kwcell">{c.name}</span>}
                                </td>
                                <td>{c.category ? <span className="p-chip">{c.category}</span> : <span className="p-na">—</span>}</td>
                                <td><span className="p-badge amber">{c.status.replace(/_/g, " ")}</span></td>
                                <td style={{ color: "var(--muted)", fontSize: 12.5, maxWidth: 340 }}>
                                  {c.rationale || <span className="p-na">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    <ExecutionPanel
                      brandId={brand.id}
                      capabilities={[
                        {
                          id: "cx:backlinks",
                          label: "Find more link opportunities",
                          produces: "A fresh search for directories and sites worth a link",
                          exec: "agent", action: "build_backlinks",
                          payload: { rationale: `Competitor research against ${analysis.competitor.domain}` },
                          primary: true,
                        },
                        {
                          id: "cx:theirlinks",
                          label: "See who links to them",
                          produces: "Their full referring-domain list, so you can target the same sites",
                          exec: "soon",
                        },
                        {
                          id: "cx:gap",
                          label: "Backlink gap analysis",
                          produces: "Sites linking to them but not to you",
                          exec: "soon",
                        },
                      ]}
                    />
                  </Panel>
                </div>
              )}

              {tab === "visibility" && (
                <div className="p-stack">
                  <Panel>
                    <PanelHead title="Visibility over time" />
                    <EmptyState
                      icon={<IconTarget size={22} />}
                      title="We only hold a single snapshot so far"
                      sub={`We know ${analysis.competitor.domain} currently ranks for ${analysis.total_competitor_keywords.toLocaleString()} keywords, but we don't yet store a history of that number — so there's no honest trend to plot. Each time you analyse a competitor we record the figure, and the chart appears once there are at least two points.`}
                    />
                  </Panel>
                  <Stagger className="p-subgrid">
                    <ConnectCard
                      icon={<IconWebsite size={19} />}
                      title="Page-level comparison"
                      desc="See which of their pages pull the most traffic and which of your pages they outperform, side by side."
                      unlocks={["Their top pages by estimated traffic", "The pages of yours they beat"]}
                      note="Our competitor feed returns keywords and positions, not page URLs — this needs a different data source."
                    />
                    <ConnectCard
                      title="Visibility share"
                      desc="Track what percentage of your market's search visibility you own versus each competitor, week over week."
                      unlocks={["Share-of-voice trend", "Alerts when a rival overtakes you"]}
                      note="Requires competitor history, which begins accumulating from your first analysis."
                    />
                  </Stagger>
                </div>
              )}
            </>
          )}
        </>
      )}

      {!selected && competitors.length > 0 && (
        <EmptyState
          icon={<IconIntelligence size={22} />}
          title="Pick a competitor to analyse"
          sub="Select any competitor above and we'll pull their live rankings and compare them against yours, keyword by keyword."
        />
      )}
    </div>
  );
}
