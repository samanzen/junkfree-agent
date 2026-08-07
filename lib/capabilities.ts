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
