"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { IconSparkle } from "../icons";

// Portal-native AI executive summary card.
//
// Uses the SAME two existing endpoints the admin dashboard's ExecSummary uses
// (/api/intelligence/recommendations then /api/intelligence/exec-summary) --
// no new backend, no duplicated server logic. It exists as a separate
// component only because the admin one hardcodes light-mode colors, and the
// portal is required to support dark mode; the admin component is frozen.
export default function AiSummary({ brandId, section, brandName, data }: {
  brandId: string;
  section: string;
  brandName?: string;
  data?: unknown;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const cacheKey = `portal_exec_${brandId}_${section}_${new Date().toISOString().slice(0, 13)}`;

  useEffect(() => {
    if (!brandId) return;
    let cancelled = false;

    const cached = localStorage.getItem(cacheKey);
    if (cached) { setText(cached); setLoading(false); return; }

    (async () => {
      try {
        const recRes = await authedFetch(`/api/intelligence/recommendations?brand=${brandId}&section=${encodeURIComponent(section)}`);
        const recJson = await recRes.json();
        const recommendations = recJson.recommendations || [];

        const sumRes = await authedFetch("/api/intelligence/exec-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId, section, brandName, recommendations: recommendations.slice(0, 3), data }),
        });
        const sumJson = await sumRes.json();

        if (cancelled) return;
        if (sumJson?.summary) {
          setText(sumJson.summary);
          localStorage.setItem(cacheKey, sumJson.summary);
        }
      } catch {
        /* leave empty — card simply doesn't render */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [brandId, section]);

  if (loading) {
    return (
      <div className="p-exec">
        <span className="p-exec-icon"><IconSparkle size={17} /></span>
        <div style={{ flex: 1 }}>
          <div className="p-exec-label">AI Executive Summary</div>
          <div className="p-skel" style={{ height: 12, width: "72%", marginTop: 8 }} />
          <div className="p-skel" style={{ height: 12, width: "48%", marginTop: 8 }} />
        </div>
      </div>
    );
  }

  if (!text) return null;

  return (
    <div className="p-exec">
      <span className="p-exec-icon"><IconSparkle size={17} /></span>
      <div>
        <div className="p-exec-label">AI Executive Summary</div>
        <p className="p-exec-text">{text}</p>
      </div>
    </div>
  );
}
