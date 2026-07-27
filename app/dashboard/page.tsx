"use client";
import { useEffect, useState } from "react";

type Draft = {
  id: string;
  task_type: string;
  target_url: string | null;
  target_keyword: string | null;
  title: string;
  body: string;
  rationale: string;
  status: string;
  created_at: string;
};

const LABEL: Record<string, string> = {
  fix_meta: "Meta fix",
  improve_content: "Content audit",
  new_page: "New page",
  new_blog: "New blog",
  technical_fix: "Technical",
};

export default function Dashboard() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningNow, setRunningNow] = useState(false);

  async function load() {
    const res = await fetch("/api/drafts");
    setDrafts(await res.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, path: string) {
    await fetch(`/api/drafts/${id}/${path}`, { method: "POST" });
    load();
  }
  async function runNow() {
    setRunningNow(true);
    try {
      const res = await fetch("/api/cron/orchestrate", { method: "POST" });
      const result = await res.json();
      if (!result.ok) alert("Run finished with an issue: " + (result.error || "unknown"));
    } catch (e) {
      alert("Run failed: " + String(e));
    }
    setRunningNow(false);
    load();
  }

  const pending = drafts.filter((d) => d.status === "pending_review");
  const approved = drafts.filter((d) => d.status === "approved");

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>Junk Free — Mission Control</h1>
          <p style={{ color: "#667", fontSize: 13, margin: "4px 0 0" }}>The agents run daily. Review what they produced.</p>
        </div>
        <button onClick={runNow} disabled={runningNow} style={btn}>
          {runningNow ? "Running…" : "Run agents now"}
        </button>
      </header>

      {loading && <p style={{ color: "#889" }}>Loading queue…</p>}
      {!loading && !pending.length && !approved.length && (
        <p style={{ color: "#889" }}>Queue is empty. Hit “Run agents now” or wait for the next scheduled run.</p>
      )}

      {[...pending, ...approved].map((d) => (
        <article key={d.id} style={card}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
            <span style={tag}>{LABEL[d.task_type] || d.task_type}</span>
            <span style={{ fontSize: 12, color: d.status === "approved" ? "#188a5a" : "#a76" }}>{d.status.replace("_", " ")}</span>
          </div>
          <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{d.title}</h3>
          <p style={{ fontSize: 12.5, color: "#667", margin: "0 0 10px" }}>{d.rationale}</p>
          <pre style={pre}>{d.body.slice(0, 1200)}{d.body.length > 1200 ? "…" : ""}</pre>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            {d.status === "pending_review" && <button onClick={() => act(d.id, "approve")} style={btn}>Approve</button>}
            {d.status === "approved" && <button onClick={() => act(d.id, "publish")} style={{ ...btn, background: "#188a5a" }}>Publish</button>}
            <button onClick={() => act(d.id, "approve?action=dismiss")} style={ghost}>Dismiss</button>
          </div>
        </article>
      ))}
    </main>
  );
}

const card: React.CSSProperties = { border: "1px solid #e4e4dd", borderRadius: 10, padding: 16, marginBottom: 14 };
const tag: React.CSSProperties = { fontSize: 11, fontWeight: 600, background: "#f0f0e8", padding: "2px 8px", borderRadius: 4 };
const pre: React.CSSProperties = { whiteSpace: "pre-wrap", fontSize: 12, background: "#faf9f5", padding: 12, borderRadius: 6, maxHeight: 220, overflow: "auto", margin: 0 };
const btn: React.CSSProperties = { background: "#228B5A", color: "#fff", border: 0, padding: "7px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 600 };
const ghost: React.CSSProperties = { background: "transparent", color: "#889", border: "1px solid #ddd", padding: "7px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer" };
