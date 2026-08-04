"use client";
import { useState } from "react";
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

export default function IntelligencePage() {
  const { brand } = usePortalAuth();
  const [tab, setTab] = useState<Tab>("overview");

  if (!brand) return null;

  return (
    <div className="p-stack">
      <PageHeader
        eyebrow="Intelligence"
        title="Search performance"
        sub="Everything we know about how your business shows up on Google — rankings, movement, and where the next win is."
      />

      <AiSummary brandId={brand.id} section="search intelligence" brandName={brand.name} />

      <SubNav items={TABS} value={tab} onChange={setTab} />

      {tab === "overview" && <OverviewTab brandId={brand.id} />}
      {tab === "keywords" && <KeywordsTab brandId={brand.id} />}
      {tab === "movement" && <MovementTab brandId={brand.id} />}
      {tab === "opportunities" && <OpportunitiesTab brandId={brand.id} />}
      {tab === "insights" && <InsightsTab brandId={brand.id} />}
      {tab === "timeline" && <TimelineTab brandId={brand.id} />}
    </div>
  );
}
