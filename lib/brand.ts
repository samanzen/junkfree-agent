// The single place that makes this engine site-specific.
// Copy this file's values to run the same system for POMO BUILD or Volo Locals.

export const BRAND = {
  name: "Junk Free",
  siteUrl: "https://www.junkfree.ca",
  // The GSC property EXACTLY as it appears in Search Console (domain property):
  gscProperty: "sc-domain:junkfree.ca",
  area: "Greater Vancouver / Lower Mainland, BC",
  services:
    "Junk removal, demolition, waste management, hauling, cleanup, eco-friendly disposal",
  edge: "Same/next-day service, eco-friendly disposal, residential & commercial",
  voice:
    "Direct, trustworthy, local, no-nonsense — reassuring for stressed homeowners, efficient for contractors. Canadian spelling.",
} as const;

export function brandBlock() {
  return `BUSINESS CONTEXT — apply throughout:
- Name: ${BRAND.name}
- Service area: ${BRAND.area}
- Services: ${BRAND.services}
- Edge: ${BRAND.edge}
- Voice: ${BRAND.voice}
- Website: ${BRAND.siteUrl}`;
}
