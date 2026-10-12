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
        style,
      ]}
    >
      {pending ? (
        <ActivityIndicator color={theme.color.primaryForeground} />
      ) : (
        <>
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
}: {
  tabs: Array<{ key: T; label: string }>;
  value: T;
  onChange: (key: T) => void;
  theme: ThemeTokens;
}) {
  const [tabsWidth, setTabsWidth] = useState(0);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === value),
  );
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
            [0, tabs.length - 1],
            [4, 4 + tabWidth],
          ),
        },
      ],
    };
  });

  return (
    <View
      onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}
      style={[styles.tabsContainer, { backgroundColor: theme.color.surface }]}
    >
      <Animated.View
        style={[
          styles.activeTabIndicator,
          { backgroundColor: theme.color.primary },
          indicatorAnimatedStyle,
        ]}
      />

      {tabs.map((tab) => {
        const isActive = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: isActive
                    ? theme.color.primaryForeground
                    : theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
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
