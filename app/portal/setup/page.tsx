"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import { useToast } from "@/app/_components/Notify";
import PageHeader from "../_components/PageHeader";
import { Panel, PanelHead } from "../_components/Panel";
import ConnectionsPanel from "../settings/_ConnectionsPanel";
import { IconCheck, IconChevron } from "../icons";
import type { SetupProgress, SetupStepKey } from "@/lib/setup";
import { PLATFORM_NAME } from "@/lib/ui/tokens";

type SetupPayload = {
  progress: SetupProgress;
  signals: {
    pending_drafts: number;
    intelligence_ready: boolean;
    publishing_connected: boolean;
    publishing_reason: string | null;
    sync_pending: boolean;
    keyword_count: number;
  };
};

const STEP_ORDER: SetupStepKey[] = [
  "business",
  "search_console",
  "intelligence",
  "publishing",
  "first_approval",
  "operating",
];

function isStep(v: string | null): v is SetupStepKey {
  return !!v && (STEP_ORDER as string[]).includes(v);
}

export default function SetupPage() {
  const { brand } = usePortalAuth();
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<SetupPayload | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [step, setStep] = useState<SetupStepKey>("search_console");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!brand?.id) return;
    try {
      const res = await authedFetch(`/api/portal/setup?brand=${brand.id}`);
      if (!res.ok) {
        setFailed("We couldn't load your setup progress.");
        return;
      }
      const body = (await res.json()) as SetupPayload;
      setFailed(null);
      setData(body);
      // Prefer URL step, else first incomplete.
      const wanted = new URLSearchParams(window.location.search).get("step");
      if (isStep(wanted)) setStep(wanted);
      else if (body.progress.next) setStep(body.progress.next);
      else setStep("operating");
    } catch {
      setFailed("We couldn't load your setup progress.");
    }
  }, [brand?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Google OAuth returns here with ?google= — toast is handled inside ConnectionsPanel.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("step");
    if (isStep(wanted)) setStep(wanted);
  }, []);

  const progress = data?.progress;
  const current = useMemo(
    () => progress?.steps.find((s) => s.key === step) || null,
    [progress, step],
  );

  function go(next: SetupStepKey) {
    setStep(next);
    const params = new URLSearchParams(window.location.search);
    params.set("step", next);
    // Keep google result params briefly so ConnectionsPanel can toast, then strip on next paint.
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  }

  async function startIntelligence() {
    if (!brand?.id) return;
    setBusy(true);
    try {
      const res = await authedFetch("/api/portal/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand_id: brand.id, action: "start_intelligence" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body.error || "Could not start sync", undefined);
        return;
      }
      toast.success(body.queued ? "Sync started" : "Sync already running", body.message);
      await load();
    } catch {
      toast.error("Could not start sync", "Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!brand) return null;

  return (
    <div className="p-stack p-setup-page">
      <PageHeader
        eyebrow="Getting started"
        title={`Activate ${brand.name}`}
        sub={`${PLATFORM_NAME} works as an operating loop — connect data, let AI work, approve when needed, then measure what moved.`}
      />

      {failed && (
        <div className="p-conn-note error" role="status">
          <span>
            {failed}{" "}
            <button className="p-linkbtn" onClick={() => void load()}>
              Try again
            </button>
          </span>
        </div>
      )}

      {progress && (
        <ol className="p-journey" aria-label="Activation steps">
          {progress.steps.map((s, i) => {
            const active = s.key === step;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  className={`p-journey-step ${s.done ? "done" : ""} ${active ? "active" : ""}`}
                  onClick={() => go(s.key)}
                >
                  <span className="p-journey-mark" aria-hidden="true">
                    {s.done ? <IconCheck size={12} /> : i + 1}
                  </span>
                  <span className="p-journey-label">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {!data ? (
        <div className="p-skel" style={{ height: 280 }} />
      ) : (
        <Panel>
          <PanelHead
            title={current?.label || "Next step"}
            sub={current?.summary}
            badge={
              progress
                ? `${progress.doneCount}/${progress.total}`
                : undefined
            }
          />

          {step === "business" && (
            <div className="p-setup-body">
              <p className="p-setup-copy">
                Business details are on file for <b>{brand.name}</b>
                {brand.site_url ? (
                  <>
                    {" "}
                    at <b>{brand.site_url.replace(/^https?:\/\//, "")}</b>
                  </>
                ) : null}
                . Next, bring in Search Console so the system can see rankings.
              </p>
              <button
                type="button"
                className="p-btn primary"
                onClick={() => go("search_console")}
              >
                <span>Continue to Search Console</span>
                <IconChevron size={14} />
              </button>
            </div>
          )}

          {step === "search_console" && (
            <div className="p-setup-body">
              <p className="p-setup-copy">
                Without Search Console there is nothing honest to prioritise. Sign in with
                Google and choose the property that matches your site.
              </p>
              <ConnectionsPanel
                brandId={brand.id}
                focusKeys={["search_console"]}
                returnPath="/portal/setup?step=search_console"
                embedded
                onChanged={() => void load()}
              />
              {data.progress.steps.find((s) => s.key === "search_console")?.done && (
                <button
                  type="button"
                  className="p-btn primary"
                  style={{ marginTop: 16 }}
                  onClick={() => go("intelligence")}
                >
                  <span>Continue to first intelligence</span>
                  <IconChevron size={14} />
                </button>
              )}
            </div>
          )}

          {step === "intelligence" && (
            <div className="p-setup-body">
              {!data.progress.steps.find((s) => s.key === "search_console")?.done ? (
                <p className="p-setup-copy">
                  Connect Search Console first — intelligence is built from that data.
                </p>
              ) : data.signals.intelligence_ready ? (
                <>
                  <p className="p-setup-copy">
                    First intelligence is in:{" "}
                    <b>{data.signals.keyword_count.toLocaleString()}</b> keywords tracked.
                    Open Intelligence anytime, or continue to publishing so approvals can go live.
                  </p>
                  <div className="p-setup-actions">
                    <Link href="/portal/intelligence" className="p-btn ghost">
                      <span>View intelligence</span>
                    </Link>
                    <button
                      type="button"
                      className="p-btn primary"
                      onClick={() => go("publishing")}
                    >
                      <span>Connect publishing</span>
                      <IconChevron size={14} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="p-setup-copy">
                    Pull your first keyword picture from Search Console. This queues a sync —
                    usually a few minutes, never invented numbers.
                  </p>
                  <div className="p-setup-actions">
                    <button
                      type="button"
                      className="p-btn primary"
                      onClick={() => void startIntelligence()}
                      disabled={busy || data.signals.sync_pending}
                      data-busy={busy || undefined}
                    >
                      <span>
                        {data.signals.sync_pending
                          ? "Sync in progress…"
                          : busy
                            ? "Starting…"
                            : "Start first intelligence sync"}
                      </span>
                    </button>
                    <button type="button" className="p-btn ghost" onClick={() => void load()}>
                      <span>Refresh status</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {step === "publishing" && (
            <div className="p-setup-body">
              <p className="p-setup-copy">
                Connect WordPress (Application Password) or a signed webhook. We verify the
                connection before saving credentials — nothing is stored on a failed check.
              </p>
              <ConnectionsPanel
                brandId={brand.id}
                focusKeys={["website_publishing"]}
                embedded
                onChanged={() => void load()}
              />
              {data.signals.publishing_connected && (
                <button
                  type="button"
                  className="p-btn primary"
                  style={{ marginTop: 16 }}
                  onClick={() => go("first_approval")}
                >
                  <span>Continue to first approval</span>
                  <IconChevron size={14} />
                </button>
              )}
            </div>
          )}

          {step === "first_approval" && (
            <div className="p-setup-body">
              {data.progress.steps.find((s) => s.key === "first_approval")?.done ? (
                <>
                  <p className="p-setup-copy">
                    You&apos;ve approved work end-to-end. The loop is proven — attention, AI work,
                    approval, execution. Results will appear as Search Console catches up.
                  </p>
                  <button
                    type="button"
                    className="p-btn primary"
                    onClick={() => go("operating")}
                  >
                    <span>Enter operating view</span>
                    <IconChevron size={14} />
                  </button>
                </>
              ) : data.signals.pending_drafts > 0 ? (
                <>
                  <p className="p-setup-copy">
                    <b>{data.signals.pending_drafts}</b> draft
                    {data.signals.pending_drafts === 1 ? "" : "s"} waiting. Approve one to prove
                    execution on your site.
                  </p>
                  <Link href="/portal/approvals" className="p-btn primary">
                    <span>Open Approvals</span>
                    <IconChevron size={14} />
                  </Link>
                </>
              ) : (
                <>
                  <p className="p-setup-copy">
                    No drafts are waiting yet. Your AI team produces the first pieces after
                    intelligence and planning jobs run — check Approvals shortly, or open the
                    assistant if you want to nudge priorities.
                  </p>
                  <div className="p-setup-actions">
                    <Link href="/portal/approvals" className="p-btn primary">
                      <span>Check Approvals</span>
                    </Link>
                    <Link href="/portal/assistant" className="p-btn ghost">
                      <span>Ask the assistant</span>
                    </Link>
                  </div>
                </>
              )}
            </div>
          )}

          {step === "operating" && (
            <div className="p-setup-body">
              {progress?.complete ? (
                <>
                  <p className="p-setup-copy">
                    You&apos;re in a useful operating state. Use the home dashboard for attention
                    and AI activity, Approvals for decisions, and Results for honest outcome
                    trails after publish.
                  </p>
                  <div className="p-setup-actions">
                    <button
                      type="button"
                      className="p-btn primary"
                      onClick={() => router.push("/portal")}
                    >
                      <span>Go to dashboard</span>
                    </button>
                    <Link href="/portal/results" className="p-btn ghost">
                      <span>Open Results</span>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="p-setup-copy">
                    A few activation steps remain. Finish them so the operating loop has real
                    data, a publish path, and a proven approval.
                  </p>
                  {progress?.next && (
                    <button
                      type="button"
                      className="p-btn primary"
                      onClick={() => go(progress.next!)}
                    >
                      <span>Continue setup</span>
                      <IconChevron size={14} />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </Panel>
      )}

      <p className="p-setup-skip">
        Need the full portal now?{" "}
        <Link href="/portal">Skip to dashboard</Link>
        {" · "}
        <Link href="/portal/settings?tab=connections">All connections</Link>
      </p>
    </div>
  );
}
