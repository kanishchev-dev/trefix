import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { X, Calendar, Activity, Clock, Heart, Award } from "lucide-react-native";
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
import { GlassInput } from "../../../../shared/ui/glass-input";
import { useCreateWorkout } from "../../hooks/use-workouts";
import { type MainCopy } from "../../../../locales";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultDate?: string; // YYYY-MM-DD
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

const WORKOUT_TYPES = [
  { key: "easy", label: "Легкий бег" },
  { key: "long_run", label: "Длительный" },
  { key: "tempo", label: "Темповый" },
  { key: "threshold", label: "Пороговый" },
  { key: "interval", label: "Интервалы" },
  { key: "recovery", label: "Восстановление" },
  { key: "hill", label: "Горки" },
  { key: "race", label: "Забег" },
];

export function AddWorkoutSheet({
  visible,
  onClose,
  defaultDate,
  theme,
  themeMode,
  copy,
}: Props) {
  const insets = useSafeAreaInsets();
  const createWorkoutMutation = useCreateWorkout();
  const locale = copy?.today?.addSheet || {};

  const [mode, setMode] = useState<"planned" | "completed">("planned");
  const [dateStr, setDateStr] = useState(
    defaultDate || new Date().toISOString().split("T")[0],
  );
  const [type, setType] = useState("easy");
  const [title, setTitle] = useState("");
  const [distanceKm, setDistanceKm] = useState("5");
  const [durationMinutes, setDurationMinutes] = useState("30");

  // Additional completed fields
  const [actualDistanceKm, setActualDistanceKm] = useState("5");
  const [actualDurationMinutes, setActualDurationMinutes] = useState("30");
  const [heartRate, setHeartRate] = useState("");
  const [rpe, setRpe] = useState("5");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // Reanimated values for modal transitions and drag-to-close gesture
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
      const initialDate = defaultDate || new Date().toISOString().split("T")[0];
      setDateStr(initialDate);
      setErrorMessage("");

      // Ensure starting position offscreen then animate in smoothly
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
  }, [visible, defaultDate]);

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

  const handleSubmit = async () => {
    setErrorMessage("");

    const dist = parseFloat(mode === "completed" ? actualDistanceKm : distanceKm);
    const dur = parseInt(mode === "completed" ? actualDurationMinutes : durationMinutes, 10);

    if (isNaN(dist) || dist <= 0) {
      setErrorMessage(locale.invalidDistance || "Укажите корректную дистанцию");
      return;
    }

    if (isNaN(dur) || dur <= 0) {
      setErrorMessage(locale.invalidDuration || "Укажите корректную продолжительность");
      return;
    }

    const scheduledAt = new Date(`${dateStr}T09:00:00.000Z`).toISOString();

    try {
      if (mode === "planned") {
        await createWorkoutMutation.mutateAsync({
          scheduledAt,
          type,
          title: title.trim() || undefined,
          distanceKm: dist,
          durationMinutes: dur,
          status: "planned",
        });
      } else {
        const hr = heartRate ? parseInt(heartRate, 10) : undefined;
        const rpeVal = rpe ? parseInt(rpe, 10) : undefined;

        await createWorkoutMutation.mutateAsync({
          scheduledAt,
          type,
          title: title.trim() || undefined,
          status: "completed",
          distanceKm: dist,
          durationMinutes: dur,
          actualDistanceKm: dist,
          actualDurationMinutes: dur,
          actualAverageHeartRate: !isNaN(hr!) ? hr : undefined,
          rpe: !isNaN(rpeVal!) ? rpeVal : undefined,
          notes: notes.trim() || undefined,
        });
      }

      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Не удалось сохранить тренировку");
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
        {/* Backdrop (Fades in / out independently of slide) */}
        <Animated.View style={[styles.backdropContainer, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={themeMode} />
          </Pressable>
        </Animated.View>

        {/* Card Container */}
        <Animated.View style={[styles.container, { marginBottom: 16 }, cardAnimatedStyle]}>
          <View
            style={[
              styles.card,
              {
                borderColor: themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
                backgroundColor: themeMode === "dark" ? "#121214" : theme.color.surfaceElevated,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            {/* Top Drag Area with GestureDetector for Pull-to-close */}
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
                        fontFamily: theme.typography.fontFamily.sans.semibold,
                      },
                    ]}
                  >
                    {locale.title || "Добавить тренировку"}
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

            {/* Mode Switcher */}
            <View
              style={[
                styles.modeSwitcher,
                {
                  backgroundColor: themeMode === "dark" ? "#1a1a1e" : theme.color.surface,
                  borderColor: themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
                },
              ]}
            >
              <Pressable
                onPress={() => setMode("planned")}
                style={[
                  styles.modeTab,
                  mode === "planned" && {
                    backgroundColor: theme.color.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    {
                      color:
                        mode === "planned"
                          ? theme.color.primaryForeground
                          : theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {locale.planTab || "Запланировать"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMode("completed")}
                style={[
                  styles.modeTab,
                  mode === "completed" && {
                    backgroundColor: theme.color.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modeTabText,
                    {
                      color:
                        mode === "completed"
                          ? theme.color.primaryForeground
                          : theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {locale.logTab || "Внести выполненную"}
                </Text>
              </Pressable>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {errorMessage ? (
                <View
                  style={[
                    styles.errorBanner,
                    { backgroundColor: "rgba(220, 38, 38, 0.2)" },
                  ]}
                >
                  <Text style={[styles.errorText, { color: "#dc2626" }]}>
                    {errorMessage}
                  </Text>
                </View>
              ) : null}

              {/* Date Input */}
              <GlassInput
                leftIcon={<Calendar color={theme.color.mutedForeground} size={18} />}
                keyboardType="default"
                label={locale.dateLabel || "Дата (ГГГГ-ММ-ДД)"}
                onChangeText={setDateStr}
                theme={theme}
                value={dateStr}
              />

              {/* Title Input */}
              <GlassInput
                leftIcon={<Activity color={theme.color.mutedForeground} size={18} />}
                label={locale.titleLabel || "Название (опционально)"}
                onChangeText={setTitle}
                placeholder={locale.titlePlaceholder || "Например: Утренняя пробежка"}
                theme={theme}
                value={title}
              />

              {/* Workout Type Selector */}
              <View style={styles.section}>
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {locale.typeLabel || "ТИП ТРЕНИРОВКИ"}
                </Text>

                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.typesRow}
                >
                  {WORKOUT_TYPES.map((t) => {
                    const selected = type === t.key;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => setType(t.key)}
                        style={[
                          styles.typeChip,
                          {
                            backgroundColor: selected
                              ? theme.color.primary
                              : themeMode === "dark" ? "#1a1a1e" : theme.color.surface,
                            borderColor: themeMode === "dark" ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.typeChipText,
                            {
                              color: selected
                                ? theme.color.primaryForeground
                                : theme.color.foreground,
                              fontFamily: selected
                                ? theme.typography.fontFamily.sans.bold
                                : theme.typography.fontFamily.sans.medium,
                            },
                          ]}
                        >
                          {t.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Metrics */}
              <View style={styles.metricsRow}>
                <View style={styles.metricField}>
                  <GlassInput
                    leftIcon={<Activity color={theme.color.mutedForeground} size={18} />}
                    keyboardType="numeric"
                    label={
                      mode === "completed"
                        ? locale.actualDistance || "Дистанция (км)"
                        : locale.planDistance || "План км"
                    }
                    onChangeText={
                      mode === "completed" ? setActualDistanceKm : setDistanceKm
                    }
                    theme={theme}
                    value={
                      mode === "completed" ? actualDistanceKm : distanceKm
                    }
                  />
                </View>

                <View style={styles.metricField}>
                  <GlassInput
                    leftIcon={<Clock color={theme.color.mutedForeground} size={18} />}
                    keyboardType="numeric"
                    label={
                      mode === "completed"
                        ? locale.actualDuration || "Время (мин)"
                        : locale.planDuration || "План мин"
                    }
                    onChangeText={
                      mode === "completed"
                        ? setActualDurationMinutes
                        : setDurationMinutes
                    }
                    theme={theme}
                    value={
                      mode === "completed"
                        ? actualDurationMinutes
                        : durationMinutes
                    }
                  />
                </View>
              </View>

              {/* Completed specific inputs */}
              {mode === "completed" && (
                <>
                  <View style={styles.metricsRow}>
                    <View style={styles.metricField}>
                      <GlassInput
                        leftIcon={<Heart color={theme.color.mutedForeground} size={18} />}
                        keyboardType="numeric"
                        label={locale.heartRate || "Ср. пульс (уд/мин)"}
                        onChangeText={setHeartRate}
                        placeholder="145"
                        theme={theme}
                        value={heartRate}
                      />
                    </View>

                    <View style={styles.metricField}>
                      <GlassInput
                        leftIcon={<Award color={theme.color.mutedForeground} size={18} />}
                        keyboardType="numeric"
                        label={locale.rpe || "Усилие RPE (1-10)"}
                        onChangeText={setRpe}
                        placeholder="6"
                        theme={theme}
                        value={rpe}
                      />
                    </View>
                  </View>

                  <GlassInput
                    label={locale.notes || "Заметки / Ощущения"}
                    multiline
                    numberOfLines={3}
                    onChangeText={setNotes}
                    placeholder={locale.notesPlaceholder || "Хорошее самочувствие..."}
                    theme={theme}
                    value={notes}
                  />
                </>
              )}
            </ScrollView>

            {/* Actions Row */}
            <View style={styles.actionsRow}>
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
                  {locale.cancel || "Отменить"}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={createWorkoutMutation.isPending}
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  { backgroundColor: theme.color.primary },
                  pressed && styles.buttonPressed,
                  createWorkoutMutation.isPending && { opacity: 0.7 },
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
                    {mode === "planned"
                      ? locale.submitPlan || "Запланировать"
                      : locale.submitLog || "Сохранить"}
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
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  container: {
    width: "100%",
    paddingHorizontal: 16,
    maxHeight: "90%",
    zIndex: 1,
  },
  card: {
    borderRadius: 38,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingTop: 12,
    gap: 16,
    overflow: "hidden",
    maxHeight: "100%",
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
    fontSize: 15,
    lineHeight: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modeSwitcher: {
    flexDirection: "row",
    borderRadius: 9999,
    borderWidth: 0,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: "center",
  },
  modeTabText: {
    fontSize: 13,
    lineHeight: 18,
  },
  scrollView: {
    flexShrink: 1,
    width: "100%",
  },
  scrollContent: {
    gap: 16,
    paddingVertical: 4,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
  },
  typesRow: {
    gap: 8,
    paddingRight: 16,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeChipText: {
    fontSize: 13,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricField: {
    flex: 1,
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
