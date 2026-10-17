import React, { type ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { styles } from "./bottom-sheet.styles";

export function SheetButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  pending = false,
  theme,
  leading,
  trailing,
  style,
}: {
  label: string;
  onPress: () => void;
  /** "destructive" — delete-type actions: danger text on a soft danger background. */
  variant?: "primary" | "secondary" | "destructive";
  disabled?: boolean;
  pending?: boolean;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  /** Icon before the label, e.g. play on "Start now". */
  leading?: ReactNode;
  trailing?: ReactNode;
  style?: object;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || pending}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor:
            variant === "primary"
              ? theme.color.primary
              : variant === "destructive"
                ? theme.color.dangerSurface
                : theme.color.controlSecondary,
        },
        disabled && !pending ? { opacity: 0.5 } : null,
        pending ? { opacity: 0.7 } : null,
        pressed && !disabled && !pending ? styles.buttonPressed : null,
        leading ? styles.buttonWithIcon : null,
        style,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={theme.color.primaryForeground} />
      ) : (
        <>
          {leading}
          <Text
            style={[
              styles.buttonLabel,
              {
                color:
                  variant === "primary"
                    ? theme.color.primaryForeground
                    : variant === "destructive"
                      ? theme.color.danger
                      : theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {label}
          </Text>
          {trailing}
        </>
      )}
    </Pressable>
  );
}

export function SheetSectionLabel({
  text,
  theme,
}: {
  text: string;
  theme: ThemeTokens;
}) {
  return (
    <Text
      style={[
        styles.sectionLabel,
        {
          color: theme.color.foreground,
          fontFamily: theme.typography.fontFamily.sans.medium,
          opacity: 0.7,
        },
      ]}
    >
      {text}
    </Text>
  );
}

/**
 * Content wrapper for sheet bodies.
 *
 * Sheets give their content a default horizontal padding (see
 * styles.sheetContentPadding). Blocks that must run edge-to-edge (sliders,
 * full-bleed media, etc.) set `edgeToEdge` and the wrapper compensates with
 * negative margins, so only the wrapper needs to know about padding.
 */
export function SheetBlock({
  edgeToEdge = false,
  disableLeftPadding = false,
  disableRightPadding = false,
  noPadding = false,
  children,
  style,
}: {
  theme: ThemeTokens;
  edgeToEdge?: boolean;
  disableLeftPadding?: boolean;
  disableRightPadding?: boolean;
  noPadding?: boolean;
  children: ReactNode;
  style?: object;
}) {
  const noLeft = edgeToEdge || noPadding || disableLeftPadding;
  const noRight = edgeToEdge || noPadding || disableRightPadding;

  return (
    <View
      style={[
        {
          paddingLeft: noLeft ? 0 : 20,
          paddingRight: noRight ? 0 : 20,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SheetTabs<T extends string>({
  tabs,
  value,
  onChange,
  theme,
  trackColor,
  compact = false,
  compactWidth,
  disabled = false,
  accessibilityLabel,
}: {
  tabs: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
  theme: ThemeTokens;
  /** Track behind the tabs; defaults to `surface`, which suits sheets. */
  trackColor?: string;
  /** Narrow two-option switch at the end of a row (units, week start). */
  compact?: boolean;
  /** Compact switch with more than two options needs more room than the default width. */
  compactWidth?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const [tabsWidth, setTabsWidth] = useState(0);
  const matchedIndex = tabs.findIndex((t) => t.key === value);
  const activeIndex = Math.max(0, matchedIndex);
  const activeTabX = useSharedValue(activeIndex);

  useEffect(() => {
    activeTabX.value = withSpring(activeIndex, {
      damping: 18,
      stiffness: 120,
      mass: 1,
    });
  }, [activeIndex, activeTabX]);

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const tabWidth = tabsWidth > 0 ? (tabsWidth - 8) / tabs.length : 140;
    return {
      width: tabWidth,
      transform: [
        {
          translateX: interpolate(
            activeTabX.value,
            [0, Math.max(1, tabs.length - 1)],
            [4, 4 + tabWidth * Math.max(1, tabs.length - 1)],
          ),
        },
      ],
    };
  });

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}
      style={[
        styles.tabsContainer,
        compact && styles.tabsCompact,
        compact && compactWidth ? { width: compactWidth } : null,
        { backgroundColor: trackColor ?? theme.color.surface },
        disabled && { opacity: 0.5 },
      ]}
    >
      <Animated.View
        style={[
          styles.activeTabIndicator,
          { backgroundColor: theme.color.primary },
          matchedIndex < 0 && { opacity: 0 },
          indicatorAnimatedStyle,
        ]}
      />

      {tabs.map((tab) => {
        const isActive = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive, disabled }}
            disabled={disabled}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, compact && styles.tabCompact]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.tabText,
                compact && styles.tabTextCompact,
                {
                  color: isActive
                    ? theme.color.primaryForeground
                    : theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
