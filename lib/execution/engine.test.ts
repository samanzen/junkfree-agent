import { beforeEach, expect, test, vi } from "vitest";
import { webhookAdapter } from "./adapters/webhook";
import { wordpressAdapter } from "./adapters/wordpress";

const getBrandById = vi.fn();
const findConnectedIntegration = vi.fn();
const getDecryptedCredentials = vi.fn();
const getIntegration = vi.fn();
const integrationsReachable = vi.fn();
const persistUpdate = vi.fn(async () => ({ error: null }));

vi.mock("../brands", () => ({
  getBrandById: (id: string) => getBrandById(id),
}));

vi.mock("../integrations", () => ({
  findConnectedIntegration: (...args: unknown[]) => findConnectedIntegration(...args),
  getDecryptedCredentials: (...args: unknown[]) => getDecryptedCredentials(...args),
  getIntegration: (...args: unknown[]) => getIntegration(...args),
  integrationsReachable: () => integrationsReachable(),
}));

vi.mock("../supabase", () => ({
  db: {
    from: () => ({
      update: () => ({
        eq: () => persistUpdate(),
      }),
    }),
  },
}));

const { resolvePublishTarget } = await import("./engine");

function row(provider: "wordpress" | "shopify" | "webhook", status: "connected" | "disconnected" = "connected") {
  return {
    id: `${provider}-row`,
    brand_id: "b1",
    provider,
    status,
    metadata: { endpointUrl: "https://example.com/api" },
    last_connected_at: null,
    last_error: null,
    created_at: "",
    updated_at: "",
  };
}

beforeEach(() => {
  getBrandById.mockReset();
  findConnectedIntegration.mockReset();
  getDecryptedCredentials.mockReset();
  getIntegration.mockReset();
  integrationsReachable.mockReset();
  persistUpdate.mockClear();
  integrationsReachable.mockResolvedValue({ ok: true, reason: null });
  getDecryptedCredentials.mockResolvedValue({ signingSecret: "x".repeat(32) });
});

test("a pinned webhook ignores a leftover WordPress row", async () => {
  getBrandById.mockResolvedValue({ id: "b1", primary_writer: "webhook", site_capabilities: {} });
  getIntegration.mockResolvedValue(row("webhook"));
  findConnectedIntegration.mockResolvedValue(row("wordpress"));

  const target = await resolvePublishTarget("b1");
  expect(target.ok).toBe(true);
  if (target.ok) {
    expect(target.platform).toBe("webhook");
    expect(target.adapter).toBe(webhookAdapter);
  }
  expect(findConnectedIntegration).not.toHaveBeenCalled();
});

test("a pinned writer that is disconnected does not fall through", async () => {
  getBrandById.mockResolvedValue({ id: "b1", primary_writer: "webhook" });
  getIntegration.mockResolvedValue(row("webhook", "disconnected"));
  findConnectedIntegration.mockResolvedValue(row("wordpress"));

  const target = await resolvePublishTarget("b1");
  expect(target.ok).toBe(false);
  if (!target.ok) {
    expect(target.code).toBe("not_configured");
    expect(target.reason).toMatch(/webhook/);
  }
  expect(findConnectedIntegration).not.toHaveBeenCalled();
});

test("an unpinned brand uses the connected writer and pins it", async () => {
  getBrandById.mockResolvedValue({ id: "b1", primary_writer: null, site_capabilities: {} });
  findConnectedIntegration.mockResolvedValue(row("wordpress"));
  getDecryptedCredentials.mockResolvedValue({ username: "a", applicationPassword: "b" });

  const target = await resolvePublishTarget("b1");
  expect(target.ok).toBe(true);
  if (target.ok) expect(target.adapter).toBe(wordpressAdapter);
  expect(persistUpdate).toHaveBeenCalled();
});
