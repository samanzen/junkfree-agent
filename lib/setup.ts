// Customer activation journey — derived from real brand state, not a
// separate "onboarding_complete" flag. No migration required.

export type SetupStepKey =
  | "business"
  | "search_console"
  | "intelligence"
  | "publishing"
  | "first_approval"
  | "operating";

export type SetupStep = {
  key: SetupStepKey;
  label: string;
  summary: string;
  done: boolean;
  href: string;
};

export type SetupProgressInput = {
  hasBrand: boolean;
  hasSiteUrl: boolean;
  hasGsc: boolean;
  hasIntelligence: boolean; // tracked keywords or keyword_positions
  hasPublishing: boolean;
  hasFirstApproval: boolean; // approved/published draft or live execution
};

export type SetupProgress = {
  steps: SetupStep[];
  doneCount: number;
  total: number;
  complete: boolean;
  /** First incomplete step, or null when finished. */
  next: SetupStepKey | null;
};

const STEP_META: Record<
  SetupStepKey,
  { label: string; summary: string; href: string }
> = {
  business: {
    label: "Business setup",
    summary: "Your brand, website, and model are on file.",
    href: "/portal/setup",
  },
  search_console: {
    label: "Search Console",
    summary: "Connect Google so rankings and clicks can flow in.",
    href: "/portal/setup?step=search_console",
  },
  intelligence: {
    label: "First intelligence",
    summary: "Pull your first keyword and opportunity picture.",
    href: "/portal/setup?step=intelligence",
  },
  publishing: {
    label: "Publishing connection",
    summary: "Connect WordPress or a webhook so approvals can go live.",
    href: "/portal/setup?step=publishing",
  },
  first_approval: {
    label: "First approval",
    summary: "Approve work once so execution is proven end-to-end.",
    href: "/portal/setup?step=first_approval",
  },
  operating: {
    label: "Operating",
    summary: "Attention, AI work, approval, execution, and results — ready.",
    href: "/portal",
  },
};

export function buildSetupProgress(input: SetupProgressInput): SetupProgress {
  const flags: Record<SetupStepKey, boolean> = {
    business: input.hasBrand && input.hasSiteUrl,
    search_console: input.hasGsc,
    intelligence: input.hasIntelligence,
    publishing: input.hasPublishing,
    first_approval: input.hasFirstApproval,
    // Operating is true only when the activation chain is complete.
    operating:
      input.hasBrand &&
      input.hasSiteUrl &&
      input.hasGsc &&
      input.hasIntelligence &&
      input.hasPublishing &&
      input.hasFirstApproval,
  };

  const order: SetupStepKey[] = [
    "business",
    "search_console",
    "intelligence",
    "publishing",
    "first_approval",
    "operating",
  ];

  const steps: SetupStep[] = order.map((key) => ({
    key,
    label: STEP_META[key].label,
    summary: STEP_META[key].summary,
    href: STEP_META[key].href,
    done: flags[key],
  }));

  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done)?.key ?? null;

  return {
    steps,
    doneCount,
    total: steps.length,
    complete: next === null,
    next,
  };
}
