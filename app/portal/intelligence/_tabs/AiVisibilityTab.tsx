"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { Panel, PanelHead } from "../../_components/Panel";
import StatTile from "../../_components/StatTile";
import EmptyState from "../../_components/EmptyState";
import ResponsiveTable from "@/app/_components/ResponsiveTable";
import { Stagger } from "../../_components/motion";
import MultiLineChart from "../../_components/MultiLineChart";
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
  type AiVisibilityResponse,
} from "@/lib/ai-visibility/display";
import type { SegmentBreakdown } from "@/lib/ai-visibility/report";

export default function AiVisibilityTab({ brandId }: { brandId: string }) {
  const [data, setData] = useState<AiVisibilityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authedFetch(`/api/intelligence/ai-visibility?brand=${brandId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [brandId]);

  if (loading) {
    return (
      <div className="p-stack">
        <div className="p-skel" style={{ height: 150 }} />
        <div className="p-skel" style={{ height: 280 }} />
      </div>
    );
  }

  const assistants = data?.assistants_configured || [];
  const hasAssistants = hasConfiguredAssistants(assistants);
  const report = data?.report;

  if (!data || data.error || !report) {
    return (
      <EmptyState
        icon="✦"
        title={emptyTitle(data?.reason, hasAssistants)}
        sub={emptyBody(data?.reason, hasAssistants, "customer")}
      />
    );
  }

  const overall = report.overall;
  const trend = report.trend
    .filter((p) => p.mentionRate != null)
    .map((p) => ({
      date: new Date(p.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      rate: p.mentionRate as number,
    }));
  const sent = report.sentiment;
  const sentTotal = sent.positive + sent.neutral + sent.negative;

  return (
    <div className="p-stack">
      <Panel>
        <PanelHead
          title="AI assistants"
          badge={formatPct(overall.rate)}
          sub="Share of questions where an assistant named you, out of the questions where it named anyone. Answers change from one ask to the next, so this is a rate across many questions, not a single reading."
        />
        <Stagger className="p-stat-grid">
          <StatTile label="Named in" value={ofSample(overall.mentioned, overall.scorable)} tone="accent" sub={namedIn(overall.mentioned, overall.scorable)} />
          <StatTile label="Mention rate" value={formatPct(overall.rate)} tone="green" sub="Of scored answers" />
          <StatTile label="Avg. rank when named" value={overall.avgRank != null ? overall.avgRank.toFixed(1) : "—"} tone="pink" sub="Lower is better" />
          <StatTile label="Questions you lose" value={String(report.gaps.length)} tone={report.gaps.length ? "red" : "green"} sub="No assistant named you" />
        </Stagger>
        {data.latest_run && (
          <p className="p-panel-sub" style={{ marginTop: 12 }}>
            Last check {formatWhen(data.latest_run.finished_at || data.latest_run.started_at)}.
            {data.latest_run.status === "running" ? " A new check is running now." : ""}
          </p>
        )}
      </Panel>

      {data.summary && (
        <Panel>
          <PanelHead title="What this means" />
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.65, color: "var(--text2)" }}>{data.summary}</p>
        </Panel>
      )}

      <div className="p-2col">
        <Panel>
          <PanelHead title="By assistant" sub="A missing channel is not configured yet, not a zero." />
          {report.assistants.length === 0 ? (
            <EmptyState icon="○" title="No assistants in this check" />
          ) : (
            <Stagger className="p-stat-grid">
              {report.assistants.map((a) => (
                <StatTile
                  key={a.assistant}
                  label={assistantLabel(a.assistant)}
                  value={formatPct(a.rate)}
                  tone={a.rate == null ? "muted" : (a.rate >= 50 ? "green" : a.rate >= 25 ? "amber" : "red")}
                  sub={ofSample(a.mentioned, a.scorable)}
                />
              ))}
              {assistants.filter((a) => !a.available).map((a) => (
                <StatTile key={a.id} label={a.label} value="—" tone="muted" sub="Not configured" />
              ))}
            </Stagger>
          )}
        </Panel>
        <Panel>
          <PanelHead title="Over time" sub="Completed weekly checks only." />
          {trend.length > 1 ? (
            <MultiLineChart
              data={trend}
              series={[{ key: "rate", name: "Mention rate", color: "var(--accent)" }]}
              height={220}
            />
          ) : (
            <EmptyState icon="📊" title="Not enough history yet" sub="This chart fills in after the second weekly check." />
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHead
          title="Questions nobody named you for"
          badge={report.gaps.length || undefined}
          badgeTone="red"
          sub="These are the questions a customer would ask where every assistant recommended someone else — or did not name you."
        />
        {report.gaps.length === 0 ? (
          <EmptyState icon="✓" title="You were named on every scored question" sub="That is the goal. Keep watching as new questions are added." />
        ) : (
          <PromptTable rows={report.gaps} />
        )}
      </Panel>

      <Panel>
        <PanelHead title="Every question we asked" sub="Worst first. Being cited without being named still counts." />
        <PromptTable rows={report.prompts} />
      </Panel>

      <div className="p-2col">
        <PlacePanel title="Cities" column="City" rows={report.places.cities} empty="No city was attached to these questions." />
        <PlacePanel title="Neighbourhoods" column="Neighbourhood" rows={report.places.neighborhoods} empty="No neighbourhood-level questions in this check." />
        <PlacePanel title="Regions" column="Region" rows={report.places.regions} empty="No region was attached to these questions." />
        <PlacePanel title="Countries" column="Country" rows={report.places.countries} empty="No country was attached to these questions." />
        <PlacePanel title="Languages" column="Language" rows={report.languages.map((r) => ({ ...r, segment: languageLabel(r.segment) }))} empty="Only one language was asked." />
        <PlacePanel title="Question types" column="Type" rows={report.intents.map((r) => ({ ...r, segment: intentLabel(r.segment) }))} empty="No question types recorded." />
      </div>

      <Panel>
        <PanelHead title="Who gets recommended instead" sub="Businesses named in the same answers. Won against you means they were named and you were not." />
        {report.competitors.length === 0 ? (
          <EmptyState icon="○" title="No other businesses were named" />
        ) : (
          <ResponsiveTable>
            <table className="p-table">
              <thead>
                <tr>
                  <th>Business</th>
                  <th>Appearances</th>
                  <th>Won against you</th>
                  <th>Best rank</th>
                  <th>Assistants</th>
                </tr>
              </thead>
              <tbody>
                {report.competitors.map((c) => (
                  <tr key={c.name}>
                    <td><div className="p-kwcell">{c.name}</div></td>
                    <td>{c.appearances}</td>
                    <td>{c.wonAgainstUs}</td>
                    <td>{c.bestRank ?? <span className="p-na">—</span>}</td>
                    <td>{c.assistants.map(assistantLabel).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTable>
        )}
      </Panel>

      <div className="p-2col">
        <Panel>
          <PanelHead title="Your pages they cited" sub="The URLs assistants pointed at when they answered." />
          {report.citedPages.length === 0 ? (
            <EmptyState icon="○" title="None of your pages were cited" sub="Being named without a citation still counts in the rate above." />
          ) : (
            <ResponsiveTable>
              <table className="p-table">
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
                        <a href={p.url} target="_blank" rel="noreferrer">{p.title || p.url}</a>
                      </td>
                      <td>{p.citations}</td>
                      <td>{p.assistants.map(assistantLabel).join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ResponsiveTable>
          )}
        </Panel>
        <Panel>
          <PanelHead title="How they described you" sub="Taken only from sentences that name you." />
          {sentTotal === 0 ? (
            <EmptyState icon="○" title="No description yet" sub="You were not named, or the answers had no describing sentence." />
          ) : (
            <Stagger className="p-stat-grid">
              <StatTile label="Positive" value={sent.positive} tone="green" />
              <StatTile label="Neutral" value={sent.neutral} tone="muted" />
              <StatTile label="Negative" value={sent.negative} tone="red" />
            </Stagger>
          )}
        </Panel>
      </div>
    </div>
  );
}

function PlacePanel({ title, column, rows, empty }: { title: string; column: string; rows: SegmentBreakdown[]; empty: string }) {
  return (
    <Panel>
      <PanelHead title={title} />
      {rows.length === 0 ? (
        <p className="p-panel-sub" style={{ margin: 0 }}>{empty}</p>
      ) : (
        <ResponsiveTable>
          <table className="p-table">
            <thead>
              <tr>
                <th>{column}</th>
                <th>Named</th>
                <th>Rate</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.segment}>
                  <td>{r.segment}</td>
                  <td>{ofSample(r.mentioned, r.scorable)}</td>
                  <td>{formatPct(r.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ResponsiveTable>
      )}
    </Panel>
  );
}

function PromptTable({ rows }: { rows: NonNullable<AiVisibilityResponse["report"]>["prompts"] }) {
  if (!rows.length) return <EmptyState icon="○" title="No questions in this check" />;
  return (
    <ResponsiveTable mode="scroll">
      <table className="p-table">
        <thead>
          <tr>
            <th>Question</th>
            <th>Place</th>
            <th>Type</th>
            <th>Named</th>
            <th>Also named</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.promptKey}>
              <td>
                <div className="p-kwcell">{p.promptText}</div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>{languageLabel(p.language)}</div>
              </td>
              <td>{p.localeLabel || p.city || <span className="p-na">—</span>}</td>
              <td><span className="p-chip">{intentLabel(p.intent)}</span></td>
              <td>{ofSample(p.mentioned, p.scorable)}</td>
              <td>{p.competitorsNamed.slice(0, 3).join(", ") || <span className="p-na">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ResponsiveTable>
  );
}
