"use client";

// Shared empty/status state for the Intelligence panels.
//
// These panels are all fed by the rank_sync job. Previously every one of them
// rendered the same bare "no data / run the agents" message regardless of the
// actual reason, which was misleading — most often the real cause is that a
// sync simply hasn't run yet, and in some cases GSC was never connected for
// the brand at all (in which case running the agents will never help).

export type DataStatusKind = "no_gsc" | "never_synced" | "syncing" | "ok";

const COPY: Record<Exclude<DataStatusKind, "ok">, { icon: string; title: string; body: string }> = {
  no_gsc: {
    icon: "🔌",
    title: "Search Console not connected",
    body: "This brand has no GSC property configured, so ranking data can't be collected. Add its gsc_property to start tracking positions.",
  },
  never_synced: {
    icon: "📡",
    title: "No ranking data collected yet",
    body: "The first rank sync hasn't run. Click \"Run agents\" to trigger one now, or wait for the daily 6am sync. Data appears here once it completes.",
  },
  syncing: {
    icon: "⏳",
    title: "Sync in progress",
    body: "Ranking data has started arriving but today's snapshot isn't aggregated yet. This panel fills in once the current sync finishes.",
  },
};

export default function DataStatus({ status, panel }: { status: DataStatusKind; panel?: string }) {
  if (status === "ok") return null;
  const c = COPY[status];
  return (
    <div className="io-empty">
      <div style={{ fontSize: 40, marginBottom: 12 }}>{c.icon}</div>
      <h3>{c.title}</h3>
      <p>{c.body}</p>
      {panel && <p style={{ fontSize: 12, color: "#B2BAC8", marginTop: 6 }}>{panel}</p>}
    </div>
  );
}
