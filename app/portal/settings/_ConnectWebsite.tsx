"use client";
import { useMemo, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import { useToast } from "@/app/_components/Notify";
import Field from "@/app/_components/Field";
import { codedSiteSnippet } from "@/lib/execution/receiver-snippet";
import type { ConnectorOption, WebsiteDetectResult } from "@/lib/website-connection/detect";
import type { WebsiteAdapterId } from "@/lib/website-connection/capabilities";
import {
  accessTransparency,
  buildCapabilityReport,
} from "@/lib/website-connection/capability-report";
import ProxySetup from "./_ProxySetup";
import CapabilityReport from "./_CapabilityReport";

type Mode = "approval" | "hybrid" | "autopilot";
type Step = "url" | "recommend" | "authorize" | "proxy" | "capabilities" | "mode";

function makeSigningSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function asAdapterId(opt: ConnectorOption | null): WebsiteAdapterId | null {
  if (!opt?.connectable) return null;
  if (
    opt.id === "wordpress" ||
    opt.id === "shopify" ||
    opt.id === "github" ||
    opt.id === "sanity" ||
    opt.id === "webhook" ||
    opt.id === "managed_pages"
  ) {
    return opt.id;
  }
  return null;
}

/**
 * URL-first Connect Website flow (progressive disclosure).
 * Analyze → recommend → authorize → prove capabilities → mode.
 */
export default function ConnectWebsite({
  brandId,
  siteUrl,
  busy,
  onBusy,
  onDone,
  onCancel,
  onProve,
  onCopy,
  lastFailReason,
}: {
  brandId: string;
  siteUrl?: string | null;
  busy: boolean;
  onBusy: (v: boolean) => void;
  onDone: () => void;
  onCancel: () => void;
  onProve: () => void;
  onCopy: (text: string, label: string) => void;
  lastFailReason?: string | null;
}) {
  const toast = useToast();
  const [step, setStep] = useState<Step>("url");
  const [url, setUrl] = useState(siteUrl || "");
  const [detect, setDetect] = useState<WebsiteDetectResult | null>(null);
  const [chosen, setChosen] = useState<ConnectorOption | null>(null);
  const [showOther, setShowOther] = useState(false);
  const [showDetectDetails, setShowDetectDetails] = useState(false);
  const [mode, setMode] = useState<Mode>("approval");

  const [wpUser, setWpUser] = useState("");
  const [wpPass, setWpPass] = useState("");
  const [shop, setShop] = useState("");
  const [shopToken, setShopToken] = useState("");
  const [ghOwner, setGhOwner] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghToken, setGhToken] = useState("");
  const [ghBranch, setGhBranch] = useState("main");
  const [ghPath, setGhPath] = useState("content");
  const [sanityProject, setSanityProject] = useState("");
  const [sanityToken, setSanityToken] = useState("");
  const [sanityDataset, setSanityDataset] = useState("production");
  const [endpointUrl, setEndpointUrl] = useState("");
  const [signingSecret, setSigningSecret] = useState(() => makeSigningSecret());

  const platform = chosen?.platform;
  const adapterId = asAdapterId(chosen);

  const report = useMemo(
    () =>
      buildCapabilityReport({
        adapterId,
        map: {},
        executionMode: mode,
      }),
    [adapterId, mode]
  );

  const access = useMemo(() => accessTransparency(adapterId), [adapterId]);

  async function runDetect(opts?: { silent?: boolean }) {
    onBusy(true);
    try {
      const res = await authedFetch("/api/portal/website-detect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId, url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "We couldn't analyze that website");
        return;
      }
      setDetect(data);
      setChosen(data.recommended);
      if (!opts?.silent) setStep("recommend");
      toast.success(opts?.silent ? "Access rechecked" : "Website analyzed", data.recommended?.label);
    } catch {
      toast.error("We couldn't analyze that website", "Try again in a moment.");
    } finally {
      onBusy(false);
    }
  }

  async function connectChosen() {
    if (!chosen?.connectable || !platform) return;
    if (platform === "proxy") {
      setStep("proxy");
      return;
    }
    onBusy(true);
    try {
      const payload =
        platform === "wordpress"
          ? {
              brand_id: brandId,
              action: "connect" as const,
              platform: "wordpress" as const,
              siteUrl: detect?.origin || url,
              username: wpUser,
              applicationPassword: wpPass,
            }
          : platform === "shopify"
            ? {
                brand_id: brandId,
                action: "connect" as const,
                platform: "shopify" as const,
                shop,
                accessToken: shopToken,
              }
            : platform === "github"
              ? {
                  brand_id: brandId,
                  action: "connect" as const,
                  platform: "github" as const,
                  owner: ghOwner,
                  repo: ghRepo,
                  token: ghToken,
                  baseBranch: ghBranch,
                  contentPath: ghPath,
                }
              : platform === "sanity"
                ? {
                    brand_id: brandId,
                    action: "connect" as const,
                    platform: "sanity" as const,
                    projectId: sanityProject,
                    token: sanityToken,
                    dataset: sanityDataset,
                  }
                : {
                    brand_id: brandId,
                    action: "connect" as const,
                    platform: "webhook" as const,
                    endpointUrl,
                    signingSecret,
                  };

      const res = await authedFetch("/api/portal/publishing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "We couldn't connect", data.detail || undefined);
        return;
      }
      toast.success("Connection tested", data.message);
      setStep("capabilities");
      onDone();
    } catch {
      toast.error("We couldn't connect", "Check the details and try again.");
    } finally {
      onBusy(false);
    }
  }

  async function recheckConnection() {
    onBusy(true);
    try {
      const res = await authedFetch("/api/portal/certify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brandId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not recheck connection");
        return;
      }
      toast.success(
        data.queued ? "Rechecking connection" : "Already testing",
        data.message || undefined
      );
      onDone();
    } catch {
      toast.error("Could not recheck connection");
    } finally {
      onBusy(false);
    }
  }

  async function saveModeAndFinish() {
    onBusy(true);
    try {
      const res = await authedFetch(`/api/brand/${brandId}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ execution_mode: mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Could not save publishing mode");
        return;
      }
      toast.success(
        mode === "approval" ? "Approval mode" : mode === "hybrid" ? "Hybrid mode" : "Autopilot mode",
        "You can change this later in settings."
      );
      onProve();
      onDone();
    } catch {
      toast.error("Could not save publishing mode");
    } finally {
      onBusy(false);
    }
  }

  return (
    <div className="p-conn-setup">
      {step === "url" && (
        <div className="p-conn-setup-fields">
          <h3 className="p-conn-setup-title">Connect Your Website</h3>
          <p className="p-conn-setup-help">
            Enter your website URL. We&apos;ll analyze what&apos;s publicly available and recommend
            the best connection — one step at a time.
          </p>
          <Field
            label="Enter your website URL"
            type="url"
            inputMode="url"
            placeholder="https://www.example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
            required
          />
          <div className="p-conn-actions">
            <button type="button" className="p-btn ghost" onClick={onCancel} disabled={busy}>
              <span>Cancel</span>
            </button>
            <button
              type="button"
              className="p-btn primary"
              onClick={() => void runDetect()}
              disabled={busy || !url.trim()}
            >
              <span>{busy ? "Analyzing…" : "Analyze & Connect"}</span>
            </button>
          </div>
        </div>
      )}

      {step === "recommend" && detect && chosen && (
        <div className="p-conn-setup-fields">
          <h3 className="p-conn-setup-title">Recommended connection</h3>
          <p className="p-conn-setup-help">
            <strong>{chosen.label}</strong> — {chosen.reason}
          </p>

          <div className="p-conn-actions">
            <button type="button" className="p-btn ghost" onClick={() => setStep("url")} disabled={busy}>
              <span>Back</span>
            </button>
            <button
              type="button"
              className="p-btn primary"
              onClick={() => setStep(chosen.platform === "proxy" ? "proxy" : "authorize")}
              disabled={busy || !chosen.connectable}
            >
              <span>Continue with {chosen.label}</span>
            </button>
          </div>

          <button type="button" className="p-linkbtn" onClick={() => setShowOther((v) => !v)}>
            Use a different connection method
          </button>
          {showOther && (
            <div className="p-conn-setup-fields" style={{ marginTop: 8 }}>
              {detect.alternatives.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`p-btn ${chosen.id === opt.id ? "primary" : "ghost"}`}
                  onClick={() => setChosen(opt)}
                  disabled={busy || !opt.connectable}
                >
                  <span>{opt.label}</span>
                </button>
              ))}
              {detect.unavailable.map((opt) => (
                <div className="p-conn-meta" key={opt.id}>
                  {opt.label} — Guided Implementation available (connector not ready). {opt.reason}
                </div>
              ))}
            </div>
          )}

          <button type="button" className="p-linkbtn" onClick={() => setShowDetectDetails((v) => !v)}>
            {showDetectDetails ? "Hide detection details" : "View detection details"}
          </button>
          {showDetectDetails && (
            <div className="p-conn-meta">
              Detected: {detect.hint} ({detect.confidence} confidence)
              {detect.signals?.length ? (
                <ul style={{ margin: "6px 0 0", paddingLeft: "1.1em" }}>
                  {detect.signals.slice(0, 5).map((s) => (
                    <li key={s.id}>{s.evidence}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          <CapabilityReport items={report} collapsed />
        </div>
      )}

      {step === "authorize" && chosen && platform && platform !== "proxy" && (
        <div className="p-conn-setup-fields">
          <h3 className="p-conn-setup-title">Authorize {chosen.label}</h3>
          <p className="p-conn-setup-help">
            We&apos;ll test the connection before saving. Only the access needed to publish SEO work
            is requested.
          </p>
          <details className="p-cap-access">
            <summary>What we access</summary>
            <div className="p-cap-access-cols">
              <div>
                <div className="p-cap-access-h">We can access</div>
                <ul>
                  {access.weAccess.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="p-cap-access-h">We do not access</div>
                <ul>
                  {access.weDoNotAccess.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
          {platform === "wordpress" && (
            <>
              <Field label="Website address" value={detect?.origin || url} readOnly />
              <Field
                label="WordPress username"
                value={wpUser}
                onChange={(e) => setWpUser(e.target.value)}
                disabled={busy}
                required
              />
              <Field
                label="Application password"
                type="password"
                value={wpPass}
                onChange={(e) => setWpPass(e.target.value)}
                disabled={busy}
                required
                helper="Users → Profile → Application Passwords in WordPress."
              />
            </>
          )}
          {platform === "shopify" && (
            <>
              <Field
                label="Store name"
                placeholder="mystore.myshopify.com"
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                disabled={busy}
                required
              />
              <Field
                label="Admin access token"
                type="password"
                value={shopToken}
                onChange={(e) => setShopToken(e.target.value)}
                disabled={busy}
                required
              />
            </>
          )}
          {platform === "github" && (
            <>
              <Field
                label="Owner"
                placeholder="your-org"
                value={ghOwner}
                onChange={(e) => setGhOwner(e.target.value)}
                disabled={busy}
                required
              />
              <Field
                label="Repository"
                placeholder="your-site"
                value={ghRepo}
                onChange={(e) => setGhRepo(e.target.value)}
                disabled={busy}
                required
              />
              <Field
                label="Personal access token"
                type="password"
                value={ghToken}
                onChange={(e) => setGhToken(e.target.value)}
                disabled={busy}
                required
                helper="Needs repo scope. Changes open as pull requests only — never silent production edits."
              />
              <Field
                label="Base branch"
                value={ghBranch}
                onChange={(e) => setGhBranch(e.target.value)}
                disabled={busy}
              />
              <Field
                label="Content folder"
                value={ghPath}
                onChange={(e) => setGhPath(e.target.value)}
                disabled={busy}
                helper="Markdown/MDX files will be proposed under this path."
              />
            </>
          )}
          {platform === "sanity" && (
            <>
              <Field
                label="Project ID"
                value={sanityProject}
                onChange={(e) => setSanityProject(e.target.value)}
                disabled={busy}
                required
              />
              <Field
                label="Write token"
                type="password"
                value={sanityToken}
                onChange={(e) => setSanityToken(e.target.value)}
                disabled={busy}
                required
              />
              <Field
                label="Dataset"
                value={sanityDataset}
                onChange={(e) => setSanityDataset(e.target.value)}
                disabled={busy}
              />
            </>
          )}
          {platform === "webhook" && (
            <>
              <Field
                as="textarea"
                label="Code for your site"
                readOnly
                rows={10}
                value={codedSiteSnippet(signingSecret)}
                inputClassName="p-conn-snippet"
              />
              <button
                type="button"
                className="p-btn ghost"
                onClick={() => onCopy(codedSiteSnippet(signingSecret), "Code")}
                disabled={busy}
              >
                <span>Copy code</span>
              </button>
              <Field label="Your secret" value={signingSecret} readOnly />
              <Field
                label="Receiver HTTPS URL"
                value={endpointUrl}
                onChange={(e) => setEndpointUrl(e.target.value)}
                disabled={busy}
                required
              />
            </>
          )}
          <div className="p-conn-actions">
            <button type="button" className="p-btn ghost" onClick={() => setStep("recommend")} disabled={busy}>
              <span>Back</span>
            </button>
            <button type="button" className="p-btn primary" onClick={() => void connectChosen()} disabled={busy}>
              <span>{busy ? "Connecting…" : "Authorize & test"}</span>
            </button>
          </div>
        </div>
      )}

      {step === "proxy" && (
        <ProxySetup
          brandId={brandId}
          busy={busy}
          onBusy={onBusy}
          onDone={() => {
            setStep("capabilities");
            onDone();
          }}
          onCancel={onCancel}
          onCopy={onCopy}
          lastFailReason={lastFailReason}
          onProve={() => {
            setStep("capabilities");
            onProve();
          }}
          siteHost={detect?.origin ? detect.origin.replace(/^https?:\/\//, "") : null}
        />
      )}

      {step === "capabilities" && (
        <div className="p-conn-setup-fields">
          <h3 className="p-conn-setup-title">What this connection can do</h3>
          <p className="p-conn-setup-help">
            Statuses reflect proven behavior for this connection — not theoretical platform support.
            Auto-Manage appears only after a capability is proven.
          </p>
          <CapabilityReport
            items={report}
            access={access}
            busy={busy}
            collapsed
            onRecheckAccess={() => void runDetect({ silent: true })}
            onRecheckConnection={() => void recheckConnection()}
          />
          <div className="p-conn-actions">
            <button type="button" className="p-btn primary" onClick={() => setStep("mode")} disabled={busy}>
              <span>Continue</span>
            </button>
          </div>
        </div>
      )}

      {step === "mode" && (
        <div className="p-conn-setup-fields">
          <h3 className="p-conn-setup-title">Publishing mode</h3>
          <p className="p-conn-setup-help">How should Volo publish after work is ready?</p>
          {(
            [
              {
                id: "approval" as const,
                label: "Approval",
                detail: "Nothing goes live until you approve.",
              },
              {
                id: "hybrid" as const,
                label: "Hybrid",
                detail: "Safe proven changes can auto-publish; bigger changes need approval.",
              },
              {
                id: "autopilot" as const,
                label: "Autopilot",
                detail: "Proven Auto-Manage capabilities may publish automatically.",
              },
            ] as const
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              className={`p-btn ${mode === m.id ? "primary" : "ghost"}`}
              onClick={() => setMode(m.id)}
              disabled={busy}
              style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 8 }}
            >
              <span>
                <strong>{m.label}</strong> — {m.detail}
              </span>
            </button>
          ))}
          <div className="p-conn-actions">
            <button type="button" className="p-btn ghost" onClick={() => setStep("capabilities")} disabled={busy}>
              <span>Back</span>
            </button>
            <button type="button" className="p-btn primary" onClick={() => void saveModeAndFinish()} disabled={busy}>
              <span>{busy ? "Saving…" : "Save & prove connection"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
