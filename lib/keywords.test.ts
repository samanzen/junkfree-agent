import { describe, expect, it } from "vitest";
import {
  buildPositionMetricsMap,
  computePositionChange,
  isKeywordDbSort,
  isKeywordMetricSort,
  metricsFromPositionHistory,
  pickLatestAndPrevious,
  shortLandingPath,
  sortKeywordRows,
  type PositionRow,
} from "./keywords";

function row(partial: Partial<PositionRow> & Pick<PositionRow, "keyword_id" | "captured_date">): PositionRow {
  return {
    position: null,
    clicks: null,
    impressions: null,
    ctr: null,
    landing_page: null,
    ...partial,
  };
}

describe("pickLatestAndPrevious", () => {
  it("returns nulls for empty history", () => {
    expect(pickLatestAndPrevious([])).toEqual({ latest: null, previous: null });
  });

  it("takes the first row as latest and next distinct date as previous", () => {
    const rows = [
      row({ keyword_id: "a", captured_date: "2026-08-12", position: 5 }),
      row({ keyword_id: "a", captured_date: "2026-08-11", position: 8 }),
      row({ keyword_id: "a", captured_date: "2026-08-10", position: 9 }),
    ];
    const { latest, previous } = pickLatestAndPrevious(rows);
    expect(latest?.position).toBe(5);
    expect(previous?.position).toBe(8);
    expect(previous?.captured_date).toBe("2026-08-11");
  });
});

describe("computePositionChange", () => {
  it("is positive when rank improves (number goes down)", () => {
    expect(computePositionChange(3, 7)).toBe(4);
  });

  it("is negative when rank declines", () => {
    expect(computePositionChange(12, 8)).toBe(-4);
  });

  it("returns null when either side is missing", () => {
    expect(computePositionChange(null, 5)).toBeNull();
    expect(computePositionChange(5, null)).toBeNull();
  });
});

describe("metricsFromPositionHistory", () => {
  it("fills Semrush-style fields from latest + previous captures", () => {
    const m = metricsFromPositionHistory([
      row({
        keyword_id: "a",
        captured_date: "2026-08-12",
        position: 4,
        clicks: 20,
        impressions: 400,
        ctr: 0.05,
        landing_page: "https://example.com/services",
      }),
      row({
        keyword_id: "a",
        captured_date: "2026-08-05",
        position: 9,
        clicks: 10,
        impressions: 300,
        ctr: 0.03,
        landing_page: "https://example.com/old",
      }),
    ]);
    expect(m.position).toBe(4);
    expect(m.previous_position).toBe(9);
    expect(m.position_change).toBe(5);
    expect(m.clicks).toBe(20);
    expect(m.ctr).toBe(0.05);
    expect(m.landing_page).toContain("/services");
    expect(m.captured_date).toBe("2026-08-12");
    expect(m.previous_captured_date).toBe("2026-08-05");
  });

  it("leaves change null when only one capture exists", () => {
    const m = metricsFromPositionHistory([
      row({ keyword_id: "a", captured_date: "2026-08-12", position: 2 }),
    ]);
    expect(m.position).toBe(2);
    expect(m.previous_position).toBeNull();
    expect(m.position_change).toBeNull();
  });
});

describe("buildPositionMetricsMap", () => {
  it("groups mixed keyword rows and sorts within each keyword", () => {
    const map = buildPositionMetricsMap([
      row({ keyword_id: "b", captured_date: "2026-08-10", position: 15 }),
      row({ keyword_id: "a", captured_date: "2026-08-11", position: 6 }),
      row({ keyword_id: "a", captured_date: "2026-08-12", position: 4 }),
      row({ keyword_id: "b", captured_date: "2026-08-12", position: 11 }),
    ]);
    expect(map.get("a")?.position).toBe(4);
    expect(map.get("a")?.previous_position).toBe(6);
    expect(map.get("a")?.position_change).toBe(2);
    expect(map.get("b")?.position).toBe(11);
    expect(map.get("b")?.position_change).toBe(4);
  });
});

describe("sortKeywordRows", () => {
  it("sorts by position ascending with nulls last", () => {
    const rows = sortKeywordRows(
      [{ id: "1", position: 10 }, { id: "2", position: null }, { id: "3", position: 3 }],
      "position",
      true,
    );
    expect(rows.map((r) => r.id)).toEqual(["3", "1", "2"]);
  });

  it("sorts by position_change descending", () => {
    const rows = sortKeywordRows(
      [
        { id: "1", position_change: 2 },
        { id: "2", position_change: 8 },
        { id: "3", position_change: -3 },
      ],
      "position_change",
      false,
    );
    expect(rows.map((r) => r.id)).toEqual(["2", "1", "3"]);
  });
});

describe("shortLandingPath", () => {
  it("returns pathname from absolute URLs", () => {
    expect(shortLandingPath("https://acme.com/plumbing/drain-cleaning")).toBe(
      "/plumbing/drain-cleaning",
    );
  });

  it("handles null", () => {
    expect(shortLandingPath(null)).toBeNull();
  });
});

describe("sort allowlists", () => {
  it("classifies db vs metric sorts", () => {
    expect(isKeywordDbSort("search_volume")).toBe(true);
    expect(isKeywordDbSort("position")).toBe(false);
    expect(isKeywordMetricSort("position_change")).toBe(true);
    expect(isKeywordMetricSort("cpc")).toBe(false);
  });
});
