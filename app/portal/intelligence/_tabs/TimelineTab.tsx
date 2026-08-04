"use client";
import { useEffect, useMemo, useState } from "react";
import { m } from "framer-motion";
import { authedFetch } from "@/lib/authedFetch";
import { Panel, PanelHead } from "../../_components/Panel";
import EmptyState from "../../_components/EmptyState";
import MultiLineChart from "../../_components/MultiLineChart";
import { fadeUp, EASE } from "../../_components/motion";
import { IconArrowUp, IconArrowDown, IconSparkle, IconContent, IconTraffic } from "../../icons";

type DistRow = {
  captured_date: string;
  top_3: number | null; top_10: number | null; top_20: number | null; top_50: number | null;
  new_this_week: number | null; lost_this_week: number | null;
  improved_this_week: number | null; declined_this_week: number | null;
  total_clicks: number | null; total_impressions: number | null;
};
type Draft = { title: string; created_at: string; status: string; task_type: string };

type Event = {
  at: string;
  kind: "ranking" | "content";
  tone: "green" | "red" | "accent" | "muted";
  title: string;
  detail?: string;
};

const fmt = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

// A single chronological record of what actually changed: ranking movement
// from the distribution snapshots, and content going live from drafts.
export default function TimelineTab({ brandId }: { brandId: string }) {
  const [dist, setDist] = useState<DistRow[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      authedFetch(`/api/intelligence/distribution?brand=${brandId}&days=180`).then((r) => r.json()).catch(() => ({})),
      authedFetch(`/api/platform?brand=${brandId}`).then((r) => r.json()).catch(() => ({})),
    ])
      .then(([d, platform]) => {
        if (cancelled) return;
        setDist(Array.isArray(d?.distribution) ? d.distribution : []);
        setDrafts(Array.isArray(platform?.drafts) ? platform.drafts : []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  const chart = useMemo(
    () => dist.map((r) => ({
      date: new Date(r.captured_date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      top_3: r.top_3 ?? 0, top_10: r.top_10 ?? 0, top_20: r.top_20 ?? 0, top_50: r.top_50 ?? 0,
    })),
    [dist]
  );

  const events = useMemo(() => {
    const out: Event[] = [];

    for (const r of dist) {
      const bits: string[] = [];
      if (r.new_this_week) bits.push(`${r.new_this_week} new`);
      if (r.improved_this_week) bits.push(`${r.improved_this_week} improved`);
      if (r.declined_this_week) bits.push(`${r.declined_this_week} declined`);
      if (r.lost_this_week) bits.push(`${r.lost_this_week} lost`);
      if (!bits.length) continue;

      const net = (r.new_this_week ?? 0) + (r.improved_this_week ?? 0)
        - (r.lost_this_week ?? 0) - (r.declined_this_week ?? 0);
      out.push({
        at: r.captured_date,
        kind: "ranking",
        tone: net > 0 ? "green" : net < 0 ? "red" : "muted",
        title: bits.join(" · "),
        detail: r.total_clicks != null ? `${r.total_clicks.toLocaleString()} clicks that week` : undefined,
      });
    }

    for (const d of drafts) {
      if (d.status !== "published") continue;
      out.push({
        at: d.created_at,
        kind: "content",
        tone: "accent",
        title: d.title.replace(/^(Blog|Page|New blog|New page|Audit \+ rewrite|Meta rewrite|Intent fix):\s*/i, ""),
        detail: d.task_type.replace(/_/g, " "),
      });
    }

    return out.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 40);
  }, [dist, drafts]);

  if (loading) {
    return (
      <div className="p-stack">
        <div className="p-skel" style={{ height: 280 }} />
        <div className="p-skel" style={{ height: 320 }} />
      </div>
    );
  }

  return (
    <div className="p-stack">
      <Panel>
        <PanelHead title="Ranking distribution over time" sub="How many keywords sit in each position band, snapshot by snapshot." />
        {chart.length > 1 ? (
          <MultiLineChart
            data={chart}
            series={[
              { key: "top_3", name: "Top 3", color: "var(--green)" },
              { key: "top_10", name: "Top 10", color: "var(--accent)" },
              { key: "top_20", name: "Top 20", color: "var(--amber)" },
              { key: "top_50", name: "Top 50", color: "var(--blue)" },
            ]}
          />
        ) : (
          <EmptyState
            icon={<IconTraffic size={22} />}
            title={chart.length === 1 ? "Only one snapshot so far" : "No snapshots yet"}
            sub="Distribution snapshots are recorded by the daily ranking sync. The chart plots as soon as there are two to compare."
          />
        )}
      </Panel>

      <Panel>
        <PanelHead title="What changed" badge={events.length || undefined} sub="Ranking movement and published content, newest first." />
        {events.length === 0 ? (
          <EmptyState
            icon={<IconSparkle size={22} />}
            title="Nothing recorded yet"
            sub="Once your rankings start moving and content goes live, every change is logged here in order."
          />
        ) : (
          <div className="p-timeline">
            {events.map((e, i) => (
              <m.div
                key={`${e.at}-${i}`}
                className="p-tl-item"
                variants={fadeUp}
                initial="hidden"
                animate="show"
                transition={{ delay: Math.min(i * 0.03, 0.4), ease: EASE }}
              >
                <span className="p-tl-rail">
                  <span className="p-tl-dot" style={{ background: `var(--${e.tone === "muted" ? "muted2" : e.tone})` }} />
                </span>
                <div className="p-tl-body">
                  <div className="p-tl-head">
                    <span className="p-tl-icon" style={{ color: `var(--${e.tone === "muted" ? "muted" : e.tone})` }}>
                      {e.kind === "content"
                        ? <IconContent size={13} />
                        : e.tone === "red" ? <IconArrowDown size={13} /> : <IconArrowUp size={13} />}
                    </span>
                    <span className="p-tl-title">{e.title}</span>
                  </div>
                  <div className="p-tl-meta">
                    {fmt(e.at)}{e.detail ? ` · ${e.detail}` : ""}
                  </div>
                </div>
              </m.div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
