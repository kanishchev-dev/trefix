import { useEffect } from "react";
import { View } from "react-native";
import { GlassView } from "expo-glass-effect";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { withAlpha, type ThemeTokens } from "@trefix/tokens";
import { styles } from "./auth-verification-screen.styles";

export type HighlightState = "normal" | "error" | "success";

const ERROR_IN_MS = 120;
const STATE_MS = 150;

export type CodeCellProps = {
  theme: ThemeTokens;
  value: string;
  /** The cell the next digit goes to: shows the focus edge and the caret. */
  isActive: boolean;
  /** The full code is being checked: the cells dim and ignore focus. */
  isDisabled: boolean;
  highlightState: HighlightState;
  /** Delay before this cell turns red, so the error runs across the row. */
  errorDelayMs?: number;
};

/**
 * Colours live on an animated layer inside the glass instead of the GlassView
 * itself: UIKit visual effect views can't have their colours or opacity animated.
 */
export function CodeCell({
  theme,
  value,
  isActive,
  isDisabled,
  highlightState,
  errorDelayMs = 0,
}: CodeCellProps) {
  const isError = highlightState === "error";
  const isSuccess = highlightState === "success";
  const showFocus = isActive && !isDisabled && !isError && !isSuccess;

  const error = useSharedValue(0);
  const focus = useSharedValue(showFocus ? 1 : 0);
  const disabled = useSharedValue(isDisabled ? 1 : 0);

  useEffect(() => {
    error.value = isError
      ? withDelay(errorDelayMs, withTiming(1, { duration: ERROR_IN_MS }))
      : withTiming(0, { duration: STATE_MS });
  }, [error, errorDelayMs, isError]);

  useEffect(() => {
    focus.value = withTiming(showFocus || isSuccess ? 1 : 0, {
      duration: STATE_MS,
    });
  }, [focus, isSuccess, showFocus]);

  useEffect(() => {
    disabled.value = withTiming(isDisabled ? 1 : 0, { duration: STATE_MS });
  }, [disabled, isDisabled]);

  // An error only recolours the digits: tinting the cell itself spoils the glass.
  const chromeStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focus.value,
      [0, 1],
      [theme.color.inputBorder, theme.color.inputBorderFocused],
    ),
  }));

  const digitStyle = useAnimatedStyle(() => {
    const base = interpolateColor(
      disabled.value,
      [0, 1],
      [theme.color.foreground, theme.color.mutedForeground],
    );

    return {
      color: interpolateColor(error.value, [0, 1], [base, theme.color.danger]),
    };
  });

  return (
    <GlassView
      glassEffectStyle="regular"
      tintColor={theme.color.glassTint}
      style={[styles.codeCell, isSuccess && styles.codeCellSuccess]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.codeCellChrome,
          {
            backgroundColor: isSuccess
              ? withAlpha(theme.color.foreground, 0.05)
              : theme.color.glassBackground,
          },
          chromeStyle,
        ]}
      />
      {value ? (
        <Animated.Text
          style={[
            styles.codeDigit,
            { fontFamily: theme.typography.fontFamily.sans.medium },
            digitStyle,
          ]}
        >
          {value}
        </Animated.Text>
      ) : showFocus ? (
        <View
          style={[styles.cursor, { backgroundColor: theme.color.foreground }]}
        />
      ) : null}
    </GlassView>
  );
}
