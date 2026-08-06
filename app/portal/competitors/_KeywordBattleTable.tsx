"use client";
import { useState } from "react";
import { m } from "framer-motion";
import { authedFetch } from "@/lib/authedFetch";
import EmptyState from "../_components/EmptyState";
import { IconCheck, IconSparkle } from "../icons";
import type { AgentAction } from "../_components/ExecutionPanel";
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import { useToast } from "@/app/_components/Notify";

export type BattleRow = {
  keyword: string;
  /** Our position, or null when we don't rank at all. */
  ours: number | null;
  theirs: number;
  volume: number | null;
};

// Head-to-head keyword table. The one-click action runs through the existing
// /api/intelligence/action endpoint — no new backend.
export default function KeywordBattleTable({
  rows, brandId, action, actionLabel, emptyTitle, emptySub, competitorDomain,
}: {
  rows: BattleRow[];
  brandId: string;
  action: AgentAction;
  actionLabel: string;
  emptyTitle: string;
  emptySub: string;
  competitorDomain: string;
}) {
  const toast = useToast();
  const [state, setState] = useState<Record<string, "idle" | "busy" | "done">>({});

  async function run(keyword: string) {
    setState((s) => ({ ...s, [keyword]: "busy" }));
    try {
      const res = await authedFetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          brand_id: brandId,
          payload: {
            target_keyword: keyword,
            rationale: `Competitor ${competitorDomain} outranks you for "${keyword}"`,
          },
        }),
      });
      if (res.ok) setState((s) => ({ ...s, [keyword]: "done" }));
      else {
        const e = await res.json().catch(() => ({}));
        toast.error("Couldn't start that", e.error || "Please try again in a moment.");
        setState((s) => ({ ...s, [keyword]: "idle" }));
      }
    } catch {
      toast.error("Couldn't start that", "Check your connection and try again.");
      setState((s) => ({ ...s, [keyword]: "idle" }));
    }
  }

  if (!rows.length) return <EmptyState title={emptyTitle} sub={emptySub} />;

  return (
    <ResponsiveTable mode="scroll">
      <table className="p-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>You</th>
            <th>Them</th>
            <th>Searches / mo</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const st = state[r.keyword] || "idle";
            return (
              <tr key={r.keyword}>
                <td><div className="p-kwcell" title={r.keyword}>{r.keyword}</div></td>
                <td>
                  {r.ours == null
                    ? <span className="p-battle-none">Not ranking</span>
                    : <span className={`p-pos ${posClass(r.ours)}`}>{r.ours}</span>}
                </td>
                <td><span className={`p-pos ${posClass(r.theirs)}`}>{r.theirs}</span></td>
                <td>{r.volume != null ? r.volume.toLocaleString() : <span className="p-na">—</span>}</td>
                <td style={{ textAlign: "right" }}>
                  {st === "done" ? (
                    <span className="p-badge green" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <IconCheck size={11} /> Queued
                    </span>
                  ) : (
                    <m.button
                      className="p-btn ghost p-battle-btn"
                      disabled={st === "busy"}
                      onClick={() => run(r.keyword)}
                      whileTap={{ scale: 0.97 }}
                    >
                      {st === "busy" ? "…" : <><IconSparkle size={12} /> {actionLabel}</>}
                    </m.button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}

function posClass(pos: number) {
  return pos <= 3 ? "top3" : pos <= 10 ? "top10" : pos <= 20 ? "top20" : "";
}
