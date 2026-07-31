"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";

type Props = {
  brandId: string;
  section: string;
  data?: unknown;
  brandName?: string;
};

// Streams an AI executive summary paragraph from Claude.
// Cached server-side in the reports table (4-hour TTL).
// Shows instantly from localStorage if cached there too (same-device fast path).
export default function ExecSummary({ brandId, section, data, brandName }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const cacheKey = `exec_${brandId}_${section}_${new Date().toISOString().slice(0, 13)}`;

  useEffect(() => {
    if (!brandId) return;

    // Fast path: local cache (within same hour)
    const local = localStorage.getItem(cacheKey);
    if (local) { setText(local); setLoading(false); return; }

    // Fetch from server (may return cached or generate fresh)
    authedFetch(`/api/intelligence/recommendations?brand=${brandId}&section=${section}`)
      .then((r) => r.json())
      .then((d) => {
        // Generate a focused exec summary from the recommendations + data context
        const recs = d.recommendations || [];
        if (!recs.length && !data) { setLoading(false); return; }

        return authedFetch("/api/intelligence/exec-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ brandId, section, brandName, recommendations: recs.slice(0, 3), data }),
        });
      })
      .then((r) => r?.json?.())
      .then((d) => {
        if (d?.summary) {
          setText(d.summary);
          localStorage.setItem(cacheKey, d.summary);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [brandId, section]);

  if (loading) return (
    <div style={{ background: "linear-gradient(135deg,#F8F7FF,#EEF2FF)", border: "1px solid #E0E7FF", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 14 }}>✦</span>
        <div style={{ height: 12, background: "#E0E7FF", borderRadius: 6, width: "60%", animation: "shimmer 1.4s infinite" }} />
      </div>
    </div>
  );

  if (!text) return null;

  return (
    <div style={{ background: "linear-gradient(135deg,#F8F7FF,#EEF2FF)", border: "1px solid #E0E7FF", borderRadius: 12, padding: "14px 16px", marginBottom: 20 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span style={{ fontSize: 14, marginTop: 1, flexShrink: 0 }}>✦</span>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#6C5CE7", letterSpacing: ".06em", textTransform: "uppercase" as const, marginRight: 8 }}>AI Analysis</span>
          <span style={{ fontSize: 13.5, color: "#3730A3", lineHeight: 1.65 }}>{text}</span>
        </div>
      </div>
    </div>
  );
}
