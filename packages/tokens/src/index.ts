export type ThemeMode = "light" | "dark";

export type ThemeTokens = {
  color: {
    background: string;
    /**
     * Page background of the signed-in app's screens. Grey under white cards on
     * light so cards read as surfaces; equal to `background` on dark.
     */
    screen: string;
    surface: string;
    surfaceElevated: string;
    foreground: string;
    mutedForeground: string;
    border: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    overlay: string;
    accent: string;
    glassBackground: string;
    glassBorder: string;
    glassTint: string;
    /** Content cards on a page (Today, plan, preview). */
    card: string;
    /** Hairline border of `card`. */
    cardBorder: string;
    /** Tappable surfaces inside sheets: option cards, chips. */
    control: string;
    /** Secondary buttons and icon buttons. */
    controlSecondary: string;
    /** Destructive actions (delete): text/icon colour and its soft, opaque background. */
    danger: string;
    dangerSurface: string;
    /** Background of bottom sheets; option tiles inside use `control`. */
    sheet: string;
    /** Circle behind a row or tile icon. */
    iconSurface: string;
    /** Hairline between rows inside a card. */
    separator: string;
    /** Attention: missing values, wear warnings. */
    warning: string;
    /** Border of option tiles, chips and bottom sheets. */
    controlBorder: string;
    /** Glass inputs: resting and focused edge. */
    inputBorder: string;
    inputBorderFocused: string;
    /** Error outline of an input. */
    dangerBorder: string;
    /** Confirmations: connected, done. */
    success: string;
    /** The AI coach (Tref): icons, labels, modified-by-coach marks. */
    ai: string;
    /** Soft AI tint: outlines and backgrounds around coach content. */
    aiSurface: string;
    /** Background of the coach title pill in the header. */
    aiPill: string;
    /** Secondary accent for links and subtitles. */
    info: string;
    /** Dimmed backdrop behind dialogs and loading overlays. */
    scrim: string;
    /** Loading placeholders. */
    skeleton: string;
    /** Off state of a switch track. */
    switchTrackOff: string;
    /** Highlight of the selected row in wheels and of the active segment. */
    selectionFill: string;
    selectionBorder: string;
    /** Segmented control: track and the sliding thumb. */
    segmentedTrack: string;
    segmentedThumb: string;
    /** Floating translucent panels over content (chat composer). */
    floating: string;
    /** Header and tab bar glass: tint, fill, edge (fallback without glass) and edge over real glass. */
    chromeTint: string;
    chromeFill: string;
    chromeBorder: string;
    tabBarFill: string;
    chromeGlassBorder: string;
    /** Selected tab indicator on the glass tab bar. */
    tabIndicatorTint: string;
    tabIndicatorFill: string;
    tabIndicatorBorder: string;
    tabIndicatorHighlight: string;
  };
  typography: {
    fontFamily: {
      sans: {
        regular: string;
        medium: string;
        semibold: string;
        bold: string;
        extrabold: string;
      };
      mono: string;
    };
  };
  radius: {
    lg: number;
    xl: number;
    pill: number;
  };
  spacing: {
    page: number;
    card: number;
  };
};

const common = {
  typography: {
    fontFamily: {
      sans: {
        regular: "Inter_400Regular",
        medium: "Inter_500Medium",
        semibold: "Inter_600SemiBold",
        bold: "Inter_700Bold",
        extrabold: "Inter_800ExtraBold",
      },
      mono: "System",
    },
  },
  radius: {
    lg: 24,
    xl: 32,
    pill: 9999,
  },
  spacing: {
    page: 24,
    card: 20,
  },
} as const;

export const mobileThemeTokens: Record<ThemeMode, ThemeTokens> = {
  light: {
    color: {
      background: "#ffffff",
      screen: "#f4f4f5",
      surface: "#ffffff",
      surfaceElevated: "#ffffff",
      foreground: "#09090b",
      mutedForeground: "#71717b",
      border: "#e4e4e7",
      primary: "#18181b",
      primaryForeground: "#fafafa",
      secondary: "#f4f4f5",
      overlay: "rgba(9, 9, 11, 0.08)",
      accent: "#18181b",
      glassBackground: "rgba(255, 255, 255, 0.35)",
      glassBorder: "rgba(0, 0, 0, 0.08)",
      glassTint: "rgba(255, 255, 255, 0.1)",
      card: "#ffffff",
      cardBorder: "#e4e4e7",
      control: "#ffffff",
      controlSecondary: "#f4f4f5",
      danger: "#e7000b",
      dangerSurface: "#fde4e4",
      sheet: "#ffffff",
      iconSurface: "#f4f4f5",
      separator: "#e4e4e7",
      warning: "#d97706",
      controlBorder: "#e4e4e7",
      inputBorder: "rgba(0, 0, 0, 0.06)",
      inputBorderFocused: "rgba(0, 0, 0, 0.16)",
      dangerBorder: "rgba(231, 0, 11, 0.6)",
      success: "#16a34a",
      ai: "#815cd6",
      aiSurface: "rgba(129, 92, 214, 0.14)",
      aiPill: "rgba(32, 28, 40, 0.8)",
      info: "#5b8cff",
      scrim: "rgba(0, 0, 0, 0.4)",
      skeleton: "#f4f4f5",
      switchTrackOff: "#e4e4e7",
      selectionFill: "rgba(0, 0, 0, 0.04)",
      selectionBorder: "rgba(0, 0, 0, 0.08)",
      segmentedTrack: "#f4f4f5",
      segmentedThumb: "#ffffff",
      floating: "rgba(255, 255, 255, 0.78)",
      chromeTint: "rgba(255, 255, 255, 0.1)",
      chromeFill: "rgba(255, 255, 255, 0.72)",
      chromeBorder: "rgba(0, 0, 0, 0.08)",
      tabBarFill: "rgba(255, 255, 255, 0.72)",
      chromeGlassBorder: "rgba(0, 0, 0, 0.08)",
      tabIndicatorTint: "rgba(255, 255, 255, 0.2)",
      tabIndicatorFill: "rgba(0, 0, 0, 0.04)",
      tabIndicatorBorder: "rgba(0, 0, 0, 0.04)",
      tabIndicatorHighlight: "rgba(255, 255, 255, 0.3)",
    },
    ...common,
  },
  dark: {
    color: {
      background: "#09090b",
      screen: "#09090b",
      surface: "#18181b",
      surfaceElevated: "#27272a",
      foreground: "#fafafa",
      mutedForeground: "#9f9fa9",
      border: "rgba(255, 255, 255, 0.1)",
      primary: "#e4e4e7",
      primaryForeground: "#18181b",
      secondary: "#27272a",
      overlay: "rgba(255, 255, 255, 0.06)",
      accent: "#e4e4e7",
      glassBackground: "rgba(255, 255, 255, 0.02)",
      glassBorder: "rgba(255, 255, 255, 0.08)",
      glassTint: "rgba(255, 255, 255, 0.01)",
      card: "#18181b",
      cardBorder: "rgba(255, 255, 255, 0.1)",
      control: "#18181b",
      controlSecondary: "#27272a",
      danger: "#ff6467",
      dangerSurface: "#3a2023",
      sheet: "#18181b",
      iconSurface: "#27272a",
      separator: "rgba(255, 255, 255, 0.1)",
      warning: "#fbbf24",
      controlBorder: "rgba(255, 255, 255, 0.15)",
      inputBorder: "rgba(255, 255, 255, 0.1)",
      inputBorderFocused: "rgba(255, 255, 255, 0.26)",
      dangerBorder: "rgba(255, 100, 103, 0.6)",
      success: "#22c55e",
      ai: "#a37eff",
      aiSurface: "rgba(163, 126, 255, 0.2)",
      aiPill: "rgba(28, 21, 34, 0.82)",
      info: "#5b8cff",
      scrim: "rgba(0, 0, 0, 0.4)",
      skeleton: "#27272a",
      switchTrackOff: "rgba(255, 255, 255, 0.15)",
      selectionFill: "rgba(255, 255, 255, 0.08)",
      selectionBorder: "rgba(255, 255, 255, 0.12)",
      segmentedTrack: "#27272a",
      segmentedThumb: "rgba(255, 255, 255, 0.08)",
      floating: "rgba(255, 255, 255, 0.04)",
      chromeTint: "rgba(0, 0, 0, 0.4)",
      chromeFill: "#09090b",
      chromeBorder: "rgba(255, 255, 255, 0.12)",
      tabBarFill: "rgba(0, 0, 0, 0.8)",
      chromeGlassBorder: "transparent",
      tabIndicatorTint: "rgba(255, 255, 255, 0.04)",
      tabIndicatorFill: "rgba(255, 255, 255, 0.06)",
      tabIndicatorBorder: "rgba(255, 255, 255, 0.08)",
      tabIndicatorHighlight: "rgba(255, 255, 255, 0.06)",
    },
    ...common,
  },
};

export const tokens = mobileThemeTokens.light;

export function getMobileThemeTokens(mode: ThemeMode): ThemeTokens {
  return mobileThemeTokens[mode];
}

/** For components that receive only the tokens, not the mode. */
export function isDarkTheme(theme: ThemeTokens): boolean {
  return theme.color.background === mobileThemeTokens.dark.color.background;
}

/** `#rrggbb` (or `#rgb`) with an alpha channel, as `rgba(...)`. Other colour formats are returned as is. */
export function withAlpha(color: string, alpha: number): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return color;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export { webThemeVariables, renderWebThemeCss } from "./web";
