"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
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
  const [role, setRole] = useState<string>("");
  const [myBrand, setMyBrand] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const router = useRouter();

  async function load() {
    const d = await (await fetch("/api/platform")).json();
    let bs = d.brands as Brand[];
    // Customers only see their own brand; admins see all.
    if (role === "customer" && myBrand) bs = bs.filter((b) => b.id === myBrand);
    setBrands(bs); setDrafts(d.drafts); setGbp(d.gbp); setCitations(d.citations);
    if (!brandId && bs[0]) setBrandId(bs[0].id);
    setLoading(false);
  }
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token) { router.push("/login"); return; }
      const me = await (await fetch("/api/me", { headers: { authorization: `Bearer ${token}` } })).json();
      setRole(me.role); setMyBrand(me.brand_id); setAuthed(true);
    })();
    /* eslint-disable-next-line */
  }, []);
  useEffect(() => { if (authed) load(); /* eslint-disable-next-line */ }, [authed, role, myBrand]);

  async function signOut() { await supabaseBrowser().auth.signOut(); router.push("/login"); }

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

  if (!authed) return <div className="sr"><div className="wrap"><p className="muted">Authenticating…</p></div></div>;

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
          {(role === "admin" || brands.length > 1) && (
            <div className="seg">
              {brands.map((b) => (
                <button key={b.id} className={b.id === brandId ? "on" : ""} onClick={() => setBrandId(b.id)}>
                  <span className={`dot ${b.id === brandId ? "" : "off"}`} />{b.name}
                </button>
              ))}
            </div>
          )}
          {brand && (
            <button className={`mode ${auto ? "auto" : ""}`} onClick={() => toggleAuto(brand.id, auto)}
              title="Review: you approve each item. Auto: the agent publishes on its own.">
              {auto ? "◉ Auto-publish" : "◎ Review mode"}
            </button>
          )}
          <a href="/portal" className="mode" style={{ textDecoration:"none", textAlign:"center" }} title="Preview customer view">👁 Customer view</a>
          <button className="mode" onClick={signOut} title="Sign out">⏻ Sign out</button>
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
.sr { --bg:#F6F8FB; --surface:#FFFFFF; --surface2:#F2F5F9; --line:#E7EAF0; --text:#1A2030; --muted:#8A93A6;
  --accent:#6C5CE7; --accent-dim:rgba(108,92,231,.1); --amber:#E1A100; --coral:#E14B4B; --violet:#8B5CF6; --green:#00B894;
  min-height:100vh; background:var(--bg); color:var(--text); font-family:'Space Grotesk',-apple-system,Segoe UI,Roboto,sans-serif; -webkit-font-smoothing:antialiased; }
.sr * { box-sizing:border-box; }
.sr .wrap { max-width:1000px; margin:0 auto; padding:36px 22px 80px; }
.sr .eyebrow { display:flex; align-items:center; gap:8px; font-family:'JetBrains Mono',monospace; font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.sr .pulse { width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 0 0 rgba(0,184,148,.4); }
.sr .pulse.live { animation:pulse 1.6s ease-out infinite; }
@keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(0,184,148,.4)} 70%{box-shadow:0 0 0 8px rgba(0,184,148,0)} 100%{box-shadow:0 0 0 0 rgba(0,184,148,0)} }
.sr .cmd { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:26px; }
.sr h1 { font-size:32px; font-weight:700; letter-spacing:-.02em; margin:0; color:#12172A; }
.sr .run { background:linear-gradient(135deg,#6C5CE7,#8B5CF6); color:#fff; border:0; padding:13px 24px; border-radius:11px; font-family:inherit; font-weight:600; font-size:14px; cursor:pointer; white-space:nowrap; transition:transform .12s, box-shadow .2s; box-shadow:0 6px 18px rgba(108,92,231,.3); }
.sr .run:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 10px 26px rgba(108,92,231,.42); }
.sr .run.on { background:var(--surface2); color:var(--accent); box-shadow:none; cursor:default; overflow:hidden; position:relative; }
.sr .run.on::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(108,92,231,.14),transparent); animation:scan 1.4s linear infinite; }
@keyframes scan { from{transform:translateX(-100%)} to{transform:translateX(100%)} }
.sr .runstat { font-family:'JetBrains Mono',monospace; font-size:12px; position:relative; z-index:1; }
.sr .brandrow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:22px; }
.sr .seg { display:flex; gap:4px; background:var(--surface); border:1px solid var(--line); border-radius:11px; padding:4px; box-shadow:0 1px 2px rgba(16,24,40,.04); }
.sr .seg button { display:flex; align-items:center; gap:7px; background:transparent; border:0; color:var(--muted); padding:8px 15px; border-radius:8px; font-family:inherit; font-size:13px; font-weight:500; cursor:pointer; transition:.15s; }
.sr .seg button.on { background:var(--accent); color:#fff; }
.sr .dot { width:6px; height:6px; border-radius:50%; background:#fff; }
.sr .dot.off { background:var(--line); }
.sr .mode { background:var(--surface); border:1px solid var(--line); color:var(--muted); padding:9px 15px; border-radius:10px; font-family:'JetBrains Mono',monospace; font-size:12px; cursor:pointer; box-shadow:0 1px 2px rgba(16,24,40,.04); }
.sr .mode:hover { color:var(--text); }
.sr .mode.auto { background:rgba(139,92,246,.12); border-color:rgba(139,92,246,.35); color:var(--violet); }
.sr .brandrow .mode:first-of-type { margin-left:auto; }
.sr .tabs { display:flex; gap:4px; border-bottom:1px solid var(--line); margin-bottom:24px; }
.sr .tabs button { background:transparent; border:0; border-bottom:2px solid transparent; color:var(--muted); padding:12px 16px; font-family:inherit; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; margin-bottom:-1px; transition:.15s; }
.sr .tabs button:hover { color:var(--text); }
.sr .tabs button.on { color:var(--accent); border-bottom-color:var(--accent); }
.sr .tabs button span { font-family:'JetBrains Mono',monospace; font-size:11px; background:var(--surface2); color:var(--muted); padding:1px 7px; border-radius:20px; }
.sr .tabs button.on span { background:var(--accent-dim); color:var(--accent); }
.sr .card { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:22px; margin-bottom:14px; box-shadow:0 1px 3px rgba(16,24,40,.04); animation:rise .4s ease both; }
@keyframes rise { from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:none} }
.sr .card.row { display:flex; justify-content:space-between; align-items:center; gap:16px; }
.sr .meta { display:flex; align-items:center; gap:10px; margin-bottom:9px; flex-wrap:wrap; }
.sr .kind { font-family:'JetBrains Mono',monospace; font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; background:var(--surface2); color:var(--muted); padding:3px 9px; border-radius:6px; }
.sr .stat { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--amber); }
.sr .stat.approved { color:var(--green); }
.sr .prio { font-family:'JetBrains Mono',monospace; font-size:11px; color:var(--amber); }
.sr h3 { font-size:17px; font-weight:600; margin:0 0 5px; letter-spacing:-.01em; color:#12172A; }
.sr .why { color:var(--muted); font-size:13px; line-height:1.55; margin:0 0 14px; }
.sr .body { background:var(--surface2); border:1px solid var(--line); border-radius:11px; padding:14px; max-height:440px; overflow:auto; }
.sr .prose { white-space:pre-wrap; font-family:'JetBrains Mono',monospace; font-size:12px; line-height:1.65; color:#3A4256; margin:0; }
.sr .fieldlabel { font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:12px 0 6px; }
.sr .fieldlabel:first-child { margin-top:0; }
.sr .opt { font-size:13px; color:var(--text); background:var(--surface); border:1px solid var(--line); padding:9px 11px; border-radius:8px; margin-bottom:6px; cursor:pointer; transition:.15s; }
.sr .opt:hover { border-color:var(--accent); background:var(--accent-dim); }
.sr .hint { font-family:'JetBrains Mono',monospace; font-size:10px; color:var(--muted); margin-top:8px; }
.sr .acts { display:flex; gap:9px; margin-top:14px; flex-wrap:wrap; }
.sr .primary { background:var(--accent); color:#fff; border:0; padding:9px 17px; border-radius:9px; font-family:inherit; font-weight:600; font-size:13px; cursor:pointer; transition:.15s; }
.sr .primary:hover { background:#5b4bd6; }
.sr .primary:disabled { opacity:.6; cursor:default; }
.sr .ghost { background:transparent; color:var(--muted); border:1px solid var(--line); padding:9px 16px; border-radius:9px; font-family:inherit; font-size:13px; cursor:pointer; }
.sr .ghost:hover { color:var(--text); border-color:var(--muted); }
.sr .fb { display:flex; gap:9px; margin-top:12px; }
.sr .fb input { flex:1; background:var(--surface); border:1px solid var(--line); color:var(--text); padding:10px 13px; border-radius:9px; font-family:inherit; font-size:13px; }
.sr .fb input:focus { outline:none; border-color:var(--accent); }
.sr .link { font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--accent); text-decoration:none; word-break:break-all; }
.sr .muted, .sr .lmuted { color:var(--muted); font-size:13px; }
.sr .empty, .sr .lempty { border:1px dashed var(--line); border-radius:16px; padding:44px; text-align:center; color:var(--muted); font-size:14px; background:var(--surface); }
/* Overview (light) */
.sr .lov { display:flex; flex-direction:column; gap:16px; }
.sr .lkpis { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.sr .lkpi { background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:18px; box-shadow:0 1px 3px rgba(16,24,40,.05); animation:rise .5s ease both; }
.sr .ltop { display:flex; align-items:center; gap:8px; margin-bottom:12px; }
.sr .lbar { width:4px; height:18px; border-radius:3px; }
.sr .llabel { font-size:12px; font-weight:600; color:var(--muted); }
.sr .lval { font-size:30px; font-weight:700; letter-spacing:-.02em; color:#12172A; }
.sr .lrow { display:flex; align-items:center; gap:8px; margin-top:8px; min-height:18px; }
.sr .ld { font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:600; padding:2px 8px; border-radius:20px; }
.sr .ld.good { color:var(--green); background:rgba(0,184,148,.1); }
.sr .ld.bad { color:var(--coral); background:rgba(225,75,75,.1); }
.sr .lhint { font-size:11px; color:var(--muted); }
.sr .lpanel { background:var(--surface); border:1px solid var(--line); border-radius:18px; padding:20px; box-shadow:0 1px 3px rgba(16,24,40,.05); animation:rise .5s ease both; }
.sr .lphead { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
.sr .small { font-size:11px; }
.sr .lkwt { width:100%; border-collapse:collapse; }
.sr .lkwt th { text-align:left; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted); padding:9px 10px; border-bottom:1px solid var(--line); font-weight:500; }
.sr .lkwt td { padding:12px 10px; font-size:13px; border-bottom:1px solid var(--line); animation:rise .4s ease both; }
.sr .lkwt tr:last-child td { border-bottom:0; }
.sr .lkwt .lkw { color:var(--text); font-weight:500; }
.sr .lkwt .lpos { font-family:'JetBrains Mono',monospace; background:var(--accent-dim); color:var(--accent); padding:2px 9px; border-radius:6px; font-size:12px; font-weight:600; }
@media (max-width:820px){ .sr .lkpis { grid-template-columns:repeat(2,1fr); } }
@media (max-width:640px){
  .sr .wrap { padding:24px 14px 60px; }
  .sr .cmd { flex-direction:column; align-items:stretch; gap:14px; }
  .sr h1 { font-size:26px; }
  .sr .run { width:100%; }
  .sr .card.row { flex-direction:column; align-items:stretch; }
  .sr .brandrow .mode:first-of-type { margin-left:0; }
  .sr .lkwt th:nth-child(3),.sr .lkwt td:nth-child(3){ display:none; }
  .sr .fb { flex-direction:column; }
}
@media (prefers-reduced-motion:reduce){ .sr .pulse.live,.sr .run.on::after,.sr .card,.sr .lkpi,.sr .lpanel,.sr .lkwt td{ animation:none; } }
`;
