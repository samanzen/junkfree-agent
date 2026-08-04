"use client";
import { useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import ConnectCard from "../_components/ConnectCard";
import { Panel, PanelHead } from "../_components/Panel";
import { Stagger } from "../_components/motion";
import { IconCheck, IconAlert, IconExternal } from "../icons";

type Tab = "business" | "connections" | "notifications" | "security";

const TABS: { key: Tab; label: string }[] = [
  { key: "business", label: "Business" },
  { key: "connections", label: "Connections" },
  { key: "notifications", label: "Notifications" },
  { key: "security", label: "Security" },
];

export default function SettingsPage() {
  const { brand } = usePortalAuth();
  const [tab, setTab] = useState<Tab>("business");

  if (!brand) return null;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Settings"
        title="Your account"
        sub="Your business details and the accounts powering your SEO."
      />

      <SubNav items={TABS} value={tab} onChange={setTab} />

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
              note="Your account currently covers one location."
              unlocks={["Rankings and reviews tracked per location", "Plus a combined roll-up view"]}
            />
          </Stagger>
        </div>
      )}

      {tab === "connections" && (
        <div className="p-stack">
          <Panel>
            <PanelHead title="Connected accounts" sub="Where your performance data comes from." />
            <div className="p-conn-list">
              <Connection
                name="Google Search Console"
                desc="Powers your keyword rankings, clicks and impressions."
                connected={!!brand.gsc_property}
                detail={brand.gsc_property || undefined}
              />
              <Connection
                name="Google Business Profile"
                desc="Powers map pack rankings, profile insights and review syncing."
                connected={!!brand.gbp_location_id}
                detail={brand.gbp_location_id || undefined}
              />
              <Connection
                name="Ranking &amp; keyword data"
                desc="Search volume, keyword difficulty and competitor rankings."
                connected
                detail="Active"
              />
              <Connection
                name="Google Analytics"
                desc="Would add on-site behaviour, conversions and lead attribution."
                connected={false}
              />
              <Connection
                name="Call tracking"
                desc="Would attribute phone calls back to the searches that generated them."
                connected={false}
              />
            </div>
          </Panel>
        </div>
      )}

      {tab === "notifications" && (
        <Stagger className="p-subgrid">
          <ConnectCard
            title="Email alerts"
            desc="Get notified when a keyword breaks into the top 3, when rankings drop sharply, or when new content is ready for your review."
            note="Notification preferences aren't configurable from the portal yet."
            unlocks={["Know when a keyword hits the top 3", "And the moment rankings drop sharply"]}
          />
          <ConnectCard
            title="Weekly digest"
            desc="A short Monday morning summary of what changed last week and what's planned for this one."
            unlocks={["A short Monday morning summary", "What changed, and what's planned next"]}
          />
          <ConnectCard
            title="Review alerts"
            desc="Be told the moment a new review lands — especially a negative one that needs a fast, considered reply."
            unlocks={["Told the moment a review lands", "Especially the ones needing a fast reply"]}
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
            />
            <ConnectCard
              title="Team access"
              desc="Invite colleagues with their own logins and control what each person can see and approve."
              unlocks={["Invite colleagues with their own logins", "Control what each person can see and approve"]}
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

function Connection({ name, desc, connected, detail }: {
  name: string; desc: string; connected: boolean; detail?: string;
}) {
  return (
    <div className="p-conn">
      <span className={`p-conn-dot ${connected ? "on" : ""}`}>
        {connected ? <IconCheck size={13} /> : <IconAlert size={13} />}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="p-conn-name">{name}</div>
        <div className="p-conn-desc">{desc}</div>
        {detail && <code className="p-conn-detail">{detail}</code>}
      </div>
      <span className={`p-badge ${connected ? "green" : ""}`}>
        {connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}
