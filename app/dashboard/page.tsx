"use client";
import { useEffect, useState } from "react";

type Brand = { id: string; slug: string; name: string };
type Draft = { id: string; brand_id: string; task_type: string; target_url: string | null; title: string; body: string; rationale: string; status: string };
type Gbp = { id: string; brand_id: string; title: string; body: string; cta: string; status: string };
type Cite = { id: string; brand_id: string; name: string; url: string; category: string; priority: number; rationale: string; status: string };

const LABEL: Record<string, string> = { fix_meta: "Meta / intent fix", improve_content: "Content audit", new_page: "New page", new_blog: "New blog", geo_answers: "AI-answer content (GEO)" };

export default function Dashboard() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [gbp, setGbp] = useState<Gbp[]>([]);
  const [citations, setCitations] = useState<Cite[]>([]);
  const [brandId, setBrandId] = useState<string>("");
  const [tab, setTab] = useState<"content" | "gbp" | "citations">("content");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [rewriting, setRewriting] = useState("");

  async function load() {
    const res = await fetch("/api/platform");
    const d = await res.json();
    setBrands(d.brands); setDrafts(d.drafts); setGbp(d.gbp); setCitations(d.citations);
    if (!brandId && d.brands[0]) setBrandId(d.brands[0].id);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function draftAct(id: string, path: string) { await fetch(`/api/drafts/${id}/${path}`, { method: "POST" }); load(); }
  async function rowAct(table: string, id: string, status: string) {
    await fetch(`/api/platform/${table}/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }
  async function processImages() {
    // Adds AI images to content drafts one at a time (each call is quick).
    for (let i = 0; i < 12; i++) {
      try {
        const r = await (await fetch("/api/images/process", { method: "POST" })).json();
        load();
        if (r.done) break;
      } catch { break; }
    }
  }
  async function rewriteExisting() {
    setRewriting("Rewriting existing posts… (0 done)");
    let n = 0;
    for (let i = 0; i < 20; i++) {
      try {
        const r = await (await fetch("/api/rewrite-existing", { method: "POST" })).json();
        if (r.done) break;
        n++;
        setRewriting(`Rewriting existing posts… (${n} done, ${r.remaining ?? "?"} left)`);
        load();
      } catch { break; }
    }
    setRewriting("");
    alert("Done rewriting existing blog posts. They now render deep content on the live site.");
    load();
  }
  async function runNow() {
    setRunning(true);
    try {
      // Enqueue the run (one plan job per brand), then process the queue one
      // small job at a time so it never hits the free-tier 60s limit.
      await fetch("/api/run", { method: "POST" });
      for (let i = 0; i < 60; i++) {
        const r = await (await fetch("/api/step", { method: "POST" })).json();
        load();
        if (r.done) break;
      }
      // Finally, add AI images to any new content drafts.
      await processImages();
    } catch (e) {
      alert("Run error: " + String(e));
    }
    setRunning(false);
    load();
  }

  const bDrafts = drafts.filter((d) => d.brand_id === brandId && d.status !== "dismissed" && d.status !== "published");
  const bGbp = gbp.filter((g) => g.brand_id === brandId && g.status === "pending_review");
  const bCites = citations.filter((c) => c.brand_id === brandId && c.status !== "skipped");

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, sans-serif", color: "#1a1a1a" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, margin: 0 }}>SEO Platform — Mission Control</h1>
          <p style={{ color: "#667", fontSize: 13, margin: "4px 0 0" }}>Multi-brand local SEO. Agents run daily; review and approve their work.</p>
        </div>
        <button onClick={runNow} disabled={running} style={btn}>{running ? "Running…" : "Run agents now"}</button>
      </header>

      {/* Brand switcher */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {brands.map((b) => (
          <button key={b.id} onClick={() => setBrandId(b.id)} style={brandId === b.id ? pillOn : pill}>{b.name}</button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e4e4dd", marginBottom: 16 }}>
        <Tab on={tab === "content"} onClick={() => setTab("content")} label={`Content (${bDrafts.length})`} />
        <Tab on={tab === "gbp"} onClick={() => setTab("gbp")} label={`Google Posts (${bGbp.length})`} />
        <Tab on={tab === "citations"} onClick={() => setTab("citations")} label={`Backlinks (${bCites.length})`} />
      </div>

      {loading && <p style={{ color: "#889" }}>Loading…</p>}

      {tab === "content" && !loading && (
        bDrafts.length ? bDrafts.map((d) => (
          <article key={d.id} style={card}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 6 }}>
              <span style={chip}>{LABEL[d.task_type] || d.task_type}</span>
              <span style={{ fontSize: 12, color: d.status === "approved" ? "#188a5a" : "#a76" }}>{d.status.replace("_", " ")}</span>
            </div>
            <h3 style={{ margin: "0 0 4px", fontSize: 15 }}>{d.title}</h3>
            <p style={{ fontSize: 12.5, color: "#667", margin: "0 0 10px" }}>{d.rationale}</p>
            <DraftBody body={d.body} />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {d.status === "pending_review" && <button onClick={() => draftAct(d.id, "approve")} style={btn}>Approve</button>}
              {d.status === "approved" && <button onClick={() => draftAct(d.id, "publish")} style={{ ...btn, background: "#188a5a" }}>Publish</button>}
              <button onClick={() => draftAct(d.id, "approve?action=dismiss")} style={ghost}>Dismiss</button>
            </div>
          </article>
        )) : <Empty />
      )}

      {tab === "gbp" && !loading && (
        bGbp.length ? bGbp.map((g) => (
          <article key={g.id} style={card}>
            <span style={chip}>Google Business post</span>
            <h3 style={{ margin: "8px 0 4px", fontSize: 15 }}>{g.title}</h3>
            <pre style={pre}>{g.body}</pre>
            <p style={{ fontSize: 12, color: "#667", margin: "8px 0 0" }}>CTA: {g.cta}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => rowAct("gbp_posts", g.id, "approved")} style={btn}>Mark posted</button>
              <button onClick={() => rowAct("gbp_posts", g.id, "dismissed")} style={ghost}>Dismiss</button>
            </div>
          </article>
        )) : <Empty />
      )}

      {tab === "citations" && !loading && (
        bCites.length ? bCites.map((c) => (
          <article key={c.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <strong style={{ fontSize: 14 }}>{c.name}</strong>
                <span style={chip}>{c.category}</span>
                <span style={{ fontSize: 11, color: "#a76" }}>priority {c.priority}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "#667", margin: "4px 0 0" }}>{c.rationale}</p>
              {c.url && <a href={c.url} target="_blank" style={{ fontSize: 12, color: "#228B5A" }}>{c.url}</a>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => rowAct("citations", c.id, "live")} style={btn}>Done</button>
              <button onClick={() => rowAct("citations", c.id, "skipped")} style={ghost}>Skip</button>
            </div>
          </article>
        )) : <Empty />
      )}
    </main>
  );
}

function Tab({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} style={{ background: "transparent", border: 0, borderBottom: on ? "2px solid #228B5A" : "2px solid transparent", color: on ? "#1a1a1a" : "#889", padding: "8px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>;
}
function Empty() { return <p style={{ color: "#889" }}>Nothing here yet. Hit “Run agents now”.</p>; }

// Renders a draft body. If it's JSON (meta/intent fixes), show the title & meta
// options as readable, copyable suggestions instead of raw JSON or a blank box.
function DraftBody({ body }: { body: string }) {
  let parsed: unknown = null;
  try {
    const t = body.replace(/```json/gi, "").replace(/```/g, "").trim();
    if (t.startsWith("{") || t.startsWith("[")) parsed = JSON.parse(t);
  } catch { /* not JSON — fall through to text */ }

  if (parsed && typeof parsed === "object") {
    const p = parsed as Record<string, unknown>;
    const titles = (p.titles as string[]) || (p.title ? [p.title as string] : []);
    const metas = (p.metas as string[]) || (p.meta ? [p.meta as string] : []);
    const opening = p.opening as string | undefined;
    const why = p.why as string | undefined;
    if (titles.length || metas.length || opening) {
      return (
        <div style={{ ...pre, display: "block" }}>
          {titles.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <strong style={{ fontSize: 12, color: "#556" }}>Title tag options:</strong>
              {titles.map((t, i) => (
                <div key={i} style={optRow} onClick={() => navigator.clipboard?.writeText(t)} title="Click to copy">• {t}</div>
              ))}
            </div>
          )}
          {metas.length > 0 && (
            <div style={{ marginBottom: opening ? 10 : 0 }}>
              <strong style={{ fontSize: 12, color: "#556" }}>Meta description options:</strong>
              {metas.map((m, i) => (
                <div key={i} style={optRow} onClick={() => navigator.clipboard?.writeText(m)} title="Click to copy">• {m}</div>
              ))}
            </div>
          )}
          {opening && (
            <div>
              <strong style={{ fontSize: 12, color: "#556" }}>New opening paragraph:</strong>
              <div style={{ ...optRow, whiteSpace: "pre-wrap" }} onClick={() => navigator.clipboard?.writeText(opening)}>{opening}</div>
            </div>
          )}
          {why && <p style={{ fontSize: 11.5, color: "#889", margin: "10px 0 0" }}>Why: {why}</p>}
          <p style={{ fontSize: 10.5, color: "#aab", margin: "8px 0 0" }}>Tip: click any option to copy it.</p>
        </div>
      );
    }
  }
  return <pre style={pre}>{body}</pre>;
}
const optRow: React.CSSProperties = { fontSize: 12.5, padding: "6px 8px", margin: "4px 0", background: "#f7f7f2", borderRadius: 5, cursor: "pointer", border: "1px solid #ececE4" };

const card: React.CSSProperties = { border: "1px solid #e4e4dd", borderRadius: 10, padding: 16, marginBottom: 14, background: "#fff" };
const chip: React.CSSProperties = { fontSize: 11, fontWeight: 600, background: "#f0f0e8", padding: "2px 8px", borderRadius: 4 };
const pre: React.CSSProperties = { whiteSpace: "pre-wrap", fontSize: 12, color: "#1a1a1a", background: "#fff", padding: 12, borderRadius: 6, maxHeight: 420, overflow: "auto", margin: 0, border: "1px solid #e4e4dd" };
const btn: React.CSSProperties = { background: "#228B5A", color: "#fff", border: 0, padding: "7px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 600 };
const ghost: React.CSSProperties = { background: "transparent", color: "#889", border: "1px solid #ddd", padding: "7px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer" };
const pill: React.CSSProperties = { background: "#f0f0e8", color: "#556", border: 0, padding: "6px 14px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontWeight: 600 };
const pillOn: React.CSSProperties = { ...pill, background: "#228B5A", color: "#fff" };
