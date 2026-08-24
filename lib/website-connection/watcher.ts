/**
 * Connector Watcher — periodic review of vendor docs/API changes.
 *
 * Never auto-enables capabilities. Creates internal review tasks only.
 */

export type ConnectorWatchTarget =
  | "wordpress"
  | "shopify"
  | "wix"
  | "webflow"
  | "github"
  | "sanity"
  | "contentful"
  | "strapi";

export type ConnectorWatchFinding = {
  target: ConnectorWatchTarget;
  detectedAt: string;
  sourceUrl: string;
  summary: string;
  suggestedChange: string;
};

export type ConnectorReviewTask = {
  id: string;
  finding: ConnectorWatchFinding;
  status: "pending_review" | "in_progress" | "tested" | "approved" | "rejected";
  createdAt: string;
};

/** Official doc entry points the watcher should poll (design registry). */
export const CONNECTOR_WATCH_SOURCES: Record<ConnectorWatchTarget, string> = {
  wordpress: "https://developer.wordpress.org/rest-api/",
  shopify: "https://shopify.dev/docs/api/admin-graphql",
  wix: "https://dev.wix.com/docs/rest",
  webflow: "https://developers.webflow.com/data/docs",
  github: "https://docs.github.com/en/rest",
  sanity: "https://www.sanity.io/docs/http-api",
  contentful: "https://www.contentful.com/developers/docs/",
  strapi: "https://docs.strapi.io/dev-docs/api/rest",
};

/**
 * Turn a documentation finding into an internal review task.
 * Callers must still implement + test + human-approve before enabling a capability.
 */
export function createConnectorReviewTask(finding: ConnectorWatchFinding): ConnectorReviewTask {
  return {
    id: `cwatch_${finding.target}_${Date.now().toString(36)}`,
    finding,
    status: "pending_review",
    createdAt: new Date().toISOString(),
  };
}

/** Safety rule encoded for tests and future cron. */
export function watcherMayAutoEnableCapability(): false {
  return false;
}
