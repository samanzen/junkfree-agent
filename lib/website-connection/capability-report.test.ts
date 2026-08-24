import { expect, test } from "vitest";
import fs from "fs";
import {
  STATUS_LABELS,
  accessTransparency,
  buildCapabilityReport,
} from "./capability-report";
import {
  CONNECTOR_WATCH_SOURCES,
  createConnectorReviewTask,
  watcherMayAutoEnableCapability,
} from "./watcher";
import { statusLabelFor } from "./capabilities";
import { capabilityMapForWriter } from "../execution/site-capabilities";
import { describeWebsiteConnection } from "./resolve";
import type { Brand } from "../brands";

test("customer status labels never say Unsupported as the normal label", () => {
  expect(STATUS_LABELS.auto_manage).toBe("Auto-Manage");
  expect(STATUS_LABELS.approval_required).toBe("Approval Required");
  expect(STATUS_LABELS.guided).toBe("Guided Implementation");
  expect(STATUS_LABELS.access_required).toBe("Access Required");
  expect(statusLabelFor("available")).toBe("Auto-Manage");
  expect(statusLabelFor("unavailable")).toBe("Guided Implementation");
  expect(statusLabelFor("needs_proof")).toBe("Approval Required");
  expect(statusLabelFor("not_configured")).toBe("Access Required");
});

test("Auto-Manage only when capability is certified", () => {
  const unverified = buildCapabilityReport({
    adapterId: "wordpress",
    map: capabilityMapForWriter("wordpress"),
    executionMode: "autopilot",
  });
  expect(unverified.find((i) => i.key === "create_page")?.status).not.toBe("auto_manage");

  const proven = buildCapabilityReport({
    adapterId: "wordpress",
    map: {
      upsert_page: {
        state: "certified",
        writer: "wordpress",
        reason: "ok",
        certified_at: "2026-08-01T00:00:00Z",
        last_execution_id: null,
        fail_count: 0,
      },
      update_meta: {
        state: "certified",
        writer: "wordpress",
        reason: "ok",
        certified_at: "2026-08-01T00:00:00Z",
        last_execution_id: null,
        fail_count: 0,
      },
    },
    executionMode: "autopilot",
  });
  expect(proven.find((i) => i.key === "create_page")?.status).toBe("auto_manage");
  expect(proven.find((i) => i.key === "update_meta")?.status).toBe("auto_manage");
  expect(proven.find((i) => i.key === "upload_media")?.status).toBe("guided");
});

test("report covers required capability keys", () => {
  const items = buildCapabilityReport({ adapterId: "managed_pages", map: {}, executionMode: "approval" });
  const keys = items.map((i) => i.key);
  expect(keys).toEqual(
    expect.arrayContaining([
      "create_blog_post",
      "create_page",
      "update_page",
      "update_meta",
      "upload_media",
      "manage_internal_links",
      "update_schema",
      "canonical",
      "manage_sitemap",
      "technical_seo",
      "deploy_verify",
      "rollback",
    ])
  );
});

test("access transparency never claims payments access", () => {
  for (const id of ["wordpress", "shopify", "github", "sanity", "managed_pages", null] as const) {
    const t = accessTransparency(id);
    expect(t.weDoNotAccess.join(" ").toLowerCase()).toMatch(/payment|order|billing|customer/);
  }
});

test("connector watcher never auto-enables capabilities", () => {
  expect(watcherMayAutoEnableCapability()).toBe(false);
  expect(Object.keys(CONNECTOR_WATCH_SOURCES)).toEqual(
    expect.arrayContaining(["wordpress", "shopify", "wix", "webflow", "github", "sanity"])
  );
  const task = createConnectorReviewTask({
    target: "wordpress",
    detectedAt: new Date().toISOString(),
    sourceUrl: CONNECTOR_WATCH_SOURCES.wordpress,
    summary: "Docs mention a new endpoint",
    suggestedChange: "Evaluate media upload support",
  });
  expect(task.status).toBe("pending_review");
});

test("POMO capability report includes managed pages sitemap path", () => {
  const brand = {
    id: "9bb33e02-2357-420c-b082-1335588fd19c",
    name: "POMO BUILD",
    primary_writer: "proxy",
    proxy_site_token: "site_" + "a".repeat(32),
    proxy_namespace: "guides",
    source_of_truth: { confirmed: "platform_proxy", confirmed_at: "2026-08-21T00:00:00Z" },
    execution_mode: "hybrid",
    site_capabilities: {
      upsert_page: {
        state: "certified",
        writer: "proxy",
        reason: "Working",
        certified_at: "2026-08-21T00:00:00Z",
        last_execution_id: null,
        fail_count: 0,
      },
    },
  } as unknown as Brand;
  const view = describeWebsiteConnection(brand);
  expect(view.adapterId).toBe("managed_pages");
  expect(view.capabilityReport.find((c) => c.key === "create_page")?.status).toBe("auto_manage");
  expect(view.capabilityReport.find((c) => c.key === "manage_sitemap")?.status).toBe("auto_manage");
});

test("Connect Website UX includes promo, Analyze & Connect, and Coming Soon page", () => {
  const wizard = fs.readFileSync("app/portal/settings/_ConnectWebsite.tsx", "utf8");
  expect(wizard).toMatch(/Analyze & Connect/);
  expect(wizard).toMatch(/Enter your website URL/);
  expect(wizard).toMatch(/onRecheckAccess/);
  expect(wizard).toMatch(/onRecheckConnection/);
  expect(wizard).toMatch(/Use a different connection method/);
  expect(wizard).not.toMatch(/Unsupported/);

  const reportUi = fs.readFileSync("app/portal/settings/_CapabilityReport.tsx", "utf8");
  expect(reportUi).toMatch(/Recheck Access/);
  expect(reportUi).toMatch(/Recheck Connection/);

  const panel = fs.readFileSync("app/portal/settings/_ConnectionsPanel.tsx", "utf8");
  expect(panel).toMatch(/WebsiteBuilderPromo/);
  expect(panel).toMatch(/Analyze & Connect/);

  expect(fs.existsSync("app/website-builder/page.tsx")).toBe(true);
  expect(fs.existsSync("app/portal/settings/_WebsiteBuilderPromo.tsx")).toBe(true);
  const landing = fs.readFileSync("app/website-builder/page.tsx", "utf8");
  expect(landing).toMatch(/Your New SEO-Ready Website/);
  expect(landing).toMatch(/NotifyInterestForm/);
  expect(landing).toMatch(/do not promise guaranteed rankings/i);
  expect(landing).not.toMatch(/100% SEO/i);
  expect(landing).not.toMatch(/zero SEO loss/i);
});
