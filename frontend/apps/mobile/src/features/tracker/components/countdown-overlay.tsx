import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";

import { type ThemeTokens } from "@trefix/tokens";

import type { MainCopy } from "../../../locales";

const SECONDS = 3;
const SIZE = 260;
const STROKE = 8;
const RADIUS = (SIZE - STROKE) / 2 - 4;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string | null;
  onDone: () => void;
  onCancel: () => void;
  copy: MainCopy;
  theme: ThemeTokens;
};

/** 3-2-1 before the recording starts; a tap starts right away. */
export function CountdownOverlay({
  visible,
  title,
  subtitle,
  onDone,
  onCancel,
  copy,
  theme,
}: Props) {
  const insets = useSafeAreaInsets();
  const [left, setLeft] = useState(SECONDS);
  const finished = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!visible) return;
    finished.current = false;
    setLeft(SECONDS);
    const timer = setInterval(() => {
      setLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    ).catch(() => undefined);
    onDoneRef.current();
  };

  useEffect(() => {
    if (!visible) return;
    if (left === 0) finish();
    else void Haptics.selectionAsync().catch(() => undefined);
  }, [left, visible]);

  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.tracker.countdown.tap}
        onPress={finish}
        style={[
          styles.root,
          {
            backgroundColor: theme.color.screen,
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.kicker,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.sub, muted]}>
            {subtitle}
          </Text>
        ) : null}
        <View style={styles.ring}>
          <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={theme.color.card}
              strokeWidth={STROKE}
              fill="none"
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={theme.color.foreground}
              strokeWidth={STROKE}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${(CIRCUMFERENCE * left) / SECONDS} ${CIRCUMFERENCE}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>
          <Text
            accessibilityLiveRegion="assertive"
            style={[
              styles.number,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {Math.max(1, left)}
          </Text>
        </View>
        <Text style={[styles.tap, muted]}>{copy.tracker.countdown.tap}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onCancel}
          style={({ pressed }) => [
            styles.cancel,
            { backgroundColor: theme.color.card },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.cancelText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.tracker.cancel}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", paddingHorizontal: 24 },
  kicker: { fontSize: 15, lineHeight: 20 },
  sub: { marginTop: 4, fontSize: 13, lineHeight: 18 },
  ring: {
    marginTop: "auto",
    width: SIZE,
    height: SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  number: {
    fontSize: 140,
    lineHeight: 150,
    letterSpacing: -4,
    fontVariant: ["tabular-nums"],
  },
  tap: { marginTop: "auto", fontSize: 13, lineHeight: 18 },
  cancel: {
    marginTop: 16,
    height: 44,
    paddingHorizontal: 22,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 15, lineHeight: 20 },
  pressed: { opacity: 0.85 },
});
