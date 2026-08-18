"use client";
import { useCallback, useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import { authedFetch } from "@/lib/authedFetch";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import ConnectCard from "../_components/ConnectCard";
import ConnectionsPanel from "./_ConnectionsPanel";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import { IconExternal } from "../icons";

type Tab = "business" | "automation" | "connections" | "notifications" | "security";

const TABS: { key: Tab; label: string }[] = [
  { key: "business", label: "Business" },
  { key: "automation", label: "Automation" },
  { key: "connections", label: "Connections" },
  { key: "notifications", label: "Notifications" },
  { key: "security", label: "Security" },
];

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.key === v);

type ActivityRow = {
  id: string;
  title: string;
  detail: string | null;
  decision: string | null;
  status: string;
  created_at: string;
  event_type: string;
  capability: string | null;
};

export default function SettingsPage() {
  const { brand, isAdmin } = usePortalAuth();
  const [tab, setTab] = useState<Tab>("business");
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [mode, setModeState] = useState<"approval" | "hybrid" | "autopilot">("approval");
  const [savingMode, setSavingMode] = useState(false);

  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (isTab(wanted)) setTab(wanted);
  }, []);

  useEffect(() => {
    if (!brand) return;
    setModeState(
      brand.execution_mode || (brand.auto_publish_meta ? "hybrid" : "approval")
    );
  }, [brand]);

  const goToTab = useCallback((next: Tab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  }, []);

  useEffect(() => {
    if (!brand?.id || tab !== "automation") return;
    authedFetch(`/api/portal/activity?brand=${brand.id}`)
      .then((r) => r.json())
      .then((d) => setActivity(d.activity || []))
      .catch(() => setActivity([]));
  }, [brand?.id, tab]);

  if (!brand) return null;

  async function setMode(next: "approval" | "hybrid" | "autopilot") {
    if (!brand) return;
    setSavingMode(true);
    try {
      await authedFetch(`/api/brand/${brand.id}/mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ execution_mode: next }),
      });
      setModeState(next);
      brand.execution_mode = next;
      brand.auto_publish_meta = next !== "approval";
    } finally {
      setSavingMode(false);
    }
  }

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Settings"
        title="Your account"
        sub="Your business details and the accounts powering your SEO."
      />

      <SubNav items={TABS} value={tab} onChange={goToTab} />

      {tab === "business" && (
        <div className="p-stack">
          <Panel>
            <PanelHead
              title="Business details"
              sub="These details shape everything your AI team writes. To change them, contact your account manager."
            />
            <dl className="p-deflist">
              <Field label="Business name" value={brand.name} />
              <Field label="Website" value={brand.site_url} href={brand.site_url} />
              <Field label="Service area" value={brand.service_area} />
              <Field label="Services" value={brand.services} />
              <Field label="Business type" value={brand.business_model?.replace(/_/g, " ")} />
              <Field label="Contact email" value={brand.owner_email} />
            </dl>
          </Panel>

          <Stagger className="p-subgrid">
            <ConnectCard
              title="Multiple locations"
              desc="Track rankings, reviews and citations separately for each location you serve, with a combined roll-up view."
              requirement="Your account currently covers one location."
              unlocks={["Rankings and reviews tracked per location", "Plus a combined roll-up view"]}
            />
          </Stagger>
        </div>
      )}

      {tab === "automation" && (
        <div className="p-stack">
          <Panel>
            <PanelHead
              title="Automation mode"
              sub="Controls how far your SEO team can go without asking. Approval is safest; Autopilot still respects QA and safety limits."
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {([
                ["approval", "Approval", "Research and drafts only — you publish."],
                ["hybrid", "Hybrid", "Safe meta fixes may auto-run; bigger changes wait."],
                ["autopilot", "Autopilot", "Full loop within policy, QA, and quotas."],
              ] as const).map(([key, label, desc]) => (
                <button
                  key={key}
                  type="button"
                  disabled={savingMode}
                  onClick={() => setMode(key)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: mode === key ? "2px solid currentColor" : "1px solid rgba(0,0,0,0.06)",
                    background: mode === key ? "rgba(0,0,0,0.04)" : "transparent",
                    cursor: "pointer",
                    maxWidth: 220,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{label}</div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>{desc}</div>
                </button>
              ))}
            </div>
            {!isAdmin && (
              <p style={{ fontSize: 12, opacity: 0.65, margin: 0 }}>
                Mode changes apply to your brand immediately. You can switch back to Approval anytime.
              </p>
            )}
          </Panel>

          <Panel>
            <PanelHead
              title="What the team is doing"
              sub="Concise decisions and outcomes — not raw model reasoning."
            />
            {activity.length === 0 ? (
              <p style={{ opacity: 0.65, margin: 0 }}>
                No autonomous activity recorded yet. Run the agents to populate this feed.
              </p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {activity.slice(0, 25).map((a) => (
                  <li key={a.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                    <div style={{ fontWeight: 600 }}>{a.title}</div>
                    <div style={{ fontSize: 12, opacity: 0.65 }}>
                      {a.capability || a.event_type}
                      {a.decision ? ` · ${a.decision}` : ""}
                      {" · "}
                      {new Date(a.created_at).toLocaleString()}
                    </div>
                    {a.detail && (
                      <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>{a.detail}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {tab === "connections" && (
        <div className="p-stack">
          <ConnectionsPanel brandId={brand.id} />
        </div>
      )}

      {tab === "notifications" && (
        <Stagger className="p-subgrid">
          <ConnectCard
            title="Email alerts"
            desc="Get notified when a keyword breaks into the top 3, when rankings drop sharply, or when new content is ready for your review."
            requirement="Notification preferences aren't configurable from the portal yet."
            unlocks={["Know when a keyword hits the top 3", "And the moment rankings drop sharply"]}
          />
          <ConnectCard
            title="Weekly digest"
            desc="A short Monday morning summary of what changed last week and what's planned for this one."
            unlocks={["A short Monday morning summary", "What changed, and what's planned next"]}
            requirement="Needs scheduled email delivery, which the platform doesn't have yet. Your weekly performance summary is available on demand in Reports."
            cta={{ label: "Open Reports", href: "/portal/reports" }}
          />
          <ConnectCard
            title="Review alerts"
            desc="Be told the moment a new review lands — especially a negative one that needs a fast, considered reply."
            unlocks={["Told the moment a review lands", "Especially the ones needing a fast reply"]}
            requirement="Needs a Google Business Profile connection to receive reviews, plus email delivery. Neither exists yet — Connections shows what the profile link requires."
          />
        </Stagger>
      )}

      {tab === "security" && (
        <div className="p-stack">
          <Panel>
            <PanelHead title="Sign-in" sub="Your account is secured by email-based authentication." />
            <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.65, margin: 0 }}>
              You&apos;re signed in to {brand.name}&apos;s portal. Signing out ends this session on
              this device — use the button in the sidebar.
            </p>
          </Panel>
          <Stagger className="p-subgrid">
            <ConnectCard
              title="Two-factor authentication"
              desc="Add a second verification step when signing in, for stronger protection of your business data."
              unlocks={["A second step when signing in", "Stronger protection for your business data"]}
              requirement="Needs multi-factor enrolment enabled on the authentication provider. Sign-in is currently email and password only."
            />
            <ConnectCard
              title="Team access"
              desc="Invite colleagues with their own logins and control what each person can see and approve."
              unlocks={["Invite colleagues with their own logins", "Control what each person can see and approve"]}
              requirement="Accounts are linked one-to-one with a business today. Multiple logins per business needs an invitation flow and per-person permissions, neither of which exists yet."
            />
          </Stagger>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, href }: { label: string; value?: string | null; href?: string }) {
  return (
    <div className="p-def">
      <dt>{label}</dt>
      <dd>
        {value
          ? href
            ? <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{value} <IconExternal size={12} /></a>
            : value
          : <span className="p-na">Not set</span>}
      </dd>
    </div>
  );
}
