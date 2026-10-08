import { describe, expect, it } from "vitest";

import {
  formatDuration,
  formatPace,
  parseDuration,
  parsePace,
} from "./plan-format";

describe("plan format", () => {
  it("round-trips paces", () => {
    expect(formatPace(330)).toBe("5:30");
    expect(parsePace("5:30")).toBe(330);
    expect(parsePace("5:75")).toBeNull();
    expect(parsePace("abc")).toBeNull();
  });

  it("round-trips durations with and without hours", () => {
    expect(formatDuration(6300)).toBe("1:45:00");
    expect(formatDuration(1530)).toBe("25:30");
    expect(parseDuration("1:45:00")).toBe(6300);
    expect(parseDuration("25:30")).toBe(1530);
  });

  it.each(["", "1:60:00", "25", "0:00", "1:2:3:4"])(
    "rejects duration %s",
    (value) => {
      expect(parseDuration(value)).toBeNull();
    },
  );
});
