import { useCallback, useMemo, useRef, useEffect, type ReactNode } from "react";
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
import {
  Home,
  LayoutList,
  BarChart2,
  Sparkles
} from "lucide-react-native";

import { type ThemeTokens } from "@workspace/tokens";
import { type MainTabKey } from "../main-types";

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

export function TabBar({
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
      icon: (
        <Home
          size={22}
          color={activeTab === "today" ? theme.color.foreground : theme.color.mutedForeground}
          strokeWidth={activeTab === "today" ? 2.5 : 2}
        />
      ),
    },
    {
      key: "plan",
      onPress: () => onChangeTab("plan"),
      icon: (
        <LayoutList
          size={22}
          color={activeTab === "plan" ? theme.color.foreground : theme.color.mutedForeground}
          strokeWidth={activeTab === "plan" ? 2.5 : 2}
        />
      ),
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
      icon: (
        <BarChart2
          size={22}
          color={activeTab === "progress" ? theme.color.foreground : theme.color.mutedForeground}
          strokeWidth={activeTab === "progress" ? 2.5 : 2}
        />
      ),
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

  // Synchronize position with activeTab prop
  // This ensures that if we navigate away and back, the indicator rolls back to the correct tab
  useEffect(() => {
    const targetIndex = tabs.findIndex((t) => t.key !== "trefix" && t.key === activeTab);
    if (targetIndex !== -1 && targetIndex !== position.value) {
      position.value = withSpring(targetIndex, {
        damping: 18,
        stiffness: 120,
      });
    }
  }, [activeTab, tabs]);

  const handleTabPress = useCallback(
    (index: number, key: string, onPress: () => void) => {
      onPress();

      // If it's a functional tab (not the center action), move the indicator
      if (key !== "trefix") {
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
      } else {
        // For the center button, just trigger haptic and scale animation
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // We don't move 'position' here, so it stays on the previous tab
      }
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
      style={[styles.outer, { paddingBottom: Math.max(insets.bottom - 18, 4) }]}
    >
      <GlassView
        colorScheme={isDark ? "dark" : "light"}
        glassEffectStyle="regular"
        tintColor={isDark ? "rgba(0, 0, 0, 0.4)" : theme.color.glassTint}
        isInteractive
        style={[
          styles.shell,
          {
            borderColor: isDark ? "transparent" : theme.color.glassBorder,
            backgroundColor: isDark ? "rgba(0, 0, 0, 0.8)" : "rgba(255, 255, 255, 0.72)",
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
          <View
            style={[
              styles.indicator,
              {
                backgroundColor: isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 255, 255, 0.45)",
                borderColor: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.1)",
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
                onPress={() => handleTabPress(index, tab.key, tab.onPress)}
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

/* ---- Icons: T and Profile ---- */

function TrefixIcon({ theme }: { theme: ThemeTokens }) {
  return (
    <Sparkles
      size={22}
      color={theme.color.mutedForeground}
      strokeWidth={2}
    />
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
    top: (SHELL_HEIGHT - INDICATOR_HEIGHT) / 2 - 1,
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
