"use client";
import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { useToast, useConfirm } from "@/app/_components/Notify";
import Field from "@/app/_components/Field";
import { Panel, PanelHead } from "../_components/Panel";
import { IconCheck, IconAlert, IconLink, IconExternal, IconSparkle } from "../icons";
import type { PublicConnectionState, ConnectionAction } from "@/lib/connections";

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

const BADGE: Record<PublicConnectionState["status"], { cls: string; label: string }> = {
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

/** Connections that authenticate by signing in at Google. */
const GOOGLE_KEYS = new Set(["search_console", "google_analytics", "google_business_profile"]);

/** What the customer is choosing, in their words rather than Google's. */
const NOUN: Record<string, string> = {
  search_console: "website",
  google_analytics: "property",
  google_business_profile: "location",
};

type PickState = {
  loading: boolean;
  accountId: string | null;
  items: { id: string; label: string; detail: string | null }[];
  chosen: string;
  reason: string | null;
};

/** The list of things a customer can point a Google connection at. */
function GooglePicker({
  state, noun, busy, onChange, onSave,
}: {
  state: PickState;
  noun: string;
  busy: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  if (state.loading) {
    return <div className="p-conn-meta">Loading your {noun}s from Google…</div>;
  }
  if (state.reason === "reauth_required") {
    return <div className="p-conn-note"><IconAlert size={13} /><span>Please sign in to Google again to continue.</span></div>;
  }
  if (state.reason === "unavailable") {
    return (
      <div className="p-conn-note">
        <IconSparkle size={13} />
        <span>You&apos;re signed in. We&apos;re still waiting on Google to approve access for this one — nothing more is needed from you.</span>
      </div>
    );
  }
  if (!state.items.length) {
    return (
      <div className="p-conn-note">
        <IconAlert size={13} />
        <span>We couldn&apos;t find any {noun}s on that Google account. Try connecting with a different account.</span>
      </div>
    );
  }
  return (
    <div className="p-conn-pick">
      <Field
        as="select"
        label={`Choose a ${noun}`}
        hideLabel
        value={state.chosen}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a {noun}…</option>
        {state.items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.label}{i.detail ? ` — ${i.detail}` : ""}
          </option>
        ))}
      </Field>
      <button
        className="p-btn primary"
        style={{ marginTop: 8 }}
        onClick={onSave}
        disabled={!state.chosen || busy}
        data-busy={busy || undefined}
      >
        <span>{busy ? "Saving…" : `Use this ${noun}`}</span>
      </button>
    </div>
  );
}

/**
 * What the customer is told when Google sends them back. The callback can only
 * pass a short code in the URL, so the wording lives here where it can stay in
 * the customer's language rather than being assembled server-side.
 */
const RETURN_MESSAGE: Record<string, { kind: "success" | "info" | "error"; title: string; detail: string }> = {
  connected: { kind: "success", title: "Connected", detail: "Your data will start flowing through shortly." },
  choose: { kind: "info", title: "Almost there", detail: "Choose which one you'd like us to use." },
  cancelled: { kind: "info", title: "Sign-in cancelled", detail: "Nothing was changed. You can try again whenever you're ready." },
  empty: { kind: "info", title: "Signed in", detail: "We couldn't find anything on that Google account to connect. Try another account." },
  linked_no_access: {
    kind: "info",
    title: "Signed in",
    detail: "We're still waiting on Google to approve access for this one. Nothing more is needed from you.",
  },
  failed: { kind: "error", title: "That didn't work", detail: "We couldn't complete the connection. Please try again." },
};

export default function ConnectionsPanel({ brandId }: { brandId: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<PublicConnectionState[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [googlePick, setGooglePick] = useState<Record<string, PickState>>({});

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
      setFailed("We couldn't check your connections just now.");
      setRows([]);
    }
  }, [brandId]);

  useEffect(() => { load(); }, [load]);

  /** Load what this Google connection can be pointed at. */
  const loadGoogleOptions = useCallback(async (key: string) => {
    setGooglePick((g) => ({
      ...g,
      [key]: { loading: true, accountId: null, items: [], chosen: "", reason: null },
    }));
    try {
      const res = await authedFetch(`/api/portal/google/select?brand=${brandId}&product=${key}`);
      const data = await res.json().catch(() => ({}));
      setGooglePick((g) => ({
        ...g,
        [key]: {
          loading: false,
          accountId: data.accountId || null,
          items: data.resources || [],
          // Preselect what's already in use, so "change it" starts from today's value.
          chosen: data.selected || "",
          reason: data.reason || null,
        },
      }));
    } catch {
      setGooglePick((g) => ({
        ...g,
        [key]: { loading: false, accountId: null, items: [], chosen: "", reason: "unavailable" },
      }));
    }
  }, [brandId]);

  // Google sends the customer back here with a result code. Report it, then
  // strip it from the URL so a refresh doesn't replay the same message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (!result) return;

    const msg = RETURN_MESSAGE[result] || RETURN_MESSAGE.failed;
    toast[msg.kind](msg.title, msg.detail);

    // Returning with "choose" means the account linked but more than one
    // option exists, so open that picker straight away rather than making the
    // customer hunt for it.
    if (result === "choose" || result === "linked_no_access") {
      const prod = params.get("product");
      if (prod) void loadGoogleOptions(prod);
    }

    params.delete("google");
    params.delete("product");
    params.delete("reason");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    load();
  }, [toast, load, loadGoogleOptions]);


  async function saveGoogleChoice(row: PublicConnectionState) {
    const pick = googlePick[row.key];
    if (!pick?.chosen || !pick.accountId) return;
    setBusy(`${row.key}:save`);
    try {
      const res = await authedFetch("/api/portal/google/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brandId,
          product: row.key,
          action: "select",
          account_id: pick.accountId,
          resource_id: pick.chosen,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "We couldn't save that", undefined);
        return;
      }
      toast.success("Connected", data.label ? `Now using ${data.label}.` : undefined);
      setGooglePick((g) => {
        const next = { ...g };
        delete next[row.key];
        return next;
      });
      await load();
    } catch {
      toast.error("We couldn't save that", "Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function startGoogle(row: PublicConnectionState) {
    setBusy(`${row.key}:connect`);
    try {
      const res = await authedFetch(
        `/api/portal/google/start?brand=${brandId}&product=${row.key}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        toast.error(data.error || "We couldn't start the connection", "Please try again in a moment.");
        setBusy(null);
        return;
      }
      // Deliberately a full navigation, not a popup: popups are blocked by
      // default on mobile Safari, which is where a lot of these are done.
      window.location.href = data.url;
    } catch {
      toast.error("We couldn't start the connection", "Check your connection and try again.");
      setBusy(null);
    }
  }

  async function act(row: PublicConnectionState, action: ConnectionAction) {
    // Connecting or reconnecting a Google product means signing in at Google.
    if (GOOGLE_KEYS.has(row.key) && (action === "connect" || action === "reconnect")) {
      await startGoogle(row);
      return;
    }

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
      // Disconnecting a Google product clears its selection through the Google
      // routes, which also keep brands.gsc_property in step. The older
      // connections route knows nothing about Analytics or Business Profile.
      const useGoogleRoute = GOOGLE_KEYS.has(row.key) && action === "disconnect" && row.key !== "search_console";
      const res = useGoogleRoute
        ? await authedFetch("/api/portal/google/select", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ brand_id: brandId, product: row.key, action: "disconnect" }),
          })
        : await authedFetch("/api/portal/connections", {
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

                {row.detail && <div className="p-conn-account">{row.detail}</div>}

                {row.lastSyncLabel && (
                  <div className="p-conn-meta">
                    {row.lastSyncLabel}
                    {row.lastSyncAt && <> · last run {relative(row.lastSyncAt)}</>}
                  </div>
                )}

                {/* Raw provider and database errors are deliberately not
                    rendered — the server strips them and logs them instead, so
                    a customer reads `why` rather than a Postgres error code. */}

                {/* Not available yet: describe what's coming, never a dead end. */}
                {row.requirement && (
                  <div className="p-conn-note">
                    <IconSparkle size={13} />
                    <span>{row.requirement}</span>
                  </div>
                )}

                {needsChoice && (
                  <div className="p-conn-pick">
                    <Field
                      as="select"
                      label={`Choose a website for ${row.name}`}
                      hideLabel
                      value={choice[row.key] || ""}
                      onChange={(e) => setChoice((c) => ({ ...c, [row.key]: e.target.value }))}
                    >
                      <option value="">Select a website…</option>
                      {row.accounts!.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}{a.detail ? ` — ${a.detail}` : ""}
                        </option>
                      ))}
                    </Field>
                  </div>
                )}

                {/* Google products fetch their options from Google itself, so
                    the list is loaded on demand rather than made part of every
                    page load. */}
                {GOOGLE_KEYS.has(row.key) && googlePick[row.key] && (
                  <GooglePicker
                    state={googlePick[row.key]}
                    noun={NOUN[row.key] || "option"}
                    busy={busy === `${row.key}:save`}
                    onChange={(v) => setGooglePick((g) => ({ ...g, [row.key]: { ...g[row.key], chosen: v } }))}
                    onSave={() => saveGoogleChoice(row)}
                  />
                )}

                {row.accounts?.length === 0 && row.status === "not_connected" && (
                  <div className="p-conn-note">
                    <IconAlert size={13} />
                    <span>
                      Your account manager needs to share your website with us before it can be
                      connected here.{" "}
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
                          title={blocked ? "Choose a website first" : undefined}
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
