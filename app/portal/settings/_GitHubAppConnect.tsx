"use client";

import { useCallback, useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { useToast } from "@/app/_components/Notify";

type RepoCard = {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  private: boolean;
  defaultBranch: string;
  framework: string | null;
  likelyDomain: string | null;
  confidence: "high" | "medium" | "low";
  contentPath: string | null;
  deploymentProvider: string | null;
  evidence: string[];
};

type Phase =
  | "idle"
  | "authorizing"
  | "finding"
  | "analyzing"
  | "testing"
  | "report"
  | "empty"
  | "error";

/**
 * Customer GitHub App connect UX — no PAT / owner / repo typing.
 */
export default function GitHubAppConnect({
  brandId,
  siteUrl,
  busy,
  onBusy,
  onDone,
  onCancel,
  onProve,
  mode = "authorize",
}: {
  brandId: string;
  siteUrl?: string | null;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onDone: () => void;
  onCancel: () => void;
  onProve?: () => void;
  /** authorize = start CTA; resume = post-callback discovery */
  mode?: "authorize" | "resume";
}) {
  const toast = useToast();
  const [phase, setPhase] = useState<Phase>(mode === "resume" ? "finding" : "idle");
  const [repos, setRepos] = useState<RepoCard[]>([]);
  const [chosen, setChosen] = useState<number | null>(null);
  const [addRepoUrl, setAddRepoUrl] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [connection, setConnection] = useState<{
    repository: string;
    framework: string | null;
    defaultBranch: string;
    contentPath: string | null;
    publishingMethod: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadRepos = useCallback(async () => {
    onBusy(true);
    setPhase("finding");
    setErrorMsg(null);
    try {
      setPhase("analyzing");
      const res = await authedFetch(`/api/portal/github/repos?brand=${encodeURIComponent(brandId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase("error");
        setErrorMsg(data.error || "Could not load repositories.");
        toast.error(data.error || "Could not load repositories");
        return;
      }
      setAddRepoUrl(data.addRepoUrl || null);
      const list = (data.repos || []) as RepoCard[];
      setRepos(list);
      if (!list.length) {
        setPhase("empty");
        return;
      }
      setPhase("testing");
      const suggested = data.suggestedRepoId ? Number(data.suggestedRepoId) : list[0].id;
      setChosen(suggested);
      setPhase("report");
    } catch {
      setPhase("error");
      setErrorMsg("Could not load repositories.");
      toast.error("Could not load repositories");
    } finally {
      onBusy(false);
    }
  }, [brandId, onBusy, toast]);

  useEffect(() => {
    if (mode === "resume") void loadRepos();
  }, [mode, loadRepos]);

  async function startInstall() {
    onBusy(true);
    setPhase("authorizing");
    try {
      const qs = new URLSearchParams({ brand: brandId });
      if (siteUrl) qs.set("site_url", siteUrl);
      const res = await authedFetch(`/api/portal/github/start?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        toast.error(data.error || "Connecting with GitHub isn't available right now.");
        setPhase("idle");
        onBusy(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      toast.error("Could not start GitHub connection");
      setPhase("idle");
      onBusy(false);
    }
  }

  async function confirmConnection() {
    if (!chosen) return;
    onBusy(true);
    try {
      const res = await authedFetch("/api/portal/github/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId, repo_id: chosen }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not save GitHub connection");
        return;
      }
      setConnection(data.connection || null);
      toast.success("GitHub connected", data.message);
      onProve?.();
      onDone();
    } catch {
      toast.error("Could not save GitHub connection");
    } finally {
      onBusy(false);
    }
  }

  const selected = repos.find((r) => r.id === chosen) || null;

  if (phase === "idle" || phase === "authorizing") {
    return (
      <div className="p-conn-setup-fields">
        <h3 className="p-conn-setup-title">Connect GitHub</h3>
        <p className="p-conn-setup-help">
          Authorize Volo to propose and publish approved website improvements. You choose which
          repository we can access.
        </p>
        <div className="p-conn-actions">
          <button type="button" className="p-btn ghost" onClick={onCancel} disabled={busy}>
            <span>Back</span>
          </button>
          <button
            type="button"
            className="p-btn primary"
            onClick={() => void startInstall()}
            disabled={busy}
          >
            <span>{phase === "authorizing" ? "Redirecting…" : "Connect GitHub"}</span>
          </button>
        </div>
        <button type="button" className="p-linkbtn" onClick={() => setShowHow((v) => !v)}>
          How GitHub access works
        </button>
        {showHow && (
          <div className="p-conn-meta">
            You&apos;ll briefly open GitHub to install the Volo GitHub App and pick repositories.
            GitHub then returns you here automatically. We never ask for a personal access token.
            Changes ship as pull requests for your review — never silent production edits.
          </div>
        )}
      </div>
    );
  }

  if (phase === "finding" || phase === "analyzing" || phase === "testing") {
    const steps = [
      { id: "authorizing", label: "Authorization confirmed", done: true },
      { id: "finding", label: "Finding your website repository", done: phase !== "finding" },
      { id: "analyzing", label: "Analyzing website structure", done: phase === "testing" || phase === "report" },
      { id: "testing", label: "Testing publishing access", done: false },
      { id: "report", label: "Preparing capability report", done: false },
    ];
    return (
      <div className="p-conn-setup-fields">
        <h3 className="p-conn-setup-title">Connecting GitHub</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {steps.map((s) => (
            <li key={s.id} className="p-conn-meta" style={{ opacity: s.done || s.id === phase ? 1 : 0.5 }}>
              {s.done ? "✓" : s.id === phase ? "…" : "○"} {s.label}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <div className="p-conn-setup-fields">
        <h3 className="p-conn-setup-title">Add repository access</h3>
        <p className="p-conn-setup-help">
          No repositories were authorized for this installation. Add repository access on GitHub,
          then we&apos;ll continue automatically when you return.
        </p>
        <div className="p-conn-actions">
          <button type="button" className="p-btn ghost" onClick={onCancel} disabled={busy}>
            <span>Cancel</span>
          </button>
          {addRepoUrl ? (
            <a className="p-btn primary" href={addRepoUrl}>
              <span>Add repository access</span>
            </a>
          ) : null}
          <button type="button" className="p-btn ghost" onClick={() => void loadRepos()} disabled={busy}>
            <span>I already added access</span>
          </button>
        </div>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="p-conn-setup-fields">
        <h3 className="p-conn-setup-title">Couldn&apos;t finish GitHub setup</h3>
        <p className="p-conn-setup-help">{errorMsg || "Something went wrong."}</p>
        <div className="p-conn-actions">
          <button type="button" className="p-btn ghost" onClick={onCancel} disabled={busy}>
            <span>Cancel</span>
          </button>
          <button type="button" className="p-btn primary" onClick={() => void loadRepos()} disabled={busy}>
            <span>Try again</span>
          </button>
        </div>
      </div>
    );
  }

  // report
  return (
    <div className="p-conn-setup-fields">
      <h3 className="p-conn-setup-title">
        {repos.length === 1 ? "Confirm your repository" : "Which repository contains this website?"}
      </h3>
      <p className="p-conn-setup-help">
        {repos.length === 1
          ? "We found one authorized repository. Confirm to connect."
          : "Pick the repository that powers this website. We never ask you to type the name."}
      </p>

      <div className="p-conn-setup-fields" style={{ gap: 8 }}>
        {repos.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`p-btn ${chosen === r.id ? "primary" : "ghost"}`}
            style={{ display: "block", width: "100%", textAlign: "left" }}
            onClick={() => setChosen(r.id)}
            disabled={busy}
          >
            <span>
              <strong>{r.name}</strong> · {r.owner} · {r.private ? "Private" : "Public"}
              <br />
              {r.framework || "Framework unknown"} · {r.defaultBranch}
              {r.likelyDomain ? ` · ${r.likelyDomain}` : ""}
              {" · "}
              {r.confidence === "high"
                ? "High confidence"
                : r.confidence === "medium"
                  ? "Possible match"
                  : "Low confidence"}
            </span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="p-conn-meta" style={{ marginTop: 12 }}>
          <div>
            <strong>Capability preview</strong>
          </div>
          <div>Publishing method: Pull requests</div>
          <div>Default branch: {selected.defaultBranch}</div>
          {selected.framework ? <div>Detected framework: {selected.framework}</div> : null}
          {selected.deploymentProvider ? <div>Deployment: {selected.deploymentProvider}</div> : null}
          <div>Create branches / commits / pull requests: supported</div>
        </div>
      )}

      <button type="button" className="p-linkbtn" onClick={() => setShowAdvanced((v) => !v)}>
        {showAdvanced ? "Hide advanced settings" : "Advanced settings"}
      </button>
      {showAdvanced && selected && (
        <div className="p-conn-meta">
          Content path detected: {selected.contentPath || "(none — will use adapter defaults)"}
          {selected.evidence?.length ? (
            <ul style={{ margin: "6px 0 0", paddingLeft: "1.1em" }}>
              {selected.evidence.slice(0, 8).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      {addRepoUrl && (
        <a className="p-linkbtn" href={addRepoUrl}>
          Add repository access
        </a>
      )}

      <div className="p-conn-actions">
        <button type="button" className="p-btn ghost" onClick={onCancel} disabled={busy}>
          <span>Cancel</span>
        </button>
        <button
          type="button"
          className="p-btn primary"
          onClick={() => void confirmConnection()}
          disabled={busy || !chosen}
        >
          <span>{busy ? "Saving…" : "Confirm connection"}</span>
        </button>
      </div>
      {connection ? (
        <div className="p-conn-meta">Connected: {connection.repository}</div>
      ) : null}
    </div>
  );
}
