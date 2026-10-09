import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  Activity,
  ClipboardList,
  Sparkles,
  Sunrise,
  type LucideIcon,
} from "lucide-react-native";

import { type ThemeTokens } from "@workspace/tokens";
import { resolveBackendMediaUrl } from "../../../lib/backend-url";
import { BottomFade } from "../../../shared/ui/bottom-fade";
import { useProfile } from "../hooks/use-profile";
import { type MainTabKey } from "../main-types";

type Props = {
  theme: ThemeTokens;
  activeTab: MainTabKey;
  onChangeTab: (tab: MainTabKey) => void;
  onOpenTrefix: () => void;
  userEmail: string;
  themeMode: "light" | "dark";
  /** The Trefix (AI coach) button is hidden when the coach is turned off. */
  showTrefix?: boolean;
};

type TabItem = {
  key: MainTabKey | "trefix";
  icon: ReactNode;
  badge?: boolean;
};

const BAR_PADDING = 6;
const SHELL_HEIGHT = 64;
const INDICATOR_HEIGHT = 46;
const HORIZONTAL_MARGIN = 16;
/** How far above the bar the bottom blur fades out. */
const FADE_EXTRA = 40;
/** Hold this long before the glass follows the finger across sections. */
const LONG_PRESS_MS = 220;
const SNAP_SPRING = { damping: 18, stiffness: 160, mass: 0.9 };
const FOLLOW_SPRING = { damping: 26, stiffness: 420, mass: 0.6 };
const PRESS_SPRING = { damping: 14, stiffness: 260, mass: 0.7 };

export function TabBar({
  theme,
  activeTab,
  onChangeTab,
  onOpenTrefix,
  userEmail,
  themeMode,
  showTrefix = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const isDark = themeMode === "dark";
  const { width: windowWidth } = useWindowDimensions();

  const barWidth = windowWidth - HORIZONTAL_MARGIN * 2;
  const tabsCount = showTrefix ? 5 : 4;
  const tabWidth = (barWidth - BAR_PADDING * 2) / tabsCount;
  const indicatorBaseWidth = Math.min(tabWidth - 6, INDICATOR_HEIGHT + 16);

  const { data: profile } = useProfile();
  const avatarUri = resolveBackendMediaUrl(profile?.avatarUrl);

  const profileFallback = useMemo(() => {
    const trimmed = userEmail.trim();
    return trimmed.slice(0, 1).toUpperCase() || "U";
  }, [userEmail]);

  const allTabs: TabItem[] = [
    {
      key: "today",
      icon: (
        <TabIcon icon={Sunrise} active={activeTab === "today"} theme={theme} />
      ),
    },
    {
      key: "plan",
      icon: (
        <TabIcon
          icon={ClipboardList}
          active={activeTab === "plan"}
          theme={theme}
        />
      ),
    },
    {
      key: "trefix",
      icon: <TrefixIcon theme={theme} />,
      badge: true,
    },
    {
      key: "progress",
      icon: (
        <TabIcon
          icon={Activity}
          active={activeTab === "progress"}
          theme={theme}
        />
      ),
    },
    {
      key: "profile",
      icon: (
        <ProfileIcon
          theme={theme}
          fallback={profileFallback}
          avatarUri={avatarUri}
          active={activeTab === "profile"}
        />
      ),
      badge: true,
    },
  ];

  const tabs = showTrefix
    ? allTabs
    : allTabs.filter((tab) => tab.key !== "trefix");
  const tabKeys = useMemo<TabItem["key"][]>(
    () =>
      showTrefix
        ? ["today", "plan", "trefix", "progress", "profile"]
        : ["today", "plan", "progress", "profile"],
    [showTrefix],
  );
  const count = tabKeys.length;
  const trefixIndex = tabKeys.indexOf("trefix");
  const activeIndex = tabKeys.findIndex(
    (key) => key !== "trefix" && key === activeTab,
  );

  /** Indicator position in tab units (fractional while it follows the finger). */
  const position = useSharedValue(Math.max(activeIndex, 0));
  /** Index of the selected section, readable from gesture worklets. */
  const selected = useSharedValue(Math.max(activeIndex, 0));
  /** 0..1: finger is down — the glass swells like a lens. */
  const press = useSharedValue(0);
  /** 0..1: jelly stretch while the indicator jumps to another tab. */
  const stretch = useSharedValue(0);
  const dragging = useSharedValue(0);
  const hovered = useSharedValue(Math.max(activeIndex, 0));

  // External navigation (back from a sub-screen, deep links) moves the indicator too.
  useEffect(() => {
    if (activeIndex === -1) return;
    selected.value = activeIndex;
    if (dragging.value === 1) return;
    position.value = withSpring(activeIndex, SNAP_SPRING);
  }, [activeIndex, dragging, position, selected]);

  // Latest props for gesture callbacks: the gesture itself must not be rebuilt mid-scrub
  // when the open section changes under the finger.
  const latest = useRef({ activeTab, onChangeTab, onOpenTrefix });
  latest.current = { activeTab, onChangeTab, onOpenTrefix };

  const selectIndex = useCallback(
    (index: number) => {
      const { activeTab, onChangeTab, onOpenTrefix } = latest.current;
      const key = tabKeys[index];
      if (!key) return;
      if (key === "trefix") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onOpenTrefix();
        return;
      }
      if (key !== activeTab) {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onChangeTab(key);
      }
    },
    [tabKeys],
  );

  // While scrubbing, every section under the finger opens at once; the coach opens only on release.
  const hoverIndex = useCallback(
    (index: number) => {
      const { activeTab, onChangeTab } = latest.current;
      void Haptics.selectionAsync();
      const key = tabKeys[index];
      if (key && key !== "trefix" && key !== activeTab) onChangeTab(key);
    },
    [tabKeys],
  );

  const grabbed = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft);
  }, []);

  const gesture = useMemo(() => {
    const indexAt = (x: number) => {
      "worklet";
      return Math.min(
        count - 1,
        Math.max(0, Math.floor((x - BAR_PADDING) / tabWidth)),
      );
    };
    const fractionAt = (x: number) => {
      "worklet";
      return Math.min(
        count - 1,
        Math.max(0, (x - BAR_PADDING) / tabWidth - 0.5),
      );
    };

    const tap = Gesture.Tap()
      .maxDuration(400)
      .onBegin(() => {
        press.value = withSpring(1, PRESS_SPRING);
      })
      .onEnd((event, success) => {
        if (!success) return;
        const index = indexAt(event.x);
        if (index !== trefixIndex && index !== selected.value) {
          stretch.value = withSequence(
            withTiming(1, { duration: 110 }),
            withTiming(0, { duration: 320 }),
          );
          position.value = withSpring(index, SNAP_SPRING);
        }
        runOnJS(selectIndex)(index);
      })
      .onFinalize(() => {
        if (dragging.value === 0) press.value = withSpring(0, PRESS_SPRING);
      });

    const scrub = Gesture.Pan()
      .activateAfterLongPress(LONG_PRESS_MS)
      .onStart((event) => {
        dragging.value = 1;
        press.value = withSpring(1, PRESS_SPRING);
        position.value = withSpring(fractionAt(event.x), FOLLOW_SPRING);
        hovered.value = indexAt(event.x);
        runOnJS(grabbed)();
      })
      .onUpdate((event) => {
        position.value = withSpring(fractionAt(event.x), FOLLOW_SPRING);
        const index = indexAt(event.x);
        if (index !== hovered.value) {
          hovered.value = index;
          runOnJS(hoverIndex)(index);
        }
      })
      .onFinalize(() => {
        if (dragging.value === 0) return;
        dragging.value = 0;
        press.value = withSpring(0, PRESS_SPRING);
        const index = hovered.value;
        // Releasing over the coach opens the chat; the glass returns to the open section.
        position.value = withSpring(
          index === trefixIndex ? selected.value : index,
          SNAP_SPRING,
        );
        if (index === trefixIndex) runOnJS(selectIndex)(index);
      });

    return Gesture.Exclusive(scrub, tap);
  }, [
    count,
    tabWidth,
    trefixIndex,
    selectIndex,
    hoverIndex,
    grabbed,
    position,
    selected,
    press,
    stretch,
    dragging,
    hovered,
  ]);

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const translateX =
      BAR_PADDING +
      position.value * tabWidth +
      (tabWidth - indicatorBaseWidth) / 2;
    const lens = 1 + 0.16 * press.value;
    return {
      transform: [
        { translateX },
        { scaleX: lens * (1 + 0.22 * stretch.value) },
        { scaleY: lens * (1 - 0.1 * stretch.value) },
      ],
    };
  });
  const highlightStyle = useAnimatedStyle(() => ({ opacity: press.value }));

  const glassAvailable = isLiquidGlassAvailable();

  const bottomPadding = Math.max(insets.bottom - 18, 4);

  return (
    <>
      <BottomFade height={bottomPadding + SHELL_HEIGHT + FADE_EXTRA} theme={theme} themeMode={themeMode} />
      <View
        pointerEvents="box-none"
        style={[styles.outer, { paddingBottom: bottomPadding }]}
      >
        <GestureDetector gesture={gesture}>
          <GlassView
            colorScheme={isDark ? "dark" : "light"}
            glassEffectStyle="regular"
            tintColor={isDark ? "rgba(0, 0, 0, 0.4)" : theme.color.glassTint}
            style={[
              styles.shell,
              {
                borderColor: isDark ? "transparent" : theme.color.glassBorder,
                backgroundColor: isDark
                  ? "rgba(0, 0, 0, 0.8)"
                  : "rgba(255, 255, 255, 0.72)",
              },
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicatorSlot,
                { width: indicatorBaseWidth },
                indicatorAnimatedStyle,
              ]}
            >
              {glassAvailable ? (
                <GlassView
                  colorScheme={isDark ? "dark" : "light"}
                  glassEffectStyle="clear"
                  tintColor={
                    isDark
                      ? "rgba(255, 255, 255, 0.04)"
                      : "rgba(255, 255, 255, 0.2)"
                  }
                  style={[
                    styles.indicator,
                    {
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(0, 0, 0, 0.04)",
                    },
                  ]}
                />
              ) : (
                <View
                  style={[
                    styles.indicator,
                    {
                      backgroundColor: isDark
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(0, 0, 0, 0.04)",
                      borderColor: isDark
                        ? "rgba(255, 255, 255, 0.06)"
                        : "rgba(0, 0, 0, 0.04)",
                    },
                  ]}
                />
              )}
              <Animated.View
                style={[
                  styles.indicatorHighlight,
                  {
                    backgroundColor: isDark
                      ? "rgba(255, 255, 255, 0.06)"
                      : "rgba(255, 255, 255, 0.3)",
                  },
                  highlightStyle,
                ]}
              />
            </Animated.View>

            {tabs.map((tab, index) => (
              <View
                key={tab.key}
                accessible
                accessibilityRole={tab.key === "trefix" ? "button" : "tab"}
                accessibilityLabel={tab.key}
                accessibilityState={{
                  selected: tab.key !== "trefix" && activeTab === tab.key,
                }}
                accessibilityActions={[{ name: "activate" }]}
                onAccessibilityAction={() => selectIndex(index)}
                style={styles.tabButton}
              >
                <View style={styles.iconWrap}>
                  {tab.icon}
                  {tab.badge && <View style={styles.badgeDot} />}
                </View>
              </View>
            ))}
          </GlassView>
        </GestureDetector>
      </View>
    </>
  );
}

/* ---- Icons ---- */

const ICON_SIZE = 22;

/** Line icon that crossfades from the muted to the active colour. */
function TabIcon({
  icon: Icon,
  active,
  theme,
}: {
  icon: LucideIcon;
  active: boolean;
  theme: ThemeTokens;
}) {
  const shown = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(active ? 1 : 0, { duration: active ? 220 : 120 });
  }, [active, shown]);
  const activeStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - shown.value }));

  return (
    <View style={styles.tabIcon}>
      <Animated.View style={inactiveStyle}>
        <Icon
          size={ICON_SIZE}
          color={theme.color.mutedForeground}
          strokeWidth={1.9}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
        <Icon
          size={ICON_SIZE}
          color={theme.color.foreground}
          strokeWidth={2.1}
        />
      </Animated.View>
    </View>
  );
}

/** The coach opens a chat rather than a tab, so it stands out as an action: sparkles on a contrasting disc. */
function TrefixIcon({ theme }: { theme: ThemeTokens }) {
  return (
    <View
      style={[styles.trefixDisc, { backgroundColor: theme.color.foreground }]}
    >
      <Sparkles size={16} color={theme.color.background} strokeWidth={2.1} />
    </View>
  );
}

function ProfileIcon({
  theme,
  fallback,
  avatarUri,
  active,
}: {
  theme: ThemeTokens;
  fallback: string;
  avatarUri: string | null;
  active: boolean;
}) {
  return (
    <View
      style={[
        avatarUri ? styles.profileAvatarBadge : styles.profileBadge,
        avatarUri
          ? { opacity: active ? 1 : 0.7 }
          : {
              borderColor: theme.color.foreground,
              borderWidth: active ? 1.6 : 1,
              opacity: active ? 1 : 0.7,
            },
      ]}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.profileAvatar} />
      ) : (
        <Text
          style={[
            styles.profileFallback,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
            },
          ]}
        >
          {fallback}
        </Text>
      )}
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
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  indicatorHighlight: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: INDICATOR_HEIGHT / 2,
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
    overflow: "hidden",
  },
  // Same visual size as the 22px line icons next to it.
  trefixDisc: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  // Same size as the coach disc, so the two round items match.
  profileAvatarBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
  },
  profileAvatar: {
    width: "100%",
    height: "100%",
  },
  profileFallback: {
    fontSize: 10,
    lineHeight: 11,
  },
});
