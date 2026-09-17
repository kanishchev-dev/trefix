// MainLiquidTabBar.tsx
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { GlassView } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { type ThemeTokens } from "@workspace/tokens";
import { type MainTabKey } from "../main.types";

type Props = {
  theme: ThemeTokens;
  activeTab: MainTabKey;
  onChangeTab: (tab: MainTabKey) => void;
  onOpenTrefix: () => void;
  userEmail: string;
  themeMode: "light" | "dark";
};

type TabItem = {
  key: MainTabKey | "trefix";
  icon: ReactNode;
  onPress: () => void;
  badge?: boolean;
};

const BAR_PADDING = 6;
const SHELL_HEIGHT = 64;
const INDICATOR_HEIGHT = 46;
const HORIZONTAL_MARGIN = 16;

export function MainLiquidTabBar({
  theme,
  activeTab,
  onChangeTab,
  onOpenTrefix,
  userEmail,
  themeMode,
}: Props) {
  const insets = useSafeAreaInsets();
  const isDark = themeMode === "dark";
  const { width: windowWidth } = useWindowDimensions();

  const barWidth = windowWidth - HORIZONTAL_MARGIN * 2;
  const tabsCount = 5;
  const tabWidth = (barWidth - BAR_PADDING * 2) / tabsCount;
  const indicatorBaseWidth = Math.min(tabWidth - 6, INDICATOR_HEIGHT + 16);

  const profileFallback = useMemo(() => {
    const trimmed = userEmail.trim();
    return trimmed.slice(0, 1).toUpperCase() || "U";
  }, [userEmail]);

  const tabs: TabItem[] = [
    {
      key: "today",
      onPress: () => onChangeTab("today"),
      icon: <TodayIcon theme={theme} active={activeTab === "today"} />,
    },
    {
      key: "plan",
      onPress: () => onChangeTab("plan"),
      icon: <PlanIcon theme={theme} active={activeTab === "plan"} />,
    },
    {
      key: "trefix",
      onPress: onOpenTrefix,
      icon: <TrefixIcon theme={theme} />,
      badge: true,
    },
    {
      key: "progress",
      onPress: () => onChangeTab("progress"),
      icon: <ProgressIcon theme={theme} active={activeTab === "progress"} />,
    },
    {
      key: "profile",
      onPress: () => onChangeTab("profile"),
      icon: (
        <ProfileIcon theme={theme} fallback={profileFallback} active={activeTab === "profile"} />
      ),
      badge: true,
    },
  ];

  const activeIndex = tabs.findIndex((t) => t.key !== "trefix" && t.key === activeTab);
  const position = useSharedValue(Math.max(activeIndex, 0));
  const isMoving = useSharedValue(0);

  const handleTabPress = useCallback(
    (index: number, onPress: () => void) => {
      onPress();
      if (index === position.value) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      isMoving.value = withTiming(1, { duration: 100 }, () => {
        isMoving.value = withTiming(0, { duration: 300 });
      });

      position.value = withSpring(index, {
        damping: 18,
        stiffness: 120,
        mass: 1,
      });
    },
    [position, isMoving]
  );

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const translateX = BAR_PADDING + position.value * tabWidth + (tabWidth - indicatorBaseWidth) / 2;

    // Bottle stretching effect based on movement
    const scaleX = interpolate(
      isMoving.value,
      [0, 1],
      [1, 1.25],
      Extrapolation.CLAMP
    );

    const scaleY = interpolate(
      isMoving.value,
      [0, 1],
      [1, 0.85],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { translateX },
        { scaleX },
        { scaleY },
      ],
    };
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      <GlassView
        glassEffectStyle="regular"
        tintColor={theme.color.glassTint}
        isInteractive
        style={[
          styles.shell,
          {
            borderColor: theme.color.glassBorder,
            backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicatorSlot,
            {
              width: indicatorBaseWidth,
            },
            indicatorAnimatedStyle,
          ]}
        >
          <GlassView
            glassEffectStyle="clear"
            tintColor={theme.color.glassTint}
            style={[
              styles.indicator,
              {
                borderColor: theme.color.glassBorder,
                backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
              },
            ]}
          />
        </Animated.View>

        {tabs.map((tab, index) => {
          const active = tab.key !== "trefix" && activeTab === tab.key;
          return (
            <TabButton
              key={tab.key}
              active={active}
              badge={tab.badge}
              onPress={() => handleTabPress(index, tab.onPress)}
              icon={tab.icon}
            />
          );
        })}
      </GlassView>
    </View>
  );
}

function TabButton({
  active,
  badge,
  onPress,
  icon,
}: {
  active: boolean;
  badge?: boolean;
  onPress: () => void;
  icon: ReactNode;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: interpolate(scale.value, [0.9, 1], [0.8, 1], Extrapolation.CLAMP),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      hitSlop={12}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabButton}
    >
      <Animated.View style={[styles.iconWrap, animatedStyle]}>
        {icon}
        {badge && <View style={styles.badgeDot} />}
      </Animated.View>
    </Pressable>
  );
}

/* ---- иконки: только линии, без подложек ---- */

function TodayIcon({ theme, active }: { theme: ThemeTokens; active: boolean }) {
  return (
    <View style={styles.iconFrame}>
      <View style={[styles.house, { borderColor: theme.color.foreground, opacity: active ? 1 : 0.6 }]}>
        <View style={[styles.houseRoof, { backgroundColor: theme.color.foreground, opacity: active ? 1 : 0.6 }]} />
      </View>
    </View>
  );
}

function PlanIcon({ theme, active }: { theme: ThemeTokens; active: boolean }) {
  return (
    <View style={styles.iconFrame}>
      <View style={[styles.planFrame, { borderColor: theme.color.foreground, opacity: active ? 1 : 0.6 }]}>
        <View style={[styles.planLine, { backgroundColor: theme.color.foreground }]} />
        <View style={[styles.planLine, { backgroundColor: theme.color.foreground }]} />
      </View>
    </View>
  );
}

function ProgressIcon({ theme, active }: { theme: ThemeTokens; active: boolean }) {
  return (
    <View style={styles.iconFrame}>
      <View style={[styles.progressWrap, { opacity: active ? 1 : 0.6 }]}>
        <View style={[styles.progressBar, { height: 8, backgroundColor: theme.color.foreground }]} />
        <View style={[styles.progressBar, { height: 13, backgroundColor: theme.color.foreground }]} />
        <View style={[styles.progressBar, { height: 18, backgroundColor: theme.color.foreground }]} />
      </View>
    </View>
  );
}

function TrefixIcon({ theme }: { theme: ThemeTokens }) {
  return (
    <View style={[styles.trefixBadge, { borderColor: theme.color.foreground }]}>
      <Text
        style={[
          styles.trefixLabel,
          { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.extrabold },
        ]}
      >
        Т
      </Text>
    </View>
  );
}

function ProfileIcon({
  theme,
  fallback,
  active,
}: {
  theme: ThemeTokens;
  fallback: string;
  active: boolean;
}) {
  return (
    <View
      style={[
        styles.profileBadge,
        { borderColor: theme.color.foreground, borderWidth: active ? 1.6 : 1, opacity: active ? 1 : 0.7 },
      ]}
    >
      <Text
        style={[
          styles.profileFallback,
          { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.extrabold },
        ]}
      >
        {fallback}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: HORIZONTAL_MARGIN,
    right: HORIZONTAL_MARGIN,
    bottom: 0,
  },
  shell: {
    minHeight: SHELL_HEIGHT,
    borderRadius: SHELL_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: BAR_PADDING,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  indicatorSlot: {
    position: "absolute",
    top: BAR_PADDING,
    height: INDICATOR_HEIGHT,
  },
  indicator: {
    flex: 1,
    borderRadius: INDICATOR_HEIGHT / 2,
    borderWidth: 1,
  },
  tabButton: {
    flex: 1,
    height: SHELL_HEIGHT - BAR_PADDING * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#ff3b30",
  },
  iconFrame: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  house: {
    width: 16,
    height: 14,
    borderWidth: 1.5,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  houseRoof: {
    position: "absolute",
    top: -2,
    width: 10,
    height: 8,
    transform: [{ rotate: "45deg" }],
    borderRadius: 2,
  },
  planFrame: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 5,
    paddingHorizontal: 2.5,
    paddingVertical: 3,
    justifyContent: "space-between",
  },
  planLine: {
    width: 8.5,
    height: 1.35,
    borderRadius: 999,
  },
  progressWrap: {
    width: 16,
    height: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  progressBar: {
    width: 2.8,
    borderRadius: 999,
  },
  trefixBadge: {
    width: 20,
    height: 20,
    borderRadius: 7,
    borderWidth: 1.4,
    alignItems: "center",
    justifyContent: "center",
  },
  trefixLabel: {
    fontSize: 12,
    lineHeight: 13,
    marginTop: -1,
  },
  profileBadge: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  profileFallback: {
    fontSize: 10,
    lineHeight: 11,
  },
});
