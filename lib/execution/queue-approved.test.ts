import { test, expect, vi, beforeEach } from "vitest";
import { wordpressAdapter } from "./adapters/wordpress";

const enqueue = vi.fn(async () => undefined);
const resolvePublishTarget = vi.fn();

vi.mock("../queue", () => ({ enqueue: (...a: unknown[]) => enqueue(...a) }));
vi.mock("./engine", () => ({
  resolvePublishTarget: (...a: unknown[]) => resolvePublishTarget(...a),
}));

const { queueLivePublishIfConnected } = await import("./queue-approved");

beforeEach(() => {
  enqueue.mockReset();
  resolvePublishTarget.mockReset();
});

const pageDraft = {
  id: "d1",
  task_type: "new_page",
  title: "Page: junk removal cost",
  body: "TITLE TAG: Junk Removal Cost\nMETA: What it costs.\n\n# Heading\n\nReal body text.",
  target_url: null,
  target_keyword: "junk removal cost",
};

test("queues a publish job when WordPress is connected", async () => {
  resolvePublishTarget.mockResolvedValue({
    ok: true,
    platform: "wordpress",
    adapter: wordpressAdapter,
    credentials: {},
    config: {},
  });
  const r = await queueLivePublishIfConnected({ id: "b1", name: "Junk Free" }, pageDraft);
  expect(r).toEqual({ queued: true });
  expect(enqueue).toHaveBeenCalledWith("b1", "publish", { draftId: "d1" });
});

test("does not queue when no last mile is connected", async () => {
  resolvePublishTarget.mockResolvedValue({ ok: false, code: "not_configured", reason: "none" });
  const r = await queueLivePublishIfConnected({ id: "b1", name: "Junk Free" }, pageDraft);
  expect(r).toEqual({ queued: false });
  expect(enqueue).not.toHaveBeenCalled();
});

test("does not queue an audit report", async () => {
  const r = await queueLivePublishIfConnected(
    { id: "b1", name: "Junk Free" },
    { ...pageDraft, task_type: "improve_content", body: '{"score":1,"checks":[]}' }
  );
  expect(r).toEqual({ queued: false });
  expect(resolvePublishTarget).not.toHaveBeenCalled();
  expect(enqueue).not.toHaveBeenCalled();
});

test("human Approve of fix_meta sends metaChoice 0", async () => {
  resolvePublishTarget.mockResolvedValue({
    ok: true,
    platform: "webhook",
    adapter: {
      provider: "webhook",
      label: "Custom",
      capabilities: ["upsert_page", "update_meta"],
      check: async () => ({ ok: true, detail: "" }),
      apply: async () => ({ ok: true, remoteId: null, url: null, previous: null }),
    },
    credentials: {},
    config: {},
  });
  const r = await queueLivePublishIfConnected(
    { id: "b1", name: "Junk Free" },
    {
      id: "d2",
      task_type: "fix_meta",
      title: "Fix meta",
      body: JSON.stringify({ titles: ["A"], metas: ["m"] }),
      target_url: "https://x.test/p",
      target_keyword: null,
    }
  );
  expect(r).toEqual({ queued: true });
  expect(enqueue).toHaveBeenCalledWith("b1", "publish", { draftId: "d2", metaChoice: 0 });
});

test("a thrown enqueue does not fail Approve", async () => {
  resolvePublishTarget.mockResolvedValue({
    ok: true,
    platform: "wordpress",
    adapter: wordpressAdapter,
    credentials: {},
    config: {},
  });
  enqueue.mockRejectedValueOnce(new Error("queue down"));
  const r = await queueLivePublishIfConnected({ id: "b1", name: "Junk Free" }, pageDraft);
  expect(r).toEqual({ queued: false });
});
