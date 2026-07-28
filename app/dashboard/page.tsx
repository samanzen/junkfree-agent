"use client";
import { useEffect, useState } from "react";
import Overview from "./Overview";

type Brand = { id: string; slug: string; name: string; auto_publish_meta?: boolean };
type Draft = { id: string; brand_id: string; task_type: string; target_url: string | null; title: string; body: string; rationale: string; status: string };
type Gbp = { id: string; brand_id: string; title: string; body: string; cta: string; status: string };
type Cite = { id: string; brand_id: string; name: string; url: string; category: string; priority: number; rationale: string; status: string };

const LABEL: Record<string, string> = {
  fix_meta: "meta / intent", improve_content: "content audit", new_page: "new page",
  new_blog: "new blog", geo_answers: "AI-answer (GEO)",
};

export default function Dashboard() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [gbp, setGbp] = useState<Gbp[]>([]);
  const [citations, setCitations] = useState<Cite[]>([]);
  const [brandId, setBrandId] = useState("");
  const [tab, setTab] = useState<"overview" | "content" | "gbp" | "citations">("overview");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runStatus, setRunStatus] = useState("");
  const [feedbackFor, setFeedbackFor] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [busy, setBusy] = useState("");

  async function load() {
    const d = await (await fetch("/api/platform")).json();
    setBrands(d.brands); setDrafts(d.drafts); setGbp(d.gbp); setCitations(d.citations);
    if (!brandId && d.brands[0]) setBrandId(d.brands[0].id);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function draftAct(id: string, path: string) {
    try {
      const r = await (await fetch(`/api/drafts/${id}/${path}`, { method: "POST" })).json();
      if (r.ok === false && r.error) alert(r.error);
    } catch (e) { alert("Action failed: " + String(e)); }
    load();
  }
  async function sendFeedback(id: string) {
    if (!feedbackText.trim()) return;
    setBusy(id);
    try {
      const r = await (await fetch(`/api/drafts/${id}/revise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback: feedbackText }) })).json();
      if (r.ok === false) alert(r.error || "Revision failed");
    } catch (e) { alert("Revision failed: " + String(e)); }
    setBusy(""); setFeedbackFor(""); setFeedbackText(""); load();
  }
  async function toggleAuto(id: string, current: boolean) {
    await fetch(`/api/brand/${id}/mode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auto_publish_meta: !current }) });
    load();
  }
  async function rowAct(table: string, id: string, status: string) {
    await fetch(`/api/platform/${table}/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }
  async function processImages() {
    for (let i = 0; i < 12; i++) {
      try { const r = await (await fetch("/api/images/process", { method: "POST" })).json(); load(); if (r.done) break; } catch { break; }
    }
  }
  async function runNow() {
    setRunning(true); setRunStatus("waking the agents");
    try { await fetch("/api/run", { method: "POST" }); } catch {}
    // Process the queue one step at a time. A slow step may time out at the
    // platform limit and return a non-JSON page — that's fine, the work
    // continues server-side, so we just keep going and refresh.
    let idle = 0;
    for (let i = 0; i < 80; i++) {
      let done = false;
      try {
        const res = await fetch("/api/step", { method: "POST" });
        const r = await res.json();
        if (r.kind) setRunStatus(`running · ${r.kind}${r.remaining ? ` · ${r.remaining} queued` : ""}`);
        done = !!r.done;
        idle = 0;
      } catch {
        // step timed out or returned non-JSON; wait briefly and continue
        setRunStatus("running · heavy step…");
        idle++;
        await new Promise((res) => setTimeout(res, 3000));
        if (idle > 6) done = true; // give up after repeated empties
      }
      load();
      if (done) break;
    }
    setRunStatus("generating images");
    try { await processImages(); } catch {}
    setRunning(false); setRunStatus(""); load();
  }

  const brand = brands.find((b) => b.id === brandId);
  const bDrafts = drafts.filter((d) => d.brand_id === brandId && d.status !== "dismissed" && d.status !== "published");
  const bGbp = gbp.filter((g) => g.brand_id === brandId && g.status === "pending_review");
  const bCites = citations.filter((c) => c.brand_id === brandId && c.status !== "skipped");
  const auto = !!brand?.auto_publish_meta;

  return (
    <div className="sr">
      <style>{CSS}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div className="wrap">
        <header className="cmd">
          <div>
            <div className="eyebrow"><span className={`pulse ${running ? "live" : ""}`} /> autonomous seo platform</div>
            <h1>Mission Control</h1>
          </div>
          <button className={`run ${running ? "on" : ""}`} onClick={runNow} disabled={running}>
            {running ? <span className="runstat">{runStatus || "running"}</span> : "Run agents"}
          </button>
        </header>

        <div className="brandrow">
          <div className="seg">
            {brands.map((b) => (
              <button key={b.id} className={b.id === brandId ? "on" : ""} onClick={() => setBrandId(b.id)}>
                <span className={`dot ${b.id === brandId ? "" : "off"}`} />{b.name}
              </button>
            ))}
          </div>
          {brand && (
            <button className={`mode ${auto ? "auto" : ""}`} onClick={() => toggleAuto(brand.id, auto)}
              title="Review: you approve each item. Auto: the agent publishes on its own.">
              {auto ? "◉ Auto-publish" : "◎ Review mode"}
            </button>
          )}
        </div>

        <nav className="tabs">
          <button className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}>Overview</button>
          <button className={tab === "content" ? "on" : ""} onClick={() => setTab("content")}>Content<span>{bDrafts.length}</span></button>
          <button className={tab === "gbp" ? "on" : ""} onClick={() => setTab("gbp")}>Google posts<span>{bGbp.length}</span></button>
          <button className={tab === "citations" ? "on" : ""} onClick={() => setTab("citations")}>Backlinks<span>{bCites.length}</span></button>
        </nav>

        {loading && <p className="muted">Loading signal…</p>}

        {tab === "overview" && brandId && <Overview brandId={brandId} />}

        {!loading && tab === "content" && (bDrafts.length ? bDrafts.map((d) => (
          <article className="card" key={d.id}>
            <div className="meta"><span className="kind">{LABEL[d.task_type] || d.task_type}</span><span className={`stat ${d.status}`}>{d.status.replace("_", " ")}</span></div>
            <h3>{d.title}</h3>
            <p className="why">{d.rationale}</p>
            <DraftBody body={d.body} />
            <div className="acts">
              {d.status === "pending_review" && <button className="primary" onClick={() => draftAct(d.id, "approve")}>Approve &amp; publish</button>}
              {d.status === "approved" && <button className="primary" onClick={() => draftAct(d.id, "publish")}>Publish</button>}
              <button className="ghost" onClick={() => draftAct(d.id, "approve?action=dismiss")}>Dismiss</button>
              <button className="ghost" onClick={() => { setFeedbackFor(feedbackFor === d.id ? "" : d.id); setFeedbackText(""); }}>Give feedback</button>
            </div>
            {feedbackFor === d.id && (
              <div className="fb">
                <input autoFocus value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendFeedback(d.id); }}
                  placeholder="Tell the agent what to change — shorter, different tone, add local detail…" />
                <button className="primary" onClick={() => sendFeedback(d.id)} disabled={busy === d.id}>{busy === d.id ? "Revising…" : "Send"}</button>
              </div>
            )}
          </article>
        )) : <Empty label="No content in the queue. Hit Run agents." />)}

        {!loading && tab === "gbp" && (bGbp.length ? bGbp.map((g) => (
          <article className="card" key={g.id}>
            <div className="meta"><span className="kind">google business post</span></div>
            <h3>{g.title}</h3>
            <DraftBody body={g.body} />
            <p className="why">Call to action: {g.cta}</p>
            <div className="acts">
              <button className="primary" onClick={() => rowAct("gbp_posts", g.id, "approved")}>Mark posted</button>
              <button className="ghost" onClick={() => rowAct("gbp_posts", g.id, "dismissed")}>Dismiss</button>
            </div>
          </article>
        )) : <Empty label="No Google posts yet. Hit Run agents." />)}

        {!loading && tab === "citations" && (bCites.length ? bCites.map((c) => (
          <article className="card row" key={c.id}>
            <div>
              <div className="meta"><strong>{c.name}</strong><span className="kind">{c.category}</span><span className="prio">P{c.priority}</span></div>
              <p className="why">{c.rationale}</p>
              {c.url && <a className="link" href={c.url} target="_blank" rel="noreferrer">{c.url}</a>}
            </div>
            <div className="acts">
              <button className="primary" onClick={() => rowAct("citations", c.id, "live")}>Done</button>
              <button className="ghost" onClick={() => rowAct("citations", c.id, "skipped")}>Skip</button>
            </div>
          </article>
        )) : <Empty label="No backlink opportunities yet. Hit Run agents." />)}
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) { return <div className="empty">{label}</div>; }

function DraftBody({ body }: { body: string }) {
  let parsed: Record<string, unknown> | null = null;
  try { const t = body.replace(/```json/gi, "").replace(/```/g, "").trim(); if (t.startsWith("{")) parsed = JSON.parse(t); } catch {}
  if (parsed) {
    const titles = (parsed.titles as string[]) || (parsed.title ? [parsed.title as string] : []);
    const metas = (parsed.metas as string[]) || (parsed.meta ? [parsed.meta as string] : []);
    const opening = parsed.opening as string | undefined;
    if (titles.length || metas.length || opening) {
      const copy = (t: string) => navigator.clipboard?.writeText(t);
      return (
        <div className="body">
          {titles.length > 0 && <><div className="fieldlabel">title tag</div>{titles.map((t, i) => <div key={i} className="opt" onClick={() => copy(t)}>{t}</div>)}</>}
          {metas.length > 0 && <><div className="fieldlabel">meta description</div>{metas.map((m, i) => <div key={i} className="opt" onClick={() => copy(m)}>{m}</div>)}</>}
          {opening && <><div className="fieldlabel">new opening</div><div className="opt" onClick={() => copy(opening)}>{opening}</div></>}
          <div className="hint">click any option to copy</div>
        </div>
      );
    }
  }
  return <pre className="body prose">{body}</pre>;
}

const CSS = `
.sr { --bg:#0B0F17; --surface:#141B26; --surface2:#1B2432; --line:#263041; --text:#E6EBF2; --muted:#7E8CA0;
  --accent:#34E0C4; --accent-dim:rgba(52,224,196,.12); --amber:#F5B461; --coral:#FF6B6B; --violet:#A78BFA;
  min-height:100vh; background:radial-gradient(1200px 600px at 80% -10%, rgba(52,224,196,.06), transparent 60%), var(--bg);
  color:var(--text); font-family:'Space Grotesk',-apple-system,Segoe UI,Roboto,sans-serif; -webkit-font-smoothing:antialiased; }
.sr * { box-sizing:border-box; }
.sr .wrap { max-width:860px; margin:0 auto; padding:40px 20px 80px; }
.sr .eyebrow { display:flex; align-items:center; gap:8px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.sr .pulse { width:7px; height:7px; border-radius:50%; background:var(--muted); }
.sr .pulse.live { background:var(--accent); animation:pulse 1.6s ease-out infinite; }
@keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(52,224,196,.5)} 70%{box-shadow:0 0 0 8px rgba(52,224,196,0)} 100%{box-shadow:0 0 0 0 rgba(52,224,196,0)} }
.sr .cmd { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:28px; }
.sr h1 { font-size:34px; font-weight:700; letter-spacing:-.02em; margin:0; }
.sr .run { background:var(--accent); color:#04231e; border:0; padding:13px 22px; border-radius:10px; font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:14px; cursor:pointer; white-space:nowrap; transition:transform .1s, box-shadow .2s; box-shadow:0 0 24px rgba(52,224,196,.25); }
.sr .run:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 0 32px rgba(52,224,196,.4); }
.sr .run.on { background:var(--surface2); color:var(--accent); box-shadow:none; cursor:default; overflow:hidden; position:relative; }
.sr .run.on::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(52,224,196,.15),transparent); animation:scan 1.4s linear infinite; }
@keyframes scan { from{transform:translateX(-100%)} to{transform:translateX(100%)} }
.sr .runstat { font-family:'JetBrains Mono',monospace; font-size:12px; position:relative; z-index:1; }
.sr .brandrow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:22px; }
.sr .seg { display:flex; gap:4px; background:var(--surface); border:1px solid var(--line); border-radius:10px; padding:4px; }
.sr .seg button { display:flex; align-items:center; gap:7px; background:transparent; border:0; color:var(--muted); padding:8px 14px; border-radius:7px; font-family:inherit; font-size:13px; font-weight:500; cursor:pointer; }
.sr .seg button.on { background:var(--surface2); color:var(--text); }
.sr .dot { width:6px; height:6px; border-radius:50%; background:var(--accent); }
.sr .dot.off { background:var(--line); }
.sr .mode { margin-left:auto; background:var(--surface); border:1px solid var(--line); color:var(--muted); padding:9px 15px; border-radius:9px; font-family:'JetBrains Mono',monospace; font-size:12px; cursor:pointer; letter-spacing:.02em; }
.sr .mode.auto { background:rgba(167,139,250,.14); border-color:rgba(167,139,250,.4); color:var(--violet); }
.sr .tabs { display:flex; gap:2px; border-bottom:1px solid var(--line); margin-bottom:22px; }
.sr .tabs button { background:transparent; border:0; border-bottom:2px solid transparent; color:var(--muted); padding:11px 16px; font-family:inherit; font-size:14px; font-weight:500; cursor:pointer; display:flex; align-items:center; gap:8px; margin-bottom:-1px; }
.sr .tabs button.on { color:var(--text); border-bottom-color:var(--accent); }
.sr .tabs button span { font-family:'JetBrains Mono',monospace; font-size:11px; background:var(--surface2); color:var(--muted); padding:1px 7px; border-radius:20px; }
.sr .tabs button.on span { background:var(--accent-dim); color:var(--accent); }
.sr .card { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:20px; margin-bottom:14px; }
.sr .card.row { display:flex; justify-content:space-between; align-items:center; gap:16px; }
.sr .meta { display:flex; align-items:center; gap:10px; margin-bottom:9px; flex-wrap:wrap; }
.sr .kind { font-family:'JetBrains Mono',monospace; font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; background:var(--surface2); color:var(--muted); padding:3px 9px; border-radius:5px; }
.sr .stat { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--amber); }
.sr .stat.approved { color:var(--accent); }
.sr .prio { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--amber); }
.sr h3 { font-size:17px; font-weight:600; margin:0 0 5px; letter-spacing:-.01em; }
.sr .why { color:var(--muted); font-size:13px; line-height:1.55; margin:0 0 14px; }
.sr .body { background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:14px; max-height:440px; overflow:auto; }
.sr .prose { white-space:pre-wrap; font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.6; color:#C6D0DE; margin:0; }
.sr .fieldlabel { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--muted); margin:12px 0 6px; }
.sr .fieldlabel:first-child { margin-top:0; }
.sr .opt { font-size:13px; color:var(--text); background:var(--surface2); border:1px solid var(--line); padding:9px 11px; border-radius:7px; margin-bottom:6px; cursor:pointer; transition:border-color .15s; }
.sr .opt:hover { border-color:var(--accent); }
.sr .hint { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--muted); margin-top:8px; }
.sr .acts { display:flex; gap:9px; margin-top:14px; flex-wrap:wrap; }
.sr .primary { background:var(--accent); color:#04231e; border:0; padding:9px 16px; border-radius:8px; font-family:inherit; font-weight:600; font-size:13px; cursor:pointer; }
.sr .primary:disabled { opacity:.6; cursor:default; }
.sr .ghost { background:transparent; color:var(--muted); border:1px solid var(--line); padding:9px 16px; border-radius:8px; font-family:inherit; font-size:13px; cursor:pointer; }
.sr .ghost:hover { color:var(--text); border-color:var(--muted); }
.sr .fb { display:flex; gap:9px; margin-top:12px; }
.sr .fb input { flex:1; background:var(--bg); border:1px solid var(--line); color:var(--text); padding:10px 13px; border-radius:8px; font-family:inherit; font-size:13px; }
.sr .fb input:focus { outline:none; border-color:var(--accent); }
.sr .link { font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--accent); text-decoration:none; word-break:break-all; }
.sr .muted { color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:13px; }
.sr .empty { border:1px dashed var(--line); border-radius:14px; padding:40px; text-align:center; color:var(--muted); font-family:'JetBrains Mono',monospace; font-size:13px; }
@media (max-width:640px){
  .sr .wrap { padding:26px 14px 60px; }
  .sr .cmd { flex-direction:column; align-items:stretch; gap:14px; }
  .sr h1 { font-size:27px; }
  .sr .run { width:100%; }
  .sr .card.row { flex-direction:column; align-items:stretch; }
  .sr .mode { margin-left:0; }
  .sr .brandrow { gap:8px; }
  .sr .fb { flex-direction:column; }
}
@media (prefers-reduced-motion:reduce){ .sr .pulse.live,.sr .run.on::after{ animation:none; } }
.sr .ov { display:flex; flex-direction:column; gap:16px; }
.sr .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
.sr .kpi { background:var(--surface); border:1px solid var(--line); border-radius:12px; padding:16px; }
.sr .klabel { font-family:'JetBrains Mono',monospace; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.sr .kval { font-size:26px; font-weight:700; letter-spacing:-.02em; }
.sr .krow { display:flex; align-items:center; gap:8px; margin-top:6px; min-height:16px; }
.sr .kd { font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:500; }
.sr .kd.good { color:var(--accent); }
.sr .kd.bad { color:var(--coral); }
.sr .khint { font-size:10.5px; color:var(--muted); }
.sr .panel { background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:18px; }
.sr .panelhead { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.sr .small { font-size:11px; }
.sr .kwt { width:100%; border-collapse:collapse; }
.sr .kwt th { text-align:left; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); padding:8px 10px; border-bottom:1px solid var(--line); font-weight:500; }
.sr .kwt td { padding:11px 10px; font-size:13px; border-bottom:1px solid var(--line); }
.sr .kwt tr:last-child td { border-bottom:0; }
.sr .kwt .kw { color:var(--text); }
.sr .kwt .pos { font-family:'JetBrains Mono',monospace; background:var(--accent-dim); color:var(--accent); padding:2px 8px; border-radius:5px; font-size:12px; }
@media (max-width:640px){ .sr .kpis { grid-template-columns:repeat(2,1fr); } .sr .kwt th:nth-child(3),.sr .kwt td:nth-child(3){ display:none; } }
`;
