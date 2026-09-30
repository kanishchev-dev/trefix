import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
  interpolate,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

/**
 * App-wide canonical bottom sheet shell.
 *
 * This is extracted 1:1 from the reference sheet — the workout goal sheet
 * on the Today screen (opened from the "add workout" type buttons):
 * floating rounded card, blur backdrop, spring slide-up, drag-to-close.
 * Every sheet in the app must render inside this shell.
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  renderHeader,
  theme,
  themeMode,
  children,
}: {
  visible: boolean;
  /** Called after the close animation finishes (backdrop tap, drag, dismiss). */
  onClose: () => void;
  /** Centered title under the handle; renderHeader takes precedence when provided. */
  title?: string;
  /** Replaces the title row entirely (keeps the handle). */
  renderHeader?: () => ReactNode;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  children?: ReactNode;
}) {
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, () => {
      runOnJS(onClose)();
    });
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;

      backdropOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, {
        damping: 28,
        stiffness: 220,
        mass: 0.8,
      });
    } else {
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([5, 5])
    .onChange((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, {
          damping: 28,
          stiffness: 220,
          mass: 0.8,
        });
      }
    });

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Modal
      animationType="none"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdropContainer,
            {
              backgroundColor:
                themeMode === "dark"
                  ? "rgba(0, 0, 0, 0.4)"
                  : "rgba(255, 255, 255, 0.4)",
            },
            backdropAnimatedStyle,
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={themeMode} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.container, { marginBottom: 8 }, cardAnimatedStyle]}>
          <View
            style={[
              styles.card,
              {
                borderColor:
                  themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
                backgroundColor:
                  themeMode === "dark" ? "#121214" : theme.color.surfaceElevated,
              },
            ]}
          >
            <GestureDetector gesture={panGesture}>
              <View style={[styles.topDragArea, styles.paddedContent]}>
                <View style={styles.handleContainer}>
                  <View
                    style={[styles.handle, { backgroundColor: theme.color.border }]}
                  />
                </View>

                {renderHeader ? (
                  renderHeader()
                ) : title !== undefined ? (
                  <View style={styles.header}>
                    <Text
                      style={[
                        styles.title,
                        {
                          color: theme.color.foreground,
                          fontFamily: theme.typography.fontFamily.sans.semibold,
                        },
                      ]}
                    >
                      {title}
                    </Text>
                  </View>
                ) : null}
              </View>
            </GestureDetector>

            {children}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Standard action pill button used inside sheets (cancel/submit rows). */
export function SheetButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  pending = false,
  theme,
  themeMode,
  trailing,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  pending?: boolean;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  trailing?: ReactNode;
  style?: object;
}) {
  const isDark = themeMode === "dark";

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
              : isDark
                ? "#1a1a1e"
                : theme.color.secondary,
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

/** Small uppercase section label used inside sheets. */
export function SheetSectionLabel({ text, theme }: { text: string; theme: ThemeTokens }) {
  return (
    <Text
      style={[
        styles.sectionLabel,
        {
          color: theme.color.mutedForeground,
          fontFamily: theme.typography.fontFamily.sans.bold,
        },
      ]}
    >
      {text}
    </Text>
  );
}

/**
 * Animated pill tab switcher (Дистанция / Время in the reference sheet).
 * Two tabs with a spring-animated active indicator.
 */
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
  }, [activeIndex]);

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
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.tab}>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropContainer: {
    ...StyleSheet.absoluteFill,
  },
  container: {
    width: "100%",
    paddingHorizontal: 8,
    maxHeight: "85%",
    zIndex: 1,
  },
  card: {
    borderRadius: 44,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 0,
    gap: 16,
    overflow: "visible",
  },
  paddedContent: {
    paddingHorizontal: 20,
  },
  topDragArea: {
    width: "100%",
    gap: 8,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    borderRadius: 9999,
    borderWidth: 0,
    padding: 4,
    position: "relative",
    overflow: "hidden",
  },
  activeTabIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 9999,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: "center",
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    lineHeight: 18,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
  },
});
