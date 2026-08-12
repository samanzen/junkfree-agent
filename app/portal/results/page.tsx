"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import PageHeader from "../_components/PageHeader";
import { Panel, PanelHead } from "../_components/Panel";
import EmptyState from "../_components/EmptyState";
import {
  outcomeStatusLabel,
  type AttributedOutcome,
  type OutcomeStatus,
  type OutcomeSummary,
} from "@/lib/outcomes";
import { IconTraffic, IconCheck } from "../icons";

type OutcomesPayload = {
  available: boolean;
  reason?: string;
  note?: string;
  items: AttributedOutcome[];
  summary: OutcomeSummary;
};

const STATUS_TONE: Record<OutcomeStatus, string> = {
  improved: "green",
  declined: "red",
  unchanged: "",
  too_early: "amber",
  insufficient_data: "amber",
  unlinked: "",
};

function fmtDelta(n: number | null | undefined, invert = false): string | null {
  if (n == null || Number.isNaN(n)) return null;
  const v = invert ? -n : n;
  const sign = v > 0 ? "+" : "";
  return `${sign}${Number.isInteger(v) ? v : v.toFixed(1)}`;
}

export default function ResultsPage() {
  const { brand } = usePortalAuth();
  const [data, setData] = useState<OutcomesPayload | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (!brand?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch(`/api/portal/outcomes?brand=${brand.id}`);
        if (!res.ok) {
          if (!cancelled) setFailed("We couldn't load outcome trails just now.");
          return;
        }
        const body = (await res.json()) as OutcomesPayload;
        if (!cancelled) {
          setFailed(null);
          setData(body);
        }
      } catch {
        if (!cancelled) setFailed("We couldn't load outcome trails just now.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brand?.id]);

  if (!brand) return null;

  const summary = data?.summary;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Results"
        title="Outcome trails"
        sub="What moved after published work — with Search Console lag respected. Correlation, not celebration."
      />

      {failed && (
        <div className="p-conn-note error" role="status">
          <span>{failed}</span>
        </div>
      )}

      {!data ? (
        <div className="p-skel" style={{ height: 320 }} />
      ) : !data.available ? (
        <EmptyState
          icon={<IconTraffic size={22} />}
          title="Outcome tracking isn't available yet"
          sub={data.reason || "The action event log needs to be present in this environment."}
        />
      ) : (
        <>
          <div className="p-outcome-summary" aria-label="Outcome summary">
            {(
              [
                ["improved", "Improved"],
                ["declined", "Declined"],
                ["unchanged", "Unchanged"],
                ["too_early", "Too early"],
                ["insufficient_data", "Thin data"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={`p-outcome-pill tone-${STATUS_TONE[key] || "neutral"}`}>
                <b>{summary?.[key] ?? 0}</b>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <Panel>
            <PanelHead
              title="Published work → later movement"
              sub="Baseline is the 14 days before publish; measurement starts after the usual 3-day Search Console lag."
            />

            {data.items.length === 0 ? (
              <EmptyState
                icon={<IconCheck size={22} />}
                title="No outcome trails yet"
                sub={
                  data.note ||
                  "Approve and publish work. Results appear here once Search Console has enough of a before/after window."
                }
                action={
                  <Link href="/portal/approvals" className="p-btn primary">
                    <span>Open Approvals</span>
                  </Link>
                }
              />
            ) : (
              <ul className="p-outcome-list">
                {data.items.map((item) => {
                  const tone = STATUS_TONE[item.status];
                  const pos = fmtDelta(item.deltas?.position);
                  const clicks = fmtDelta(item.deltas?.clicks);
                  return (
                    <li key={item.actionId} className="p-outcome-row">
                      <div className="p-outcome-main">
                        <div className="p-outcome-title">
                          {item.eventDetail || item.eventLabel}
                        </div>
                        <div className="p-outcome-meta">
                          <span>{new Date(item.occurredAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}</span>
                          {item.keyword && <span>· {item.keyword}</span>}
                          {item.pageUrl && (
                            <span className="p-outcome-url">
                              · {item.pageUrl.replace(/^https?:\/\//, "")}
                            </span>
                          )}
                        </div>
                        <p className="p-outcome-explain">{item.explanation}</p>
                        {(pos || clicks) && (
                          <div className="p-outcome-deltas">
                            {pos && (
                              <span>
                                Position <b>{pos}</b>
                                <em> (lower rank number is better)</em>
                              </span>
                            )}
                            {clicks && (
                              <span>
                                Clicks <b>{clicks}</b>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className={`p-badge ${tone}`}>
                        {outcomeStatusLabel(item.status)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
