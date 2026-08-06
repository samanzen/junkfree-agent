"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { m } from "framer-motion";
import { authedFetch } from "@/lib/authedFetch";
import { Panel, PanelHead } from "../../_components/Panel";
import EmptyState from "../../_components/EmptyState";
import ConnectCard from "../../_components/ConnectCard";
import StatTile from "../../_components/StatTile";
import ExecutionPanel from "../../_components/ExecutionPanel";
import { Stagger, fadeUp } from "../../_components/motion";
import { IconCheck, IconAlert, IconContent, IconTraffic, IconIntelligence } from "../../icons";
import ResponsiveTable from "@/app/_components/ResponsiveTable";

type PageRow = {
  page: string; clicks: number; impressions: number; avg_ctr: number;
  best_position: number | null; keyword_count: number; top_keyword: string | null;
  click_delta: number | null; status: string;
};
type LowCtrRow = { page: string; impressions: number; ctr: number };

const path = (u: string) => u.replace(/^https?:\/\/[^/]+/, "") || "/";

// Insights that need cross-referencing rather than a single list: which pages
// are decaying, which are competing with each other, and where impressions
// aren't converting into clicks. Every figure comes from an existing endpoint.
export default function InsightsTab({ brandId }: { brandId: string }) {
  const [pages, setPages] = useState<PageRow[]>([]);
  const [lowCtr, setLowCtr] = useState<LowCtrRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      authedFetch(`/api/intelligence/content?brand=${brandId}`).then((r) => r.json()).catch(() => ({})),
      authedFetch(`/api/analytics?brand=${brandId}`).then((r) => r.json()).catch(() => ({})),
    ])
      .then(([content, analytics]) => {
        if (cancelled) return;
        setPages(Array.isArray(content?.pages) ? content.pages : []);
        setLowCtr(Array.isArray(analytics?.lowCtrPages) ? analytics.lowCtrPages : []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  const decaying = useMemo(
    () => pages.filter((p) => p.status === "declining").sort((a, b) => (a.click_delta ?? 0) - (b.click_delta ?? 0)),
    [pages]
  );
  const growing = useMemo(
    () => pages.filter((p) => p.status === "growing").sort((a, b) => (b.click_delta ?? 0) - (a.click_delta ?? 0)),
    [pages]
  );

  // Pages whose strongest attributed keyword is the same. High precision (both
  // pages genuinely rank for that term) but partial recall — see the note.
  const overlaps = useMemo(() => {
    const byKeyword = new Map<string, PageRow[]>();
    for (const p of pages) {
      const k = (p.top_keyword || "").trim().toLowerCase();
      if (!k) continue;
      if (!byKeyword.has(k)) byKeyword.set(k, []);
      byKeyword.get(k)!.push(p);
    }
    return [...byKeyword.entries()]
      .filter(([, ps]) => ps.length > 1)
      .map(([keyword, ps]) => ({ keyword, pages: ps.sort((a, b) => b.clicks - a.clicks) }));
  }, [pages]);

  if (loading) {
    return (
      <div className="p-stack">
        {[...Array(3)].map((_, i) => <div key={i} className="p-skel" style={{ height: 200 }} />)}
      </div>
    );
  }

  const lostClicks = decaying.reduce((s, p) => s + Math.abs(p.click_delta ?? 0), 0);
  const gainedClicks = growing.reduce((s, p) => s + (p.click_delta ?? 0), 0);

  return (
    <div className="p-stack">
      <Panel>
        <PanelHead title="Where you're gaining and losing" sub="Comparing each page's clicks against the same page seven days ago." />
        <Stagger className="p-stat-grid">
          <StatTile label="Pages declining" value={decaying.length || "—"} tone={decaying.length ? "red" : "green"} />
          <StatTile label="Clicks lost / week" value={lostClicks || "—"} tone={lostClicks ? "red" : "muted"} />
          <StatTile label="Pages growing" value={growing.length || "—"} tone={growing.length ? "green" : "muted"} />
          <StatTile label="Clicks gained / week" value={gainedClicks || "—"} tone={gainedClicks ? "green" : "muted"} />
        </Stagger>
      </Panel>

      {/* Content decay */}
      <Panel>
        <PanelHead
          title="Content losing ground"
          badge={decaying.length || undefined}
          badgeTone="red"
          sub="These pages earned meaningfully fewer clicks than they did a week ago. Acting while a decline is fresh is far easier than recovering months later."
        />
        {decaying.length === 0 ? (
          <EmptyState
            icon={<IconCheck size={22} />}
            title="Nothing is decaying"
            sub="No page has lost a meaningful number of clicks compared with last week."
          />
        ) : (
          <>
            <ResponsiveTable>
              <table className="p-table">
                <thead><tr><th>Page</th><th>Clicks</th><th>Change</th><th>Best pos.</th><th>Keywords</th></tr></thead>
                <tbody>
                  {decaying.slice(0, 15).map((p) => (
                    <tr key={p.page}>
                      <td>
                        <a href={p.page} target="_blank" rel="noreferrer" className="p-kwcell" style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {path(p.page)}
                        </a>
                        {p.top_keyword && <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{p.top_keyword}</div>}
                      </td>
                      <td><b>{p.clicks.toLocaleString()}</b></td>
                      <td><span className="p-move-delta down">{p.click_delta}</span></td>
                      <td>{p.best_position != null ? <span className="p-pos">{p.best_position}</span> : <span className="p-na">—</span>}</td>
                      <td>{p.keyword_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
            <ExecutionPanel
              brandId={brandId}
              capabilities={decaying.slice(0, 1).map((p) => ({
                id: `decay:${p.page}`,
                label: `Refresh ${path(p.page)}`,
                produces: "Updated, expanded content to win the position back",
                exec: "agent" as const,
                action: "improve_content" as const,
                payload: { target_url: p.page, target_keyword: p.top_keyword || undefined, rationale: `Content decay: ${p.click_delta} clicks week over week` },
                primary: true,
              }))}
            />
          </>
        )}
      </Panel>

      {/* CTR opportunities */}
      <Panel>
        <PanelHead
          title="Seen but not clicked"
          badge={lowCtr.length || undefined}
          badgeTone="amber"
          sub="Google shows these pages often and almost nobody clicks. The ranking is already earned — the listing itself is what's losing the visit."
        />
        {lowCtr.length === 0 ? (
          <EmptyState
            icon={<IconCheck size={22} />}
            title="No weak listings"
            sub="Every page with meaningful impressions earns a reasonable share of clicks."
          />
        ) : (
          <>
            <ResponsiveTable>
              <table className="p-table">
                <thead><tr><th>Page</th><th>Impressions</th><th>CTR</th></tr></thead>
                <tbody>
                  {lowCtr.map((r) => (
                    <tr key={r.page}>
                      <td>
                        <a href={r.page} target="_blank" rel="noreferrer" className="p-kwcell" style={{ color: "var(--accent)", textDecoration: "none" }}>
                          {path(r.page)}
                        </a>
                      </td>
                      <td>{r.impressions.toLocaleString()}</td>
                      <td><span className="p-move-delta flat">{(r.ctr * 100).toFixed(1)}%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
            <ExecutionPanel
              brandId={brandId}
              capabilities={lowCtr.slice(0, 1).map((r) => ({
                id: `ctr:${r.page}`,
                label: `Rewrite the listing for ${path(r.page)}`,
                produces: "A new title and description written to earn the click",
                exec: "agent" as const,
                action: "fix_meta" as const,
                payload: { target_url: r.page, rationale: `Low CTR: ${(r.ctr * 100).toFixed(1)}% on ${r.impressions} impressions` },
                primary: true,
              }))}
            />
          </>
        )}
      </Panel>

      {/* Cannibalisation */}
      <Panel>
        <PanelHead
          title="Pages competing with each other"
          badge={overlaps.length || undefined}
          badgeTone="amber"
          sub="When two of your pages target the same search, they split the signals that should go to one — and Google often ranks neither well."
        />
        {overlaps.length === 0 ? (
          <EmptyState
            icon={<IconCheck size={22} />}
            title="No competing pages detected"
            sub="Among the keywords we can currently attribute to a page, no two pages share the same strongest term."
          />
        ) : (
          <div className="p-cardlist">
            {overlaps.map((o) => (
              <m.div key={o.keyword} className="p-rec" variants={fadeUp} initial="hidden" animate="show">
                <div className="p-rec-top">
                  <span className="p-rec-icon"><IconAlert size={15} /></span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="p-rec-title">&ldquo;{o.keyword}&rdquo;</div>
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                      {o.pages.length} pages ranking for the same term
                    </div>
                  </div>
                </div>
                <ResponsiveTable>
                  <table className="p-table">
                    <thead><tr><th>Page</th><th>Clicks</th><th>Best pos.</th></tr></thead>
                    <tbody>
                      {o.pages.map((p) => (
                        <tr key={p.page}>
                          <td><a href={p.page} target="_blank" rel="noreferrer" className="p-kwcell" style={{ color: "var(--accent)", textDecoration: "none" }}>{path(p.page)}</a></td>
                          <td>{p.clicks.toLocaleString()}</td>
                          <td>{p.best_position != null ? <span className="p-pos">{p.best_position}</span> : <span className="p-na">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ResponsiveTable>
                <p className="p-rec-text" style={{ margin: "12px 0 0" }}>
                  Pick the page you want to win this term, strengthen it, and point the other page&apos;s
                  internal links at it rather than competing.
                </p>
              </m.div>
            ))}
          </div>
        )}
        <p className="p-tech-note" style={{ marginTop: 14, marginBottom: 0 }}>
          <IconAlert size={13} />
          <span>
            This compares the strongest keyword we can attribute to each page. Full cannibalisation
            detection needs every keyword mapped to every page that ranks for it — our ranking feed
            currently returns a single page per keyword, so overlaps beyond each page&apos;s top term
            aren&apos;t visible yet.
          </span>
        </p>
      </Panel>

      {/* Honest gaps */}
      <Stagger className="p-subgrid">
        <ConnectCard
          icon={<IconIntelligence size={19} />}
          title="Search intent changes"
          desc="Know when Google reinterprets a keyword — when a term you rank for stops meaning what it used to, and the page that wins it changes shape."
          unlocks={["Intent shifts flagged as they happen", "The content change each shift calls for"]}
          note="We store each keyword's current intent but not a history of it, so there's nothing to compare against yet. Detecting a change needs intent recorded per enrichment run."
        />
        <ConnectCard
          icon={<IconTraffic size={19} />}
          title="Estimated revenue opportunity"
          desc="Translate ranking gains into pounds and pence, so you can weigh SEO work against everything else competing for your budget."
          unlocks={["Revenue impact per keyword", "Opportunities ranked by money, not clicks"]}
          note="Needs your average job value, visitor-to-lead rate and lead-to-customer rate. None are set on your account, so every revenue figure would be invented — we'd rather show nothing."
        />
        <ConnectCard
          icon={<IconContent size={19} />}
          title="Competitor overlap & gaps"
          desc="See which rivals target the same searches and where they rank for terms you don't appear for at all."
          unlocks={["Head-to-head keyword comparison", "Gaps ranked by search volume"]}
          note="Already built — open the Competitors section to track a rival and run the analysis."
        />
      </Stagger>

      <Link href="/portal/competitors" className="p-btn ghost" style={{ alignSelf: "flex-start" }}>
        Open Competitor Intelligence
      </Link>
    </div>
  );
}
