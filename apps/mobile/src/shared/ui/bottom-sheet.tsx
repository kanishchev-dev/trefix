import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { withAlpha, type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import {
  SCREEN_HEIGHT,
  SHEET_SPRING_CONFIG,
  MAX_STACK_LAYERS,
  STACK_SPRING_CONFIG,
  STACK_EXIT_TIMING,
  STACK_FADE_IN,
  STACK_FADE_OUT,
  getStackLayerRole,
} from "./bottom-sheet-stack";
import { styles } from "./bottom-sheet.styles";
import { StackLayer } from "./bottom-sheet-stack-layer";
export {
  SheetButton,
  SheetSectionLabel,
  SheetBlock,
  SheetTabs,
} from "./sheet-controls";

type SheetStackApi = {
  pop: () => void;
};

const SheetStackContext = React.createContext<SheetStackApi | null>(null);

export function useSheetStack(): SheetStackApi {
  const api = React.useContext(SheetStackContext);
  if (!api) {
    throw new Error(
      "useSheetStack must be used within a stack-mode BottomSheet",
    );
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
  // Shared values are stable; the array literal is not, so effects read it through a ref.
  const layerOpacitiesRef = useRef(layerOpacities);
  layerOpacitiesRef.current = layerOpacities;

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
      const opacity = layerOpacitiesRef.current[index];

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
  }, [isStack, logicalLayerCount]);

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
  }, [
    animatedHide,
    backdropOpacity,
    finishSingleClose,
    hideMounted,
    isStack,
    translateY,
    visible,
  ]);

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
    exitTimerRef.current = setTimeout(
      finishStackExit,
      STACK_EXIT_TIMING.duration + 60,
    );
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

    popTimerRef.current = setTimeout(
      finishPop,
      STACK_EXIT_TIMING.duration + 40,
    );
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
      <Modal
        animationType="none"
        onRequestClose={handleSingleClose}
        transparent
        visible={animatedHide ? hideMounted : visible}
      >
        <View style={styles.overlay}>
          <Animated.View
            style={[styles.backdropContainer, backdropAnimatedStyle]}
          >
            <BlurView
              intensity={25}
              tint={themeMode === "dark" ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={handleSingleClose}
            />
          </Animated.View>

          <Animated.View
            style={[styles.container, { marginBottom: 8 }, cardAnimatedStyle]}
          >
            <View
              style={[
                styles.card,
                {
                  borderColor: theme.color.controlBorder,
                  backgroundColor: theme.color.sheet,
                },
              ]}
            >
              <GestureDetector gesture={handleSingleGesture}>
                <View style={[styles.topDragArea, styles.paddedContent]}>
                  <View style={styles.handleContainer}>
                    <View
                      style={[
                        styles.handle,
                        { backgroundColor: theme.color.border },
                      ]}
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
                            fontFamily: theme.typography.fontFamily.sans.medium,
                          },
                        ]}
                      >
                        {title}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </GestureDetector>

              <View style={styles.sheetContent}>
                {children}
                <LinearGradient
                  colors={[
                    withAlpha(theme.color.sheet, 0.95),
                    withAlpha(theme.color.sheet, 0),
                  ]}
                  style={styles.topFade}
                  pointerEvents="none"
                />
                <LinearGradient
                  colors={[
                    withAlpha(theme.color.sheet, 0),
                    withAlpha(theme.color.sheet, 0.95),
                  ]}
                  style={styles.bottomFade}
                  pointerEvents="none"
                />
              </View>
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
        <Animated.View
          style={[styles.backdropContainer, backdropAnimatedStyle]}
        >
          <BlurView
            intensity={25}
            tint={themeMode === "dark" ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropTap}
          />
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
