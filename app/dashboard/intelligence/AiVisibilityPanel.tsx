"use client";
import { useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import MetricExplainer from "./MetricExplainer";
import {
  assistantLabel,
  emptyBody,
  emptyTitle,
  formatPct,
  formatWhen,
  hasConfiguredAssistants,
  intentLabel,
  languageLabel,
  namedIn,
  ofSample,
  rateTone,
  type AiVisibilityResponse,
} from "@/lib/ai-visibility/display";
import type { PromptBreakdown, SegmentBreakdown } from "@/lib/ai-visibility/report";

type View = "overview" | "questions" | "places" | "competitors" | "citations";

const VIEWS: { key: View; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "questions", label: "Questions" },
  { key: "places", label: "Places" },
  { key: "competitors", label: "Competitors" },
  { key: "citations", label: "Citations" },
];

const TONE: Record<string, string> = {
  g: "#00B894",
  a: "#F5B461",
  b: "#FF6B6B",
  m: "#8A93A6",
};

export default function AiVisibilityPanel({ brandId, isAdmin }: { brandId: string; isAdmin?: boolean }) {
  const [data, setData] = useState<AiVisibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("overview");
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");

  function load() {
    if (!brandId) return;
    authedFetch(`/api/intelligence/ai-visibility?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    setLoading(true);
    setData(null);
    load();
    // load is recreated each render; brandId is the actual dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  async function runSweep() {
    if (!isAdmin || running) return;
    setRunning(true);
    setRunMsg("");
    try {
      const res = await authedFetch("/api/cron/ai-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || d.error || "Could not start a sweep");
      setRunMsg(d.queued ? "Sweep queued. Numbers update as checks finish." : "Sweep already queued.");
      load();
    } catch (e) {
      setRunMsg(e instanceof Error ? e.message : "Could not start a sweep");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="io-skeleton">
        <div className="io-skel-grid">{[...Array(4)].map((_, i) => <div key={i} className="io-skel-card" />)}</div>
      </div>
    );
  }

  const assistants = data?.assistants_configured || [];
  const hasAssistants = hasConfiguredAssistants(assistants);
  const report = data?.report;

  if (!data || data.error) {
    return <div className="av-empty">Could not load AI visibility.</div>;
  }

  if (!report) {
    return (
      <div className="io-empty">
        <div style={{ fontSize: 40, marginBottom: 12 }}>✦</div>
        <h3>{emptyTitle(data.reason, hasAssistants)}</h3>
        <p>{emptyBody(data.reason, hasAssistants, "admin")}</p>
        {isAdmin && data.reason !== "not_migrated" && hasAssistants && (
          <div style={{ marginTop: 16 }}>
            <button className="av-run" onClick={runSweep} disabled={running}>
              {running ? "Starting…" : "Run sweep"}
            </button>
            {runMsg && <p className="av-sub" style={{ marginTop: 10 }}>{runMsg}</p>}
          </div>
        )}
        <AssistantChips assistants={assistants} />
      </div>
    );
  }

  const overall = report.overall;
  const tone = TONE[rateTone(overall.rate)];
  const sweepLive = data.latest_run?.status === "running";

  return (
    <div className="av">
      <div className="av-head">
        <div>
          <div className="av-label">AI visibility <MetricExplainer metric="ai_visibility" /></div>
          <div className="av-val" style={{ color: tone }}>{namedIn(overall.mentioned, overall.scorable)}</div>
          <div className="av-sub">
            {formatPct(overall.rate)} of scored answers
            {overall.avgRank != null ? ` · avg rank ${overall.avgRank}` : ""}
            {overall.avgShareOfVoice != null ? ` · ${formatPct(overall.avgShareOfVoice)} share of voice` : ""}
            {data.latest_run?.finished_at || data.latest_run?.started_at
              ? ` · last sweep ${formatWhen(data.latest_run.finished_at || data.latest_run.started_at)}`
              : ""}
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
            <button className="av-run" onClick={runSweep} disabled={running || sweepLive}>
              {running || sweepLive ? "Sweep running…" : "Run sweep"}
            </button>
            {runMsg && <span className="av-muted">{runMsg}</span>}
          </div>
        )}
      </div>

      {sweepLive && (
        <div className="av-banner">A sweep is in progress. Rates update as each assistant answers.</div>
      )}

      {data.summary && (
        <div className="av-summary">{data.summary}</div>
      )}

      <div className="av-tabs" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            role="tab"
            aria-selected={view === v.key}
            className={`av-tab ${view === v.key ? "on" : ""}`}
            onClick={() => setView(v.key)}
          >
            {v.label}
            {v.key === "questions" && report.gaps.length > 0 && (
              <span className="wl-count">{report.gaps.length}</span>
            )}
          </button>
        ))}
      </div>

      {view === "overview" && <Overview report={report} assistants={assistants} />}
      {view === "questions" && <Questions report={report} />}
      {view === "places" && <Places report={report} />}
      {view === "competitors" && <Competitors report={report} />}
      {view === "citations" && <Citations report={report} />}
    </div>
  );
}

function Overview({
  report,
  assistants,
}: {
  report: NonNullable<AiVisibilityResponse["report"]>;
  assistants: AiVisibilityResponse["assistants_configured"];
}) {
  const seen = new Set(report.assistants.map((a) => a.assistant));
  const missing = assistants.filter((a) => !a.available);
  const notInSweep = assistants.filter((a) => a.available && !seen.has(a.id));
  const sent = report.sentiment;
  const sentTotal = sent.positive + sent.neutral + sent.negative;

  return (
    <div className="av" style={{ gap: 16 }}>
      <div className="av-kpis">
        <Kpi label="Mention rate" value={formatPct(report.overall.rate)} sub={ofSample(report.overall.mentioned, report.overall.scorable)} color={TONE[rateTone(report.overall.rate)]} />
        <Kpi label="Avg. rank when named" value={report.overall.avgRank != null ? String(report.overall.avgRank) : "—"} sub="Lower is better" />
        <Kpi label="Share of voice" value={formatPct(report.overall.avgShareOfVoice)} sub="Of brands named in scored answers" />
        <Kpi label="Unanswered questions" value={String(report.gaps.length)} sub="No assistant named you" color={report.gaps.length ? TONE.b : TONE.g} />
      </div>

      <div className="av-card">
        <h3 className="av-h">Trend</h3>
        <p className="av-p">Completed sweeps only. A vendor outage never becomes a drop here.</p>
        {report.trend.length > 1 ? (
          <div className="av-trend">
            {report.trend.map((p) => {
              const h = p.mentionRate == null ? 8 : Math.max(8, Math.round((p.mentionRate / 100) * 72));
              return (
                <div key={p.runId} className="av-trend-bar" title={`${formatWhen(p.startedAt)}: ${formatPct(p.mentionRate)}`}>
                  <div className="av-trend-fill" style={{ height: h }} />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="av-muted">Need two completed sweeps before a trend appears.</div>
        )}
      </div>

      <div className="av-card">
        <h3 className="av-h">By assistant</h3>
        <p className="av-p">A missing channel is “not configured”, not zero visibility.</p>
        <div className="av-assist">
          {report.assistants.map((a) => (
            <div key={a.assistant} className="av-assist-card">
              <div className="av-assist-name">{assistantLabel(a.assistant)}</div>
              <div className="av-assist-rate" style={{ color: TONE[rateTone(a.rate)] }}>{formatPct(a.rate)}</div>
              <div className="av-assist-meta">
                {ofSample(a.mentioned, a.scorable)}
                {a.avgRank != null ? ` · rank ${a.avgRank}` : ""}
                {a.errors ? ` · ${a.errors} error${a.errors === 1 ? "" : "s"}` : ""}
              </div>
              {a.model && <div className="av-assist-meta">{a.model}</div>}
            </div>
          ))}
          {notInSweep.map((a) => (
            <div key={a.id} className="av-assist-card">
              <div className="av-assist-name">{a.label}</div>
              <div className="av-assist-rate" style={{ color: TONE.m }}>—</div>
              <div className="av-assist-meta">Configured, not in this sweep</div>
            </div>
          ))}
          {missing.map((a) => (
            <div key={a.id} className="av-assist-card">
              <div className="av-assist-name">{a.label}</div>
              <span className="av-chip off">Not configured</span>
              <div className="av-assist-meta" style={{ marginTop: 8 }}>Needs {a.requires}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="av-grid2">
        <div className="av-card">
          <h3 className="av-h">How you were described</h3>
          <p className="av-p">Sentiment is taken only from sentences that name you.</p>
          {sentTotal === 0 ? (
            <div className="av-muted">No sentiment yet — you were not named, or the answers had no describing sentence.</div>
          ) : (
            <SegmentList
              rows={[
                { segment: "Positive", checks: sent.positive, mentioned: sent.positive, scorable: sentTotal, rate: pct(sent.positive, sentTotal) },
                { segment: "Neutral", checks: sent.neutral, mentioned: sent.neutral, scorable: sentTotal, rate: pct(sent.neutral, sentTotal) },
                { segment: "Negative", checks: sent.negative, mentioned: sent.negative, scorable: sentTotal, rate: pct(sent.negative, sentTotal) },
              ]}
            />
          )}
        </div>
        <div className="av-card">
          <h3 className="av-h">Health</h3>
          <p className="av-p">Kept separate from the visibility numbers so an outage is not a ranking change.</p>
          <div className="av-assist-meta" style={{ marginBottom: 8 }}>
            {report.health.scorable} scored · {report.health.errors} errors · {report.health.declined} declined to name anyone
          </div>
          {report.health.errorsByAssistant.length === 0 ? (
            <div className="av-muted">No assistant errors in this window.</div>
          ) : (
            report.health.errorsByAssistant.map((e) => (
              <div key={e.assistant} style={{ marginBottom: 8 }}>
                <div className="av-assist-name">{assistantLabel(e.assistant)} <span className="av-chip err">{e.errors}</span></div>
                {e.lastError && <div className="av-muted">{e.lastError}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Questions({ report }: { report: NonNullable<AiVisibilityResponse["report"]> }) {
  const [q, setQ] = useState("");
  const [intent, setIntent] = useState("");
  const [gapsOnly, setGapsOnly] = useState(report.gaps.length > 0);
  const intents = useMemo(
    () => [...new Set(report.prompts.map((p) => p.intent).filter(Boolean))] as string[],
    [report.prompts]
  );

  const rows = report.prompts.filter((p) => {
    if (gapsOnly && !(p.scorable > 0 && p.mentioned === 0)) return false;
    if (intent && p.intent !== intent) return false;
    if (q.trim() && !p.promptText.toLowerCase().includes(q.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <div className="av-card">
      <h3 className="av-h">Every question we asked</h3>
      <p className="av-p">Worst first. Being cited without being named still counts as a mention.</p>
      <div className="av-filter">
        <input className="av-search" placeholder="Search questions…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="av-search" style={{ flex: "0 0 160px" }} value={intent} onChange={(e) => setIntent(e.target.value)}>
          <option value="">All intents</option>
          {intents.map((i) => <option key={i} value={i}>{intentLabel(i)}</option>)}
        </select>
        <button className={`air-cat ${gapsOnly ? "on" : ""}`} onClick={() => setGapsOnly((v) => !v)} style={gapsOnly ? { borderColor: "#6C5CE7", color: "#6C5CE7" } : undefined}>
          Gaps only
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="av-empty">{gapsOnly ? "No unanswered questions in this window." : "No questions match that filter."}</div>
      ) : (
        <ResponsiveTable mode="scroll">
          <table className="av-table">
            <thead>
              <tr>
                <th>Question</th>
                <th>Place</th>
                <th>Intent</th>
                <th>Named</th>
                <th>Assistants</th>
                <th>Also named</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.promptKey}>
                  <td>
                    <div className="av-prompt">{p.promptText}</div>
                    <div className="av-muted">{languageLabel(p.language)}</div>
                  </td>
                  <td>{p.localeLabel || p.city || "—"}</td>
                  <td>{intentLabel(p.intent)}</td>
                  <td style={{ color: TONE[rateTone(p.rate)], fontWeight: 700 }}>{ofSample(p.mentioned, p.scorable)}</td>
                  <td><AssistantDots prompt={p} /></td>
                  <td className="av-muted">{p.competitorsNamed.slice(0, 3).join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </div>
  );
}

function Places({ report }: { report: NonNullable<AiVisibilityResponse["report"]> }) {
  const blocks: { title: string; sub: string; rows: SegmentBreakdown[] }[] = [
    { title: "Countries", sub: "Where the question was placed.", rows: report.places.countries },
    { title: "Regions", sub: "State or province.", rows: report.places.regions },
    { title: "Cities", sub: "The city the customer is asking about.", rows: report.places.cities },
    { title: "Neighbourhoods", sub: "Only when the service area is that specific.", rows: report.places.neighborhoods },
    { title: "Languages", sub: "The language the question was asked in, not the language of the answer.", rows: report.languages.map((r) => ({ ...r, segment: languageLabel(r.segment) })) },
    { title: "Intents", sub: "The shape of the question — losing on price is a different problem from losing on discovery.", rows: report.intents.map((r) => ({ ...r, segment: intentLabel(r.segment) })) },
  ];

  return (
    <div className="av-grid2">
      {blocks.map((b) => (
        <div key={b.title} className="av-card">
          <h3 className="av-h">{b.title}</h3>
          <p className="av-p">{b.sub}</p>
          {b.rows.length === 0 ? <div className="av-muted">Nothing in this sweep.</div> : <SegmentList rows={b.rows} />}
        </div>
      ))}
    </div>
  );
}

function Competitors({ report }: { report: NonNullable<AiVisibilityResponse["report"]> }) {
  if (report.competitors.length === 0) {
    return <div className="av-empty">No other businesses were named in scored answers.</div>;
  }
  return (
    <div className="av-card">
      <h3 className="av-h">Who gets recommended instead</h3>
      <p className="av-p">Appearances across scored answers. “Won against us” is questions where they were named and you were not.</p>
      <ResponsiveTable>
        <table className="av-table">
          <thead>
            <tr>
              <th>Business</th>
              <th>Appearances</th>
              <th>Won against us</th>
              <th>Best rank</th>
              <th>Avg rank</th>
              <th>Assistants</th>
            </tr>
          </thead>
          <tbody>
            {report.competitors.map((c) => (
              <tr key={c.name}>
                <td className="av-prompt">{c.name}</td>
                <td>{c.appearances}</td>
                <td>{c.wonAgainstUs}</td>
                <td>{c.bestRank ?? "—"}</td>
                <td>{c.avgRank ?? "—"}</td>
                <td className="av-muted">{c.assistants.map(assistantLabel).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ResponsiveTable>
    </div>
  );
}

function Citations({ report }: { report: NonNullable<AiVisibilityResponse["report"]> }) {
  return (
    <div className="av-grid2">
      <div className="av-card">
        <h3 className="av-h">Your pages that earned a citation</h3>
        <p className="av-p">Being cited without being named still counts as a mention in the rate above.</p>
        {report.citedPages.length === 0 ? (
          <div className="av-muted">No assistant cited one of your URLs in this window.</div>
        ) : (
          <ResponsiveTable>
            <table className="av-table">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Citations</th>
                  <th>Assistants</th>
                </tr>
              </thead>
              <tbody>
                {report.citedPages.map((p) => (
                  <tr key={p.url}>
                    <td>
                      <a className="av-link" href={p.url} target="_blank" rel="noreferrer">{p.title || hostPath(p.url)}</a>
                      <div className="av-muted">{hostPath(p.url)}</div>
                    </td>
                    <td>{p.citations}</td>
                    <td className="av-muted">{p.assistants.map(assistantLabel).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </div>
      <div className="av-card">
        <h3 className="av-h">Domains assistants cite</h3>
        <p className="av-p">Who owns the sources is a different question from who gets named.</p>
        {report.citedDomains.length === 0 ? (
          <div className="av-muted">No citation domains recorded.</div>
        ) : (
          <SegmentList
            rows={report.citedDomains.map((d) => ({
              segment: d.isOwn ? `${d.domain} (yours)` : d.domain,
              checks: d.citations,
              mentioned: d.citations,
              scorable: report.citedDomains[0]?.citations || d.citations,
              rate: null,
            }))}
            value={(r) => String(r.checks)}
          />
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div className="av-card">
      <div className="av-label">{label}</div>
      <div className="av-val" style={{ color: color || "#1A2030", marginTop: 8 }}>{value}</div>
      <div className="av-sub">{sub}</div>
    </div>
  );
}

function SegmentList({
  rows,
  value,
}: {
  rows: SegmentBreakdown[];
  value?: (row: SegmentBreakdown) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.scorable || r.checks || 0));
  return (
    <div className="av-seg">
      {rows.map((r) => {
        const width = Math.round(((r.scorable || r.checks) / max) * 100);
        return (
          <div key={r.segment} className="av-seg-row">
            <div className="av-seg-label">{r.segment}</div>
            <div className="av-seg-track">
              <div className="av-seg-fill" style={{ width: `${width}%`, background: TONE[rateTone(r.rate)] }} />
            </div>
            <div className="av-seg-val">{value ? value(r) : r.rate == null ? ofSample(r.mentioned, r.scorable) : `${formatPct(r.rate)}`}</div>
          </div>
        );
      })}
    </div>
  );
}

function AssistantDots({ prompt }: { prompt: PromptBreakdown }) {
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {prompt.perAssistant.map((a, i) => {
        const kind = a.error ? "miss" : a.mentioned ? "yes" : "no";
        const title = `${assistantLabel(a.assistant)}${a.error ? `: ${a.error}` : a.mentioned ? a.rank != null ? ` #${a.rank}` : " named" : " not named"}`;
        return (
          <span key={`${a.assistant}-${i}`} className={`av-dot ${kind}`} title={title}>
            {kind === "yes" ? "✓" : kind === "no" ? "✕" : "·"}
          </span>
        );
      })}
    </span>
  );
}

function AssistantChips({ assistants }: { assistants: AiVisibilityResponse["assistants_configured"] }) {
  if (!assistants.length) return null;
  return (
    <div className="io-status-row" style={{ justifyContent: "center", marginTop: 18 }}>
      {assistants.map((a) => (
        <div key={a.id} className="io-status-chip" style={{ borderColor: a.available ? "#00B894" : "#B2BAC8", color: a.available ? "#00B894" : "#8A93A6" }}>
          {a.label}{a.available ? "" : " — off"}
        </div>
      ))}
    </div>
  );
}

function hostPath(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

function pct(part: number, total: number): number | null {
  if (!total) return null;
  return Math.round((part / total) * 1000) / 10;
}
