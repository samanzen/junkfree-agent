import { afterEach, expect, test, vi } from "vitest";

const executeChange = vi.fn();
const resolvePublishTarget = vi.fn();
const checkCertificationPage = vi.fn();
const patchOperationCapability = vi.fn();
const enqueue = vi.fn();
const getBrandById = vi.fn();

vi.mock("../queue", () => ({
  enqueue: (...args: unknown[]) => enqueue(...args),
}));

vi.mock("../brands", () => ({
  getBrandById: (id: string) => getBrandById(id),
}));

vi.mock("./engine", () => ({
  executeChange: (...args: unknown[]) => executeChange(...args),
  resolvePublishTarget: (...args: unknown[]) => resolvePublishTarget(...args),
}));

vi.mock("../publish-check", () => ({
  absolutePageUrl: (site: string, path: string) => `${site.replace(/\/$/, "")}/${path.replace(/^\//, "")}`,
  checkCertificationPage: (...args: unknown[]) => checkCertificationPage(...args),
}));

vi.mock("./site-capabilities", async () => {
  const actual = await vi.importActual<typeof import("./site-capabilities")>("./site-capabilities");
  return {
    ...actual,
    patchOperationCapability: (...args: unknown[]) => patchOperationCapability(...args),
  };
});

const { stepCertify, newCanary, publicCanaryUrl, orphanCanariesFromRows, isCanarySlug } = await import("./certify");

afterEach(() => {
  executeChange.mockReset();
  resolvePublishTarget.mockReset();
  checkCertificationPage.mockReset();
  patchOperationCapability.mockReset();
  enqueue.mockReset();
  getBrandById.mockReset();
});

const brand = {
  id: "b1",
  slug: "acme",
  name: "Acme",
  site_url: "https://acme.test",
  primary_writer: "webhook" as const,
  source_of_truth: { confirmed: "application_database" },
  site_capabilities: {
    upsert_page: { state: "supported_unverified", writer: "webhook", reason: "x", certified_at: null },
  },
};

const adapter = {
  capabilities: ["upsert_page"],
  check: vi.fn(async () => ({ ok: true, detail: "ok" })),
};

function canary() {
  return {
    slug: "seo-cert-deadbeef",
    title: "Publishing test CT-aaa",
    titleToken: "CT-aaa",
    bodyToken: "CB-bbb",
    bodyMarkdown: "CB-bbb",
    phase: "write" as const,
  };
}

test("Shopify canary URL is the customer storefront, not myshopify", () => {
  const url = publicCanaryUrl(
    { site_url: "https://www.shop.test" } as never,
    "shopify",
    "seo-cert-ab",
    "https://store.myshopify.com/pages/seo-cert-ab"
  );
  expect(url).toBe("https://www.shop.test/pages/seo-cert-ab");
});

test("new canaries carry unique tokens and a noindex hint", () => {
  const a = newCanary();
  const b = newCanary();
  expect(a.slug).toMatch(/^seo-cert-[a-f0-9]{8}$/);
  expect(a.titleToken).not.toBe(b.titleToken);
  expect(a.bodyMarkdown).toMatch(/noindex/);
});

test("a full write-verify-delete-gone sequence certifies upsert_page", async () => {
  getBrandById.mockResolvedValue(brand);
  resolvePublishTarget.mockResolvedValue({
    ok: true,
    platform: "webhook",
    adapter,
    credentials: {},
    config: {},
  });
  executeChange
    .mockResolvedValueOnce({
      status: "succeeded",
      platform: "webhook",
      url: "/seo-cert-deadbeef",
      remoteId: "seo-cert-deadbeef",
      executionId: "ex1",
    })
    .mockResolvedValueOnce({
      status: "succeeded",
      platform: "webhook",
      url: null,
      remoteId: "seo-cert-deadbeef",
      executionId: "ex2",
    });
  checkCertificationPage
    .mockResolvedValueOnce({ ok: true, url: "https://acme.test/seo-cert-deadbeef", reason: "present", liveTitle: "x", liveWords: 3 })
    .mockResolvedValueOnce({ ok: true, url: "https://acme.test/seo-cert-deadbeef", reason: "absent", liveTitle: null, liveWords: 0 });

  await stepCertify(brand as never, canary());

  expect(executeChange.mock.calls[0][1]).toMatchObject({ type: "upsert_page", slug: "seo-cert-deadbeef" });
  expect(executeChange.mock.calls[1][1]).toMatchObject({ type: "delete_page" });
  expect(patchOperationCapability).toHaveBeenCalledWith(
    "b1",
    "upsert_page",
    expect.objectContaining({ state: "certified", writer: "webhook", last_execution_id: "ex1" })
  );
});

test("a fake Origin write that never appears on production is not certified", async () => {
  getBrandById.mockResolvedValue(brand);
  resolvePublishTarget.mockResolvedValue({
    ok: true,
    platform: "webhook",
    adapter,
    credentials: {},
    config: {},
  });
  executeChange.mockResolvedValue({
    status: "succeeded",
    platform: "webhook",
    url: "/seo-cert-deadbeef",
    remoteId: "x",
    executionId: "ex1",
  });
  checkCertificationPage.mockResolvedValue({
    ok: false,
    url: "https://acme.test/seo-cert-deadbeef",
    reason: "missing",
    liveTitle: null,
    liveWords: 0,
  });

  await expect(stepCertify(brand as never, { ...canary(), phaseAttempts: 2 })).rejects.toThrow(/missing|stepCertify/);
  expect(patchOperationCapability).toHaveBeenCalledWith(
    "b1",
    "upsert_page",
    expect.objectContaining({ state: "supported_unverified" })
  );
  expect(patchOperationCapability.mock.calls.some((c: unknown[]) => (c[2] as { state?: string }).state === "certified")).toBe(
    false
  );
});

test("rollback failure prevents certification", async () => {
  getBrandById.mockResolvedValue(brand);
  resolvePublishTarget.mockResolvedValue({
    ok: true,
    platform: "webhook",
    adapter,
    credentials: {},
    config: {},
  });
  executeChange
    .mockResolvedValueOnce({
      status: "succeeded",
      platform: "webhook",
      url: "/seo-cert-deadbeef",
      remoteId: "x",
      executionId: "ex1",
    })
    .mockResolvedValueOnce({
      status: "failed",
      platform: "webhook",
      error: "cannot delete",
      retryable: false,
      executionId: "ex2",
    });
  checkCertificationPage.mockResolvedValue({
    ok: true,
    url: "https://acme.test/seo-cert-deadbeef",
    reason: "present",
    liveTitle: "x",
    liveWords: 3,
  });

  await expect(stepCertify(brand as never, canary())).rejects.toThrow(/cannot delete/);
  expect(patchOperationCapability).toHaveBeenCalledWith(
    "b1",
    "upsert_page",
    expect.objectContaining({ state: "supported_unverified" })
  );
});

test("missing Source of Truth confirmation refuses certification", async () => {
  await expect(
    stepCertify({ ...brand, source_of_truth: {} } as never, canary())
  ).rejects.toThrow(/Confirm where new pages/);
});

test("only seo-cert canary slugs are reclaimed", () => {
  expect(isCanarySlug("seo-cert-deadbeef")).toBe(true);
  expect(isCanarySlug("about-us")).toBe(false);
  const rows = orphanCanariesFromRows([
    {
      id: "e1",
      target: "seo-cert-deadbeef",
      remote_id: "gid://shopify/Page/1",
      previous: { canary: true, titleToken: "CT-x" },
      rollback_status: "available",
    },
    {
      id: "e2",
      target: "about-us",
      remote_id: "99",
      previous: { canary: true },
      rollback_status: "available",
    },
    {
      id: "e3",
      target: "seo-cert-aaaaaaaa",
      previous: { title: "real page" },
      rollback_status: "available",
    },
  ]);
  expect(rows).toEqual([{ executionId: "e1", slug: "seo-cert-deadbeef", remoteId: "gid://shopify/Page/1" }]);
});

test("a Source-of-Truth change mid-certification deletes the leftover canary", async () => {
  getBrandById.mockResolvedValue({ ...brand, source_of_truth: {} });
  executeChange.mockResolvedValue({
    status: "succeeded",
    platform: "webhook",
    url: null,
    remoteId: "seo-cert-deadbeef",
    executionId: "ex-del",
  });

  await expect(
    stepCertify(
      { ...brand, source_of_truth: {} } as never,
      { ...canary(), phase: "verify_write", remoteId: "seo-cert-deadbeef", executionId: "ex1" }
    )
  ).rejects.toThrow(/Confirm where new pages/);

  expect(executeChange).toHaveBeenCalledWith(
    expect.anything(),
    { type: "delete_page", slug: "seo-cert-deadbeef", remoteId: "seo-cert-deadbeef" },
    expect.anything()
  );
  expect(patchOperationCapability.mock.calls.some((c: unknown[]) => (c[2] as { state?: string }).state === "certified")).toBe(
    false
  );
});

test("a write-phase job does not delete before the canary exists", async () => {
  await expect(
    stepCertify({ ...brand, source_of_truth: {} } as never, canary())
  ).rejects.toThrow(/Confirm where new pages/);
  expect(executeChange).not.toHaveBeenCalled();
});
