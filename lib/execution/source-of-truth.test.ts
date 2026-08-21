import { expect, test } from "vitest";
import fs from "fs";
import {
  scoreSourceSignals,
  parseSourceOfTruth,
  writerForConfirmed,
  sourceOfTruthMatchesWriter,
  isOperationAutopilotReady,
} from "./source-of-truth";

const read = (p: string) => fs.readFileSync(p, "utf8");

test("framework fingerprints never become high-confidence WordPress", () => {
  const r = scoreSourceSignals({
    homepage: {
      status: 200,
      headers: {},
      body: "<script>window.__NEXT_DATA__={}</script><div id=\"__nuxt\">vite</div>",
    },
  });
  expect(r.detected).toBe("application_database");
  expect(r.confidence).not.toBe("high");
});

test("wp-json JSON is a wordpress signal and still does not confirm", () => {
  const r = scoreSourceSignals({
    wpJson: { status: 200, body: JSON.stringify({ name: "WP", namespaces: ["wp/v2"] }) },
  });
  expect(r.detected).toBe("wordpress");
  expect(parseSourceOfTruth({ detected: r.detected }).confirmed).toBeNull();
});

test("confirmed SoT maps to the V1 writer", () => {
  expect(writerForConfirmed("wordpress")).toBe("wordpress");
  expect(writerForConfirmed("shopify")).toBe("shopify");
  expect(writerForConfirmed("application_database")).toBe("webhook");
  expect(writerForConfirmed("platform_proxy")).toBe("proxy");
  expect(writerForConfirmed("unknown")).toBeNull();
});

test("unknown or mismatched SoT blocks Autopilot even if certified", () => {
  const certified = {
    upsert_page: {
      state: "certified",
      writer: "wordpress",
      reason: "Working",
      certified_at: new Date().toISOString(),
    },
  };
  expect(
    isOperationAutopilotReady(
      { primary_writer: "wordpress", site_capabilities: certified, source_of_truth: { confirmed: "unknown" } },
      "upsert_page"
    )
  ).toBe(false);
  expect(
    isOperationAutopilotReady(
      {
        primary_writer: "wordpress",
        site_capabilities: certified,
        source_of_truth: { confirmed: "shopify" },
      },
      "upsert_page"
    )
  ).toBe(false);
  expect(
    isOperationAutopilotReady(
      {
        primary_writer: "wordpress",
        site_capabilities: certified,
        source_of_truth: { confirmed: "wordpress" },
      },
      "upsert_page"
    )
  ).toBe(true);
});

test("stale certification is not Autopilot-ready", () => {
  expect(
    sourceOfTruthMatchesWriter({ confirmed: "wordpress" } as never, "wordpress")
  ).toBe(true);
  expect(
    isOperationAutopilotReady(
      {
        primary_writer: "wordpress",
        site_capabilities: {
          upsert_page: { state: "stale", writer: "wordpress", reason: "x", certified_at: "2026-01-01T00:00:00Z" },
        },
        source_of_truth: { confirmed: "wordpress" },
      },
      "upsert_page"
    )
  ).toBe(false);
});

test("reconnect of the same writer keeps confirmed SoT in detectAndStoreSourceOfTruth source", () => {
  // Pin the contract in source: confirmed is preserved when writer matches.
  const src = read("lib/execution/source-of-truth.ts");
  expect(src).toMatch(/sameWriter \? current\.confirmed : null/);
  expect(src).toMatch(/markCertifiedOperationsStale/);
});
