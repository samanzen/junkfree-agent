/**
 * Customer-facing capability report for Website Connection.
 *
 * Statuses (never show bare "Unsupported" as the normal label):
 *   auto_manage | approval_required | guided | access_required
 */

import type { WebsiteAdapterId } from "./capabilities";
import type { SiteCapabilityMap } from "../execution/site-capabilities";
import type { OperationState } from "../execution/site-capabilities";

export type CustomerCapabilityStatus =
  | "auto_manage"
  | "approval_required"
  | "guided"
  | "access_required";

export type CapabilityLimitReason =
  | "provider_api"
  | "missing_permission"
  | "missing_connector"
  | "private_page"
  | "robots_blocked"
  | "bot_protection"
  | "missing_repo"
  | "cms_owned"
  | "needs_proof"
  | "not_applicable";

export type CapabilityReportItem = {
  key: string;
  label: string;
  status: CustomerCapabilityStatus;
  statusLabel: string;
  /** One-line summary for the main list. */
  summary: string;
  /** Details behind "View details". */
  details: {
    canAnalyze: string;
    canPublish: string;
    cannotDo: string;
    reason: CapabilityLimitReason;
    reasonLabel: string;
    customerAction: string | null;
    developerAction: string | null;
    unlockHint: string | null;
  };
};

export const STATUS_LABELS: Record<CustomerCapabilityStatus, string> = {
  auto_manage: "Auto-Manage",
  approval_required: "Approval Required",
  guided: "Guided Implementation",
  access_required: "Access Required",
};

const REASON_LABELS: Record<CapabilityLimitReason, string> = {
  provider_api: "Provider API restriction",
  missing_permission: "Missing permission",
  missing_connector: "Connector not available for this platform",
  private_page: "Private or login-protected page",
  robots_blocked: "robots.txt restriction",
  bot_protection: "Firewall or bot protection",
  missing_repo: "Missing repository or source-code access",
  cms_owned: "CMS-owned content",
  needs_proof: "Connection not proven yet",
  not_applicable: "Not applicable for this connection type",
};

const REPORT_KEYS: { key: string; label: string }[] = [
  { key: "create_blog_post", label: "Blog-post creation" },
  { key: "create_page", label: "New-page creation" },
  { key: "update_page", label: "Existing-content updates" },
  { key: "update_meta", label: "Titles and meta descriptions" },
  { key: "upload_media", label: "Images and alt text" },
  { key: "manage_internal_links", label: "Internal links" },
  { key: "update_schema", label: "Schema markup" },
  { key: "canonical", label: "Canonical URLs" },
  { key: "manage_sitemap", label: "Sitemap and robots rules" },
  { key: "technical_seo", label: "Technical SEO changes" },
  { key: "deploy_verify", label: "Deployment verification" },
  { key: "rollback", label: "Rollback" },
];

function opState(map: SiteCapabilityMap, op: "upsert_page" | "update_meta"): OperationState | undefined {
  return map[op]?.state;
}

function proven(state: OperationState | undefined): boolean {
  return state === "certified";
}

function unverified(state: OperationState | undefined): boolean {
  return state === "supported_unverified" || state === "stale" || state === "temporarily_failed";
}

function item(
  key: string,
  label: string,
  status: CustomerCapabilityStatus,
  summary: string,
  details: Omit<CapabilityReportItem["details"], "reasonLabel"> & { reason: CapabilityLimitReason }
): CapabilityReportItem {
  return {
    key,
    label,
    status,
    statusLabel: STATUS_LABELS[status],
    summary,
    details: {
      ...details,
      reasonLabel: REASON_LABELS[details.reason],
    },
  };
}

/**
 * Build the capability report for a connected (or recommended) adapter.
 * Auto-Manage only when the operation is certified for that writer.
 */
export function buildCapabilityReport(opts: {
  adapterId: WebsiteAdapterId | null;
  map: SiteCapabilityMap;
  executionMode?: "approval" | "hybrid" | "autopilot" | null;
}): CapabilityReportItem[] {
  const { adapterId, map, executionMode } = opts;
  const page = opState(map, "upsert_page");
  const meta = opState(map, "update_meta");
  const mode = executionMode || "approval";

  const publishStatus = (state: OperationState | undefined, supports: boolean): CustomerCapabilityStatus => {
    if (!supports) return "guided";
    if (proven(state)) {
      return mode === "autopilot" || mode === "hybrid" ? "auto_manage" : "approval_required";
    }
    if (unverified(state)) return "approval_required";
    return "guided";
  };

  const supports = {
    create_page: !!adapterId,
    create_blog_post: adapterId === "wordpress" || adapterId === "github",
    update_page:
      adapterId === "wordpress" ||
      adapterId === "github" ||
      adapterId === "sanity" ||
      adapterId === "shopify",
    update_meta:
      adapterId === "wordpress" || adapterId === "github" || adapterId === "sanity",
    upload_media: false,
    manage_internal_links: false,
    update_schema: false,
    canonical: adapterId === "managed_pages" || adapterId === "github",
    manage_sitemap: adapterId === "managed_pages",
    technical_seo: false,
    deploy_verify: adapterId === "github" || adapterId === "managed_pages" || !!adapterId,
    rollback: adapterId === "github" || adapterId === "wordpress" || adapterId === "sanity",
  };

  return REPORT_KEYS.map(({ key, label }) => {
    switch (key) {
      case "create_page":
        return item(key, label, publishStatus(page, supports.create_page),
          supports.create_page
            ? proven(page)
              ? mode === "approval"
                ? "We prepare pages; you approve before they go live."
                : "Proven — can publish new pages per your mode."
              : "Connection can create pages after Prove."
            : "We analyze public pages and prepare copy or developer instructions.",
          {
            canAnalyze: "Public page structure, headings and content opportunities.",
            canPublish: supports.create_page
              ? proven(page)
                ? "New pages through this connection."
                : "New pages after the connection is proven."
              : "Cannot publish automatically on this connection.",
            cannotDo: supports.create_page ? "Nothing blocking once proven." : "Automatic page creation on this platform.",
            reason: supports.create_page ? (proven(page) ? "not_applicable" : "needs_proof") : "missing_connector",
            customerAction: supports.create_page && !proven(page) ? "Complete Prove connection." : null,
            developerAction: !supports.create_page
              ? "Connect WordPress, GitHub, Sanity, or Managed Pages to enable publishing."
              : null,
            unlockHint: !supports.create_page
              ? "Connecting a supported CMS or repository enables automatic page publishing."
              : null,
          });
      case "create_blog_post":
        return item(key, label, publishStatus(page, supports.create_blog_post),
          supports.create_blog_post
            ? "Blog-style posts via this connection (WordPress posts or GitHub markdown)."
            : "We can draft article content; publishing needs WordPress or GitHub.",
          {
            canAnalyze: "Topic opportunities and competitor article patterns from public data.",
            canPublish: supports.create_blog_post
              ? "Posts through WordPress or markdown PRs on GitHub."
              : "No automatic blog publishing on this connection.",
            cannotDo: supports.create_blog_post ? "—" : "Native blog publishing.",
            reason: supports.create_blog_post ? (proven(page) ? "not_applicable" : "needs_proof") : "provider_api",
            customerAction: supports.create_blog_post && !proven(page) ? "Prove the connection." : null,
            developerAction: !supports.create_blog_post
              ? "Connect WordPress (posts) or GitHub (content folder) for blog publishing."
              : null,
            unlockHint: "WordPress or GitHub unlocks blog-post creation.",
          });
      case "update_page":
        return item(key, label, publishStatus(page, supports.update_page),
          supports.update_page
            ? "Existing content can be updated through this connection."
            : "We provide exact rewrite instructions for your developer.",
          {
            canAnalyze: "Public HTML of crawlable pages.",
            canPublish: supports.update_page ? "Updates via CMS/API or GitHub PR." : "Not automatic on Managed Pages alone.",
            cannotDo: supports.update_page ? "—" : "Editing pages that live only in your app codebase without Git access.",
            reason: supports.update_page ? (proven(page) ? "not_applicable" : "needs_proof") : "missing_repo",
            customerAction: !supports.update_page ? "Connect GitHub or a CMS that owns the content." : null,
            developerAction: !supports.update_page
              ? "Grant repository access or CMS write access so updates can be proposed safely."
              : null,
            unlockHint: "GitHub (PR flow) or WordPress/Sanity enables content updates.",
          });
      case "update_meta":
        return item(key, label, publishStatus(meta, supports.update_meta),
          supports.update_meta
            ? "Titles and meta descriptions through this connection."
            : "We generate exact title/description recommendations for Guided Implementation.",
          {
            canAnalyze: "Current titles and meta descriptions on public pages.",
            canPublish: supports.update_meta
              ? "Meta updates via WordPress, Sanity, or GitHub frontmatter PRs."
              : "Cannot write meta automatically on this connection.",
            cannotDo: supports.update_meta ? "—" : "Automatic meta writes.",
            reason: supports.update_meta
              ? proven(meta) || unverified(meta)
                ? proven(meta)
                  ? "not_applicable"
                  : "needs_proof"
                : "provider_api"
              : "provider_api",
            customerAction: supports.update_meta && !proven(meta) ? "Prove the connection (includes meta where claimed)." : null,
            developerAction: !supports.update_meta
              ? "Connect WordPress with SEO plugin meta, Sanity, or GitHub content files."
              : null,
            unlockHint: "WordPress, Sanity or GitHub unlocks meta updates.",
          });
      case "upload_media":
        return item(key, label, "guided",
          "We recommend image and alt-text changes; automatic media upload is not enabled yet.",
          {
            canAnalyze: "Public images and missing alt text on crawlable pages.",
            canPublish: "Cannot upload media automatically yet.",
            cannotDo: "Automatic media library writes.",
            reason: "missing_connector",
            customerAction: null,
            developerAction: "Apply recommended alt text and image changes from the report, or wait for media connector support.",
            unlockHint: "Future WordPress/Shopify media permissions may enable Auto-Manage.",
          });
      case "manage_internal_links":
        return item(key, label, "guided",
          "We map internal-link opportunities and provide exact link suggestions.",
          {
            canAnalyze: "Public internal link graph on crawlable pages.",
            canPublish: "Cannot rewrite links automatically on most connectors yet.",
            cannotDo: "Automatic link insertion across the site.",
            reason: "missing_connector",
            customerAction: null,
            developerAction: "Implement suggested internal links from the opportunity report.",
            unlockHint: "CMS or GitHub connections may later enable PR-based link updates.",
          });
      case "update_schema":
        return item(key, label, "guided",
          "We detect missing schema and provide JSON-LD to add.",
          {
            canAnalyze: "Public schema.org markup on crawlable pages.",
            canPublish: "Cannot inject schema automatically yet.",
            cannotDo: "Automatic schema injection.",
            reason: "missing_connector",
            customerAction: null,
            developerAction: "Add the provided JSON-LD to the page template or CMS fields.",
            unlockHint: "Template-level GitHub PRs can later ship schema automatically.",
          });
      case "canonical":
        return item(key, label,
          supports.canonical ? (adapterId === "managed_pages" && proven(page) ? (mode === "approval" ? "approval_required" : "auto_manage") : "guided") : "guided",
          supports.canonical
            ? "Managed Pages and GitHub can control canonicals for content we publish."
            : "We audit canonicals and provide exact tag recommendations.",
          {
            canAnalyze: "Canonical tags on public pages.",
            canPublish: supports.canonical ? "Canonicals for pages we publish." : "Recommendations only.",
            cannotDo: "Rewriting canonicals on pages we do not control.",
            reason: supports.canonical ? "not_applicable" : "cms_owned",
            customerAction: null,
            developerAction: !supports.canonical ? "Apply recommended canonical tags in your templates." : null,
            unlockHint: "Publishing through Managed Pages or GitHub covers new page canonicals.",
          });
      case "manage_sitemap":
        return item(key, label,
          supports.manage_sitemap && proven(page)
            ? mode === "approval" ? "approval_required" : "auto_manage"
            : supports.manage_sitemap
              ? "approval_required"
              : "guided",
          supports.manage_sitemap
            ? "Managed Pages maintains a sitemap for published pages."
            : "We check sitemap/robots and provide exact fixes.",
          {
            canAnalyze: "Public sitemap.xml and robots.txt when reachable.",
            canPublish: supports.manage_sitemap ? "Sitemap for Managed Pages paths." : "Recommendations only.",
            cannotDo: supports.manage_sitemap ? "Site-wide robots beyond managed paths." : "Automatic sitemap writes.",
            reason: supports.manage_sitemap ? (proven(page) ? "not_applicable" : "needs_proof") : "missing_connector",
            customerAction: supports.manage_sitemap && !proven(page) ? "Prove Managed Pages." : null,
            developerAction: !supports.manage_sitemap ? "Update sitemap/robots per the provided instructions." : null,
            unlockHint: "Managed Pages enables sitemap for new managed URLs.",
          });
      case "technical_seo":
        return item(key, label, "guided",
          "We run technical checks and provide prioritized fixes with developer steps.",
          {
            canAnalyze: "Public technical signals (status codes, indexability, speed hints where available).",
            canPublish: "Cannot apply most technical fixes automatically yet.",
            cannotDo: "Server/config changes without host or repo access.",
            reason: "missing_connector",
            customerAction: "Share developer contact for Guided Implementation items.",
            developerAction: "Apply technical fixes from the Technical SEO report.",
            unlockHint: "GitHub + host access expands what can move to Approval Required.",
          });
      case "deploy_verify":
        return item(key, label,
          adapterId === "github"
            ? "approval_required"
            : adapterId
              ? proven(page) ? "approval_required" : "approval_required"
              : "access_required",
          adapterId === "github"
            ? "We verify PR content; production verify waits for your merge/deploy."
            : adapterId
              ? "We verify publishes where the connection allows (live URL or API)."
              : "Connect a publisher to enable deployment verification.",
          {
            canAnalyze: "Public URLs after deploy when crawlable.",
            canPublish: "Verification only — deploy remains on your host/CI.",
            cannotDo: "Deploying production without your approval pipeline.",
            reason: adapterId === "github" ? "missing_permission" : adapterId ? "not_applicable" : "missing_connector",
            customerAction: adapterId === "github" ? "Merge the PR and deploy, then Recheck Connection." : null,
            developerAction: adapterId === "github" ? "Merge Volo PRs and run your normal deploy." : null,
            unlockHint: null,
          });
      case "rollback":
        return item(key, label,
          supports.rollback ? "approval_required" : "guided",
          supports.rollback
            ? "We can open a revert PR or restore prior CMS values where recorded."
            : "We document prior state when known; rollback is manual.",
          {
            canAnalyze: "Previous values captured at publish time when available.",
            canPublish: supports.rollback ? "Revert via PR or CMS restore for recorded changes." : "Manual rollback instructions.",
            cannotDo: "Guaranteed one-click rollback on every host.",
            reason: supports.rollback ? "not_applicable" : "missing_connector",
            customerAction: null,
            developerAction: !supports.rollback ? "Revert using your VCS or CMS revision history." : null,
            unlockHint: "GitHub and CMS connectors improve rollback.",
          });
      default:
        return item(key, label, "guided", "Analyzed when publicly available.", {
          canAnalyze: "Public signals where crawlable.",
          canPublish: "Not automatic.",
          cannotDo: "Automatic change.",
          reason: "missing_connector",
          customerAction: null,
          developerAction: null,
          unlockHint: null,
        });
    }
  });
}

/** Access transparency copy for the authorize step. */
export function accessTransparency(adapterId: WebsiteAdapterId | null): {
  weAccess: string[];
  weDoNotAccess: string[];
} {
  if (adapterId === "wordpress") {
    return {
      weAccess: ["Pages and posts", "Titles, excerpts and SEO meta fields when available", "Media library listings when permitted"],
      weDoNotAccess: ["Payments, orders or customer PII", "WordPress admin users beyond the connected account", "Plugins unrelated to publishing"],
    };
  }
  if (adapterId === "shopify") {
    return {
      weAccess: ["Online Store pages", "Store content needed to publish pages"],
      weDoNotAccess: ["Orders, payments or customer data", "Checkout or billing settings"],
    };
  }
  if (adapterId === "github") {
    return {
      weAccess: ["Selected repository contents", "Branches and pull requests we open for SEO changes"],
      weDoNotAccess: ["Other repositories", "Org billing", "Secrets outside the token you provide"],
    };
  }
  if (adapterId === "sanity") {
    return {
      weAccess: ["Documents in the selected project/dataset", "Fields needed for pages and metadata"],
      weDoNotAccess: ["Other Sanity projects", "Billing"],
    };
  }
  if (adapterId === "managed_pages") {
    return {
      weAccess: ["Public pages on your site for checks", "Managed pages we publish under your domain"],
      weDoNotAccess: [
        "Your app source code",
        "Hosting account credentials",
        "Private admin areas",
        "Payments, billing, orders or customer information",
      ],
    };
  }
  return {
    weAccess: ["Public pages we can crawl", "Connection credentials you provide"],
    weDoNotAccess: ["Payments, billing, orders or customer information"],
  };
}
