import { describe, expect, it } from "vitest";

import { formatDate, isLocale, resolveStoredLocale } from "./index";

describe("i18n lookup helpers", () => {
  describe("isLocale", () => {
    it("accepts supported locales", () => {
      expect(isLocale("ru")).toBe(true);
      expect(isLocale("en")).toBe(true);
    });

    it("rejects unsupported values", () => {
      expect(isLocale("fr")).toBe(false);
      expect(isLocale(null)).toBe(false);
      expect(isLocale(undefined)).toBe(false);
      expect(isLocale(42)).toBe(false);
    });
  });

  describe("resolveStoredLocale", () => {
    it("returns the default locale when storage is empty", () => {
      expect(resolveStoredLocale()).toBe("en");
    });

    it("returns the persisted locale", () => {
      window.localStorage.setItem("trefix_admin_locale", "ru");
      expect(resolveStoredLocale()).toBe("ru");
      window.localStorage.removeItem("trefix_admin_locale");
    });

    it("falls back to the default locale on unknown values", () => {
      window.localStorage.setItem("trefix_admin_locale", "fr");
      expect(resolveStoredLocale()).toBe("en");
      window.localStorage.removeItem("trefix_admin_locale");
    });
  });
});

describe("formatDate", () => {
  const date = new Date("2026-10-02T12:30:00.000Z");

  it("formats dates with the russian locale", () => {
    const result = formatDate(date, "ru");
    expect(result).toContain("2026");
    expect(result).not.toBe("—");
  });

  it("formats dates with the english locale", () => {
    const result = formatDate(date, "en");
    expect(result).toContain("2026");
    expect(result).not.toBe("—");
  });

  it("formats ISO strings", () => {
    expect(formatDate("2026-10-02T12:30:00.000Z", "en")).not.toBe("—");
  });

  it("returns a dash for null and undefined", () => {
    expect(formatDate(null, "en")).toBe("—");
    expect(formatDate(undefined, "en")).toBe("—");
  });

  it("returns a dash for invalid date strings", () => {
    expect(formatDate("not-a-date", "en")).toBe("—");
  });
});
