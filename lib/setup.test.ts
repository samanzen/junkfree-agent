import { describe, expect, test } from "vitest";
import { buildSetupProgress } from "./setup";

describe("buildSetupProgress", () => {
  test("new brand with only business details points at Search Console", () => {
    const p = buildSetupProgress({
      hasBrand: true,
      hasSiteUrl: true,
      hasGsc: false,
      hasIntelligence: false,
      hasPublishing: false,
      hasFirstApproval: false,
    });
    expect(p.next).toBe("search_console");
    expect(p.complete).toBe(false);
    expect(p.steps.find((s) => s.key === "business")?.done).toBe(true);
  });

  test("full chain marks operating complete", () => {
    const p = buildSetupProgress({
      hasBrand: true,
      hasSiteUrl: true,
      hasGsc: true,
      hasIntelligence: true,
      hasPublishing: true,
      hasFirstApproval: true,
    });
    expect(p.complete).toBe(true);
    expect(p.next).toBeNull();
    expect(p.doneCount).toBe(6);
  });

  test("publishing without approval is not operating", () => {
    const p = buildSetupProgress({
      hasBrand: true,
      hasSiteUrl: true,
      hasGsc: true,
      hasIntelligence: true,
      hasPublishing: true,
      hasFirstApproval: false,
    });
    expect(p.next).toBe("first_approval");
    expect(p.steps.find((s) => s.key === "operating")?.done).toBe(false);
  });
});
