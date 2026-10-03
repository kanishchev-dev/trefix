import { afterEach, describe, expect, it, vi } from "vitest";

import { parseRealtimeSettings, resolveTheme } from "./app-settings-provider";

describe("parseRealtimeSettings", () => {
  it("reads the settings snapshot from the realtime envelope", () => {
    const payload = {
      event: "settings.updated",
      data: {
        settings: {
          defaultGroups: [],
          defaultPermissions: [],
          theme: "dark",
          locale: "ru",
        },
        updatedAt: "2026-10-02T12:00:00.000Z",
      },
      meta: { audience: "room", target: "settings" },
    };

    expect(parseRealtimeSettings(payload)).toEqual({ theme: "dark", locale: "ru" });
  });

  it("accepts a flat payload without the envelope", () => {
    expect(
      parseRealtimeSettings({ settings: { theme: "light", locale: "en" } }),
    ).toEqual({ theme: "light", locale: "en" });
  });

  it("ignores unsupported theme and locale values", () => {
    expect(
      parseRealtimeSettings({ data: { settings: { theme: "sepia", locale: "fr" } } }),
    ).toEqual({ theme: undefined, locale: undefined });
  });

  it("returns null for non-object payloads", () => {
    expect(parseRealtimeSettings(null)).toBeNull();
    expect(parseRealtimeSettings(undefined)).toBeNull();
    expect(parseRealtimeSettings("nope")).toBeNull();
    expect(parseRealtimeSettings(42)).toBeNull();
  });

  it("yields nothing to apply when the payload carries no settings", () => {
    const nothing = { theme: undefined, locale: undefined };
    expect(parseRealtimeSettings({})).toEqual(nothing);
    expect(parseRealtimeSettings({ data: {} })).toEqual(nothing);
    expect(parseRealtimeSettings({ data: { settings: null } })).toEqual(nothing);
  });

  it("accepts the system theme mode", () => {
    expect(
      parseRealtimeSettings({ data: { settings: { theme: "system" } } }),
    ).toEqual({ theme: "system", locale: undefined });
  });
});

describe("resolveTheme", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubPrefersDark(matches: boolean) {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  it("passes explicit modes through unchanged", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  it("resolves system against the OS preference", () => {
    stubPrefersDark(true);
    expect(window.matchMedia).toBeTypeOf("function");
    expect(resolveTheme("system")).toBe("dark");

    stubPrefersDark(false);
    expect(resolveTheme("system")).toBe("light");
  });

  it("falls back to light when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(resolveTheme("system")).toBe("light");
    window.matchMedia = originalMatchMedia;
  });
});