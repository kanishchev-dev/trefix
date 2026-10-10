import type { ThemeTokens } from "@workspace/tokens";

/**
 * Soft edge for glass inputs: a faint highlight at rest and a slightly brighter one
 * in focus, instead of a solid foreground-coloured outline.
 */
export function glassBorderColor(theme: ThemeTokens, focused: boolean): string {
  return focused ? theme.color.inputBorderFocused : theme.color.inputBorder;
}
