import { describe, expect, test } from "vitest";
import {
  aggregateWindow,
  attributeAction,
  judgeWindows,
  summariseOutcomes,
  MIN_JUDGMENT_DAYS,
  MIN_WINDOW_IMPRESSIONS,
  type DailyMetric,
  type AttributedOutcome,
} from "./outcomes";

function series(
  start: string,
  days: number,
  opts: { position: number; clicks: number; impressions: number },
): DailyMetric[] {
  const out: DailyMetric[] = [];
  const d0 = new Date(start + "T12:00:00Z");
  for (let i = 0; i < days; i++) {
    const d = new Date(d0);
    d.setUTCDate(d0.getUTCDate() + i);
    const date = d.toISOString().slice(0, 10);
    out.push({
      date,
      position: opts.position,
      clicks: opts.clicks,
      impressions: opts.impressions,
      ctr: opts.impressions ? opts.clicks / opts.impressions : 0,
    });
  }
  return out;
}

describe("aggregateWindow", () => {
  test("weights position by impressions", () => {
    const w = aggregateWindow([
      { date: "2026-01-01", position: 10, clicks: 1, impressions: 90, ctr: 0.011 },
      { date: "2026-01-02", position: 4, clicks: 1, impressions: 10, ctr: 0.1 },
    ]);
    expect(w.position).toBe(9.4);
    expect(w.clicks).toBe(2);
    expect(w.impressions).toBe(100);
  });
});

describe("judgeWindows", () => {
  test("refuses to judge before GSC lag + measure buffer", () => {
    const r = judgeWindows(
      { position: 12, clicks: 40, impressions: 400, ctr: 0.1, days: 14 },
      { position: 8, clicks: 60, impressions: 400, ctr: 0.15, days: 7 },
      MIN_JUDGMENT_DAYS - 1,
      true,
    );
    expect(r.status).toBe("too_early");
  });

  test("marks thin impressions as insufficient_data", () => {
    const r = judgeWindows(
      { position: 12, clicks: 2, impressions: MIN_WINDOW_IMPRESSIONS - 1, ctr: 0.1, days: 14 },
      { position: 8, clicks: 3, impressions: MIN_WINDOW_IMPRESSIONS - 1, ctr: 0.15, days: 14 },
      MIN_JUDGMENT_DAYS + 2,
      true,
    );
    expect(r.status).toBe("insufficient_data");
  });

  test("detects an honest position improvement", () => {
    const r = judgeWindows(
      { position: 14, clicks: 20, impressions: 400, ctr: 0.05, days: 14 },
      { position: 9, clicks: 35, impressions: 420, ctr: 0.083, days: 14 },
      MIN_JUDGMENT_DAYS + 5,
      true,
    );
    expect(r.status).toBe("improved");
    expect(r.deltas?.position).toBe(5);
  });

  test("detects a decline", () => {
    const r = judgeWindows(
      { position: 8, clicks: 40, impressions: 400, ctr: 0.1, days: 14 },
      { position: 16, clicks: 10, impressions: 400, ctr: 0.025, days: 14 },
      MIN_JUDGMENT_DAYS + 5,
      true,
    );
    expect(r.status).toBe("declined");
  });

  test("unlinked actions stay unlinked", () => {
    const r = judgeWindows(null, null, 40, false);
    expect(r.status).toBe("unlinked");
  });
});

describe("attributeAction", () => {
  test("builds before/after windows around the publish day", () => {
    const actionDay = "2026-06-15";
    const before = series("2026-06-01", 14, { position: 18, clicks: 3, impressions: 40 });
    const after = series("2026-06-18", 14, { position: 11, clicks: 8, impressions: 45 });
    const history = [...before, ...after];
    const now = new Date("2026-07-10T12:00:00Z");

    const result = attributeAction(
      {
        id: "a1",
        occurredAt: actionDay + "T10:00:00Z",
        eventType: "content_update",
        eventLabel: "Published to wordpress",
        keyword: "junk removal near me",
        pageUrl: "https://example.com/junk-removal",
      },
      history,
      now,
    );

    expect(result.status).toBe("improved");
    expect(result.before?.position).toBe(18);
    expect(result.after?.position).toBe(11);
  });
});

describe("summariseOutcomes", () => {
  test("counts each status", () => {
    const items = [
      { status: "improved" },
      { status: "improved" },
      { status: "too_early" },
      { status: "unchanged" },
    ] as AttributedOutcome[];
    expect(summariseOutcomes(items)).toMatchObject({
      improved: 2,
      too_early: 1,
      unchanged: 1,
      total: 4,
    });
  });
});
