import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  getMobileThemeTokens,
  isDarkTheme,
  mobileThemeTokens,
  renderWebThemeCss,
  webThemeVariables,
  withAlpha,
} from "../src";

const COLOR =
  /^(#[0-9a-f]{3}|#[0-9a-f]{6}|#[0-9a-f]{8}|rgba?\([^)]+\)|transparent)$/i;

describe("theme tokens", () => {
  it.each(["light", "dark"] as const)(
    "%s colours are valid CSS colours",
    (mode) => {
      for (const [name, value] of Object.entries(
        mobileThemeTokens[mode].color,
      )) {
        expect(value, name).toMatch(COLOR);
      }
    },
  );

  it("tells the dark theme from the light one", () => {
    expect(isDarkTheme(getMobileThemeTokens("dark"))).toBe(true);
    expect(isDarkTheme(getMobileThemeTokens("light"))).toBe(false);
  });

  it("exposes the same web variables in both modes", () => {
    expect(Object.keys(webThemeVariables("dark")).sort()).toEqual(
      Object.keys(webThemeVariables("light")).sort(),
    );
  });

  it("keeps the generated web theme in sync", () => {
    const committed = readFileSync(
      new URL("../../ui/src/styles/theme.css", import.meta.url),
      "utf8",
    );
    expect(committed).toBe(renderWebThemeCss());
  });
});

describe("withAlpha", () => {
  it("converts short and long hex colours", () => {
    expect(withAlpha("#fff", 0.5)).toBe("rgba(255, 255, 255, 0.5)");
    expect(withAlpha("#102030", 1)).toBe("rgba(16, 32, 48, 1)");
  });

  it("returns other formats unchanged", () => {
    expect(withAlpha("rgba(0, 0, 0, 0.2)", 0.5)).toBe("rgba(0, 0, 0, 0.2)");
  });
});
