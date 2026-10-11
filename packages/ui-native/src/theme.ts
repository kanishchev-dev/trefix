import {
  getMobileThemeTokens,
  type ThemeMode,
  type ThemeTokens,
} from "@workspace/tokens";

/** Controls take the tokens when the screen passes them, otherwise the palette of the mode. */
export function resolveTheme(
  theme: ThemeTokens | undefined,
  themeMode: ThemeMode | undefined,
): ThemeTokens {
  return theme ?? getMobileThemeTokens(themeMode ?? "light");
}
