import { expect, test } from "vitest";
import { buildRollbackChange } from "./rollback";

test("a create with no previous rolls back by deleting the page", () => {
  const change = buildRollbackChange({
    change_type: "upsert_page",
    target: "seo-cert-ab12",
    previous: null,
    remote_id: "gid://shopify/Page/9",
  });
  expect(change).toEqual({
    type: "delete_page",
    slug: "seo-cert-ab12",
    remoteId: "gid://shopify/Page/9",
  });
});

test("a canary marker rolls back by deleting even if leftover fields exist", () => {
  const change = buildRollbackChange({
    change_type: "upsert_page",
    target: "seo-cert-ab12",
    previous: { canary: true, titleToken: "CT-x", bodyToken: "CB-y" },
    remote_id: "42",
  });
  expect(change?.type).toBe("delete_page");
});

test("WordPress HTML previous is still not restored via upsert_page", () => {
  const change = buildRollbackChange({
    change_type: "upsert_page",
    target: "about",
    previous: { id: 1, title: "Old", content: "<p>html</p>" },
    remote_id: "1",
  });
  expect(change).toBeNull();
});

test("markdown previous still restores via upsert_page", () => {
  const change = buildRollbackChange({
    change_type: "upsert_page",
    target: "about",
    previous: { title: "Old", bodyMarkdown: "Hello" },
  });
  expect(change).toMatchObject({ type: "upsert_page", title: "Old", bodyMarkdown: "Hello" });
});
