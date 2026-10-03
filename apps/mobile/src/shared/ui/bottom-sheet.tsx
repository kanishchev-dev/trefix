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

// Stack look: every card has the same fixed height, so the active sheet always
// sits at exactly the same position while the previous one peeks out above it.
// Layers older than the previous one are parked fully off-screen (only two
// windows are ever visible at once), fading in/out when they enter/leave.
const STACK_BG_SCALE = 0.92;
const STACK_BG_OFFSET = -48;
const MAX_STACK_LAYERS = 8;
const STACK_CARD_HEIGHT = Math.round(SCREEN_HEIGHT * 0.78);
const STACK_PARKED_OFFSET = 140;
const STACK_SPRING_CONFIG = {
  damping: 30,
  stiffness: 380,
  mass: 0.9,
};
// Close timing matches the single-sheet close exactly (translateY 220ms +
// 200ms backdrop fade), so the plan-creation stack feels identical.
const STACK_EXIT_TIMING = { duration: 220 };
const STACK_FADE_IN = { duration: 160 };
const STACK_FADE_OUT = { duration: 140 };

type StackLayerRole = "top" | "behind" | "parked";

function getStackLayerRole(layerIndex: number, layerCount: number): StackLayerRole {
  if (layerIndex >= layerCount) {
    return "parked";
  }
  if (layerIndex === layerCount - 1) {
    return "top";
  }
  if (layerIndex === layerCount - 2) {
    return "behind";
  }
  return "parked";
}

function getStackLayerTargetY(role: StackLayerRole): number {
  if (role === "top") {
    return 0;
  }
  if (role === "behind") {
    return STACK_BG_OFFSET;
  }
  return SCREEN_HEIGHT + STACK_PARKED_OFFSET;
}

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
  /** Stack mode: standard header title per layer, aligned with children order. */
  layerTitles?: string[];
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
  layerTitles,
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

  const stackLayerScales = [
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
    useSharedValue(1),
  ];
  const stackLayerScalesRef = useRef(stackLayerScales);
  stackLayerScalesRef.current = stackLayerScales;

  const layerOpacities = [
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
    useSharedValue(0),
  ];

  const [hideMounted, setHideMounted] = useState(visible);
  const [stackMounted, setStackMounted] = useState(visible);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const layerCountRef = useRef(1);
  // The guard lives in a ref: state closures can go stale, and a lost
  // Reanimated completion callback would block every future pop forever.
  const isTransitioningRef = useRef(false);
  const popTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLayerCountRef = useRef<number | null>(null);

  const layers = React.Children.toArray(children);
  const logicalLayerCount = Math.max(layers.length, 1);
  layerCountRef.current = Math.min(logicalLayerCount, MAX_STACK_LAYERS);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Keep layer opacities in sync with the stack: visible windows are opaque,
  // parked ones are fully transparent (animated, so the third window fades
  // in/out instead of popping).
  useEffect(() => {
    if (!isStack) {
      return;
    }

    if (prevLayerCountRef.current === logicalLayerCount) {
      return;
    }
    prevLayerCountRef.current = logicalLayerCount;

    for (let index = 0; index < MAX_STACK_LAYERS; index += 1) {
      const shouldShow = index < logicalLayerCount;
      const opacity = layerOpacities[index];

      if (shouldShow && opacity.value < 1) {
        if (index === logicalLayerCount - 1) {
          // The entering top layer slides in like a single sheet — no fade,
          // otherwise the open animation would differ from the reference.
          opacity.value = 1;
        } else {
          opacity.value = withTiming(1, STACK_FADE_IN);
        }
      } else if (!shouldShow && opacity.value > 0) {
        opacity.value = withTiming(0, STACK_FADE_OUT);
      }
    }
  }, [isStack, layerOpacities, logicalLayerCount]);

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
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    isTransitioningRef.current = false;
    setIsTransitioning(false);
    setStackMounted(false);
    onCloseRef.current();
  }, []);

  const exitStackAnimated = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });

    const count = Math.min(layerCountRef.current, MAX_STACK_LAYERS);
    for (let index = 0; index < count; index += 1) {
      const offset = stackLayerOffsetsRef.current[index];
      if (offset) {
        offset.value = withTiming(SCREEN_HEIGHT, STACK_EXIT_TIMING);
      }
    }

    // Completion is driven by a plain timer: animation callbacks can be
    // dropped when an animation gets interrupted, which used to leave the
    // stack stuck in a "transitioning" state with dead pop gestures.
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }
    exitTimerRef.current = setTimeout(finishStackExit, STACK_EXIT_TIMING.duration + 60);
  }, [backdropOpacity, finishStackExit]);

  useEffect(() => {
    if (!isStack) {
      return;
    }

    if (visible) {
      setStackMounted(true);
      setIsTransitioning(false);
      isTransitioningRef.current = false;
      backdropOpacity.value = withTiming(1, { duration: 200 });
      return;
    }

    if (stackMounted) {
      exitStackAnimated();
    }
  }, [backdropOpacity, exitStackAnimated, isStack, stackMounted, visible]);

  const finishPop = useCallback(() => {
    if (popTimerRef.current) {
      clearTimeout(popTimerRef.current);
      popTimerRef.current = null;
    }
    isTransitioningRef.current = false;
    setIsTransitioning(false);
    onStackPop?.();
  }, [onStackPop]);

  const popTopLayer = useCallback(() => {
    if (isTransitioningRef.current) {
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

    isTransitioningRef.current = true;
    setIsTransitioning(true);
    topOffset.value = withTiming(SCREEN_HEIGHT, STACK_EXIT_TIMING);

    // The window underneath starts returning immediately: both animations run
    // in parallel, so the pop feels like one synchronized move.
    const behindIndex = topIndex - 1;
    if (behindIndex >= 0) {
      const behindOffset = stackLayerOffsetsRef.current[behindIndex];
      const behindScale = stackLayerScalesRef.current[behindIndex];
      if (behindOffset) {
        behindOffset.value = withSpring(0, STACK_SPRING_CONFIG);
      }
      if (behindScale) {
        behindScale.value = withSpring(1, STACK_SPRING_CONFIG);
      }
    }

    popTimerRef.current = setTimeout(finishPop, STACK_EXIT_TIMING.duration + 40);
  }, [finishPop]);

  // Swipe-down on the first (single) layer closes the whole stack with the
  // same animated exit, bypassing onDismissRequest.
  const dismissStackBySwipe = useCallback(() => {
    if (isTransitioningRef.current) {
      return;
    }
    isTransitioningRef.current = true;
    setIsTransitioning(true);
    exitStackAnimated();
  }, [exitStackAnimated]);

  useEffect(() => {
    return () => {
      if (popTimerRef.current) {
        clearTimeout(popTimerRef.current);
      }
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

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
          <Animated.View style={[styles.backdropContainer, backdropAnimatedStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={handleSingleClose} />
          </Animated.View>

          <Animated.View style={[styles.container, { marginBottom: 0 }, cardAnimatedStyle]}>
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

              <View style={styles.sheetContent}>{children}</View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  }

  const canPop = logicalLayerCount > 1;

  const handleBackdropTap = () => {
    if (canPop) {
      popTopLayer();
      return;
    }
    requestStackDismiss();
  };

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
        <Animated.View style={[styles.backdropContainer, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropTap} />
        </Animated.View>

        <SheetStackContext.Provider value={stackApi}>
          {layers.map((layer, index) => {
            if (index >= MAX_STACK_LAYERS) {
              return null;
            }

            return (
              <StackLayer
                key={index}
                role={getStackLayerRole(index, logicalLayerCount)}
                title={layerTitles?.[index]}
                layerY={stackLayerOffsets[index]}
                layerScale={stackLayerScales[index]}
                layerOpacity={layerOpacities[index]}
                sheetVisible={stackMounted}
                isTransitioning={isTransitioning}
                theme={theme}
                themeMode={themeMode}
                onDragEnd={(shouldClose) => {
                  if (!shouldClose) {
                    return;
                  }
                  if (logicalLayerCount <= 1) {
                    dismissStackBySwipe();
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
  role,
  title,
  layerY,
  layerScale,
  layerOpacity,
  sheetVisible,
  isTransitioning,
  theme,
  themeMode,
  onDragEnd,
  children,
}: {
  role: StackLayerRole;
  title?: string;
  layerY: SharedValue<number>;
  layerScale: SharedValue<number>;
  layerOpacity: SharedValue<number>;
  sheetVisible: boolean;
  isTransitioning: boolean;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  onDragEnd: (shouldClose: boolean) => void;
  children: ReactNode;
}) {
  const isTopLayer = role === "top";

  // A layer's first animation is its entrance (sheet opening or a new step
  // pushed in) — it must match the single-sheet open animation exactly.
  // Later role changes are internal stack navigation and stay snappy.
  const hasEnteredRef = useRef(false);

  // Every role change retargets the layer: the active card always settles at
  // the exact same position, the previous one right above it, older ones park
  // off-screen.
  useEffect(() => {
    if (!sheetVisible) {
      hasEnteredRef.current = false;
      return;
    }

    const spring = hasEnteredRef.current ? STACK_SPRING_CONFIG : SHEET_SPRING_CONFIG;
    hasEnteredRef.current = true;

    layerY.value = withSpring(getStackLayerTargetY(role), spring);
    layerScale.value = withSpring(role === "top" ? 1 : STACK_BG_SCALE, spring);
  }, [layerScale, layerY, role, sheetVisible]);

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
        layerY.value = withSpring(getStackLayerTargetY(role), STACK_SPRING_CONFIG);
        return;
      }
      runOnJS(onDragEnd)(true);
    });

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: layerY.value }, { scale: layerScale.value }],
    opacity: layerOpacity.value,
  }));

  return (
    <Animated.View
      pointerEvents={isTopLayer ? "auto" : "none"}
      style={[
        styles.stackLayerContainer,
        containerAnimatedStyle,
        { zIndex: isTopLayer ? 3 : 2 },
      ]}
    >
      <View style={styles.stackLayerCardWrapper}>
        <View
          style={[
            styles.card,
            styles.stackCard,
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


              {title !== undefined ? (
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

          <View style={styles.sheetContent}>{children}</View>
        </View>
      </View>
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

/**
 * Content wrapper for sheet bodies.
 *
 * Sheets give their content a default horizontal padding (see
 * styles.sheetContentPadding). Blocks that must run edge-to-edge (sliders,
 * full-bleed media, etc.) set `edgeToEdge` and the wrapper compensates with
 * negative margins, so only the wrapper needs to know about padding.
 */
export function SheetBlock({
  theme,
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
    zIndex: 1,
  },
  stackLayerCardWrapper: {
    marginBottom: 0,
  },
  card: {
    borderRadius: 44,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    gap: 0,
    overflow: "hidden",
  },
  stackCard: {
    height: STACK_CARD_HEIGHT,
    overflow: "hidden",
  },
  paddedContent: {
    paddingHorizontal: 20,
  },
  topDragArea: {
    width: "100%",
    gap: 8,
    backgroundColor: "transparent",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 4,
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
  sheetContent: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 16,
  },
  sheetContentPadding: {
    paddingHorizontal: 20,
  },
  sheetContentBleed: {
    marginHorizontal: -20,
  },
});
