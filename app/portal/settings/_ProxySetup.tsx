"use client";
import { useEffect, useMemo, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { useToast } from "@/app/_components/Notify";
import Field from "@/app/_components/Field";
import {
  SUGGESTED_NAMESPACES,
  namespaceValidationError,
  normalizeProxyNamespace,
} from "@/lib/execution/proxy-token";
import { DEFAULT_MANAGED_NAMESPACE } from "@/lib/website-connection";
import { SNIPPET_HOSTS, type SnippetHost } from "@/lib/proxy/snippets";

type ClaimCheck = {
  namespace: string;
  result: "clear" | "collision" | "loop" | "unreachable" | "error";
  detail: string;
  probes?: Array<{ path: string; status: number | null; note?: string }>;
};

type SnippetBundle = Record<SnippetHost, { title: string; body: string; hint?: string }>;

/**
 * Volo Managed Pages setup (proxy adapter underneath).
 *
 * Primary flow no longer asks customers to pick /guides/ vs /resources/ —
 * that is content architecture. We default to /guides/ and keep path
 * selection under Advanced settings.
 */
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
  // Steps: 1 check → 2 rewrite → 3 prove. Path picking is Advanced only.
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [namespace, setNamespace] = useState(DEFAULT_MANAGED_NAMESPACE);
  const [custom, setCustom] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [claim, setClaim] = useState<ClaimCheck | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [snippets, setSnippets] = useState<SnippetBundle | null>(null);
  const [host, setHost] = useState<SnippetHost>("vercel");
  const [autoStarted, setAutoStarted] = useState(false);

  const chosenNs = normalizeProxyNamespace(custom || namespace);
  const nsError = namespaceValidationError(chosenNs);

  const activeSnippet = useMemo(() => {
    if (!snippets) return null;
    return snippets[host];
  }, [snippets, host]);

  const developerMailto = useMemo(() => {
    if (!activeSnippet || host !== "unknown") return null;
    const subject = encodeURIComponent(`Connect Volo Managed Pages on our website`);
    const body = encodeURIComponent(activeSnippet.body);
    return `mailto:?subject=${subject}&body=${body}`;
  }, [activeSnippet, host]);

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
        toast.error(data.error || "We couldn't check your website");
        return;
      }
      setClaim(data.check);
      setNamespace(chosenNs);
      setCustom("");
      setStep(1);
      if (data.canContinue) {
        toast.success("Ready to connect", data.check?.detail);
      } else if (data.check?.result === "unreachable" || data.check?.result === "error") {
        toast.error("Check failed", data.check?.detail);
      } else {
        toast.error("That setup won't work yet", data.check?.detail);
      }
    } catch {
      toast.error("We couldn't check your website", "Try again in a moment.");
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
      setStep(2);
      toast.success("Almost there", data.message);
    } catch {
      toast.error("We couldn't save that setup", "Try again in a moment.");
    } finally {
      onBusy(false);
    }
  }

  // Auto-check the default managed path on open — no path picker required.
  useEffect(() => {
    if (autoStarted) return;
    setAutoStarted(true);
    void runClaimCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claimBlocks = claim?.result === "collision" || claim?.result === "loop";
  const claimRetry = claim?.result === "unreachable" || claim?.result === "error" || !claim;
  const claimClear = claim?.result === "clear";

  return (
    <div className="p-conn-setup">
      <p className="p-conn-setup-help">
        <strong>Volo Managed Pages</strong> — recommended when your site isn&apos;t
        WordPress or Shopify. We connect to your domain; no API code on your app.
      </p>

      <div className="p-conn-meta" style={{ marginBottom: 8 }}>
        Step {step} of 3 —{" "}
        {step === 1 ? "Check your site" : step === 2 ? "Add one host setting" : "Prove the connection"}
      </div>

      {step === 1 && (
        <div className="p-conn-setup-fields">
          {claim && (
            <div className={`p-conn-note ${claimBlocks ? "error" : ""}`}>
              <span>{claim.detail}</span>
            </div>
          )}
          {!claim && busy && <div className="p-conn-meta">Checking your website…</div>}

          <details
            className="p-conn-advanced"
            open={advancedOpen}
            onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
          >
            <summary>Advanced settings</summary>
            <div className="p-conn-setup-fields" style={{ marginTop: 8 }}>
              <div className="p-conn-meta">
                Managed pages default to <code>/{DEFAULT_MANAGED_NAMESPACE}/</code>.
                Change this only if that path is already in use on your site.
              </div>
              <div className="p-conn-setup-tabs" role="tablist" aria-label="Managed path">
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
                label="Custom path"
                placeholder={DEFAULT_MANAGED_NAMESPACE}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                disabled={busy}
                helper={nsError || `Managed pages will appear at /${chosenNs || "…"}/.`}
                error={custom ? nsError : undefined}
              />
              <button
                type="button"
                className="p-btn ghost"
                onClick={() => void runClaimCheck()}
                disabled={busy || !!nsError}
              >
                <span>{busy ? "Checking…" : "Re-check path"}</span>
              </button>
            </div>
          </details>

          <div className="p-conn-actions">
            <button type="button" className="p-btn ghost" onClick={onCancel} disabled={busy}>
              <span>Cancel</span>
            </button>
            {(claimRetry || claimBlocks) && (
              <button type="button" className="p-btn ghost" onClick={() => void runClaimCheck()} disabled={busy}>
                <span>{busy ? "Checking…" : "Retry"}</span>
              </button>
            )}
            {claimClear && (
              <button type="button" className="p-btn primary" onClick={() => void mintSetup()} disabled={busy}>
                <span>{busy ? "Saving…" : "Continue"}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="p-conn-setup-fields">
          {!snippets ? (
            <button type="button" className="p-btn primary" onClick={() => void mintSetup()} disabled={busy}>
              <span>{busy ? "Preparing…" : "Prepare connection"}</span>
            </button>
          ) : (
            <>
              <p className="p-conn-setup-help">
                Ask whoever hosts your site to add this setting (or paste it yourself).
                It connects your domain to Volo Managed Pages.
              </p>
              {token && (
                <Field
                  label="Connection token"
                  value={token}
                  readOnly
                  helper="Already included in the snippet below."
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
                      onClick={() => onCopy(activeSnippet.body, "Host setting")}
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
              <details className="p-conn-advanced">
                <summary>Advanced / diagnostics</summary>
                <div className="p-conn-meta" style={{ marginTop: 8 }}>
                  Adapter: Volo Managed Pages · Managed path: /{chosenNs}/ · Use a
                  200 proxy rewrite (not a 301 redirect).
                </div>
              </details>
              <div className="p-conn-actions">
                <button type="button" className="p-btn ghost" onClick={() => setStep(1)} disabled={busy}>
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  className="p-btn primary"
                  onClick={() => {
                    setStep(3);
                    onDone();
                  }}
                  disabled={busy || !snippets}
                >
                  <span>I&apos;ve added the setting</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="p-conn-setup-fields">
          <p className="p-conn-setup-help">
            We&apos;ll publish a temporary test page
            {siteHost ? <> on <code>{siteHost}</code></> : null}, check it live, then remove it.
          </p>
          {lastFailReason && (
            <div className="p-conn-note error">
              <span>{lastFailReason}</span>
            </div>
          )}
          {!lastFailReason && (
            <div className="p-conn-meta">
              If this fails, we&apos;ll explain what to fix — usually the host setting
              isn&apos;t live yet.
            </div>
          )}
          <div className="p-conn-actions">
            <button type="button" className="p-btn ghost" onClick={() => setStep(2)} disabled={busy}>
              <span>Back</span>
            </button>
            <button type="button" className="p-btn primary" onClick={onProve} disabled={busy}>
              <span>{lastFailReason ? "Try again" : "Prove connection"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
