export type ThemeMode = "light" | "dark";

export type ThemeTokens = {
  color: {
    background: string;
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
      background: "#f2f2f5",
      surface: "#ffffff",
      surfaceElevated: "#ffffff",
      foreground: "#09090b",
      mutedForeground: "#71717a",
      border: "#d4d4d8",
      primary: "#09090b",
      primaryForeground: "#ffffff",
      secondary: "#e4e4e7",
      overlay: "rgba(9, 9, 11, 0.08)",
      accent: "#09090b",
      glassBackground: "rgba(255, 255, 255, 0.35)",
      glassBorder: "rgba(0, 0, 0, 0.08)",
      glassTint: "rgba(255, 255, 255, 0.1)",
      card: "#ffffff",
      cardBorder: "rgba(0, 0, 0, 0.08)",
      control: "#ffffff",
      controlSecondary: "#e4e4e7",
      danger: "#dc2626",
      dangerSurface: "#fde4e4",
      sheet: "#ffffff",
      iconSurface: "#f2f2f5",
      separator: "rgba(0, 0, 0, 0.07)",
      warning: "#d97706",
    },
    ...common,
  },
  dark: {
    color: {
      background: "#09090b",
      surface: "#111111",
      surfaceElevated: "#27272a",
      foreground: "#f8fafc",
      mutedForeground: "#a1a1aa",
      border: "#3f3f46",
      primary: "#f8fafc",
      primaryForeground: "#020617",
      secondary: "#18181b",
      overlay: "rgba(255, 255, 255, 0.06)",
      accent: "#f8fafc",
      glassBackground: "rgba(255, 255, 255, 0.02)",
      glassBorder: "rgba(255, 255, 255, 0.08)",
      glassTint: "rgba(255, 255, 255, 0.01)",
      card: "#1a1a1e",
      cardBorder: "transparent",
      control: "#1a1a1e",
      controlSecondary: "#1a1a1e",
      danger: "#f87171",
      dangerSurface: "#3a2023",
      sheet: "#121214",
      iconSurface: "rgba(255, 255, 255, 0.06)",
      separator: "rgba(255, 255, 255, 0.07)",
      warning: "#fbbf24",
    },
    ...common,
  },
};

export const tokens = mobileThemeTokens.light;

export function getMobileThemeTokens(mode: ThemeMode): ThemeTokens {
  return mobileThemeTokens[mode];
}
