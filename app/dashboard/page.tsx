"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { authedFetch } from "@/lib/authedFetch";
import { slugify } from "@/lib/utils";
import { touchTargetCSS, responsiveTableCSS, fieldCSS, down } from "@/lib/ui/tokens";
import { useToast, useConfirm } from "@/app/_components/Notify";
import Field, { focusFirstError } from "@/app/_components/Field";
import Overview from "./Overview";
import IntelligencePage from "./intelligence/IntelligencePage";

type JobFailure = { kind: string; error: string; finished_at: string };
type Brand = { id: string; slug: string; name: string; auto_publish_meta?: boolean; business_model?: string; site_url?: string; gsc_property?: string | null; last_run_at?: string | null; recent_failures?: JobFailure[]; active?: boolean };
const BUSINESS_MODELS = ["local_service", "ecommerce", "saas", "national_brand", "content_publisher"] as const;
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
  const [tab, setTab] = useState<"overview" | "content" | "gbp" | "citations" | "intelligence" | "brands">("overview");
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
  const [token, setToken] = useState<string>("");
  const toast = useToast();
  const confirm = useConfirm();

  // Sprint 6.3 Phase 3 — admin-only brand onboarding (replaces the SQL editor
  // as the way to add a tenant). allBrands is the admin management list
  // (GET /api/brands, active + inactive), kept separate from `brands` above
  // (from /api/platform, active-only, what the brand switcher uses).
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [newBrand, setNewBrand] = useState({ name: "", slug: "", site_url: "", business_model: "local_service", gsc_property: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [brandFormErr, setBrandFormErr] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const brandFormRef = useRef<HTMLDivElement>(null);

  async function loadAllBrands() {
    const d = await (await authedFetch("/api/brands")).json();
    setAllBrands(d.brands || []);
  }

  // Inline, per-field validation. Presentation only — the same three fields
  // were already required, and the server still validates them independently;
  // this just tells the user which box is wrong before a round trip.
  function validateBrand(): boolean {
    const errs: Record<string, string> = {};
    if (!newBrand.name.trim()) errs.name = "Give the brand a name.";
    if (!newBrand.slug.trim()) errs.slug = "A slug is required.";
    else if (!/^[a-z0-9-]+$/.test(newBrand.slug.trim())) errs.slug = "Use only lowercase letters, numbers and hyphens.";
    if (!newBrand.site_url.trim()) errs.site_url = "A site URL is required.";
    else if (!/^https?:\/\/.+\..+/.test(newBrand.site_url.trim())) errs.site_url = "Include the full address, starting with https://";
    setFieldErrors(errs);
    if (Object.keys(errs).length) {
      // Land the user on the first problem instead of leaving them to find it.
      setTimeout(() => focusFirstError(brandFormRef.current), 0);
      return false;
    }
    return true;
  }

  function clearFieldError(key: string) {
    setFieldErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
  }

  async function createBrand() {
    setBrandFormErr("");
    if (!validateBrand()) return;
    setCreatingBrand(true);
    try {
      const res = await authedFetch("/api/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newBrand.name.trim(),
          slug: newBrand.slug.trim(),
          site_url: newBrand.site_url.trim(),
          business_model: newBrand.business_model,
          gsc_property: newBrand.gsc_property.trim() || undefined,
        }),
      });
      const r = await res.json();
      if (!res.ok) { setBrandFormErr(r.error || `Failed to create brand (${res.status}).`); return; }
      setNewBrand({ name: "", slug: "", site_url: "", business_model: "local_service", gsc_property: "" });
      setSlugTouched(false);
      await loadAllBrands();
      load(); // refresh the active-brand switcher too
    } catch (e) {
      setBrandFormErr("Failed to create brand: " + String(e));
    } finally {
      setCreatingBrand(false);
    }
  }

  async function linkUser(brandId: string, email: string, role: string) {
    const trimmed = email.trim();
    if (!trimmed) { toast.warning("Enter an email address", "Type the address of an existing user first."); return; }
    const brandName = allBrands.find((b) => b.id === brandId)?.name || "this brand";
    // Explicit confirmation — this can silently move an EXISTING customer to a
    // different brand, not just link a fresh one, so a careless click must
    // never be able to do that unconfirmed.
    const ok = await confirm({
      title: `Link ${trimmed} to ${brandName}?`,
      body: `They will be given the ${role} role. If they are already linked to a different brand, this moves them.`,
      confirmLabel: "Link user",
    });
    if (!ok) return;
    try {
      const res = await authedFetch(`/api/brands/${brandId}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });
      const r = await res.json();
      if (!res.ok) { toast.error("Couldn't link that user", r.error || `The server returned ${res.status}.`); return; }
      toast.success("User linked", `${trimmed} now has access to ${brandName}.`);
    } catch {
      toast.error("Couldn't link that user", "Check your connection and try again.");
    }
  }

  // Sprint 6.8 Phase 3 — new brands are created inactive (Phase 1); this is
  // the deliberate, separate action (Phase 2's PATCH endpoint) that brings
  // one online.
  async function activateBrand(brandId: string) {
    try {
      const res = await authedFetch(`/api/brands/${brandId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: true }),
      });
      const r = await res.json();
      if (!res.ok) { toast.error("Couldn't activate that brand", r.error || `The server returned ${res.status}.`); return; }
      await loadAllBrands();
      load(); // refresh the active-brand switcher too
    } catch {
      toast.error("Couldn't activate that brand", "Check your connection and try again.");
    }
  }

  async function load() {
    const res = await authedFetch("/api/platform");
    if (!res.ok) { router.push("/login"); return; }
    const d = await res.json();
    let bs = (d.brands || []) as Brand[];
    // Customers only see their own brand; admins see all.
    if (role === "customer" && myBrand) bs = bs.filter((b) => b.id === myBrand);
    setBrands(bs); setDrafts(d.drafts || []); setGbp(d.gbp || []); setCitations(d.citations || []);
    if (!brandId && bs[0]) setBrandId(bs[0].id);
    setLoading(false);
  }
  useEffect(() => {
    (async () => {
      const { data } = await supabaseBrowser().auth.getSession();
      const token = data.session?.access_token;
      if (!token) { router.push("/login"); return; }
      setToken(token);
      const res = await authedFetch("/api/me");
      if (!res.ok) { router.push("/login"); return; }
      const me = await res.json();
      setRole(me.role); setMyBrand(me.brand_id); setAuthed(true);
    })();
    /* eslint-disable-next-line */
  }, []);
  useEffect(() => { if (authed) load(); /* eslint-disable-next-line */ }, [authed, role, myBrand]);
  useEffect(() => { if (authed && role === "admin") loadAllBrands(); /* eslint-disable-next-line */ }, [authed, role]);

  // Google posts / Backlinks are local-SEO-only concepts (Sprint 6.2 Phase 3).
  // If the selected brand isn't local_service, those tabs are hidden below —
  // this guard bounces away from either one so a brand switch never leaves
  // the view stuck on a tab whose button just disappeared.
  const activeBrand = brands.find((b) => b.id === brandId);
  const activeBrandIsLocal = !activeBrand?.business_model || activeBrand.business_model === "local_service";
  useEffect(() => {
    if (!activeBrandIsLocal && (tab === "gbp" || tab === "citations")) setTab("overview");
  }, [activeBrandIsLocal, tab]);

  async function signOut() { await supabaseBrowser().auth.signOut(); router.push("/login"); }

  async function draftAct(id: string, path: string) {
    try {
      const r = await (await authedFetch(`/api/drafts/${id}/${path}`, { method: "POST" })).json();
      if (r.ok === false && r.error) toast.error("That action didn't complete", r.error);
    } catch { toast.error("That action didn't complete", "Check your connection and try again."); }
    load();
  }
  async function sendFeedback(id: string) {
    if (!feedbackText.trim()) return;
    setBusy(id);
    try {
      const r = await (await authedFetch(`/api/drafts/${id}/revise`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedback: feedbackText }) })).json();
      if (r.ok === false) toast.error("Revision failed", r.error || "The agent could not rewrite this draft.");
      else toast.success("Draft revised", "The agent has rewritten it with your feedback.");
    } catch { toast.error("Revision failed", "Check your connection and try again."); }
    setBusy(""); setFeedbackFor(""); setFeedbackText(""); load();
  }
  async function toggleAuto(id: string, current: boolean) {
    await authedFetch(`/api/brand/${id}/mode`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auto_publish_meta: !current }) });
    load();
  }
  async function rowAct(table: string, id: string, status: string) {
    await authedFetch(`/api/platform/${table}/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }
  async function processImages() {
    for (let i = 0; i < 12; i++) {
      try { const r = await (await authedFetch("/api/images/process", { method: "POST" })).json(); load(); if (r.done) break; } catch { break; }
    }
  }
  async function runNow() {
    if (!brandId) return;
    setRunning(true); setRunStatus("waking the agents");
    try {
      const res = await authedFetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id: brandId }) });
      if (res.status === 409) {
        setRunning(false); setRunStatus("");
        // Sprint 6.10: covers both the existing "locked" (concurrent run in
        // flight) and the new "cooldown" (too soon since the last completed
        // run) cases — both now return a specific `message` from the API,
        // so show that instead of a single hardcoded string.
        const errBody = await res.json().catch(() => ({}));
        toast.warning("Not started", errBody.message || "This brand already has a run starting elsewhere — try again shortly.");
        return;
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        setRunning(false); setRunStatus("");
        toast.error("Couldn't start the run", errBody.error || errBody.message || `The server returned ${res.status}.`);
        return;
      }
    } catch (e) {
      setRunning(false); setRunStatus("");
      toast.error("Couldn't start the run", "Check your connection and try again.");
      return;
    }
    // Process the queue one step at a time. A slow step may time out at the
    // platform limit and return a non-JSON page — that's fine, the work
    // continues server-side, so we just keep going and refresh.
    let idle = 0;
    for (let i = 0; i < 80; i++) {
      let done = false;
      try {
        const res = await authedFetch("/api/step", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brand_id: brandId }) });
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

  // The <style> has to be inside this early return too. Without it the
  // authenticating state rendered .sr markup with no stylesheet attached at
  // all, so every session began with a flash of unstyled content before the
  // real tree mounted.
  if (!authed) return (
    <div className="sr">
      <style>{CSS}</style>
      <div className="wrap"><p className="muted">Authenticating…</p></div>
    </div>
  );

  return (
    <div className="sr">
      {/* Fonts come from next/font in app/layout.tsx now — no external request. */}
      <style>{CSS}</style>

      {/* Lets a keyboard user jump past the brand switcher and tab strip
          straight to the panel they came for. */}
      <a href="#dash-main" className="skip-link">Skip to main content</a>

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
          <a href={`/portal?brand=${brandId}`} className="mode" style={{ textDecoration:"none", textAlign:"center" }} title="Preview customer view">👁 Customer view</a>
          <button className="mode" onClick={signOut} title="Sign out">⏻ Sign out</button>
        </div>

        {/* role="tablist" + aria-selected: these swap the panel below rather
            than navigating, so tab semantics are correct here (aria-current
            would claim a page change that never happens). Counts are given an
            accessible name so "Content 5" is not announced as "Content five". */}
        <nav className="tabs" role="tablist" aria-label="Dashboard sections">
          <button role="tab" aria-selected={tab === "overview"} className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}>Overview</button>
          <button role="tab" aria-selected={tab === "intelligence"} className={tab === "intelligence" ? "on" : ""} onClick={() => setTab("intelligence")}><span aria-hidden="true">🧠</span> Intelligence</button>
          <button role="tab" aria-selected={tab === "content"} className={tab === "content" ? "on" : ""} onClick={() => setTab("content")}>Content<span aria-label={`${bDrafts.length} waiting`}>{bDrafts.length}</span></button>
          {activeBrandIsLocal && <button role="tab" aria-selected={tab === "gbp"} className={tab === "gbp" ? "on" : ""} onClick={() => setTab("gbp")}>Google posts<span aria-label={`${bGbp.length} waiting`}>{bGbp.length}</span></button>}
          {activeBrandIsLocal && <button role="tab" aria-selected={tab === "citations"} className={tab === "citations" ? "on" : ""} onClick={() => setTab("citations")}>Backlinks<span aria-label={`${bCites.length} waiting`}>{bCites.length}</span></button>}
          {role === "admin" && <button role="tab" aria-selected={tab === "brands"} className={tab === "brands" ? "on" : ""} onClick={() => setTab("brands")}>Brands<span aria-label={`${allBrands.length} total`}>{allBrands.length}</span></button>}
        </nav>

        <main id="dash-main" tabIndex={-1}>
        {loading && <p className="muted" role="status" aria-live="polite">Loading signal…</p>}

        {tab === "overview" && brandId && !loading && <Overview key={brandId} brandId={brandId} token={token} />}
        {tab === "intelligence" && brandId && <IntelligencePage key={`intel-${brandId}`} brandId={brandId} brandName={brands.find(b => b.id === brandId)?.name} />}

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
                <Field
                  hideLabel label="Feedback for the agent" className="fb-input-wrap"
                  autoFocus value={feedbackText} disabled={busy === d.id}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendFeedback(d.id); }}
                  placeholder="Tell the agent what to change — shorter, different tone, add local detail…" />
                <button className="primary" onClick={() => sendFeedback(d.id)} disabled={busy === d.id}>{busy === d.id ? "Revising…" : "Send"}</button>
              </div>
            )}
          </article>
        )) : <Empty
          icon="✍"
          title="No content waiting"
          body="When the agents plan and write work for this brand, drafts land here for you to review before anything goes live."
          action={{ label: running ? "Running…" : "Run agents now", onClick: runNow, disabled: running }}
        />)}

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
        )) : <Empty
          icon="📍"
          title="No Google posts drafted"
          body="Posts for this brand's Google Business Profile appear here once the agents run their local SEO pass."
          action={{ label: running ? "Running…" : "Run agents now", onClick: runNow, disabled: running }}
        />)}

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
        )) : <Empty
          icon="🔗"
          title="No backlink opportunities yet"
          body="The agents search for directories and citation sources worth a listing. Results appear here, ranked by how much they help."
          action={{ label: running ? "Running…" : "Run agents now", onClick: runNow, disabled: running }}
        />)}

        {tab === "brands" && role === "admin" && (
          <>
            <article className="card">
              <h3>Add brand</h3>
              <p className="why">New brands are created inactive — activate them below when ready.</p>
              {/* Errors are per-field now, so the reader is told which box is
                  wrong instead of being handed one sentence for the whole form. */}
              <div className="brandform" ref={brandFormRef}>
                <Field
                  label="Name" required
                  value={newBrand.name}
                  error={fieldErrors.name}
                  disabled={creatingBrand}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewBrand((b) => ({ ...b, name, slug: slugTouched ? b.slug : slugify(name) }));
                    clearFieldError("name");
                  }} />
                <Field
                  label="Slug" required
                  helper="Lowercase letters, numbers and hyphens."
                  value={newBrand.slug}
                  error={fieldErrors.slug}
                  disabled={creatingBrand}
                  onChange={(e) => { setSlugTouched(true); setNewBrand((b) => ({ ...b, slug: e.target.value })); clearFieldError("slug"); }} />
                <Field
                  label="Site URL" required type="url"
                  placeholder="https://example.com"
                  value={newBrand.site_url}
                  error={fieldErrors.site_url}
                  disabled={creatingBrand}
                  onChange={(e) => { setNewBrand((b) => ({ ...b, site_url: e.target.value })); clearFieldError("site_url"); }} />
                <Field
                  as="select" label="Business model"
                  value={newBrand.business_model}
                  disabled={creatingBrand}
                  onChange={(e) => setNewBrand((b) => ({ ...b, business_model: e.target.value }))}>
                  {BUSINESS_MODELS.map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
                </Field>
                <Field
                  label="GSC property"
                  helper="Optional — e.g. sc-domain:example.com"
                  value={newBrand.gsc_property}
                  disabled={creatingBrand}
                  onChange={(e) => setNewBrand((b) => ({ ...b, gsc_property: e.target.value }))} />
                <button
                  className="primary brandform-submit"
                  onClick={createBrand}
                  disabled={creatingBrand}
                  data-busy={creatingBrand || undefined}
                >
                  <span>{creatingBrand ? "Creating…" : "Create brand"}</span>
                </button>
              </div>
              {brandFormErr && <p className="why" role="alert" style={{ color: "var(--coral)" }}>{brandFormErr}</p>}
            </article>

            {allBrands.length ? allBrands.map((b) => {
              const lr = lastRunBadge(b.last_run_at);
              return (
                <article className="card row" key={b.id}>
                  <div>
                    <div className="meta">
                      <strong>{b.name}</strong>
                      <span className="kind">{b.business_model || "local_service"}</span>
                      {b.active === false
                        ? <span className="stat" style={{ color: "var(--coral)" }}>Inactive</span>
                        : <span className={`stat ${lr.stale ? "" : "approved"}`}>{lr.stale ? "⚠️ " : ""}{lr.label}</span>}
                    </div>
                    <p className="why">{b.slug} · {b.site_url}</p>
                    {!!b.recent_failures?.length && (
                      <p className="why" style={{ color: "var(--coral)" }}>
                        ⚠️ {b.recent_failures.length} recent failure{b.recent_failures.length > 1 ? "s" : ""} — latest: {b.recent_failures[0].kind}: {truncateError(b.recent_failures[0].error)}
                      </p>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    {b.active === false && <button className="primary" onClick={() => activateBrand(b.id)}>Activate</button>}
                    <BrandLinkForm brandId={b.id} onLink={linkUser} />
                  </div>
                </article>
              );
            }) : <Empty
              icon="◆"
              title="No brands yet"
              body="Create your first brand with the form above. New brands start inactive, so nothing runs until you switch it on."
            />}
          </>
        )}
        </main>
      </div>
    </div>
  );
}

// A real empty state rather than a bare line of grey text: it says what will
// appear here, why it is empty, and offers the one action that fills it.
function Empty({ icon, title, body, action }: {
  icon?: string;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void; disabled?: boolean };
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon" aria-hidden="true">{icon}</div>}
      <div className="empty-title">{title}</div>
      {body && <p className="empty-body">{body}</p>}
      {action && (
        <button className="primary empty-action" onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </button>
      )}
    </div>
  );
}

// Sprint 6.4 Phase 3 — "is this brand actually running" indicator for the
// Brands tab, sourced from app/api/brands' last_run_at (lib/scheduling.ts's
// lastCompletedRunMap). Stale threshold (36h) allows slack over the daily
// cadence rather than flagging a brand the moment it crosses 24h.
function lastRunBadge(lastRunAt: string | null | undefined): { label: string; stale: boolean } {
  if (!lastRunAt) return { label: "never run", stale: true };
  const hours = (Date.now() - new Date(lastRunAt).getTime()) / 3_600_000;
  const stale = hours > 36;
  if (hours < 1) return { label: "last run: <1h ago", stale };
  if (hours < 48) return { label: `last run: ${Math.round(hours)}h ago`, stale };
  return { label: `last run: ${Math.round(hours / 24)}d ago`, stale };
}

// Sprint 6.6 Phase 3 — bounds a stored job error message before rendering it
// in the Brands tab, so a verbose error string can't blow out the row layout
// (and as a defensive cap on what internal error text ever reaches the UI).
function truncateError(error: string, max = 150): string {
  return error.length > max ? error.slice(0, max) + "…" : error;
}

// Sprint 6.3 Phase 3 — per-brand inline "link an existing user" form. Kept as
// its own component (rather than lifted state in Dashboard) so each brand
// row's email/role inputs are independent.
function BrandLinkForm({ brandId, onLink }: { brandId: string; onLink: (brandId: string, email: string, role: string) => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("customer");
  return (
    <div className="acts">
      <Field hideLabel label="User email" type="email" className="acts-email"
        placeholder="user@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
      <Field as="select" hideLabel label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="customer">Customer</option>
        <option value="admin">Admin</option>
      </Field>
      <button className="primary" onClick={() => { onLink(brandId, email, role); setEmail(""); }}>Link user</button>
    </div>
  );
}

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
          {titles.length > 0 && <><div className="fieldlabel">title tag</div>{titles.map((t, i) => <button key={i} type="button" className="opt" onClick={() => copy(t)} aria-label={`Copy title tag: ${t}`}>{t}</button>)}</>}
          {metas.length > 0 && <><div className="fieldlabel">meta description</div>{metas.map((m, i) => <button key={i} type="button" className="opt" onClick={() => copy(m)} aria-label={`Copy meta description: ${m}`}>{m}</button>)}</>}
          {opening && <><div className="fieldlabel">new opening</div><button type="button" className="opt" onClick={() => copy(opening)} aria-label="Copy new opening paragraph">{opening}</button></>}
          <div className="hint">click any option to copy</div>
        </div>
      );
    }
  }
  return <pre className="body prose">{body}</pre>;
}

const CSS = `
.sr { --bg:#F6F8FB; --surface:#FFFFFF; --surface2:#F2F5F9; --line:#E7EAF0; --text:#1A2030; --muted:#6B768D;
  --accent:#6C5CE7; --accent-dim:rgba(108,92,231,.1); --amber:#9A6E00; --coral:#DD3535; --violet:#8655F6; --green:#00856B;
  min-height:100vh; background:var(--bg); color:var(--text); font-family:var(--font-sans); -webkit-font-smoothing:antialiased; }
.sr * { box-sizing:border-box; }
.sr .wrap { max-width:1000px; margin:0 auto; padding:36px 22px 80px; }
.sr .eyebrow { display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted); margin-bottom:8px; }
.sr .pulse { width:8px; height:8px; border-radius:50%; background:var(--green); box-shadow:0 0 0 0 rgba(0,184,148,.4); }
.sr .pulse.live { animation:pulse 1.6s ease-out infinite; }
@keyframes pulse { 0%{box-shadow:0 0 0 0 rgba(0,184,148,.4)} 70%{box-shadow:0 0 0 8px rgba(0,184,148,0)} 100%{box-shadow:0 0 0 0 rgba(0,184,148,0)} }
.sr .cmd { display:flex; justify-content:space-between; align-items:flex-end; gap:16px; margin-bottom:26px; }
.sr h1 { font-size:32px; font-weight:700; letter-spacing:-.02em; margin:0; color:#12172A; }
.sr .run { background:linear-gradient(135deg,#6C5CE7,#8B5CF6); color:#fff; border:0; padding:12px 24px; border-radius:var(--radius-sm); font-family:inherit; font-weight:600; font-size:14px; cursor:pointer; white-space:nowrap; transition:transform var(--dur-1), box-shadow var(--dur-2); box-shadow:0 6px 18px rgba(108,92,231,.3); }
.sr .run:hover:not(:disabled) { transform:translateY(-1px); box-shadow:0 10px 26px rgba(108,92,231,.42); }
.sr .run.on { background:var(--surface2); color:var(--accent); box-shadow:none; cursor:default; overflow:hidden; position:relative; }
.sr .run.on::after { content:""; position:absolute; inset:0; background:linear-gradient(90deg,transparent,rgba(108,92,231,.14),transparent); animation:scan 1.4s linear infinite; }
@keyframes scan { from{transform:translateX(-100%)} to{transform:translateX(100%)} }
.sr .runstat { font-family:var(--font-mono); font-size:12px; position:relative; z-index:1; }
.sr .brandrow { display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:22px; }
.sr .seg { display:flex; gap:4px; background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-sm); padding:4px; box-shadow:var(--shadow-1); }
.sr .seg button { display:flex; align-items:center; gap:8px; background:transparent; border:0; color:var(--muted); padding:8px 16px; border-radius:var(--radius-sm); font-family:inherit; font-size:13px; font-weight:500; cursor:pointer; transition:all var(--dur-2) var(--ease-out); }
.sr .seg button.on { background:var(--accent); color:#fff; }
.sr .dot { width:6px; height:6px; border-radius:50%; background:#fff; }
.sr .dot.off { background:var(--line); }
.sr .mode { background:var(--surface); border:1px solid var(--line); color:var(--muted); padding:8px 16px; border-radius:var(--radius-sm); font-family:var(--font-mono); font-size:12px; cursor:pointer; box-shadow:var(--shadow-1); }
.sr .mode:hover { color:var(--text); }
.sr .mode.auto { background:rgba(139,92,246,.12); border-color:rgba(139,92,246,.35); color:var(--violet); }
.sr .brandrow .mode:first-of-type { margin-left:auto; }
.sr .tabs { display:flex; gap:4px; border-bottom:1px solid var(--line); margin-bottom:24px; }
.sr .tabs button { background:transparent; border:0; border-bottom:2px solid transparent; color:var(--muted); padding:12px 16px; font-family:inherit; font-size:14px; font-weight:600; cursor:pointer; display:flex; align-items:center; gap:8px; margin-bottom:-1px; transition:all var(--dur-2) var(--ease-out); }
.sr .tabs button:hover { color:var(--text); }
.sr .tabs button.on { color:var(--accent); border-bottom-color:var(--accent); }
.sr .tabs button span { font-family:var(--font-mono); font-size:11px; background:var(--surface2); color:var(--muted); padding:1px 8px; border-radius:var(--radius-lg); }
.sr .tabs button.on span { background:var(--accent-dim); color:var(--accent); }
.sr .card { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); padding:22px; margin-bottom:14px; box-shadow:var(--shadow-1); animation:rise .4s ease both; }
@keyframes rise { from{opacity:0; transform:translateY(8px)} to{opacity:1; transform:none} }
.sr .card.row { display:flex; justify-content:space-between; align-items:center; gap:16px; }
.sr .meta { display:flex; align-items:center; gap:10px; margin-bottom:9px; flex-wrap:wrap; }
.sr .kind { font-family:var(--font-mono); font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; background:var(--surface2); color:var(--muted); padding:4px 8px; border-radius:var(--radius-xs); }
.sr .stat { font-family:var(--font-mono); font-size:11px; color:var(--amber); }
.sr .stat.approved { color:var(--green); }
.sr .prio { font-family:var(--font-mono); font-size:11px; color:var(--amber); }
.sr h3 { font-size:17px; font-weight:600; margin:0 0 4px; letter-spacing:-.01em; color:#12172A; }
.sr .why { color:var(--muted); font-size:13px; line-height:1.55; margin:0 0 14px; }
.sr .body { background:var(--surface2); border:1px solid var(--line); border-radius:var(--radius-sm); padding:14px; max-height:440px; overflow:auto; }
.sr .prose { white-space:pre-wrap; font-family:var(--font-mono); font-size:12px; line-height:1.65; color:#3A4256; margin:0; }
.sr .fieldlabel { font-family:var(--font-mono); font-size:10px; letter-spacing:.08em; text-transform:uppercase; color:var(--muted); margin:12px 0 6px; }
.sr .fieldlabel:first-child { margin-top:0; }
.sr .opt { display:block; width:100%; text-align:left; font-family:inherit; font-size:13px; color:var(--text); background:var(--surface); border:1px solid var(--line); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:6px; cursor:pointer; transition:all var(--dur-2) var(--ease-out); }
.sr .opt:hover { border-color:var(--accent); background:var(--accent-dim); }
.sr .hint { font-family:var(--font-mono); font-size:10px; color:var(--muted); margin-top:8px; }
.sr .acts { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
.sr .primary { background:var(--accent); color:#fff; border:0; padding:8px 16px; border-radius:var(--radius-sm); font-family:inherit; font-weight:600; font-size:13px; cursor:pointer; transition:all var(--dur-2) var(--ease-out); }
.sr .primary:hover { background:#5b4bd6; }
.sr .primary:disabled { opacity:.6; cursor:default; }
.sr .ghost { background:transparent; color:var(--muted); border:1px solid var(--line); padding:8px 16px; border-radius:var(--radius-sm); font-family:inherit; font-size:13px; cursor:pointer; }
.sr .ghost:hover { color:var(--text); border-color:var(--muted); }
.sr .fb { display:flex; gap:8px; margin-top:12px; }
.sr .fb input { flex:1; background:var(--surface); border:1px solid var(--line); color:var(--text); padding:10px 12px; border-radius:var(--radius-sm); font-family:inherit; font-size:13px; }
.sr .fb input:focus { outline:none; border-color:var(--accent); }
/* Labelled fields need vertical room, so the old single flex row becomes a
   responsive grid. Field styling comes from the shared fieldCSS. */
.sr .brandform { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:14px; margin-top:12px; align-items:start; }
.sr .brandform-submit { align-self:end; }
.sr .acts select { background:var(--surface); border:1px solid var(--line); color:var(--text); padding:8px 12px; border-radius:var(--radius-sm); font-family:inherit; font-size:13px; }
.sr .acts input { background:var(--surface); border:1px solid var(--line); color:var(--text); padding:8px 12px; border-radius:var(--radius-sm); font-family:inherit; font-size:13px; }
.sr .link { font-family:var(--font-mono); font-size:12px; color:var(--accent); text-decoration:none; word-break:break-all; }
.sr .muted, .sr .lmuted { color:var(--muted); font-size:13px; }
.sr .empty, .sr .lempty { border:1px dashed var(--line); border-radius:var(--radius-md); padding:44px 28px; text-align:center; color:var(--muted); font-size:14px; background:var(--surface); }
.sr .empty-icon { font-size:26px; line-height:1; margin-bottom:12px; opacity:.75; }
.sr .empty-title { font-size:15.5px; font-weight:660; color:var(--text); letter-spacing:-.015em; margin-bottom:7px; }
.sr .empty-body { font-size:13px; line-height:1.65; color:var(--muted); margin:0 auto; max-width:44ch; }
.sr .empty-action { margin-top:18px; }
/* Overview CSS moved to Sprint 3 block */
@media (prefers-reduced-motion:reduce){ .sr .pulse.live,.sr .run.on::after,.sr .card,.sr .lkpi,.sr .lpanel,.sr .lkwt td{ animation:none; } }
/* ── Overview (Sprint 3) ───────────────────────────────────────────────────── */
.sr .ov { display:flex; flex-direction:column; gap:18px; }
.sr .ov-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
.sr .ov-kpi { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); padding:18px 18px 14px; box-shadow:var(--shadow-1); animation:rise .5s ease both; position:relative; overflow:hidden; }
.sr .ov-kpi-accent { position:absolute; top:0; left:0; right:0; height:3px; border-radius:var(--radius-md) var(--radius-md) 0 0; }
.sr .ov-kpi-label { font-size:11.5px; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.06em; margin-bottom:10px; }
.sr .ov-kpi-val { font-size:28px; font-weight:700; letter-spacing:-.02em; line-height:1.1; }
.sr .ov-kpi-foot { display:flex; align-items:center; gap:8px; margin-top:8px; flex-wrap:wrap; min-height:18px; }
.sr .ov-delta { font-size:11.5px; font-weight:600; padding:2px 8px; border-radius:var(--radius-lg); }
.sr .ov-delta.g { color:var(--green); background:rgba(0,184,148,.1); }
.sr .ov-delta.b { color:var(--coral); background:rgba(225,75,75,.1); }
.sr .ov-hint { font-size:11px; color:#B2BAC8; }
.sr .ov-row2 { display:grid; grid-template-columns:1.6fr 1fr; gap:18px; }
.sr .ov-panel { background:var(--surface); border:1px solid var(--line); border-radius:var(--radius-md); padding:20px; box-shadow:var(--shadow-1); animation:rise .5s ease both; }
.sr .ov-chart-panel { grid-column:auto; }
.sr .ov-panel-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:8px; }
.sr .ov-panel-head h3 { font-size:15px; font-weight:700; margin:0; color:#12172A; }
.sr .ov-panel-sub { font-size:12.5px; color:var(--muted); margin:0 0 14px; }
.sr .ov-panel-sub-inline { font-size:12px; color:var(--muted); }
.sr .ov-badge { font-size:11px; font-weight:600; background:rgba(108,92,231,.1); color:var(--accent); padding:4px 10px; border-radius:var(--radius-lg); }
.sr .ov-badge-warn { background:rgba(245,180,97,.15); color:#C07000; }
.sr .ov-chart-tabs { display:flex; gap:4px; }
.sr .ov-ctab { background:transparent; border:1px solid var(--line); color:var(--muted); padding:4px 12px; border-radius:var(--radius-xs); font-size:11.5px; font-family:inherit; cursor:pointer; }
.sr .ov-ctab.on { background:var(--accent); color:#fff; border-color:var(--accent); }
.sr .ov-chart-empty { height:200px; display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:13px; }
.sr .ov-agent-panel { display:flex; flex-direction:column; gap:14px; }
.sr .ov-agent-stats { display:flex; gap:10px; }
.sr .ov-astat { flex:1; text-align:center; background:var(--surface2); border-radius:var(--radius-sm); padding:12px 6px; }
.sr .ov-astat-n { font-size:24px; font-weight:700; letter-spacing:-.02em; }
.sr .ov-astat-l { font-size:11px; color:var(--muted); margin-top:2px; }
.sr .ov-type-list { display:flex; flex-direction:column; gap:8px; }
.sr .ov-type-row { display:flex; align-items:center; gap:10px; }
.sr .ov-type-label { font-size:12px; color:var(--muted); width:110px; flex-shrink:0; }
.sr .ov-type-bar-wrap { flex:1; height:6px; background:var(--surface2); border-radius:3px; overflow:hidden; }
.sr .ov-type-bar { height:100%; border-radius:3px; transition:width var(--dur-4) var(--ease-out); }
.sr .ov-type-count { font-size:12px; font-weight:600; color:var(--text); width:24px; text-align:right; }
.sr .ov-table { width:100%; border-collapse:collapse; }
.sr .ov-table th { text-align:left; font-size:10.5px; font-weight:600; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); padding:8px 10px; border-bottom:1px solid var(--line); }
.sr .ov-table td { padding:10px 10px; font-size:12.5px; border-bottom:1px solid var(--line); }
.sr .ov-table tr:last-child td { border-bottom:0; }
.sr .ov-table tr:hover td { background:var(--surface2); }
.sr .ov-kw { font-weight:500; color:var(--text); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sr .ov-page-url { font-family:var(--font-mono); font-size:11.5px; color:var(--muted); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.sr .ov-pos { font-size:11.5px; font-weight:700; padding:2px 8px; border-radius:var(--radius-lg); }
.sr .ov-empty-msg { color:var(--muted); font-size:13px; padding:12px 0; }
.sr .ov-empty { text-align:center; padding:60px 20px; }
.sr .ov-empty-icon { font-size:48px; margin-bottom:12px; }
.sr .ov-empty h3 { margin:0 0 8px; }
.sr .ov-empty p { color:var(--muted); font-size:14px; }
.sr .ov-skel { background:linear-gradient(90deg,#F0F2F5,#E7EAF0,#F0F2F5); background-size:200%; border-radius:var(--radius-md); animation:rise .5s ease both, shimmer 1.4s infinite; }
.sr .ov-skel { height:110px; }
.sr .ov-skel-lg { height:260px; margin-top:18px; border-radius:var(--radius-md); }
@keyframes shimmer { 0%{background-position:200%} 100%{background-position:-200%} }
/* ── Responsive (Phase 1: consolidated onto the shared breakpoints) ───────── */
/* Previously two ad-hoc queries at 900px and 540px covering only this tab. */
${down.md} { .sr .ov-kpis{grid-template-columns:repeat(2,1fr)} .sr .ov-row2{grid-template-columns:1fr} }
${down.sm} { .sr .ov-kpis{grid-template-columns:1fr} .sr .ov-chart-tabs{flex-wrap:wrap} }

/* ══ Phase 1 foundation ═══════════════════════════════════════════════════ */
${touchTargetCSS(".sr")}

.sr .fb-input-wrap { flex:1; min-width:0; }
.sr .acts-email { min-width:180px; }

/* ══ Phase 4: shared form fields + loading ════════════════════════════════ */
${fieldCSS(".sr", {
  surface: "var(--surface)", line: "var(--line)", lineStrong: "#C6CEDA",
  muted: "var(--muted)", text: "var(--text)", accent: "var(--accent)",
  danger: "var(--coral)", radius: "var(--radius-sm)",
})}

/* ══ Phase 3: card-stack tables ═══════════════════════════════════════════ */
${responsiveTableCSS(".sr", {
  surface: "var(--surface)", line: "var(--line)", muted: "var(--muted)",
  text: "var(--text)", radius: "var(--radius-md)",
})}
/* The dashboard's tables carry their own cell padding, which the card layout
   supplies instead. */
${down.sm} { .sr .rt-stack td, .sr .rt-stack th { padding-left:0; padding-right:0; } }

/* The tab bar was a plain flex row of six tabs with neither wrap nor scroll,
   so on a phone it pushed the whole page sideways and the last tabs could not
   be reached at all. It now scrolls as its own region, with a right-edge fade
   so the overflow is visible and scroll-snap so tabs land cleanly. */
.sr .tabs {
  overflow-x:auto; overscroll-behavior-x:contain; -webkit-overflow-scrolling:touch;
  scroll-snap-type:x proximity; scrollbar-width:none;
  -webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);
          mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent);
}
.sr .tabs::-webkit-scrollbar { display:none; }
.sr .tabs button { scroll-snap-align:start; white-space:nowrap; flex:0 0 auto; }

${down.sm} {
  .sr .wrap { padding:22px 16px 72px; }
  /* The command bar put a 32px heading and the Run button on one unwrapping
     row, squashing both. */
  .sr .cmd { flex-direction:column; align-items:stretch; gap:14px; }
  .sr h1 { font-size:25px; }
  .sr .run { width:100%; }
  /* margin-left:auto on the first mode button only works while the row is a
     single line; once it wraps the buttons need to lay out normally. */
  .sr .brandrow .mode:first-of-type { margin-left:0; }
  .sr .seg { width:100%; }
  .sr .seg button { flex:1; justify-content:center; }
  /* Feedback and brand forms stack rather than fighting for one row. */
  .sr .fb { flex-direction:column; }
  .sr .brandform input, .sr .brandform select { flex:1 1 100%; }
  .sr .card { padding:18px; border-radius:var(--radius-md); }
  .sr .body { max-height:min(52vh,340px); }
  .sr .empty, .sr .lempty { padding:32px 20px; }
}
`;
