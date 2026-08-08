// CAPABILITY GATE — the single seam where subscription tiers will later decide
// which customer-facing capabilities a brand gets.
//
// Deliberately not a billing system. There are no plans, no prices and no
// entitlement checks here yet, because none exist to enforce. What this gives
// us is one place to add them: every gated capability is asked for by name
// through `canUse()`, so introducing Starter / Professional / Agency later
// means changing this file, not the code that uses the capability.
//
// The rule for callers: ask, then degrade. A capability that is off must leave
// the feature working in its previous form, never fail the job. Every call site
// added in Phase 8B follows that shape.

export type Capability =
  /**
   * Render a page's JavaScript before reading its content, so client-rendered
   * sites report real word counts and real copy instead of their pre-JS shell.
   * Costs a metered DataForSEO call per page (~$0.0015), which is exactly the
   * kind of thing a paid tier will eventually gate.
   */
  | "js_rendering";

/** The brand fields this module reads. Kept structural so callers can pass a
 *  full Brand without this file importing (and coupling to) the Brand type. */
export type CapabilityScope = { id?: string; slug?: string };

/**
 * Whether `brand` may use `capability`.
 *
 * Every capability is currently enabled for every brand — that is the honest
 * present state, not a placeholder pretending to decide something. When plans
 * arrive, this is where the brand's tier gets looked up.
 */
export function canUse(_brand: CapabilityScope, _capability: Capability): boolean {
  return true;
}

// ── Metered quotas ──────────────────────────────────────────────────────────
//
// A capability answers "may this brand do X at all". A quota answers "how many
// times per day". Both belong to the plan, so both are resolved here — one
// place to change when Starter / Pro / Agency / Enterprise arrive, rather than
// a limit hard-coded at each call site.

export type Quota =
  /**
   * AI header/illustration images generated for content drafts. Metered
   * because each one is a paid image-model call.
   */
  | "images_per_day";

/** A quota with no ceiling. Compared with `>=`, so this can never be reached. */
export const UNLIMITED = Number.POSITIVE_INFINITY;

/**
 * Today's per-brand allowance, per day, in the brand's own bucket.
 *
 * Every brand currently gets the same number — that is the honest present
 * state, not a placeholder pretending to decide something. What matters is
 * that the number is asked for PER BRAND: the count it is compared against is
 * scoped by brand_id, so one tenant exhausting its allowance cannot affect
 * another. Introducing plans means returning a different number here; no call
 * site changes.
 */
const DEFAULT_QUOTAS: Record<Quota, number> = {
  images_per_day: 1,
};

export function quotaFor(_brand: CapabilityScope, quota: Quota): number {
  return DEFAULT_QUOTAS[quota];
}
