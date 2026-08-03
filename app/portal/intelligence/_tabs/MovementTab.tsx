"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { Panel, PanelHead } from "../../_components/Panel";
import EmptyState from "../../_components/EmptyState";
import { IconArrowUp, IconArrowDown } from "../../icons";

type MoveRow = {
  keyword: string;
  current_position?: number; previous_position?: number; change?: number;
  position?: number; last_position?: number;
  search_volume?: number | null;
};
type Movement = {
  gains: MoveRow[]; drops: MoveRow[];
  new_keywords: MoveRow[]; lost_keywords: MoveRow[];
  almost_page_1: MoveRow[];
};

export default function MovementTab({ brandId }: { brandId: string }) {
  const [data, setData] = useState<Movement | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/intelligence/winners-losers?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  if (loading) {
    return (
      <div className="p-2col">
        <div className="p-skel" style={{ height: 300 }} />
        <div className="p-skel" style={{ height: 300 }} />
      </div>
    );
  }

  const total = data
    ? data.gains.length + data.drops.length + data.new_keywords.length + data.lost_keywords.length
    : 0;

  if (!data || total === 0) {
    return (
      <EmptyState
        icon="⇅"
        title="No ranking movement recorded yet"
        sub="Movement compares today's positions against last week's. Once we have a week of history, gains and drops appear here."
      />
    );
  }

  return (
    <div className="p-2col">
      <div className="p-stack">
        <Panel>
          <PanelHead title="Biggest gains" badge={data.gains.length || undefined} badgeTone="green" sub="Keywords that moved up over the last 7 days." />
          <MoveList rows={data.gains} kind="gain" />
        </Panel>
        <Panel>
          <PanelHead title="New keywords" badge={data.new_keywords.length || undefined} badgeTone="accent" sub="Started ranking in the last 7 days." />
          <MoveList rows={data.new_keywords} kind="new" />
        </Panel>
      </div>
      <div className="p-stack">
        <Panel>
          <PanelHead title="Biggest drops" badge={data.drops.length || undefined} badgeTone="red" sub="Keywords that slipped over the last 7 days." />
          <MoveList rows={data.drops} kind="drop" />
        </Panel>
        <Panel>
          <PanelHead title="Lost keywords" badge={data.lost_keywords.length || undefined} badgeTone="amber" sub="No longer ranking in the top 100." />
          <MoveList rows={data.lost_keywords} kind="lost" />
        </Panel>
      </div>
    </div>
  );
}

function MoveList({ rows, kind }: { rows: MoveRow[]; kind: "gain" | "drop" | "new" | "lost" }) {
  if (!rows.length) {
    return <p className="p-empty-sub" style={{ margin: "6px 0 0", textAlign: "left" }}>Nothing here right now.</p>;
  }
  return (
    <div>
      {rows.map((r, i) => (
        <div key={i} className="p-move-row">
          <div style={{ minWidth: 0 }}>
            <div className="p-move-kw" title={r.keyword}>{r.keyword}</div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
              {kind === "gain" || kind === "drop"
                ? `Position ${r.previous_position} → ${r.current_position}`
                : kind === "new"
                ? `Now at position ${r.position}`
                : `Last seen at position ${r.last_position}`}
              {r.search_volume ? ` · ${r.search_volume.toLocaleString()} searches/mo` : ""}
            </div>
          </div>
          {kind === "gain" && <span className="p-move-delta up"><IconArrowUp size={11} />{r.change}</span>}
          {kind === "drop" && <span className="p-move-delta down"><IconArrowDown size={11} />{r.change}</span>}
          {kind === "new" && <span className="p-move-delta up">new</span>}
          {kind === "lost" && <span className="p-move-delta flat">lost</span>}
        </div>
      ))}
    </div>
  );
}
