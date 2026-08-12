// CAPABILITY GATE — subscription tiers decide execution capacity.
//
// Plans are sold as *how much work the OS can run*, not as Semrush-style
// toolkit bundles. Every gated number flows through this file so call sites
// ask by name and degrade when a tier is lower — they never hard-code limits.

export type PlanKey = "founding" | "growth" | "managed";

export type Capability =
  /**
   * Render a page's JavaScript before reading its content, so client-rendered
   * sites report real word counts and real copy instead of their pre-JS shell.
   */
  | "js_rendering"
  /** Multi-prompt AI visibility tracking across discovery queries. */
  | "ai_visibility_tracking"
  /** Pull conversion / lead / call signals from connected analytics. */
  | "conversion_signals"
  /** Import GBP reviews and auto-draft replies into the approval queue. */
  | "review_automation";

export type Quota =
  | "images_per_day"
  /** Max tracked keywords enriched / shown under Intelligence. */
  | "tracked_keywords"
  /** Max AI visibility prompts checked per brand. */
  | "ai_prompts"
  /** Max full agent orchestration runs seeded per day. */
  | "agent_runs_per_day"
  /** Max competitors stored for gap analysis. */
  | "competitors";

/** A quota with no ceiling. Compared with `>=`, so this can never be reached. */
export const UNLIMITED = Number.POSITIVE_INFINITY;

/** The brand fields this module reads. Structural so callers can pass Brand. */
export type CapabilityScope = {
  id?: string;
  slug?: string;
  plan?: string | null;
  billing_status?: string | null;
};

export type PlanCapacity = {
  label: string;
  tagline: string;
  /** Marketing price line — Stripe amounts stay in env. */
  priceLabel: string;
  priceHint: string;
  capabilities: Record<Capability, boolean>;
  quotas: Record<Quota, number>;
};

/**
 * Capacity packages — the product answer to Semrush toolkit pricing.
 * Founding/Growth map to Stripe plan keys; Managed is sales-led.
 */
export const PLAN_CAPACITY: Record<PlanKey, PlanCapacity> = {
  founding: {
    label: "Founding",
    tagline: "One brand. Full AI loop. Approve and ship.",
    priceLabel: "Early access",
    priceHint: "Per brand · locked founding rate when billing is live",
    capabilities: {
      js_rendering: true,
      ai_visibility_tracking: true,
      conversion_signals: true,
      review_automation: true,
    },
    quotas: {
      images_per_day: 2,
      tracked_keywords: 500,
      ai_prompts: 25,
      agent_runs_per_day: 2,
      competitors: 5,
    },
  },
  growth: {
    label: "Growth",
    tagline: "More runs, more keywords, deeper AI visibility.",
    priceLabel: "Standard",
    priceHint: "Per brand · built for ongoing agent throughput",
    capabilities: {
      js_rendering: true,
      ai_visibility_tracking: true,
      conversion_signals: true,
      review_automation: true,
    },
    quotas: {
      images_per_day: 8,
      tracked_keywords: 2000,
      ai_prompts: 100,
      agent_runs_per_day: 6,
      competitors: 15,
    },
  },
  managed: {
    label: "Managed",
    tagline: "Human operators plus the platform — multi-brand ready.",
    priceLabel: "Custom",
    priceHint: "Strategy + execution capacity sized to your brands",
    capabilities: {
      js_rendering: true,
      ai_visibility_tracking: true,
      conversion_signals: true,
      review_automation: true,
    },
    quotas: {
      images_per_day: 40,
      tracked_keywords: 10000,
      ai_prompts: 500,
      agent_runs_per_day: 30,
      competitors: 50,
    },
  },
};

/** Trial / unset plan gets Founding capacity — never zero. */
export function resolvePlan(brand: CapabilityScope): PlanKey {
  const raw = (brand.plan || "").toLowerCase().trim();
  if (raw === "growth" || raw === "managed" || raw === "founding") return raw;
  return "founding";
}

export function planCapacity(brand: CapabilityScope): PlanCapacity {
  return PLAN_CAPACITY[resolvePlan(brand)];
}

export function canUse(brand: CapabilityScope, capability: Capability): boolean {
  return planCapacity(brand).capabilities[capability] === true;
}

export function quotaFor(brand: CapabilityScope, quota: Quota): number {
  return planCapacity(brand).quotas[quota];
}
