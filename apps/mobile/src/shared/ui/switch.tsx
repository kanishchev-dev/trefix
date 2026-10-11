import { useEffect } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  theme: ThemeTokens;
  disabled?: boolean;
  accessibilityLabel?: string;
};

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const KNOB_WIDTH = 26;
const KNOB_HEIGHT = 20;
const INSET = 2;
const TRAVEL = TRACK_WIDTH - KNOB_WIDTH - INSET * 2;

/** Compact black-and-white switch: a capsule knob that springs across a 44×24 track. */
export function Switch({
  value,
  onValueChange,
  theme,
  disabled = false,
  accessibilityLabel,
}: Props) {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(value ? 1 : 0, {
      damping: 18,
      stiffness: 260,
      mass: 0.7,
    });
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.color.switchTrackOff, theme.color.primary],
    ),
  }));
  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * TRAVEL }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.color.primary, theme.color.primaryForeground],
    ),
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => onValueChange(!value)}
      style={disabled ? styles.disabled : undefined}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    padding: INSET,
    justifyContent: "center",
  },
  knob: {
    width: KNOB_WIDTH,
    height: KNOB_HEIGHT,
    borderRadius: KNOB_HEIGHT / 2,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
