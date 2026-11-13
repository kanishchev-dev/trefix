import { type ReactNode } from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { type ThemeTokens } from "@trefix/tokens";

/** Shared building blocks of the Progress section: cards, headings, tracks. */

/** Inset of section headings: card margin plus the card's corner radius. */
const SECTION_INSET = 40;
const CARD_RADIUS = 24;

/** Greys of the section, from the app tokens; dividers use the screen colour. */
export function progressPalette(theme: ThemeTokens) {
  return {
    fg: theme.color.foreground,
    muted: theme.color.mutedForeground,
    line: theme.color.controlSecondary,
    chip: theme.color.controlSecondary,
    faint: theme.color.intensity1,
    mid: theme.color.intensity2,
    card: theme.color.card,
    inverse: theme.color.primary,
    inverseFg: theme.color.primaryForeground,
    ai: theme.color.ai,
  };
}

export type ProgressPalette = ReturnType<typeof progressPalette>;

export function fonts(theme: ThemeTokens) {
  const sans = theme.typography.fontFamily.sans;
  return { regular: sans.regular, medium: sans.medium, bold: sans.bold };
}

type CardProps = {
  theme: ThemeTokens;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ProgressCard({ theme, children, style }: CardProps) {
  return (
    <View style={[styles.card, { backgroundColor: theme.color.card }, style]}>
      {children}
    </View>
  );
}

type SectionHeaderProps = {
  theme: ThemeTokens;
  title: string;
  /** Muted text on the right, or a node such as the demo badge. */
  aside?: ReactNode;
};

export function SectionHeader({ theme, title, aside }: SectionHeaderProps) {
  const font = fonts(theme);
  return (
    <View style={styles.section}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={[
          styles.sectionTitle,
          { color: theme.color.foreground, fontFamily: font.medium },
        ]}
      >
        {title}
      </Text>
      {typeof aside === "string" ? (
        <Text
          numberOfLines={1}
          style={[
            styles.sectionAside,
            { color: theme.color.mutedForeground, fontFamily: font.regular },
          ]}
        >
          {aside}
        </Text>
      ) : (
        aside
      )}
    </View>
  );
}

export function DemoBadge({
  theme,
  label,
}: {
  theme: ThemeTokens;
  label: string;
}) {
  const palette = progressPalette(theme);
  return (
    <View style={[styles.demo, { borderColor: palette.faint }]}>
      <Text
        style={[
          styles.demoText,
          { color: palette.muted, fontFamily: fonts(theme).medium },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

type TrackProps = {
  theme: ThemeTokens;
  /** 0–100. */
  percent: number;
  height?: number;
  color?: string;
};

export function Track({ theme, percent, height = 6, color }: TrackProps) {
  const palette = progressPalette(theme);
  const radius = height / 2;
  return (
    <View
      style={{
        height,
        borderRadius: radius,
        backgroundColor: palette.chip,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          width: `${Math.max(0, Math.min(100, percent))}%`,
          height,
          borderRadius: radius,
          backgroundColor: color ?? palette.fg,
        }}
      />
    </View>
  );
}

/** Small muted caption line. */
export function Caption({
  theme,
  children,
  style,
  numberOfLines,
}: {
  theme: ThemeTokens;
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        styles.caption,
        {
          color: theme.color.mutedForeground,
          fontFamily: fonts(theme).regular,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Kicker({
  theme,
  children,
  style,
}: {
  theme: ThemeTokens;
  children: ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      numberOfLines={1}
      style={[
        styles.kicker,
        { color: theme.color.mutedForeground, fontFamily: fonts(theme).medium },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Medal of a personal record. */
export function Medal({
  color,
  cutout,
  size = 16,
}: {
  color: string;
  cutout?: string;
  size?: number;
}) {
  if (size <= 16) {
    return (
      <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
        <Path d="M5.5 1l-1.5 5M10.5 1l1.5 5" stroke={color} strokeWidth={2} />
        <Circle cx={8} cy={10.5} r={5} fill={color} />
      </Svg>
    );
  }
  return (
    <Svg width={(size * 34) / 40} height={size} viewBox="0 0 34 40" fill="none">
      <Path
        d="M11 2l-4 14M23 2l4 14"
        stroke={color}
        strokeWidth={5}
        strokeLinecap="square"
      />
      <Circle cx={17} cy={26} r={12} fill={color} />
      {cutout ? (
        <Circle
          cx={17}
          cy={26}
          r={9}
          stroke={cutout}
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      ) : null}
    </Svg>
  );
}

export const progressStyles = StyleSheet.create({
  cardBody: {
    marginHorizontal: 16,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 18,
    gap: 12,
  },
  listBody: { marginHorizontal: 16, paddingHorizontal: 18, paddingVertical: 4 },
  body: { fontSize: 15, lineHeight: 20 },
  value: { fontSize: 17, lineHeight: 22 },
});

const styles = StyleSheet.create({
  card: { borderRadius: CARD_RADIUS, overflow: "hidden" },
  section: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: SECTION_INSET,
    marginTop: 8,
  },
  sectionTitle: { flexShrink: 1, fontSize: 15, lineHeight: 20 },
  sectionAside: { fontSize: 13, lineHeight: 18 },
  demo: {
    height: 20,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    justifyContent: "center",
  },
  demoText: { fontSize: 11, lineHeight: 14 },
  caption: { fontSize: 12, lineHeight: 16 },
  kicker: { fontSize: 13, lineHeight: 18 },
});
