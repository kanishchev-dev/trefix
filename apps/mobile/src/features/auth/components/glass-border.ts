import { getMobileThemeTokens, type ThemeTokens } from "@workspace/tokens";

const DARK_BACKGROUND = getMobileThemeTokens("dark").color.background.toLowerCase();

/**
 * Soft edge for glass inputs: a faint highlight at rest and a slightly brighter one
 * in focus, instead of a solid foreground-coloured outline.
 */
export function glassBorderColor(theme: ThemeTokens, focused: boolean): string {
  const dark = theme.color.background.toLowerCase() === DARK_BACKGROUND;
  if (dark) return focused ? "rgba(255, 255, 255, 0.26)" : "rgba(255, 255, 255, 0.1)";
  return focused ? "rgba(0, 0, 0, 0.16)" : "rgba(0, 0, 0, 0.06)";
}
