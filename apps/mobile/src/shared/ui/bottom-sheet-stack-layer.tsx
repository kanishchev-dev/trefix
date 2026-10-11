import React, { type ReactNode, useEffect, useRef } from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { withAlpha, type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import {
  SHEET_SPRING_CONFIG,
  STACK_BG_SCALE,
  STACK_SPRING_CONFIG,
  getStackLayerTargetY,
  type StackLayerRole,
} from "./bottom-sheet-stack";
import { styles } from "./bottom-sheet.styles";

export function StackLayer({
  role,
  title,
  layerY,
  layerScale,
  layerOpacity,
  sheetVisible,
  isTransitioning,
  theme,
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

    const spring = hasEnteredRef.current
      ? STACK_SPRING_CONFIG
      : SHEET_SPRING_CONFIG;
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
        layerY.value = withSpring(
          getStackLayerTargetY(role),
          STACK_SPRING_CONFIG,
        );
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
              borderColor: theme.color.controlBorder,
              backgroundColor: theme.color.sheet,
            },
          ]}
        >
          <GestureDetector gesture={panGesture}>
            <View style={[styles.topDragArea, styles.paddedContent]}>
              <View style={styles.handleContainer}>
                <View
                  style={[
                    styles.handle,
                    { backgroundColor: theme.color.border },
                  ]}
                />
              </View>

              {title !== undefined ? (
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
      </View>
    </Animated.View>
  );
}
