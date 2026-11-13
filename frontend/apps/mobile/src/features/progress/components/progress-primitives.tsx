import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { type ThemeTokens } from "@trefix/tokens";
import { type AppLanguage, type MainCopy } from "../../../locales";
import { SectionTitle } from "../../../shared/ui/list-card";
import { type Formatter } from "../../profile/lib/profile-format";
import { styles } from "./progress-sections.styles";

export type Common = {
  copy: MainCopy;
  language: AppLanguage;
  theme: ThemeTokens;
  format: Formatter;
};

export const fontOf = (
  theme: ThemeTokens,
  weight: "regular" | "medium" | "semibold",
) => theme.typography.fontFamily.sans[weight];

/** Group title with an optional link on the right. */
export function SectionHeader({
  title,
  link,
  onLink,
  theme,
}: {
  title: string;
  link?: string;
  onLink?: () => void;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.sectionHeader}>
      <SectionTitle text={title} theme={theme} />
      {link && onLink ? (
        <Pressable accessibilityRole="link" hitSlop={8} onPress={onLink}>
          <Text
            style={[
              styles.sectionLink,
              {
                color: theme.color.foreground,
                fontFamily: fontOf(theme, "medium"),
              },
            ]}
          >
            {link}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Content of a section, laid straight on the page. */
export function Block({
  children,
  gap = 14,
}: {
  children: ReactNode;
  gap?: number;
}) {
  return <View style={{ gap }}>{children}</View>;
}

export function Muted({
  theme,
  children,
  numberOfLines = 1,
}: {
  theme: ThemeTokens;
  children: ReactNode;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        styles.muted,
        {
          color: theme.color.mutedForeground,
          fontFamily: fontOf(theme, "regular"),
        },
      ]}
    >
      {children}
    </Text>
  );
}

export function BigValue({
  theme,
  children,
  size = 26,
}: {
  theme: ThemeTokens;
  children: ReactNode;
  size?: number;
}) {
  return (
    <Text
      style={{
        color: theme.color.foreground,
        fontFamily: fontOf(theme, "semibold"),
        fontSize: size,
        lineHeight: size + 6,
        letterSpacing: -0.4,
        fontVariant: ["tabular-nums"],
      }}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------- goal

export function MetricTile({
  theme,
  label,
  value,
  hint,
  onPress,
}: {
  theme: ThemeTokens;
  label: string;
  value: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value} ${hint ?? ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Muted theme={theme}>{label}</Muted>
      <Text
        style={{
          color: theme.color.foreground,
          fontFamily: fontOf(theme, "semibold"),
          fontSize: 17,
          lineHeight: 22,
          fontVariant: ["tabular-nums"],
        }}
      >
        {value}
      </Text>
      {hint ? <Muted theme={theme}>{hint}</Muted> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- capabilities
