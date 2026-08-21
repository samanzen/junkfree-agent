import { expect, test } from "vitest";
import { isBuyerIntentQuery, OUTCOME_LAG_DAYS, scoreOutcome } from "./index";

test("buyer-intent drops free and flagged terms", () => {
  expect(isBuyerIntentQuery("junk removal toronto")).toBe(true);
  expect(isBuyerIntentQuery("free junk removal")).toBe(false);
  expect(isBuyerIntentQuery("what is junk")).toBe(false);
  expect(isBuyerIntentQuery("junk pickup", "pickup")).toBe(false);
});

test("too soon before the lag window", () => {
  const scored = scoreOutcome(null, { position: 12, clicks: 4, impressions: 40, captured_date: "2026-08-20" }, {
    keyword: "junk removal",
    buyerIntent: true,
    lagDays: 3,
  });
  expect(scored.verdict).toBe("too_soon");
  expect(scored.lesson).toContain(String(OUTCOME_LAG_DAYS));
});

test("more clicks on a hire-ready query is a win", () => {
  const scored = scoreOutcome(
    { position: 14, clicks: 2, impressions: 80, captured_date: "2026-07-01" },
    { position: 8, clicks: 11, impressions: 90, captured_date: "2026-08-20" },
    { keyword: "junk removal toronto", buyerIntent: true, lagDays: 21 }
  );
  expect(scored.verdict).toBe("won");
  expect(scored.lesson).toMatch(/Keep doing this/);
});

test("lost ground writes a drop lesson", () => {
  const scored = scoreOutcome(
    { position: 6, clicks: 20, impressions: 200, captured_date: "2026-07-01" },
    { position: 18, clicks: 4, impressions: 180, captured_date: "2026-08-20" },
    { keyword: "junk removal toronto", buyerIntent: true, lagDays: 21 }
  );
  expect(scored.verdict).toBe("lost");
  expect(scored.lesson).toMatch(/Drop or rewrite/);
});

test("non-buyer traffic is not treated as a win", () => {
  const scored = scoreOutcome(
    { position: 20, clicks: 0, impressions: 10, captured_date: "2026-07-01" },
    { position: 4, clicks: 40, impressions: 400, captured_date: "2026-08-20" },
    { keyword: "free junk removal", buyerIntent: false, lagDays: 21 }
  );
  expect(scored.verdict).toBe("not_buyer");
});
