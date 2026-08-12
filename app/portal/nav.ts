// Portal navigation by user intent. Single source for the sidebar, mobile
// drawer, bottom nav overflow, and the ⌘K command palette — so a destination
// cannot exist in one surface and go missing in another.

import type { ComponentType } from "react";
import {
  IconDashboard, IconTarget, IconIntelligence, IconCompetitors, IconLocalSeo,
  IconWebsite, IconTechnical, IconContent, IconReviews, IconReports,
  IconBilling, IconSettings, IconAssistant, IconCheck, IconTraffic, IconSparkle,
} from "./icons";

type Icon = ComponentType<{ size?: number; className?: string }>;

export type NavItem = {
  href: string;
  label: string;
  Icon: Icon;
  exact?: boolean;
  /** Show pending-approval badge on this item. */
  badge?: "approvals";
};

export type NavGroup = {
  label: string;
  items: NavItem[];
  /** Rendered outside the scrollable list, above the sidebar foot. */
  pin?: "footer";
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/portal", label: "Dashboard", Icon: IconDashboard, exact: true },
    ],
  },
  {
    label: "Act",
    items: [
      { href: "/portal/approvals", label: "Approvals", Icon: IconCheck, badge: "approvals" },
      { href: "/portal/opportunities", label: "Opportunities", Icon: IconTarget },
      { href: "/portal/content", label: "Content", Icon: IconContent },
      { href: "/portal/reviews", label: "Reviews", Icon: IconReviews },
    ],
  },
  {
    label: "Analyse",
    items: [
      { href: "/portal/intelligence", label: "Intelligence", Icon: IconIntelligence },
      { href: "/portal/ai-visibility", label: "AI Visibility", Icon: IconSparkle },
      { href: "/portal/results", label: "Results", Icon: IconTraffic },
      { href: "/portal/competitors", label: "Competitors", Icon: IconCompetitors },
      { href: "/portal/reports", label: "Reports", Icon: IconReports },
    ],
  },
  {
    label: "Site",
    items: [
      { href: "/portal/website", label: "Website", Icon: IconWebsite },
      { href: "/portal/technical", label: "Technical SEO", Icon: IconTechnical },
      { href: "/portal/local-seo", label: "Local SEO", Icon: IconLocalSeo },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/portal/settings", label: "Settings", Icon: IconSettings },
      { href: "/portal/billing", label: "Billing", Icon: IconBilling },
    ],
  },
  {
    label: "Assistant",
    pin: "footer",
    items: [
      { href: "/portal/assistant", label: "AI Assistant", Icon: IconAssistant },
    ],
  },
];

/** Flat list of every destination — used by the command palette. */
export const NAV_ROUTES: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);
