import { useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as Haptics from "expo-haptics";

type Props = {
  onHold: () => void;
  holdMs?: number;
  accessibilityLabel: string;
  /** Fill growing while the finger is down. */
  fillColor: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Acts only after a press held for `holdMs`, so a stray touch cannot end or unlock a run. */
export function HoldButton({
  onHold,
  holdMs = 1000,
  accessibilityLabel,
  fillColor,
  style,
  children,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  const begin = (): void => {
    Animated.timing(progress, {
      toValue: 1,
      duration: holdMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  };
  const cancel = (): void => {
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityActions={[{ name: "activate" }]}
      onAccessibilityAction={onHold}
      delayLongPress={holdMs}
      onPressIn={begin}
      onPressOut={cancel}
      onLongPress={() => {
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => undefined);
        onHold();
      }}
      style={[styles.root, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.fill,
          {
            backgroundColor: fillColor,
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  fill: { position: "absolute", left: 0, top: 0, bottom: 0 },
});
