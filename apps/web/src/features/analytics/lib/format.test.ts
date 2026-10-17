import { describe, expect, it } from "vitest";

import {
  formatCompact,
  formatPercent,
  formatSigned,
  formatSince,
  trendOf,
} from "./format";

describe("analytics format", () => {
  it("compacts only large numbers", () => {
    expect(formatCompact(9_999, "en")).toBe("9,999");
    expect(formatCompact(18_420, "en")).toBe("18.4K");
    expect(formatCompact(null, "en")).toBe("—");
  });

  it("formats percentages and signed changes", () => {
    expect(formatPercent(63.84, "en")).toBe("63.8%");
    expect(formatSigned(8.4, "en", "%")).toBe("+8.4%");
    expect(formatSigned(-6.2, "en", "%")).toBe("−6.2%");
    expect(formatSigned(0, "en")).toBe("0");
  });

  it("classifies a change as up, down or flat", () => {
    expect(trendOf(3)).toBe("up");
    expect(trendOf(-3)).toBe("down");
    expect(trendOf(0.2)).toBe("flat");
    expect(trendOf(null)).toBe("flat");
  });

  it("describes how long ago something started", () => {
    const now = Date.parse("2026-10-17T12:00:00Z");
    expect(formatSince("2026-10-17T11:56:00Z", "en", now)).toBe("4 min. ago");
    expect(formatSince("2026-10-17T07:00:00Z", "en", now)).toBe("5 hr. ago");
    expect(formatSince("2026-10-07T12:00:00Z", "en", now)).toBe("10 days ago");
  });
});
