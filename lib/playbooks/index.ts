// Vertical-aware content guidance (Sprint 6.2 Phase 5). One engine, one
// content-agent shape (lib/agents/index.ts), but the E-E-A-T framing and
// audit focus vary by business_model so a SaaS/e-commerce/national brand
// doesn't get local-trade phrasing forced into its content.
//
// local_service below is a byte-for-byte extraction of the wording every
// brand got before this file existed -- existing brands see zero change in
// the rendered prompt.

import type { BusinessModel } from "../brands";

export type Playbook = {
  eeatGuidance: string; // interpolated into writeContent()'s E-E-A-T section
  auditFocus: string;   // interpolated into auditPage()'s "Cover: ..." line
  // Sprint 6.7: interpolated into lib/images.ts's imagePrompt(). Together
  // they reconstruct "for a {imageSubjectPrefix}{service} business blog post
  // ... {imageContext}" -- local_service's values are a byte-for-byte
  // extraction of the wording every brand's image prompt got before this
  // sprint existed.
  imageSubjectPrefix: string;
  imageContext: string;
};

const LOCAL_SERVICE: Playbook = {
  eeatGuidance: `- EXPERIENCE: include specifics only a real local operator would know — local disposal/recycling rules, which materials cost extra, realistic price ranges in CAD, seasonal/local factors, real logistics.
- EXPERTISE: accurate, detailed how-to and what-to-expect information.
- AUTHORITY: reference the service area, credentials, and process confidently.
- TRUST: honest about pricing/what's included; no hype, no empty filler.`,
  auditFocus: "local specifics/E-E-A-T",
  imageSubjectPrefix: "local ",
  imageContext: "Canadian suburban/residential context.",
};

const ECOMMERCE: Playbook = {
  eeatGuidance: `- EXPERIENCE: include specifics only someone who has actually used/sold the product would know — real specs, sizing/fit or compatibility notes, common failure points, how it compares to alternatives.
- EXPERTISE: accurate, detailed information on materials, use cases, and what to check before buying.
- AUTHORITY: reference return/warranty policy, certifications, and sourcing/testing process confidently.
- TRUST: honest about pricing, shipping, and limitations; no hype, no empty filler.`,
  auditFocus: "product/buyer E-E-A-T",
  imageSubjectPrefix: "",
  imageContext: "Clean, modern studio or lifestyle product-photography context.",
};

const SAAS: Playbook = {
  eeatGuidance: `- EXPERIENCE: include specifics only someone who has actually run this workflow/integration would know — real setup steps, common gotchas, what breaks at scale.
- EXPERTISE: accurate, detailed technical information on how the feature/integration actually works.
- AUTHORITY: reference the product's track record, integrations, and security/compliance posture confidently.
- TRUST: honest about pricing tiers and limitations; no hype, no empty filler.`,
  auditFocus: "technical/buyer E-E-A-T",
  imageSubjectPrefix: "",
  imageContext: "Modern software/workplace context, clean tech-forward setting.",
};

const NATIONAL_BRAND: Playbook = {
  eeatGuidance: `- EXPERIENCE: include specifics only a brand operating at this scale would know — real logistics, regional variation, what changes market to market.
- EXPERTISE: accurate, detailed how-to and what-to-expect information.
- AUTHORITY: reference scale, credentials, and process confidently.
- TRUST: honest about pricing/what's included; no hype, no empty filler.`,
  auditFocus: "brand/buyer E-E-A-T",
  imageSubjectPrefix: "",
  imageContext: "Professional, brand-consistent commercial context.",
};

const CONTENT_PUBLISHER: Playbook = {
  eeatGuidance: `- EXPERIENCE: include specifics only someone who has actually researched/tested this topic would know — real sources, concrete examples, firsthand detail.
- EXPERTISE: accurate, well-sourced, detailed information.
- AUTHORITY: reference sourcing, credentials, and editorial process confidently.
- TRUST: honest, balanced, no hype, no empty filler, cite sources where relevant.`,
  auditFocus: "editorial E-E-A-T",
  imageSubjectPrefix: "",
  imageContext: "Editorial, magazine-style context.",
};

const PLAYBOOKS: Record<BusinessModel, Playbook> = {
  local_service: LOCAL_SERVICE,
  ecommerce: ECOMMERCE,
  saas: SAAS,
  national_brand: NATIONAL_BRAND,
  content_publisher: CONTENT_PUBLISHER,
};

// Falls back to local_service for any value outside the known set -- matches
// today's blanket behavior. Unreachable in practice (brands.business_model is
// `not null default 'local_service'` and BusinessModel restricts valid values
// at the TypeScript layer), but keeps this function total rather than partial.
export function playbookFor(businessModel: BusinessModel): Playbook {
  return PLAYBOOKS[businessModel] || LOCAL_SERVICE;
}
