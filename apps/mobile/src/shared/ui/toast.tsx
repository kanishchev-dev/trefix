import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type ThemeTokens } from "@trefix/tokens";

type ToastApi = {
  showToast: (message: string) => void;
};

const ToastContext = createContext<ToastApi>({ showToast: () => undefined });

const VISIBLE_MS = 2600;

/** Lightweight top toast for confirmations ("Plan started", "Draft saved"). */
export function ToastProvider({
  theme,
  children,
}: {
  theme: ThemeTokens;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-12);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (next: string) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setMessage(next);
      AccessibilityInfo.announceForAccessibility(next);
      opacity.value = withTiming(1, { duration: 180 });
      translateY.value = withTiming(0, { duration: 180 });
      hideTimer.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(-12, { duration: 220 });
      }, VISIBLE_MS);
    },
    [opacity, translateY],
  );

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const api = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View
        pointerEvents="none"
        style={[styles.host, { top: insets.top + 64 }]}
      >
        <Animated.View
          style={[
            styles.toast,
            { backgroundColor: theme.color.primary },
            animatedStyle,
          ]}
        >
          {message ? (
            <Text
              numberOfLines={2}
              style={[
                styles.text,
                {
                  color: theme.color.primaryForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {message}
            </Text>
          ) : null}
        </Animated.View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 100,
  },
  toast: {
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxWidth: "100%",
  },
  text: {
    fontSize: 14,
    lineHeight: 19,
    textAlign: "center",
  },
});
