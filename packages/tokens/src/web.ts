import { mobileThemeTokens, type ThemeMode } from "./index";

/** Admin-only colours with no counterpart in the app (shadcn zinc). */
const WEB_ONLY: Record<ThemeMode, { ring: string; sidebar: string; sidebarPrimary: string; chart: string[] }> = {
  light: {
    ring: "#9f9fa9",
    sidebar: "#fafafa",
    sidebarPrimary: "#18181b",
    chart: ["#d4d4d8", "#71717b", "#52525c", "#3f3f46", "#27272a"],
  },
  dark: {
    ring: "#71717b",
    sidebar: "#18181b",
    sidebarPrimary: "#1447e6",
    chart: ["#d4d4d8", "#71717b", "#52525c", "#3f3f46", "#27272a"],
  },
};

/**
 * shadcn CSS variables of the admin panel, built from the shared palette so the
 * admin and the app use the same colours. Changing a token changes the admin
 * after `pnpm --filter @workspace/tokens generate:web-css`.
 */
export function webThemeVariables(mode: ThemeMode): Record<string, string> {
  const c = mobileThemeTokens[mode].color;
  const web = WEB_ONLY[mode];
  // shadcn zinc: text on grey fills is the primary colour in light mode and the foreground in dark.
  const onSubtle = mode === "light" ? c.primary : c.foreground;
  return {
    background: c.background,
    foreground: c.foreground,
    card: c.card,
    "card-foreground": c.foreground,
    popover: c.sheet,
    "popover-foreground": c.foreground,
    primary: c.primary,
    "primary-foreground": c.primaryForeground,
    secondary: c.controlSecondary,
    "secondary-foreground": onSubtle,
    muted: c.iconSurface,
    "muted-foreground": c.mutedForeground,
    accent: c.iconSurface,
    "accent-foreground": onSubtle,
    destructive: c.danger,
    border: c.border,
    input: c.controlBorder,
    ring: web.ring,
    "chart-1": web.chart[0]!,
    "chart-2": web.chart[1]!,
    "chart-3": web.chart[2]!,
    "chart-4": web.chart[3]!,
    "chart-5": web.chart[4]!,
    sidebar: web.sidebar,
    "sidebar-foreground": c.foreground,
    "sidebar-primary": web.sidebarPrimary,
    "sidebar-primary-foreground": mode === "light" ? c.primaryForeground : c.foreground,
    "sidebar-accent": c.iconSurface,
    "sidebar-accent-foreground": onSubtle,
    "sidebar-border": c.border,
    "sidebar-ring": web.ring,
    success: c.success,
    warning: c.warning,
    ai: c.ai,
    info: c.info,
  };
}
/** Contents of `packages/ui/src/styles/theme.css`. */
export function renderWebThemeCss(): string {
  const block = (selector: string, mode: ThemeMode, extra: string[] = []): string => {
    const lines = Object.entries(webThemeVariables(mode)).map(([name, value]) => `  --${name}: ${value};`);
    return `${selector} {\n${[...extra, ...lines].join("\n")}\n}\n`;
  };
  return [
    "/* Generated from @workspace/tokens (packages/tokens/src/web.ts). Do not edit: run `pnpm --filter @workspace/tokens generate:web-css`. */\n",
    block(":root", "light", ["  --radius: 0.625rem;"]),
    block(".dark", "dark"),
  ].join("\n");
}
