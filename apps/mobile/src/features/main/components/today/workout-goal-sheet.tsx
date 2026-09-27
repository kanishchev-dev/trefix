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
} from "react-native";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { useCreateWorkout } from "../../hooks/use-workouts";

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
  copy: any;
};

const DISTANCE_PRESETS = [5, 10, 15];
const DURATION_PRESETS = [30, 45, 60];

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

  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

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

  // Date validation check (must be strictly future date)
  const isFutureDate = useMemo(() => {
    if (!date) return false;
    const target = new Date(`${date}T00:00:00.000`);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return target.getTime() > today.getTime();
  }, [date]);

  const parsedValue = useMemo(() => {
    const val = mode === "distance" ? parseFloat(distanceVal.replace(",", ".")) : parseInt(durationVal, 10);
    return isNaN(val) ? 0 : val;
  }, [mode, distanceVal, durationVal]);

  const isValid = parsedValue > 0 && isFutureDate && !createWorkoutMutation.isPending;

  const handleSubmit = async () => {
    setErrorMessage("");

    if (!isFutureDate) {
      setErrorMessage(
        goalSheetCopy.futureDateOnly ||
          "Плановую тренировку можно добавить только на будущую дату.",
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
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
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
        <Animated.View style={[styles.backdropContainer, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={themeMode} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.container, cardAnimatedStyle]}>
          <View
            style={[
              styles.card,
              {
                borderColor: theme.color.border,
                backgroundColor: theme.color.surfaceElevated,
                paddingBottom: Math.max(insets.bottom, 24),
              },
            ]}
          >
            <GestureDetector gesture={panGesture}>
              <View style={styles.topDragArea}>
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
                        fontFamily: theme.typography.fontFamily.sans.extrabold,
                      },
                    ]}
                  >
                    {goalSheetCopy.title || "Выберите текущую цель и виджет"}
                  </Text>

                  <Pressable
                    accessibilityRole="button"
                    hitSlop={12}
                    onPress={handleClose}
                    style={styles.closeButton}
                  >
                    <X color={theme.color.mutedForeground} size={20} />
                  </Pressable>
                </View>
              </View>
            </GestureDetector>

            {/* Mode Tabs */}
            <View
              style={[
                styles.tabsContainer,
                {
                  backgroundColor: theme.color.surface,
                  borderColor: theme.color.border,
                },
              ]}
            >
              <Pressable
                onPress={() => setMode("duration")}
                style={[
                  styles.tab,
                  mode === "duration" && {
                    backgroundColor: theme.color.primary,
                  },
                ]}
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

              <Pressable
                onPress={() => setMode("distance")}
                style={[
                  styles.tab,
                  mode === "distance" && {
                    backgroundColor: theme.color.primary,
                  },
                ]}
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
                  {goalSheetCopy.tabs?.distance || "По дистанции"}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.scrollView}
            >
              {errorMessage ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                </View>
              ) : null}

              {/* Display Main Goal Value Input */}
              <View style={styles.valueDisplayArea}>
                <View style={styles.inputRow}>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={mode === "distance" ? setDistanceVal : setDurationVal}
                    selectTextOnFocus
                    style={[
                      styles.valueInput,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.extrabold,
                      },
                    ]}
                    value={mode === "distance" ? distanceVal : durationVal}
                  />
                  <Text
                    style={[
                      styles.unitText,
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

                {/* Quick Presets */}
                <View style={styles.presetsRow}>
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
                                : theme.color.surface,
                              borderColor: theme.color.border,
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
                </View>
              </View>
            </ScrollView>

            {/* Primary Action Button */}
            <Pressable
              accessibilityRole="button"
              disabled={!isValid}
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.submitButton,
                { backgroundColor: theme.color.primary },
                !isValid && { opacity: 0.5 },
                pressed && isValid && styles.submitButtonPressed,
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
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {goalSheetCopy.submit || "Добавить тренировку"}
                </Text>
              )}
            </Pressable>
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  container: {
    width: "100%",
    maxHeight: "85%",
    zIndex: 1,
  },
  card: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    paddingTop: 12,
    gap: 16,
    overflow: "hidden",
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
    justifyContent: "space-between",
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    flex: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
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
    alignItems: "center",
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
    gap: 16,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 8,
  },
  valueInput: {
    fontSize: 54,
    lineHeight: 64,
    textAlign: "center",
    minWidth: 100,
  },
  unitText: {
    fontSize: 20,
    lineHeight: 26,
  },
  presetsRow: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "center",
  },
  presetChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presetChipText: {
    fontSize: 14,
  },
  submitButton: {
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  submitButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  submitLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
});
