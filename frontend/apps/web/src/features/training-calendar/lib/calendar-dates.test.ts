import { describe, expect, it } from "vitest";

import {
  getMonthGridRange,
  parseDateKey,
  startOfMonth,
  toDateKey,
  toScheduledAt,
  toTimeValue,
} from "./calendar-dates";

describe("calendar dates", () => {
  it("round-trips local date keys", () => {
    const date = new Date(2026, 9, 7, 18, 45);

    expect(toDateKey(date)).toBe("2026-10-07");
    expect(parseDateKey("2026-10-07")?.getTime()).toBe(
      new Date(2026, 9, 7).getTime(),
    );
  });

  it.each(["", "2026-13-01", "2026-02-30", "07.10.2026", null])(
    "rejects malformed date key %s",
    (value) => {
      expect(parseDateKey(value)).toBeNull();
    },
  );

  it("combines a local day and time into an ISO instant", () => {
    const iso = toScheduledAt("2026-10-07", "06:30");

    expect(iso).toBe(new Date(2026, 9, 7, 6, 30).toISOString());
    expect(toTimeValue(new Date(iso as string))).toBe("06:30");
  });

  it("refuses an invalid time", () => {
    expect(toScheduledAt("2026-10-07", "24:00")).toBeNull();
    expect(toScheduledAt("2026-10-07", "")).toBeNull();
  });

  it("covers the outside days of the month grid", () => {
    expect(getMonthGridRange(new Date(2026, 9, 15))).toEqual({
      from: "2026-09-25",
      to: "2026-11-06",
    });
  });

  it("finds the first day of the month", () => {
    expect(toDateKey(startOfMonth(new Date(2026, 1, 28)))).toBe("2026-02-01");
  });
});
