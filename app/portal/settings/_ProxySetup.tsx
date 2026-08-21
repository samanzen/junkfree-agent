"use client";
import { useMemo, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { useToast } from "@/app/_components/Notify";
import Field from "@/app/_components/Field";
import {
  SUGGESTED_NAMESPACES,
  namespaceValidationError,
  normalizeProxyNamespace,
} from "@/lib/execution/proxy-token";
import { SNIPPET_HOSTS, type SnippetHost } from "@/lib/proxy/snippets";

type ClaimCheck = {
  namespace: string;
  result: "clear" | "collision" | "loop" | "unreachable" | "error";
  detail: string;
  probes?: Array<{ path: string; status: number | null; note?: string }>;
};

type SnippetBundle = Record<SnippetHost, { title: string; body: string; hint?: string }>;

export default function ProxySetup({
  brandId,
  busy,
  onBusy,
  onDone,
  onCancel,
  onCopy,
  onProve,
  lastFailReason,
  siteHost,
}: {
  brandId: string;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onDone: () => void;
  onCancel: () => void;
  onCopy: (text: string, label: string) => void;
  onProve: () => void;
  lastFailReason?: string | null;
  siteHost?: string | null;
}) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [namespace, setNamespace] = useState("guides");
  const [custom, setCustom] = useState("");
  const [claim, setClaim] = useState<ClaimCheck | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<SnippetBundle | null>(null);
  const [host, setHost] = useState<SnippetHost>("vercel");

  const chosenNs = normalizeProxyNamespace(custom || namespace);
  const nsError = namespaceValidationError(chosenNs);

  const activeSnippet = useMemo(() => {
    if (!snippets) return null;
    return snippets[host];
  }, [snippets, host]);

  const developerMailto = useMemo(() => {
    if (!activeSnippet || host !== "unknown") return null;
    const subject = encodeURIComponent(`Add rewrite for /${chosenNs}/ on our website`);
    const body = encodeURIComponent(activeSnippet.body);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [activeSnippet, host, chosenNs]);

  async function runClaimCheck() {
    if (nsError) {
      toast.error(nsError);
      return;
    }
    onBusy(true);
    try {
      const res = await authedFetch("/api/proxy/claim-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId, namespace: chosenNs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "We couldn't check that path");
        return;
      }
      setClaim(data.check);
      setNamespace(chosenNs);
      setCustom("");
      setStep(2);
      if (data.canContinue) {
        toast.success("Path is free", data.check?.detail);
      } else if (data.check?.result === "unreachable" || data.check?.result === "error") {
        toast.error("Check failed", data.check?.detail);
      } else {
        toast.error("That path won't work", data.check?.detail);
      }
    } catch {
      toast.error("We couldn't check that path", "Try again in a moment.");
    } finally {
      onBusy(false);
    }
  }

  async function mintSetup() {
    onBusy(true);
    try {
      const res = await authedFetch("/api/proxy/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId, namespace: chosenNs }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "We couldn't save that setup");
        return;
      }
      setToken(data.token);
      setSnippets(data.snippets);
      setStep(3);
      toast.success("Rewrite ready", data.message);
    } catch {
      toast.error("We couldn't save that setup", "Try again in a moment.");
    } finally {
      onBusy(false);
    }
  }

  const claimBlocks = claim?.result === "collision" || claim?.result === "loop";
  const claimRetry = claim?.result === "unreachable" || claim?.result === "error" || !claim;

  return (
    <div className="p-conn-setup">
      <p className="p-conn-setup-help">
        <strong>Recommended for custom sites.</strong> One config change on your
        host — no API code on your app. New pages live under a path on your domain.
      </p>

      <div className="p-conn-meta" style={{ marginBottom: 8 }}>
        Step {step} of 4 —{" "}
        {step === 1
          ? "Choose a path"
          : step === 2
            ? "Check the path"
            : step === 3
              ? "Add the rewrite"
              : "Prove publishing"}
      </div>

      {step === 1 && (
        <div className="p-conn-setup-fields">
          <div className="p-conn-setup-tabs" role="tablist" aria-label="Suggested paths">
            {SUGGESTED_NAMESPACES.map((ns) => (
              <button
                key={ns}
                type="button"
                role="tab"
                aria-selected={namespace === ns && !custom}
                className={`p-btn ${namespace === ns && !custom ? "primary" : "ghost"}`}
                onClick={() => {
                  setNamespace(ns);
                  setCustom("");
                }}
                disabled={busy}
              >
                <span>/{ns}/</span>
              </button>
            ))}
          </div>
          <Field
            label="Or a custom path"
            placeholder="guides"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            disabled={busy}
            helper={nsError || `New pages will appear at /${chosenNs || "…"}/ on your site.`}
            error={custom ? nsError : undefined}
          />
          <div className="p-conn-actions">
            <button type="button" className="p-btn ghost" onClick={onCancel} disabled={busy}>
              <span>Cancel</span>
            </button>
            <button
              type="button"
              className="p-btn primary"
              onClick={() => void runClaimCheck()}
              disabled={busy || !!nsError}
            >
              <span>{busy ? "Checking…" : "Check this path"}</span>
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="p-conn-setup-fields">
          {claim && (
            <div className={`p-conn-note ${claimBlocks ? "error" : ""}`}>
              <span>{claim.detail}</span>
            </div>
          )}
          {claim?.probes?.some((p) => p.note) && (
            <div className="p-conn-meta">
              {claim.probes.filter((p) => p.note).map((p) => p.note).join(" · ")}
            </div>
          )}
          <div className="p-conn-actions">
            <button type="button" className="p-btn ghost" onClick={() => setStep(1)} disabled={busy}>
              <span>Back</span>
            </button>
            {(claimRetry || claimBlocks) && (
              <button type="button" className="p-btn ghost" onClick={() => void runClaimCheck()} disabled={busy}>
                <span>{busy ? "Checking…" : "Retry check"}</span>
              </button>
            )}
            {claim?.result === "clear" && (
              <button type="button" className="p-btn primary" onClick={() => void mintSetup()} disabled={busy}>
                <span>{busy ? "Saving…" : "Continue"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="p-conn-setup-fields">
          {!snippets ? (
            <button type="button" className="p-btn primary" onClick={() => void mintSetup()} disabled={busy}>
              <span>{busy ? "Preparing…" : "Prepare rewrite"}</span>
            </button>
          ) : (
            <>
              <p className="p-conn-setup-help">
                Paste this into your host. The path <code>/{chosenNs}/</code> must appear in
                both the public URL and the destination. Use a <strong>200 proxy</strong>, not a 301 redirect.
              </p>
              {token && (
                <Field
                  label="Your publishing token"
                  value={token}
                  readOnly
                  helper="Embedded in the snippet — no need to copy separately."
                />
              )}
              <div className="p-conn-setup-tabs" role="tablist" aria-label="Hosting">
                {SNIPPET_HOSTS.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    role="tab"
                    aria-selected={host === h.id}
                    className={`p-btn ${host === h.id ? "primary" : "ghost"}`}
                    onClick={() => setHost(h.id)}
                    disabled={busy}
                  >
                    <span>{h.label}</span>
                  </button>
                ))}
              </div>
              {activeSnippet && (
                <>
                  <Field
                    as="textarea"
                    label={activeSnippet.title}
                    readOnly
                    rows={12}
                    value={activeSnippet.body}
                    inputClassName="p-conn-snippet"
                  />
                  {activeSnippet.hint && <div className="p-conn-meta">{activeSnippet.hint}</div>}
                  <div className="p-conn-actions" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      className="p-btn ghost"
                      onClick={() => onCopy(activeSnippet.body, "Rewrite")}
                      disabled={busy}
                    >
                      <span>Copy</span>
                    </button>
                    {developerMailto && (
                      <a className="p-btn ghost" href={developerMailto}>
                        <span>Email these instructions</span>
                      </a>
                    )}
                  </div>
                </>
              )}
              <div className="p-conn-actions">
                <button type="button" className="p-btn ghost" onClick={() => setStep(2)} disabled={busy}>
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  className="p-btn primary"
                  onClick={() => {
                    setStep(4);
                    onDone();
                  }}
                  disabled={busy || !snippets}
                >
                  <span>I&apos;ve added the rewrite</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="p-conn-setup-fields">
          <p className="p-conn-setup-help">
            We&apos;ll publish a temporary test page under <code>/{chosenNs}/</code>
            {siteHost ? <> on <code>{siteHost}</code></> : null}, check it live, then delete it.
          </p>
          {lastFailReason && (
            <div className="p-conn-note error">
              <span>{lastFailReason}</span>
            </div>
          )}
          {!lastFailReason && (
            <div className="p-conn-meta">
              If this fails we&apos;ll say whether we got your 404 (rewrite missing), a redirect
              (301 instead of 200), wrong content (path typo in the destination), or a timeout.
            </div>
          )}
          <div className="p-conn-actions">
            <button type="button" className="p-btn ghost" onClick={() => setStep(3)} disabled={busy}>
              <span>Back</span>
            </button>
            <button type="button" className="p-btn primary" onClick={onProve} disabled={busy}>
              <span>{lastFailReason ? "Try again" : "Prove publishing"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
