import { describe, it, expect } from "vitest";
import { resolveDateRange, buildMonthBuckets } from "../dateRange";

describe("resolveDateRange", () => {
  const today = new Date("2026-09-09T00:00:00.000Z");

  it("defaults to the last 6 calendar months when preset is absent", () => {
    const range = resolveDateRange(undefined, undefined, undefined, today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("resolves the 12m preset to 12 calendar months back", () => {
    const range = resolveDateRange("12m", undefined, undefined, today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2025-10-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("resolves the ytd preset to January 1st of the current year", () => {
    const range = resolveDateRange("ytd", undefined, undefined, today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("resolves a valid custom range from the given from/to", () => {
    const range = resolveDateRange("custom", "2026-02-01", "2026-05-15", today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-02-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-05-15");
  });

  it("falls back to the 6-month default when custom 'from' is missing", () => {
    const range = resolveDateRange("custom", undefined, "2026-05-15", today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(range.to.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("falls back to the 6-month default when custom 'from' is after 'to'", () => {
    const range = resolveDateRange("custom", "2026-06-01", "2026-01-01", today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("falls back to the 6-month default when custom dates are unparseable", () => {
    const range = resolveDateRange("custom", "not-a-date", "2026-05-15", today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("falls back to the 6-month default for an unrecognized preset", () => {
    const range = resolveDateRange("not-a-preset", undefined, undefined, today);
    expect(range.from.toISOString().slice(0, 10)).toBe("2026-04-01");
  });
});

describe("buildMonthBuckets", () => {
  const today = new Date("2026-09-09T00:00:00.000Z");

  it("builds one bucket per full month plus a truncated final bucket ending at 'to'", () => {
    const range = resolveDateRange("6m", undefined, undefined, today);
    const buckets = buildMonthBuckets(range);

    expect(buckets.map((b) => b.label)).toEqual(["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    expect(buckets[0].bucketEnd.toISOString().slice(0, 10)).toBe("2026-04-30");
    expect(buckets[4].bucketEnd.toISOString().slice(0, 10)).toBe("2026-08-31");
    expect(buckets[5].bucketEnd.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("builds a single bucket when from and to fall in the same month", () => {
    const range = { from: new Date("2026-09-01T00:00:00.000Z"), to: new Date("2026-09-09T00:00:00.000Z") };
    const buckets = buildMonthBuckets(range);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].label).toBe("2026-09");
    expect(buckets[0].bucketEnd.toISOString().slice(0, 10)).toBe("2026-09-09");
  });

  it("handles a range spanning a year boundary", () => {
    const range = { from: new Date("2025-11-01T00:00:00.000Z"), to: new Date("2026-01-15T00:00:00.000Z") };
    const buckets = buildMonthBuckets(range);
    expect(buckets.map((b) => b.label)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(buckets[0].bucketEnd.toISOString().slice(0, 10)).toBe("2025-11-30");
    expect(buckets[1].bucketEnd.toISOString().slice(0, 10)).toBe("2025-12-31");
    expect(buckets[2].bucketEnd.toISOString().slice(0, 10)).toBe("2026-01-15");
  });
});
