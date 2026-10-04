import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Minus, Plus } from "lucide-react-native";
import { type ThemeMode } from "@workspace/tokens";
import { type ValueControlProps } from "./value-control-types";

export type RulerProps = ValueControlProps<number> & {
  unit?: string;
  /** Every N units a tick is drawn long (default: 1 for fractional steps, 5×step otherwise). */
  majorEvery?: number;
  /** Every N units a tick gets a numeric label (default: majorEvery). */
  labelEvery?: number;
  /** Horizontal distance between neighbouring ticks, px. */
  tickSpacing?: number;
  /** How far a fling carries: projected distance = velocity × momentum (s). */
  momentum?: number;
  themeMode?: ThemeMode;
};

const RULER_HEIGHT = 64;
const MINOR_TICK = 12;
const MAJOR_TICK = 22;
const INDICATOR_HEIGHT = 34;
/** Extra ticks rendered beyond the viewport so fast flings never show gaps. */
const TICK_BUFFER = 40;
const EPSILON = 1e-6;
/** Wide enough for "1:45:00"-style labels. */
const TICK_LABEL_WIDTH = 56;

const SNAP_SPRING = { damping: 26, stiffness: 140, mass: 1 } as const;

function isMultiple(value: number, of: number) {
  const ratio = value / of;
  return Math.abs(ratio - Math.round(ratio)) < EPSILON;
}

function defaultFormat(value: number, step: number) {
  if (step >= 1) return String(Math.round(value));
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

const VALUE_FONT_SIZE = 34;
const VALUE_LINE_HEIGHT = 40;
const DIGIT_FADE_MS = 160;

/**
 * One character slot: on change the old glyph fades out over the new one
 * fading in, in place. No movement, so nothing can leave the slot.
 */
function FadeSlot({
  char,
  style,
}: {
  char: string;
  style: React.ComponentProps<typeof Text>["style"];
}) {
  const [previous, setPrevious] = useState<string | null>(null);
  const lastChar = useRef(char);
  const progress = useSharedValue(1);

  // Layout effect: start from opacity 0 before the new glyph is painted.
  useLayoutEffect(() => {
    if (lastChar.current === char) return;
    setPrevious(lastChar.current);
    lastChar.current = char;
    progress.value = 0;
    progress.value = withTiming(1, { duration: DIGIT_FADE_MS }, (finished) => {
      if (finished) runOnJS(setPrevious)(null);
    });
  }, [char, progress]);

  const fadeInStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const fadeOutStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));

  return (
    <View>
      <Animated.Text style={[style, fadeInStyle]}>{char}</Animated.Text>
      {previous !== null ? (
        <Animated.Text style={[style, styles.fadeOutGlyph, fadeOutStyle]}>{previous}</Animated.Text>
      ) : null}
    </View>
  );
}

/**
 * Number with per-character crossfade. Slots are keyed from the right edge
 * so "9.5 → 10" fades only the characters that actually changed.
 */
function RollingNumber({
  text,
  style,
}: {
  text: string;
  style: React.ComponentProps<typeof Text>["style"];
}) {
  const chars = text.split("");
  return (
    <View style={styles.rollingRow}>
      {chars.map((char, index) => (
        <FadeSlot key={`slot-${chars.length - index}`} char={char} style={style} />
      ))}
    </View>
  );
}

/**
 * Value picker: "− 10 км +" on top, a draggable centimetre-like ruler below.
 * Behaves like Wheel horizontally: drag, fling with momentum, snap to step,
 * haptic tick on every step. No background / selection chrome by design.
 */
export function Ruler({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  formatValue,
  formatLabel,
  accessibilityLabel,
  theme,
  themeMode,
  unit,
  majorEvery,
  labelEvery,
  tickSpacing = 12,
  momentum = 0.25,
}: RulerProps) {
  const isDark =
    themeMode === "dark" ||
    theme?.color.background === "#09090b" ||
    theme?.color.surface === "#111111";
  const foreground = theme?.color.foreground || (isDark ? "#f8fafc" : "#09090b");
  const muted = theme?.color.mutedForeground || (isDark ? "#a1a1aa" : "#71717a");

  const major = majorEvery ?? (step < 1 ? 1 : step * 5);
  const labelStep = labelEvery ?? major;

  const tickCount = Math.max(0, Math.round((max - min) / step));
  const maxOffset = tickCount * tickSpacing;

  const clampIndex = useCallback(
    (index: number) => Math.max(0, Math.min(tickCount, index)),
    [tickCount],
  );
  const indexOf = useCallback(
    (v: number) => clampIndex(Math.round((v - min) / step)),
    [clampIndex, min, step],
  );
  const valueAt = useCallback(
    (index: number) => Number((min + index * step).toFixed(4)),
    [min, step],
  );

  const format = useCallback(
    (v: number) => (formatValue ? formatValue(v) : defaultFormat(v, step)),
    [formatValue, step],
  );

  const [width, setWidth] = useState(0);
  const [centerIndex, setCenterIndex] = useState(() => indexOf(value));

  /** Scroll offset in px: 0 = min value under the indicator. */
  const offset = useSharedValue(indexOf(value) * tickSpacing);
  const isInteracting = useSharedValue(false);
  const lastIndex = useSharedValue(indexOf(value));

  const triggerHaptic = useCallback(() => {
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const handleIndexCross = useCallback(
    (index: number) => {
      setCenterIndex(index);
      triggerHaptic();
    },
    [triggerHaptic],
  );

  const commitIndex = useCallback(
    (index: number) => {
      const next = valueAt(index);
      if (Math.abs(next - value) > EPSILON) onChange(next);
    },
    [onChange, value, valueAt],
  );

  // Follow external value changes (presets, other controls) when idle.
  useEffect(() => {
    if (isInteracting.value) return;
    const index = indexOf(value);
    lastIndex.value = index;
    setCenterIndex(index);
    offset.value = withSpring(index * tickSpacing, SNAP_SPRING);
  }, [value, indexOf, tickSpacing, offset, isInteracting, lastIndex]);

  // Live index while dragging / flinging → display value + haptics.
  useAnimatedReaction(
    () => Math.max(0, Math.min(tickCount, Math.round(offset.value / tickSpacing))),
    (index, previous) => {
      if (previous === null || index === previous || index === lastIndex.value) return;
      lastIndex.value = index;
      runOnJS(handleIndexCross)(index);
    },
    [tickCount, tickSpacing, handleIndexCross],
  );

  const snapTo = useCallback(
    (index: number) => {
      const target = clampIndex(index);
      offset.value = withSpring(target * tickSpacing, SNAP_SPRING);
      setCenterIndex(target);
      commitIndex(target);
    },
    [clampIndex, commitIndex, offset, tickSpacing],
  );

  const panGesture = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetX([-6, 6])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      "worklet";
      isInteracting.value = true;
      cancelAnimation(offset);
    })
    .onChange((event) => {
      "worklet";
      const next = offset.value - event.changeX;
      // Rubber-band past the ends.
      offset.value = next < 0 || next > maxOffset ? offset.value - event.changeX * 0.3 : next;
    })
    .onEnd((event) => {
      "worklet";
      const projected = offset.value - event.velocityX * momentum;
      const index = Math.max(0, Math.min(tickCount, Math.round(projected / tickSpacing)));
      offset.value = withSpring(
        index * tickSpacing,
        { ...SNAP_SPRING, velocity: -event.velocityX },
        (finished) => {
          if (finished) isInteracting.value = false;
        },
      );
      runOnJS(commitIndex)(index);
    })
    .onFinalize((_event, success) => {
      "worklet";
      // Tap without pan: release the lock so external updates apply again.
      if (!success) isInteracting.value = false;
    });

  const stripStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: width / 2 - offset.value }],
  }));

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  // Window-render only ticks around the centre; keeps ~100 views instead of hundreds.
  const ticks = useMemo(() => {
    if (width === 0) return [];
    const half = Math.ceil(width / 2 / tickSpacing);
    const from = Math.max(0, centerIndex - half - TICK_BUFFER);
    const to = Math.min(tickCount, centerIndex + half + TICK_BUFFER);
    const list: { index: number; value: number; isMajor: boolean; hasLabel: boolean; opacity: number }[] = [];
    for (let index = from; index <= to; index += 1) {
      const tickValue = valueAt(index);
      const distance = Math.abs(index - centerIndex) * tickSpacing;
      list.push({
        index,
        value: tickValue,
        isMajor: isMultiple(tickValue, major),
        hasLabel: isMultiple(tickValue, labelStep),
        // Fade towards the edges instead of a gradient mask (no background by design).
        opacity: Math.max(0.08, 1 - (distance / (width / 2)) * 0.92),
      });
    }
    return list;
  }, [width, tickSpacing, centerIndex, tickCount, valueAt, major, labelStep]);

  const displayIndex = centerIndex;
  const displayValue = valueAt(displayIndex);

  const bump = (direction: 1 | -1) => {
    if (disabled) return;
    cancelAnimation(offset);
    triggerHaptic();
    snapTo(indexOf(value) + direction);
  };

  const textFont = theme?.typography.fontFamily.sans.medium || "System";
  const labelFont = theme?.typography.fontFamily.sans.medium || "System";

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ text: `${format(value)}${unit ? ` ${unit}` : ""}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) => bump(event.nativeEvent.actionName === "increment" ? 1 : -1)}
      style={[styles.container, disabled && styles.disabled]}
    >
      <View style={styles.valueRow}>
        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          disabled={disabled || displayIndex <= 0}
          onPress={() => bump(-1)}
          style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}
        >
          <Minus color={displayIndex <= 0 ? muted : foreground} size={26} strokeWidth={2} />
        </Pressable>

        <View style={styles.valueGroup}>
          {/* Unit floats above the number (absolute) so the number itself is
              centred both horizontally and vertically against − / +. */}
          {unit ? (
            <Text style={[styles.unitText, { color: muted, fontFamily: labelFont }]}>{unit}</Text>
          ) : null}
          <RollingNumber
            text={format(displayValue)}
            style={[styles.valueText, { color: foreground, fontFamily: textFont }]}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          hitSlop={10}
          disabled={disabled || displayIndex >= tickCount}
          onPress={() => bump(1)}
          style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}
        >
          <Plus color={displayIndex >= tickCount ? muted : foreground} size={26} strokeWidth={2} />
        </Pressable>
      </View>

      <GestureDetector gesture={panGesture}>
        <View style={styles.ruler} onLayout={handleLayout}>
          <Animated.View style={[styles.strip, stripStyle]}>
            {ticks.map((tick) => (
              <React.Fragment key={tick.index}>
                <View
                  style={[
                    styles.tick,
                    {
                      left: tick.index * tickSpacing - (tick.isMajor ? 0.75 : 0.5),
                      width: tick.isMajor ? 1.5 : 1,
                      height: tick.isMajor ? MAJOR_TICK : MINOR_TICK,
                      backgroundColor: foreground,
                      opacity: tick.opacity,
                    },
                  ]}
                />
                {tick.hasLabel ? (
                  <Text
                    style={[
                      styles.tickLabel,
                      {
                        left: tick.index * tickSpacing - TICK_LABEL_WIDTH / 2,
                        color: foreground,
                        opacity: tick.opacity,
                        fontFamily: labelFont,
                      },
                    ]}
                  >
                    {formatLabel ? formatLabel(tick.value) : defaultFormat(tick.value, step)}
                  </Text>
                ) : null}
              </React.Fragment>
            ))}
          </Animated.View>

          <View
            pointerEvents="none"
            style={[styles.indicator, { left: width / 2 - 1, backgroundColor: foreground }]}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 14,
  },
  disabled: {
    opacity: 0.5,
  },
  valueRow: {
    // Room for the unit label that floats above the number.
    paddingTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sideButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
    transform: [{ scale: 0.92 }],
  },
  valueGroup: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rollingRow: {
    flexDirection: "row",
    height: VALUE_LINE_HEIGHT,
    overflow: "hidden",
  },
  fadeOutGlyph: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    textAlign: "center",
  },
  valueText: {
    fontSize: VALUE_FONT_SIZE,
    lineHeight: VALUE_LINE_HEIGHT,
    height: VALUE_LINE_HEIGHT,
  },
  unitText: {
    position: "absolute",
    bottom: "100%",
    fontSize: 13,
    lineHeight: 16,
  },
  ruler: {
    width: "100%",
    height: RULER_HEIGHT,
    overflow: "hidden",
  },
  strip: {
    position: "absolute",
    top: 0,
    left: 0,
    height: RULER_HEIGHT,
  },
  tick: {
    position: "absolute",
    top: 6,
    borderRadius: 1,
  },
  tickLabel: {
    position: "absolute",
    top: 38,
    width: TICK_LABEL_WIDTH,
    textAlign: "center",
    fontSize: 11,
  },
  indicator: {
    position: "absolute",
    top: 0,
    width: 2,
    height: INDICATOR_HEIGHT,
    borderRadius: 1,
  },
});
