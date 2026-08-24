/**
 * Website Connection — customer-facing capability catalogue.
 *
 * Agents and the Connections UI talk in these terms. Adapters underneath
 * (WordPress, Shopify, webhook, managed_pages/proxy) map into this set.
 * Customers never see adapter or rewrite vocabulary here.
 */

export type WebsiteCapability =
  | "read_site"
  | "create_page"
  | "update_page"
  | "create_blog_post"
  | "update_blog_post"
  | "update_meta"
  | "update_schema"
  | "manage_internal_links"
  | "manage_redirects"
  | "manage_sitemap"
  | "upload_media"
  | "rollback"
  | "managed_pages";

/** How a capability appears to the customer. */
export type CapabilityAvailability =
  | "available"
  | "needs_proof"
  | "unavailable"
  | "not_configured";

export type CapabilityView = {
  key: WebsiteCapability;
  label: string;
  status: CapabilityAvailability;
  /** Short customer-facing status phrase, e.g. "Available". */
  statusLabel: string;
};

/** Internal adapter identity. Never shown as a primary UI label for customers. */
export type WebsiteAdapterId =
  | "wordpress"
  | "shopify"
  | "webhook"
  | "managed_pages"
  | "github";

export const CAPABILITY_LABELS: Record<WebsiteCapability, string> = {
  read_site: "Website reading",
  create_page: "New page publishing",
  update_page: "Existing content editing",
  create_blog_post: "Blog publishing",
  update_blog_post: "Blog updates",
  update_meta: "SEO metadata",
  update_schema: "Structured data",
  manage_internal_links: "Internal links",
  manage_redirects: "Redirects",
  manage_sitemap: "Sitemap",
  upload_media: "Media uploads",
  rollback: "Rollback",
  managed_pages: "Volo Managed Pages",
};

/** Capabilities the Connections card surfaces by default. */
export const CUSTOMER_CAPABILITY_ORDER: WebsiteCapability[] = [
  "read_site",
  "create_page",
  "update_page",
  "create_blog_post",
  "update_meta",
  "managed_pages",
];

export function statusLabelFor(status: CapabilityAvailability): string {
  if (status === "available") return "Available";
  if (status === "needs_proof") return "Needs proof";
  if (status === "not_configured") return "Not configured";
  return "Unavailable";
}

/** Default managed path — content architecture, not a connection choice. */
export const DEFAULT_MANAGED_NAMESPACE = "guides";
