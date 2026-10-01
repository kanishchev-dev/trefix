import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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
import Animated, {
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SHEET_SPRING_CONFIG = {
  damping: 28,
  stiffness: 220,
  mass: 0.8,
};

const STACK_BG_SCALE = 0.92;
const STACK_BG_OFFSET = -24;
const MAX_STACK_LAYERS = 8;
const MAX_VISIBLE_STACK_LAYERS = 3;

type SheetStackApi = {
  pop: () => void;
};

const SheetStackContext = React.createContext<SheetStackApi | null>(null);

export function useSheetStack(): SheetStackApi {
  const api = React.useContext(SheetStackContext);
  if (!api) {
    throw new Error("useSheetStack must be used within a stack-mode BottomSheet");
  }
  return api;
}

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  renderHeader?: () => ReactNode;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  children?: ReactNode;
  mode?: "single" | "stack";
  animatedHide?: boolean;
  onStackPop?: () => void;
  onDismissRequest?: () => void;
};

export function BottomSheet({
  visible,
  onClose,
  title,
  renderHeader,
  theme,
  themeMode,
  children,
  mode = "single",
  animatedHide = false,
  onStackPop,
  onDismissRequest,
}: BottomSheetProps) {
  const isStack = mode === "stack";

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const stackLayerOffsets = [
    useSharedValue(SCREEN_HEIGHT),
    useSharedValue(SCREEN_HEIGHT),
    useSharedValue(SCREEN_HEIGHT),
    useSharedValue(SCREEN_HEIGHT),
    useSharedValue(SCREEN_HEIGHT),
    useSharedValue(SCREEN_HEIGHT),
    useSharedValue(SCREEN_HEIGHT),
    useSharedValue(SCREEN_HEIGHT),
  ];
  const stackLayerOffsetsRef = useRef(stackLayerOffsets);
  stackLayerOffsetsRef.current = stackLayerOffsets;

  const [hideMounted, setHideMounted] = useState(visible);
  const [stackMounted, setStackMounted] = useState(visible);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const layerCountRef = useRef(1);
  const exitRemaining = useSharedValue(0);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const finishSingleClose = useCallback(() => {
    if (animatedHide) {
      setHideMounted(false);
    }
    onCloseRef.current();
  }, [animatedHide]);

  const handleSingleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, () => {
      runOnJS(finishSingleClose)();
    });
  }, [backdropOpacity, finishSingleClose, translateY]);

  const handleSingleGesture = Gesture.Pan()
    .activeOffsetY([5, 5])
    .onChange((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        runOnJS(handleSingleClose)();
      } else {
        translateY.value = withSpring(0, SHEET_SPRING_CONFIG);
      }
    });

  useEffect(() => {
    if (isStack) {
      return;
    }

    if (visible) {
      if (animatedHide) {
        setHideMounted(true);
      }
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;
      backdropOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, SHEET_SPRING_CONFIG);
      return;
    }

    if (!animatedHide) {
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;
    }
  }, [animatedHide, backdropOpacity, isStack, translateY, visible]);

  useEffect(() => {
    if (isStack || !animatedHide) {
      return;
    }

    if (!visible && hideMounted) {
      backdropOpacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, () => {
        runOnJS(finishSingleClose)();
      });
    }
  }, [animatedHide, backdropOpacity, finishSingleClose, hideMounted, isStack, translateY, visible]);

  const finishStackExit = useCallback(() => {
    setStackMounted(false);
    onCloseRef.current();
  }, []);

  const exitStackAnimated = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });

    const count = Math.min(layerCountRef.current, MAX_STACK_LAYERS);
    if (count === 0) {
      finishStackExit();
      return;
    }

    exitRemaining.value = count;
    for (let index = 0; index < count; index += 1) {
      stackLayerOffsetsRef.current[index].value = withTiming(
        SCREEN_HEIGHT,
        { duration: 240 },
        () => {
          exitRemaining.value -= 1;
          if (exitRemaining.value === 0) {
            runOnJS(finishStackExit)();
          }
        },
      );
    }
  }, [backdropOpacity, exitRemaining, finishStackExit]);

  useEffect(() => {
    if (!isStack) {
      return;
    }

    if (visible) {
      setStackMounted(true);
      backdropOpacity.value = withTiming(1, { duration: 200 });
      return;
    }

    if (stackMounted) {
      exitStackAnimated();
    }
  }, [backdropOpacity, exitStackAnimated, isStack, stackMounted, visible]);

  const finishPop = useCallback(() => {
    setIsTransitioning(false);
    onStackPop?.();
  }, [onStackPop]);

  const popTopLayer = useCallback(() => {
    if (isTransitioning) {
      return;
    }

    const topIndex = Math.min(layerCountRef.current - 1, MAX_STACK_LAYERS - 1);
    if (topIndex < 0) {
      return;
    }

    const topOffset = stackLayerOffsetsRef.current[topIndex];
    if (!topOffset) {
      return;
    }

    setIsTransitioning(true);
    topOffset.value = withSpring(SCREEN_HEIGHT, SHEET_SPRING_CONFIG, () => {
      runOnJS(finishPop)();
    });
  }, [finishPop, isTransitioning]);

  const requestStackDismiss = useCallback(() => {
    const topIndex = Math.min(layerCountRef.current - 1, MAX_STACK_LAYERS - 1);
    const topOffset = stackLayerOffsetsRef.current[topIndex];

    if (onDismissRequest) {
      if (topOffset) {
        topOffset.value = withSpring(0, SHEET_SPRING_CONFIG);
      }
      onDismissRequest();
      return;
    }

    exitStackAnimated();
  }, [exitStackAnimated, onDismissRequest]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const stackApi = useMemo<SheetStackApi>(
    () => ({ pop: popTopLayer }),
    [popTopLayer],
  );

  if (!isStack) {
    return (
      <Modal animationType="none" onRequestClose={handleSingleClose} transparent visible={animatedHide ? hideMounted : visible}>
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
            <Pressable style={StyleSheet.absoluteFill} onPress={handleSingleClose}>
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
              <GestureDetector gesture={handleSingleGesture}>
                <View style={[styles.topDragArea, styles.paddedContent]}>
                  <View style={styles.handleContainer}>
                    <View style={[styles.handle, { backgroundColor: theme.color.border }]} />
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

  const layers = React.Children.toArray(children);
  const logicalLayerCount = Math.max(layers.length, 1);
  layerCountRef.current = logicalLayerCount;

  const visibleStartIndex = Math.max(logicalLayerCount - MAX_VISIBLE_STACK_LAYERS, 0);
  const visibleLayers = layers.slice(visibleStartIndex);
  const activeLocalIndex = visibleLayers.length - 1;
  const canPop = logicalLayerCount > 1;

  const handleBackdropTap = () => {
    if (canPop) {
      popTopLayer();
      return;
    }
    requestStackDismiss();
  };

  const activeOriginalIndex = Math.min(visibleStartIndex + activeLocalIndex, MAX_STACK_LAYERS - 1);

  return (
    <Modal
      animationType="none"
      onRequestClose={() => {
        if (canPop) {
          popTopLayer();
          return;
        }
        requestStackDismiss();
      }}
      transparent
      visible={stackMounted}
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
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropTap}>
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={themeMode} />
          </Pressable>
        </Animated.View>

        <SheetStackContext.Provider value={stackApi}>
          {visibleLayers.map((layer, localIndex) => {
            const originalIndex = visibleStartIndex + localIndex;
            const isTopLayer = localIndex === activeLocalIndex;
            const layerIndex = Math.min(originalIndex, MAX_STACK_LAYERS - 1);
            const activeLayerOffset = isTopLayer
              ? null
              : stackLayerOffsets[Math.min(activeOriginalIndex, MAX_STACK_LAYERS - 1)];

            return (
              <StackLayer
                key={originalIndex}
                layerIndex={localIndex}
                activeIndex={activeLocalIndex}
                layerY={stackLayerOffsets[layerIndex]}
                sheetVisible={stackMounted}
                isTransitioning={isTransitioning}
                activeLayerOffset={activeLayerOffset}
                theme={theme}
                themeMode={themeMode}
                onDragEnd={(shouldClose) => {
                  if (!shouldClose) {
                    return;
                  }
                  if (originalIndex === 0) {
                    requestStackDismiss();
                  } else {
                    popTopLayer();
                  }
                }}
              >
                {layer}
              </StackLayer>
            );
          })}
        </SheetStackContext.Provider>
      </View>
    </Modal>
  );
}

function StackLayer({
  layerIndex,
  activeIndex,
  layerY,
  sheetVisible,
  isTransitioning,
  activeLayerOffset,
  theme,
  themeMode,
  onDragEnd,
  children,
}: {
  layerIndex: number;
  activeIndex: number;
  layerY: SharedValue<number>;
  sheetVisible: boolean;
  isTransitioning: boolean;
  activeLayerOffset: SharedValue<number> | null;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onDragEnd: (shouldClose: boolean) => void;
  children: ReactNode;
}) {
  const isTopLayer = layerIndex === activeIndex;

  useEffect(() => {
    if (sheetVisible) {
      layerY.value = withSpring(0, SHEET_SPRING_CONFIG);
    }
  }, [layerY, sheetVisible]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([5, 5])
    .enabled(isTopLayer && !isTransitioning)
    .onChange((event) => {
      if (event.translationY > 0) {
        layerY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      const shouldClose = event.translationY > 100 || event.velocityY > 500;
      if (!shouldClose) {
        layerY.value = withSpring(0, SHEET_SPRING_CONFIG);
        return;
      }
      runOnJS(onDragEnd)(true);
    });

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: layerY.value }],
  }));

  const backgroundAnimatedStyle = useAnimatedStyle(() => {
    if (isTopLayer || !activeLayerOffset) {
      return {};
    }

    const progress = 1 - activeLayerOffset.value / SCREEN_HEIGHT;
    return {
      transform: [
        {
          translateY: interpolate(progress, [0, 1], [0, STACK_BG_OFFSET], "clamp"),
        },
        {
          scale: interpolate(progress, [0, 1], [1, STACK_BG_SCALE], "clamp"),
        },
      ],
    };
  });

  const cardStyle =
    isTopLayer || activeLayerOffset === null
      ? [styles.stackLayerCardWrapper]
      : [styles.stackLayerCardWrapper, backgroundAnimatedStyle];

  return (
    <Animated.View
      pointerEvents={isTopLayer ? "auto" : "none"}
      style={[styles.stackLayerContainer, containerAnimatedStyle]}
    >
      <Animated.View style={cardStyle}>
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
                <View style={[styles.handle, { backgroundColor: theme.color.border }]} />
              </View>
            </View>
          </GestureDetector>

          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

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
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === value));
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
          translateX: interpolate(activeTabX.value, [0, tabs.length - 1], [4, 4 + tabWidth]),
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
                  color: isActive ? theme.color.primaryForeground : theme.color.mutedForeground,
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
  stackLayerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    maxHeight: "85%",
    zIndex: 1,
  },
  stackLayerCardWrapper: {
    marginBottom: 8,
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
