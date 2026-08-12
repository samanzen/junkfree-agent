"use client";
import { useEffect, useState } from "react";
import { m } from "framer-motion";
import { describeKind, describeTiming, relativeTime } from "@/lib/agentActivity";
import type { AgentActivity as Activity, AgentActivityItem } from "../_data";
import { EASE } from "./motion";
import EmptyState from "./EmptyState";
import { IconCheck, IconClock, IconAlert, IconSparkle } from "../icons";

// AGENT ACTIVITY — the platform showing its own work.
//
// Every row here is a real `jobs` row: the status is the column the runner
// writes, and the timings are the ones it records. Nothing is simulated, and
// where the platform genuinely does not know a duration (the timing columns are
// written best-effort — see lib/agentActivity) the field is simply absent
// rather than estimated.
//
// Colour discipline: the running state is the ONLY azure here, because azure
// means "the machine is acting". Done is positive, failed is critical, queued
// is neutral. State is carried by the icon and the label as well as the colour,
// so it survives a colour-blind reader and forced-colors mode.

const STATE = {
  running: { cls: "on", label: "Running" },
  queued: { cls: "queued", label: "Queued" },
  done: { cls: "done", label: "Done" },
  failed: { cls: "failed", label: "Failed" },
} as const;

function StateIcon({ status }: { status: AgentActivityItem["status"] }) {
  if (status === "done") return <IconCheck size={12} />;
  if (status === "failed") return <IconAlert size={12} />;
  if (status === "queued") return <IconClock size={12} />;
  return <IconSparkle size={12} />;
}

function Row({ item, now }: { item: AgentActivityItem; now: number }) {
  const timing = describeTiming(item, now);
  const state = STATE[item.status];

  // Running work reports elapsed time; settled work reports how long it took
  // and how long ago it happened. Both come from real timestamps.
  const meta =
    item.status === "running"
      ? timing && `running ${timing}`
      : item.status === "queued"
      ? "waiting to start"
      : [timing, relativeTime(item.finished_at || item.created_at, now)]
          .filter(Boolean)
          .join(" · ");

  return (
    <m.li
      className={`p-act-row is-${state.cls}`}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      <span className="p-act-dot" aria-hidden="true" />
      <span className="p-act-main">
        <span className="p-act-title">{describeKind(item.kind)}</span>
        {item.status === "failed" && item.error && (
          <span className="p-act-error">{item.error}</span>
        )}
      </span>
      <span className="p-act-meta">
        <span className="p-act-state">
          <StateIcon status={item.status} />
          {state.label}
        </span>
        {meta && <span className="p-act-time">{meta}</span>}
      </span>
    </m.li>
  );
}

export default function AgentActivity({ activity, loading }: { activity: Activity | null; loading: boolean }) {
  // Elapsed time on a running job has to advance, or "running 0:04" is a lie
  // three seconds later. Ticks only while something is actually running.
  const running = (activity?.counts.running ?? 0) > 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (loading && !activity) {
    return <div className="p-skel" style={{ height: 168 }} />;
  }
  if (!activity || activity.items.length === 0) {
    return (
      <EmptyState
        icon={<IconSparkle size={20} />}
        title="No agent runs yet"
        sub="Your agents run on a schedule. As soon as they start work, every step shows up here with its status and how long it took."
      />
    );
  }

  return (
    <ul className="p-act-list">
      {activity.items.map((item) => (
        <Row key={item.id} item={item} now={now} />
      ))}
    </ul>
  );
}
