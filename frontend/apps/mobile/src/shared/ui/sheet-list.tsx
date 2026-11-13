import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";

/**
 * Building blocks of the profile-style sheets: a centred muted subtitle under
 * the title, a round badge above it and a grouped list on the page colour.
 */
export function SheetSubtitle({
  text,
  theme,
}: {
  text: string;
  theme: ThemeTokens;
}) {
  return (
    <Text
      style={[
        styles.subtitle,
        {
          color: theme.color.mutedForeground,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
      ]}
    >
      {text}
    </Text>
  );
}

export function SheetBadge({
  children,
  theme,
  tone = "neutral",
}: {
  children: ReactNode;
  theme: ThemeTokens;
  tone?: "neutral" | "danger";
}) {
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor:
            tone === "danger" ? theme.color.dangerSurface : theme.color.screen,
        },
      ]}
    >
      {children}
    </View>
  );
}

export function SheetList({
  children,
  theme,
}: {
  children: ReactNode;
  theme: ThemeTokens;
}) {
  return (
    <View style={[styles.list, { backgroundColor: theme.color.screen }]}>
      {children}
    </View>
  );
}

type RowProps = {
  title: string;
  theme: ThemeTokens;
  /** Not the first row: draws the divider in the sheet colour. */
  divided?: boolean;
  icon?: ReactNode;
  value?: string;
  /** The value is set by the user: foreground instead of muted. */
  valueStrong?: boolean;
  chevron?: boolean;
  checked?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function SheetListRow({
  title,
  theme,
  divided = false,
  icon,
  value,
  valueStrong = false,
  chevron = false,
  checked = false,
  disabled = false,
  destructive = false,
  trailing,
  onPress,
  accessibilityLabel,
}: RowProps) {
  const color = destructive ? theme.color.danger : theme.color.foreground;
  const content = (
    <>
      {icon}
      <Text
        numberOfLines={1}
        style={[
          styles.title,
          { color, fontFamily: theme.typography.fontFamily.sans.medium },
        ]}
      >
        {title}
      </Text>
      {value ? (
        <Text
          numberOfLines={1}
          style={[
            styles.value,
            valueStrong
              ? {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                }
              : {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
          ]}
        >
          {value}
        </Text>
      ) : null}
      {trailing}
      {checked ? (
        <Check color={theme.color.foreground} size={18} strokeWidth={2.4} />
      ) : null}
      {chevron ? (
        <ChevronRight
          color={theme.color.mutedForeground}
          size={18}
          strokeWidth={2.2}
        />
      ) : null}
    </>
  );
  const rowStyle = [
    styles.row,
    divided && { borderTopWidth: 1, borderTopColor: theme.color.sheet },
    disabled && styles.disabled,
  ];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled, selected: checked }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginTop: -6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  badge: {
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    borderRadius: 20,
    overflow: "hidden",
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    lineHeight: 20,
  },
  // Keeps the title readable: a long value ends with an ellipsis instead.
  value: {
    flexShrink: 1,
    maxWidth: "60%",
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.82,
  },
});
