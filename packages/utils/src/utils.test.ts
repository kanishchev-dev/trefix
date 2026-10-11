import { describe, expect, it } from "vitest";

import { resolveApiErrorMessage } from "./api-errors";
import {
  formatHoursMinutesSeconds,
  formatMinutesSeconds,
  parseHoursMinutesSeconds,
  parseMinutesSeconds,
} from "./time";
import { formatNumber, paceToDisplay } from "./units";

describe("time", () => {
  it("formats pace and durations", () => {
    expect(formatMinutesSeconds(307.4)).toBe("5:07");
    expect(formatHoursMinutesSeconds(6155)).toBe("1:42:35");
    expect(formatHoursMinutesSeconds(1361)).toBe("22:41");
  });

  it("parses clock strings", () => {
    expect(parseMinutesSeconds("5:07")).toBe(307);
    expect(parseMinutesSeconds("5:7")).toBeNull();
    expect(parseHoursMinutesSeconds("1:42:35")).toBe(6155);
    expect(parseHoursMinutesSeconds("90:00")).toBe(5400);
    expect(parseHoursMinutesSeconds("1:60:00")).toBeNull();
    expect(parseHoursMinutesSeconds("0:00")).toBeNull();
  });
});

describe("units", () => {
  it("converts pace to per-mile and formats numbers by locale", () => {
    expect(Math.round(paceToDisplay(300, "imperial"))).toBe(483);
    expect(formatNumber(72.44, 1, "ru")).toBe("72,4");
  });
});

describe("resolveApiErrorMessage", () => {
  const lookup = {
    byCode: (code: string) =>
      code === "PLAN_NOT_FOUND" ? "Plan is gone" : undefined,
    byStatus: (status: number) => (status === 429 ? "Slow down" : undefined),
    network: "No connection",
    fallback: "Something went wrong",
  };

  it("prefers the code, then the status, then the backend message", () => {
    expect(
      resolveApiErrorMessage(
        { status: 404, code: "PLAN_NOT_FOUND", message: "x" },
        lookup,
      ),
    ).toBe("Plan is gone");
    expect(resolveApiErrorMessage({ status: 429, code: "OTHER" }, lookup)).toBe(
      "Slow down",
    );
    expect(
      resolveApiErrorMessage(
        { status: 400, message: "Сообщение бэкенда" },
        lookup,
      ),
    ).toBe("Сообщение бэкенда");
  });

  it("separates network failures from other errors", () => {
    expect(
      resolveApiErrorMessage(new TypeError("Network request failed"), lookup),
    ).toBe("No connection");
    expect(resolveApiErrorMessage(new Error("boom"), lookup)).toBe(
      "Something went wrong",
    );
  });
});
