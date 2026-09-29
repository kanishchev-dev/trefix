import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Dimensions,
  TextInput,
  LayoutChangeEvent,
} from "react-native";
import { BlurView } from "expo-blur";
import { Plus, Minus } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  interpolate,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { useCreateWorkout } from "../../hooks/use-workouts";
import { type MainCopy } from "../../../../locales";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export type ManualWorkoutType = "easy" | "tempo" | "interval" | "hill" | "race";
export type WorkoutGoalMode = "duration" | "distance";

type Props = {
  visible: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD
  workoutType: ManualWorkoutType;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

const DISTANCE_PRESETS = [3, 5, 8, 10, 12, 15, 21, 42];
const DURATION_PRESETS = [20, 30, 45, 60, 90, 120];

export function WorkoutGoalSheet({
  visible,
  onClose,
  date,
  workoutType,
  theme,
  themeMode,
  copy,
}: Props) {
  const insets = useSafeAreaInsets();
  const createWorkoutMutation = useCreateWorkout();
  const goalSheetCopy = copy?.today?.goalSheet || {};

  const [mode, setMode] = useState<WorkoutGoalMode>("distance");
  const [distanceVal, setDistanceVal] = useState("10");
  const [durationVal, setDurationVal] = useState("45");
  const [errorMessage, setErrorMessage] = useState("");
  const [tabsWidth, setTabsWidth] = useState(0);

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  const activeTabX = useSharedValue(0);

  useEffect(() => {
    activeTabX.value = withSpring(mode === "distance" ? 0 : 1, {
      damping: 18,
      stiffness: 120,
      mass: 1,
    });
  }, [mode]);

  const indicatorAnimatedStyle = useAnimatedStyle(() => {
    const tabWidth = tabsWidth > 0 ? (tabsWidth - 8) / 2 : 140;
    return {
      width: tabWidth,
      transform: [
        {
          translateX: interpolate(
            activeTabX.value,
            [0, 1],
            [4, 4 + tabWidth]
          ),
        },
      ],
    };
  });

  const handleClose = useCallback(() => {
    backdropOpacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, () => {
      runOnJS(onClose)();
    });
  }, [onClose]);

  useEffect(() => {
    if (visible) {
      setErrorMessage("");
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;

      backdropOpacity.value = withTiming(1, { duration: 200 });
      translateY.value = withSpring(0, {
        damping: 28,
        stiffness: 220,
        mass: 0.8,
      });
    } else {
      translateY.value = SCREEN_HEIGHT;
      backdropOpacity.value = 0;
    }
  }, [visible]);

  const panGesture = Gesture.Pan()
    .activeOffsetY([5, 5])
    .onChange((event) => {
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > 100 || event.velocityY > 500) {
        runOnJS(handleClose)();
      } else {
        translateY.value = withSpring(0, {
          damping: 28,
          stiffness: 220,
          mass: 0.8,
        });
      }
    });

  const backdropAnimatedStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Date validation check (today or future date)
  const isFutureOrToday = useMemo(() => {
    if (!date) return true;
    const target = new Date(`${date}T00:00:00.000`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return target.getTime() >= today.getTime();
  }, [date]);

  const parsedValue = useMemo(() => {
    const val = mode === "distance" ? parseFloat(distanceVal.replace(",", ".")) : parseInt(durationVal, 10);
    return isNaN(val) ? 0 : val;
  }, [mode, distanceVal, durationVal]);

  const isValid = parsedValue > 0 && isFutureOrToday && !createWorkoutMutation.isPending;

  const handleDecrement = () => {
    if (mode === "distance") {
      const current = parseFloat(distanceVal.replace(",", ".")) || 0;
      const next = Math.max(0.5, current - 1);
      setDistanceVal(next.toString());
    } else {
      const current = parseInt(durationVal, 10) || 0;
      const next = Math.max(5, current - 5);
      setDurationVal(next.toString());
    }
  };

  const handleIncrement = () => {
    if (mode === "distance") {
      const current = parseFloat(distanceVal.replace(",", ".")) || 0;
      const next = current + 1;
      setDistanceVal(next.toString());
    } else {
      const current = parseInt(durationVal, 10) || 0;
      const next = current + 5;
      setDurationVal(next.toString());
    }
  };

  const handleSubmit = async () => {
    setErrorMessage("");

    if (!isFutureOrToday) {
      setErrorMessage(
        goalSheetCopy.futureDateOnly ||
          "Плановую тренировку можно добавить только на сегодняшнюю или будущую дату.",
      );
      return;
    }

    if (parsedValue <= 0) {
      setErrorMessage(
        goalSheetCopy.invalidValue || "Укажите значение больше 0",
      );
      return;
    }

    const scheduledAt = new Date(`${date}T09:00:00.000Z`).toISOString();

    const distanceKm = mode === "distance" ? parsedValue : Math.max(1, Math.round(parsedValue / 6));
    const durationMinutes = mode === "duration" ? parsedValue : Math.max(5, Math.round(parsedValue * 6));

    try {
      await createWorkoutMutation.mutateAsync({
        scheduledAt,
        type: workoutType,
        distanceKm,
        durationMinutes,
        status: "planned",
      });

      handleClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(
        message ||
          goalSheetCopy.errorDefault ||
          "Не удалось добавить тренировку. Попробуйте ещё раз.",
      );
    }
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={handleClose}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdropContainer,
            {
              backgroundColor: themeMode === "dark" ? "rgba(0, 0, 0, 0.4)" : "rgba(255, 255, 255, 0.4)",
            },
            backdropAnimatedStyle,
          ]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={themeMode} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.container, { marginBottom: 8 }, cardAnimatedStyle]}>
          <View
            style={[
              styles.card,
              {
                borderColor: themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
                backgroundColor: themeMode === "dark" ? "#121214" : theme.color.surfaceElevated,
                paddingBottom: 20,
              },
            ]}
          >
            <GestureDetector gesture={panGesture}>
              <View style={[styles.topDragArea, styles.paddedContent]}>
                <View style={styles.handleContainer}>
                  <View
                    style={[styles.handle, { backgroundColor: theme.color.border }]}
                  />
                </View>

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
                    {goalSheetCopy.title || "Укажите цель"}
                  </Text>
                </View>
              </View>
            </GestureDetector>

            {/* Mode Tabs with Animated Pill Indicator */}
            <View style={styles.paddedContent}>
              <View
                onLayout={(e: LayoutChangeEvent) => setTabsWidth(e.nativeEvent.layout.width)}
                style={[
                  styles.tabsContainer,
                  {
                    backgroundColor: themeMode === "dark" ? "#1a1a1e" : theme.color.surface,
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.activeTabIndicator,
                    {
                      backgroundColor: theme.color.primary,
                    },
                    indicatorAnimatedStyle,
                  ]}
                />

                <Pressable
                  onPress={() => setMode("distance")}
                  style={styles.tab}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          mode === "distance"
                            ? theme.color.primaryForeground
                            : theme.color.mutedForeground,
                        fontFamily: theme.typography.fontFamily.sans.bold,
                      },
                    ]}
                  >
                    {goalSheetCopy.tabs?.distance || "Дистанция"}
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setMode("duration")}
                  style={styles.tab}
                >
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          mode === "duration"
                            ? theme.color.primaryForeground
                            : theme.color.mutedForeground,
                        fontFamily: theme.typography.fontFamily.sans.bold,
                      },
                    ]}
                  >
                    {goalSheetCopy.tabs?.duration || "Время"}
                  </Text>
                </Pressable>
              </View>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scrollView}
            >
              {errorMessage ? (
                <View style={[styles.errorBanner, styles.paddedContent]}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Display Main Goal Value Input with Stepper Controls */}
              <View style={[styles.valueDisplayArea, styles.paddedContent]}>
                <View style={styles.inputRow}>
                  <Pressable
                    onPress={handleDecrement}
                    style={({ pressed }) => [
                      styles.stepperButton,
                      {
                        backgroundColor: themeMode === "dark" ? "#1a1a1e" : theme.color.surface,
                        borderColor: themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
                      },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Minus size={20} color={theme.color.foreground} />
                  </Pressable>

                  <View style={styles.numberWrapper}>
                    <TextInput
                      editable={false}
                      style={[
                        styles.valueInput,
                        {
                          color: theme.color.foreground,
                          fontFamily: theme.typography.fontFamily.sans.medium,
                        },
                      ]}
                      value={mode === "distance" ? distanceVal : durationVal}
                    />
                    <Text
                      style={[
                        styles.superscriptUnit,
                        {
                          color: theme.color.mutedForeground,
                          fontFamily: theme.typography.fontFamily.sans.semibold,
                        },
                      ]}
                    >
                      {mode === "distance"
                        ? goalSheetCopy.distanceUnit || "км"
                        : goalSheetCopy.durationUnit || "мин"}
                    </Text>
                  </View>

                  <Pressable
                    onPress={handleIncrement}
                    style={({ pressed }) => [
                      styles.stepperButton,
                      {
                        backgroundColor: themeMode === "dark" ? "#1a1a1e" : theme.color.surface,
                        borderColor: themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
                      },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Plus size={20} color={theme.color.foreground} />
                  </Pressable>
                </View>
              </View>

              {/* Quick Presets Horizontal Slider (Edge-to-Edge) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetsScrollContent}
                style={styles.presetsScrollView}
              >
                {(mode === "distance" ? DISTANCE_PRESETS : DURATION_PRESETS).map(
                  (preset) => {
                    const isSelected =
                      mode === "distance"
                        ? parseFloat(distanceVal.replace(",", ".")) === preset
                        : parseInt(durationVal, 10) === preset;

                    return (
                      <Pressable
                        key={preset}
                        onPress={() => {
                          if (mode === "distance") {
                            setDistanceVal(preset.toString());
                          } else {
                            setDurationVal(preset.toString());
                          }
                        }}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: isSelected
                              ? theme.color.primary
                              : themeMode === "dark" ? "#1a1a1e" : theme.color.surface,
                            borderColor: themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.presetChipText,
                            {
                              color: isSelected
                                ? theme.color.primaryForeground
                                : theme.color.foreground,
                              fontFamily: isSelected
                                ? theme.typography.fontFamily.sans.bold
                                : theme.typography.fontFamily.sans.medium,
                            },
                          ]}
                        >
                          {preset}{" "}
                          {mode === "distance"
                            ? goalSheetCopy.distanceUnit || "км"
                            : goalSheetCopy.durationUnit || "мин"}
                        </Text>
                      </Pressable>
                    );
                  },
                )}
              </ScrollView>
            </ScrollView>

            {/* Actions Row */}
            <View style={[styles.actionsRow, styles.paddedContent]}>
              <Pressable
                accessibilityRole="button"
                onPress={handleClose}
                style={({ pressed }) => [
                  styles.cancelButton,
                  {
                    backgroundColor: themeMode === "dark" ? "#1a1a1e" : theme.color.secondary,
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.cancelLabel,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {goalSheetCopy.cancel || "Отменить"}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={!isValid}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: theme.color.primary },
                  !isValid && { opacity: 0.5 },
                  pressed && isValid && styles.buttonPressed,
                ]}
              >
                {createWorkoutMutation.isPending ? (
                  <ActivityIndicator color={theme.color.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.submitLabel,
                      {
                        color: theme.color.primaryForeground,
                        fontFamily: theme.typography.fontFamily.sans.semibold,
                      },
                    ]}
                  >
                    {goalSheetCopy.submit || "Добавить"}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
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
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    gap: 20,
    paddingVertical: 12,
  },
  errorBanner: {
    backgroundColor: "rgba(220, 38, 38, 0.2)",
    padding: 12,
    borderRadius: 12,
    width: "100%",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
  },
  valueDisplayArea: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 12,
    marginVertical: 12,
  },
  numberWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  superscriptUnit: {
    position: "absolute",
    top: -20,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  valueInput: {
    fontSize: 48,
    lineHeight: 56,
    textAlign: "center",
    minWidth: 90,
  },
  unitText: {
    fontSize: 18,
    lineHeight: 24,
  },
  presetsScrollView: {
    width: "100%",
    maxHeight: 50,
  },
  presetsScrollContent: {
    gap: 10,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presetChipText: {
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  submitButton: {
    flex: 1,
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  submitLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
});
