"use client";
import { useCallback, useEffect, useState } from "react";
import { usePortalAuth } from "@/lib/portalAuth";
import PageHeader from "../_components/PageHeader";
import SubNav from "../_components/SubNav";
import AiSummary from "../_components/AiSummary";
import OverviewTab from "./_tabs/OverviewTab";
import KeywordsTab from "./_tabs/KeywordsTab";
import MovementTab from "./_tabs/MovementTab";
import OpportunitiesTab from "./_tabs/OpportunitiesTab";
import InsightsTab from "./_tabs/InsightsTab";
import TimelineTab from "./_tabs/TimelineTab";

type Tab = "overview" | "keywords" | "movement" | "opportunities" | "insights" | "timeline";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "keywords", label: "Keywords" },
  { key: "movement", label: "Movement" },
  { key: "opportunities", label: "Opportunities" },
  { key: "insights", label: "Insights" },
  { key: "timeline", label: "Timeline" },
];

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.key === v);

export default function IntelligencePage() {
  const { brand } = usePortalAuth();
  const [tab, setTab] = useState<Tab>("overview");

  // Mirror Settings: restore tab from ?tab= after mount so SSR/prerender never
  // touches window, and keep the URL in step so Back/refresh/share work.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("tab");
    if (isTab(wanted)) setTab(wanted);
  }, []);

  const goToTab = useCallback((next: Tab) => {
    setTab(next);
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
  }, []);

  if (!brand) return null;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Intelligence"
        title="Search performance"
        sub="Everything we know about how your business shows up on Google — rankings, movement, and where the next win is."
      />

      <AiSummary brandId={brand.id} section="search intelligence" brandName={brand.name} />

      <SubNav items={TABS} value={tab} onChange={goToTab} />

      {tab === "overview" && <OverviewTab brandId={brand.id} />}
      {tab === "keywords" && <KeywordsTab brandId={brand.id} />}
      {tab === "movement" && <MovementTab brandId={brand.id} />}
      {tab === "opportunities" && <OpportunitiesTab brandId={brand.id} />}
      {tab === "insights" && <InsightsTab brandId={brand.id} />}
      {tab === "timeline" && <TimelineTab brandId={brand.id} />}
    </div>
  );
}
