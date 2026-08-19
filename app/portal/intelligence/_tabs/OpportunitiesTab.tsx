"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { Panel, PanelHead } from "../../_components/Panel";
import EmptyState from "../../_components/EmptyState";
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import { useToast } from "@/app/_components/Notify";

type AlmostRow = {
  keyword: string; position?: number; search_volume?: number | null;
  landing_page?: string | null; ai_opportunity_reason?: string | null;
};

/**
 * Intelligence opportunities = ranking signals only.
 * Work to approve lives in the Content / Approvals queue — not a second
 * parallel "AI recommendations" list.
 */
export default function OpportunitiesTab({ brandId }: { brandId: string }) {
  const toast = useToast();
  const [almost, setAlmost] = useState<AlmostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [queued, setQueued] = useState<Record<string, "loading" | "done">>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/intelligence/winners-losers?brand=${brandId}`)
      .then((r) => r.json())
      .then((wl) => {
        if (cancelled) return;
        setAlmost(Array.isArray(wl?.almost_page_1) ? wl.almost_page_1 : []);
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  async function queueBoost(row: AlmostRow) {
    const key = row.keyword;
    setQueued((q) => ({ ...q, [key]: "loading" }));
    try {
      const res = await authedFetch("/api/intelligence/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "boost_page1",
          brand_id: brandId,
          payload: {
            target_keyword: row.keyword,
            target_url: row.landing_page,
            event_label: "Page 1 boost",
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error("Couldn't queue that", err.error || "Please try again.");
        setQueued((q) => { const n = { ...q }; delete n[key]; return n; });
        return;
      }
      setQueued((q) => ({ ...q, [key]: "done" }));
      toast.success("Queued for Approvals", "The draft will show up in your approval inbox.");
    } catch {
      toast.error("Couldn't queue that", "Check your connection and try again.");
      setQueued((q) => { const n = { ...q }; delete n[key]; return n; });
    }
  }

  if (loading) {
    return (
      <div className="p-stack">
        {[...Array(3)].map((_, i) => <div key={i} className="p-skel" style={{ height: 120 }} />)}
      </div>
    );
  }

  return (
    <div className="p-stack">
      <Panel>
        <PanelHead
          title="Almost on page 1"
          badge={almost.length || undefined}
          badgeTone="amber"
          sub="Keywords in positions 11–20. Queue work from here — it lands in Approvals to approve, decline, or autopilot."
        />
        {almost.length === 0 ? (
          <EmptyState icon="⚡" title="Nothing in striking distance right now" sub="Keywords ranking between positions 11 and 20 will show up here." />
        ) : (
          <ResponsiveTable>
            <table className="p-table">
              <thead>
                <tr><th>Keyword</th><th>Position</th><th>Searches / mo</th><th>Page</th><th></th></tr>
              </thead>
              <tbody>
                {almost.map((r) => (
                  <tr key={r.keyword}>
                    <td><div className="p-kwcell" title={r.keyword}>{r.keyword}</div></td>
                    <td><span className="p-pos top20">{r.position}</span></td>
                    <td>{r.search_volume != null ? r.search_volume.toLocaleString() : <span className="p-na">—</span>}</td>
                    <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)", fontSize: 12 }}>
                      {r.landing_page ? r.landing_page.replace(/^https?:\/\/[^/]+/, "") || "/" : <span className="p-na">—</span>}
                    </td>
                    <td>
                      {queued[r.keyword] === "done" ? (
                        <span className="p-badge green">In Approvals</span>
                      ) : (
                        <button
                          className="p-btn primary"
                          style={{ padding: "6px 12px", fontSize: 12 }}
                          disabled={queued[r.keyword] === "loading"}
                          onClick={() => queueBoost(r)}
                        >
                          {queued[r.keyword] === "loading" ? "…" : "Queue"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </Panel>
    </div>
  );
}
