"use client";
import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { useToast, useConfirm } from "@/app/_components/Notify";
import Field from "@/app/_components/Field";
import { Panel, PanelHead } from "../_components/Panel";
import { IconCheck, IconAlert, IconLink, IconExternal } from "../icons";
import type { ConnectionState, ConnectionAction } from "@/lib/connections";

// THE INTEGRATION CENTER.
//
// Replaces a static list that showed "Connected"/"Not connected" derived from
// two brand columns. Everything rendered here — status, the reason for it,
// freshness, which actions exist, which properties are selectable — comes from
// lib/connections.ts, so the page has no opinion of its own to drift.
//
// The rule this component follows: nothing is ever a dead end. A service the
// platform can't connect to yet renders what it would take instead of a button
// that does nothing.

const BADGE: Record<ConnectionState["status"], { cls: string; label: string }> = {
  connected: { cls: "green", label: "Connected" },
  not_connected: { cls: "", label: "Not connected" },
  expired: { cls: "amber", label: "Access expired" },
  error: { cls: "red", label: "Needs attention" },
  unavailable: { cls: "", label: "Not available yet" },
};

const ACTION_LABEL: Record<ConnectionAction, string> = {
  connect: "Connect",
  disconnect: "Disconnect",
  reconnect: "Reconnect",
  sync_now: "Sync now",
};

export default function ConnectionsPanel({ brandId }: { brandId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ConnectionState[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      const res = await authedFetch(`/api/portal/connections?brand=${brandId}`);
      if (!res.ok) {
        setFailed("We couldn't load your connections just now.");
        setRows([]);
        return;
      }
      const data = await res.json();
      setFailed(null);
      setRows(data.connections || []);
    } catch {
      setFailed("We couldn't reach the server to check your connections.");
      setRows([]);
    }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  async function act(row: ConnectionState, action: ConnectionAction) {
    if (action === "disconnect") {
      const ok = await confirm({
        title: `Disconnect ${row.name}?`,
        body:
          row.key === "search_console"
            ? "Your ranking and traffic data will stop updating until you reconnect. Nothing already collected is deleted."
            : "Approved work will need to be published by hand until you reconnect.",
        confirmLabel: "Disconnect",
        danger: true,
      });
      if (!ok) return;
    }

    setBusy(`${row.key}:${action}`);
    try {
      const res = await authedFetch("/api/portal/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          key: row.key,
          action,
          account: choice[row.key] || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (data.redirect) {
        toast.info(data.message || "Continue setup", "Taking you to the right page.");
        window.location.href = data.redirect;
        return;
      }
      if (!res.ok) {
        toast.error(data.error || "That didn't work", data.detail || undefined);
        return;
      }
      toast.success(ACTION_LABEL[action], data.message || undefined);
      await load();
    } catch {
      toast.error("That didn't work", "Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  if (rows === null) {
    return (
      <Panel>
        <PanelHead title="Connected accounts" sub="Checking your connections…" />
        <div className="p-conn-list">
          {[0, 1, 2].map((i) => <div key={i} className="p-conn"><div className="p-skel" style={{ height: 44, width: "100%" }} /></div>)}
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHead
        title="Connected accounts"
        sub="Where your data comes from, whether each connection is healthy, and what to do when it isn't."
      />

      {failed && (
        <div className="p-conn-note error" role="status">
          <IconAlert size={14} />
          <span>{failed} <button className="p-linkbtn" onClick={load}>Try again</button></span>
        </div>
      )}

      <div className="p-conn-list">
        {rows.map((row) => {
          const badge = BADGE[row.status];
          const on = row.status === "connected";
          const needsChoice =
            (row.status === "not_connected" || row.status === "expired") &&
            !!row.accounts?.length;

          return (
            <div className="p-conn" key={row.key}>
              <span className={`p-conn-dot ${on ? "on" : ""}`}>
                {on ? <IconCheck size={13} /> : row.status === "unavailable" ? <IconLink size={13} /> : <IconAlert size={13} />}
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="p-conn-name">{row.name}</div>
                <div className="p-conn-desc">{row.purpose}</div>

                {/* Why this status — always present, so no state is unexplained. */}
                <div className="p-conn-why">{row.why}</div>

                {row.detail && <code className="p-conn-detail">{row.detail}</code>}

                {row.lastSyncLabel && (
                  <div className="p-conn-meta">
                    {row.lastSyncLabel}
                    {row.lastSyncAt && <> · last run {relative(row.lastSyncAt)}</>}
                  </div>
                )}

                {row.lastError && (
                  <div className="p-conn-meta err" title={row.lastError}>
                    {truncate(row.lastError, 140)}
                  </div>
                )}

                {/* Not available yet: say what it would take, never a dead end. */}
                {row.requirement && (
                  <div className="p-conn-note">
                    <IconAlert size={13} />
                    <span>{row.requirement}</span>
                  </div>
                )}

                {needsChoice && (
                  <div className="p-conn-pick">
                    <Field
                      as="select"
                      label={`Choose a property for ${row.name}`}
                      hideLabel
                      value={choice[row.key] || row.detail || ""}
                      onChange={(e) => setChoice((c) => ({ ...c, [row.key]: e.target.value }))}
                    >
                      <option value="">Select a property…</option>
                      {row.accounts!.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}{a.detail ? ` — ${a.detail}` : ""}
                        </option>
                      ))}
                    </Field>
                  </div>
                )}

                {row.accounts?.length === 0 && row.status === "not_connected" && (
                  <div className="p-conn-note">
                    <IconAlert size={13} />
                    <span>
                      Add our service account as a user on your property in Search Console, then
                      choose it here.{" "}
                      <a
                        href="https://search.google.com/search-console/users"
                        target="_blank"
                        rel="noreferrer"
                        className="p-inline-link"
                      >
                        Open Search Console <IconExternal size={11} />
                      </a>
                    </span>
                  </div>
                )}

                {row.actions.length > 0 && (
                  <div className="p-conn-actions">
                    {row.actions.map((a) => {
                      const key = `${row.key}:${a}`;
                      const isBusy = busy === key;
                      const blocked = a === "connect" && needsChoice && !choice[row.key];
                      return (
                        <button
                          key={a}
                          className={`p-btn ${a === "disconnect" ? "ghost danger" : a === "connect" ? "primary" : "ghost"}`}
                          onClick={() => act(row, a)}
                          disabled={!!busy || blocked}
                          data-busy={isBusy || undefined}
                          title={blocked ? "Choose a property first" : undefined}
                        >
                          <span>{isBusy ? "Working…" : ACTION_LABEL[a]}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <span className={`p-badge ${badge.cls}`}>{badge.label}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
