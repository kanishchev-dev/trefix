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
import {
  X,
  CheckCircle2,
  Activity,
  Clock,
  Heart,
  Award,
  Sparkles,
  ChevronRight,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";

import { type TrainingWorkout } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { GlassInput } from "../../../../shared/ui/glass-input";
import { useCompleteWorkout } from "../../hooks/use-workouts";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type Props = {
  workout: TrainingWorkout | null;
  visible: boolean;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: any;
};

export function WorkoutDetailSheet({
  workout,
  visible,
  onClose,
  theme,
  themeMode,
  copy,
}: Props) {
  const insets = useSafeAreaInsets();
  const completeWorkoutMutation = useCompleteWorkout();
  const locale = copy?.today?.detailSheet || {};
  const statuses = copy?.today?.workout?.statuses || {};

  const [isCompleting, setIsCompleting] = useState(false);
  const [actualDistanceKm, setActualDistanceKm] = useState("");
  const [actualDurationMinutes, setActualDurationMinutes] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [rpe, setRpe] = useState("");
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
      setIsCompleting(false);
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

  if (!workout) return null;

  const isCompleted = workout.status === "completed";
  const actualData = (workout.actual as Record<string, unknown>) || {};
  const analysisData = workout.analysis;

  const handleStartCompleting = () => {
    setActualDistanceKm(String(workout.distanceKm || "5"));
    setActualDurationMinutes(String(workout.durationMinutes || "30"));
    setIsCompleting(true);
    setErrorMessage("");
  };

  const handleSaveCompletion = async () => {
    setErrorMessage("");
    const dist = parseFloat(actualDistanceKm);
    const dur = parseInt(actualDurationMinutes, 10);

    if (isNaN(dist) || dist <= 0) {
      setErrorMessage(copy?.today?.addSheet?.invalidDistance || "Укажите корректную дистанцию");
      return;
    }

    if (isNaN(dur) || dur <= 0) {
      setErrorMessage(copy?.today?.addSheet?.invalidDuration || "Укажите корректную продолжительность");
      return;
    }

    try {
      const hr = heartRate ? parseInt(heartRate, 10) : undefined;
      const rpeVal = rpe ? parseInt(rpe, 10) : undefined;

      await completeWorkoutMutation.mutateAsync({
        workoutId: workout.id,
        dto: {
          actualDistanceKm: dist,
          actualDurationMinutes: dur,
          actualAverageHeartRate: !isNaN(hr!) ? hr : undefined,
          rpe: !isNaN(rpeVal!) ? rpeVal : undefined,
          notes: notes.trim() || undefined,
        },
      });

      setIsCompleting(false);
      handleClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Не удалось завершить тренировку");
    }
  };

  const getStatusLabel = () => {
    switch (workout.status) {
      case "completed":
        return statuses.completed || "Выполнено";
      case "missed":
        return statuses.missed || "Пропущено";
      case "modified":
        return statuses.modified || "Изменено Трефиксом";
      default:
        return statuses.planned || "Запланировано";
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
        {/* Backdrop (Fades in / out independently) */}
        <Animated.View style={[styles.backdropContainer, backdropAnimatedStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            <BlurView intensity={20} style={StyleSheet.absoluteFill} tint={themeMode} />
          </Pressable>
        </Animated.View>

        {/* Card Container */}
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
            {/* Top Drag Area with GestureDetector for Pull-to-close */}
            <GestureDetector gesture={panGesture}>
              <View style={styles.topDragArea}>
                <View style={styles.handleContainer}>
                  <View
                    style={[styles.handle, { backgroundColor: theme.color.border }]}
                  />
                </View>

                <View style={styles.header}>
                  <View style={styles.titleRow}>
                    {isCompleted ? (
                      <CheckCircle2 color={theme.color.primary} size={22} />
                    ) : (
                      <Activity color={theme.color.primary} size={22} />
                    )}
                    <Text
                      style={[
                        styles.title,
                        {
                          color: theme.color.foreground,
                          fontFamily: theme.typography.fontFamily.sans.extrabold,
                        },
                      ]}
                    >
                      {((workout.target as any)?.title as string) ||
                        `${workout.type.toUpperCase()} Run`}
                    </Text>
                  </View>

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

            {/* Status Badge */}
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: isCompleted
                      ? theme.color.primary + "20"
                      : theme.color.surface,
                    borderColor: theme.color.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    {
                      color: isCompleted
                        ? theme.color.primary
                        : theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.bold,
                    },
                  ]}
                >
                  {getStatusLabel().toUpperCase()}
                </Text>
              </View>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
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

              {/* Target / Plan Stats */}
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
                  {locale.workoutPlan || "ПЛАН ТРЕНИРОВКИ"}
                </Text>

                <View style={styles.statsGrid}>
                  <View
                    style={[
                      styles.statBox,
                      {
                        backgroundColor: theme.color.surface,
                        borderColor: theme.color.border,
                      },
                    ]}
                  >
                    <Activity color={theme.color.primary} size={18} />
                    <View>
                      <Text
                        style={[
                          styles.statValue,
                          {
                            color: theme.color.foreground,
                            fontFamily: theme.typography.fontFamily.sans.extrabold,
                          },
                        ]}
                      >
                        {workout.distanceKm} км
                      </Text>
                      <Text
                        style={[
                          styles.statLabel,
                          {
                            color: theme.color.mutedForeground,
                            fontFamily: theme.typography.fontFamily.sans.medium,
                          },
                        ]}
                      >
                        {locale.distance || "Дистанция"}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statBox,
                      {
                        backgroundColor: theme.color.surface,
                        borderColor: theme.color.border,
                      },
                    ]}
                  >
                    <Clock color={theme.color.primary} size={18} />
                    <View>
                      <Text
                        style={[
                          styles.statValue,
                          {
                            color: theme.color.foreground,
                            fontFamily: theme.typography.fontFamily.sans.extrabold,
                          },
                        ]}
                      >
                        {workout.durationMinutes} мин
                      </Text>
                      <Text
                        style={[
                          styles.statLabel,
                          {
                            color: theme.color.mutedForeground,
                            fontFamily: theme.typography.fontFamily.sans.medium,
                          },
                        ]}
                      >
                        {locale.duration || "Продолжительность"}
                      </Text>
                    </View>
                  </View>
                </View>

                {((workout.target as any)?.description as string) ? (
                  <Text
                    style={[
                      styles.descriptionText,
                      {
                        color: theme.color.mutedForeground,
                        fontFamily: theme.typography.fontFamily.sans.regular,
                      },
                    ]}
                  >
                    {((workout.target as any)?.description as string)}
                  </Text>
                ) : null}
              </View>

              {/* Actual Results (if completed) */}
              {isCompleted && (
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
                    {locale.result || "РЕЗУЛЬТАТ"}
                  </Text>

                  <View style={styles.statsGrid}>
                    {actualData.actualDistanceKm ? (
                      <View
                        style={[
                          styles.statBox,
                          {
                            backgroundColor: theme.color.surface,
                            borderColor: theme.color.border,
                          },
                        ]}
                      >
                        <Activity color={theme.color.primary} size={18} />
                        <View>
                          <Text
                            style={[
                              styles.statValue,
                              {
                                color: theme.color.foreground,
                                fontFamily: theme.typography.fontFamily.sans.extrabold,
                              },
                            ]}
                          >
                            {String(actualData.actualDistanceKm)} км
                          </Text>
                          <Text
                            style={[
                              styles.statLabel,
                              {
                                color: theme.color.mutedForeground,
                                fontFamily: theme.typography.fontFamily.sans.medium,
                              },
                            ]}
                          >
                            {locale.actualDistance || "Факт дистанция"}
                          </Text>
                        </View>
                      </View>
                    ) : null}

                    {actualData.actualDurationMinutes ? (
                      <View
                        style={[
                          styles.statBox,
                          {
                            backgroundColor: theme.color.surface,
                            borderColor: theme.color.border,
                          },
                        ]}
                      >
                        <Clock color={theme.color.primary} size={18} />
                        <View>
                          <Text
                            style={[
                              styles.statValue,
                              {
                                color: theme.color.foreground,
                                fontFamily: theme.typography.fontFamily.sans.extrabold,
                              },
                            ]}
                          >
                            {String(actualData.actualDurationMinutes)} мин
                          </Text>
                          <Text
                            style={[
                              styles.statLabel,
                              {
                                color: theme.color.mutedForeground,
                                fontFamily: theme.typography.fontFamily.sans.medium,
                              },
                            ]}
                          >
                            {locale.actualDuration || "Факт время"}
                          </Text>
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {actualData.actualAverageHeartRate ? (
                    <View style={styles.infoRow}>
                      <Heart color={theme.color.mutedForeground} size={16} />
                      <Text
                        style={[
                          styles.infoText,
                          {
                            color: theme.color.foreground,
                            fontFamily: theme.typography.fontFamily.sans.medium,
                          },
                        ]}
                      >
                        {locale.avgHeartRate || "Средний пульс"}: {String(actualData.actualAverageHeartRate)} уд/мин
                      </Text>
                    </View>
                  ) : null}

                  {actualData.rpe ? (
                    <View style={styles.infoRow}>
                      <Award color={theme.color.mutedForeground} size={16} />
                      <Text
                        style={[
                          styles.infoText,
                          {
                            color: theme.color.foreground,
                            fontFamily: theme.typography.fontFamily.sans.medium,
                          },
                        ]}
                      >
                        {locale.rpeRating || "Оценка усилия RPE"}: {String(actualData.rpe)} / 10
                      </Text>
                    </View>
                  ) : null}

                  {analysisData ? (
                    <View
                      style={[
                        styles.analysisCard,
                        {
                          backgroundColor: theme.color.surface,
                          borderColor: theme.color.border,
                        },
                      ]}
                    >
                      <Sparkles color="#A37EFF" size={18} />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.analysisTitle,
                            {
                              color: theme.color.foreground,
                              fontFamily: theme.typography.fontFamily.sans.bold,
                            },
                          ]}
                        >
                          {locale.analysisTitle || "Анализ выполнения"}: {Math.round(analysisData.completion * 100)}%
                        </Text>
                        <Text
                          style={[
                            styles.analysisBody,
                            {
                              color: theme.color.mutedForeground,
                              fontFamily: theme.typography.fontFamily.sans.regular,
                            },
                          ]}
                        >
                          {locale.loadLabel || "Нагрузка"}: {Math.round(analysisData.load)} TRIMP ({locale.plannedLoad || "план"}: {Math.round(analysisData.expectedLoad)})
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Completion Form (if completing now) */}
              {isCompleting && (
                <View style={styles.completingForm}>
                  <Text
                    style={[
                      styles.sectionLabel,
                      {
                        color: theme.color.primary,
                        fontFamily: theme.typography.fontFamily.sans.bold,
                      },
                    ]}
                  >
                    {locale.completingHeader || "ВВЕДИТЕ ФАКТИЧЕСКИЕ ДАННЫЕ"}
                  </Text>

                  <View style={styles.metricsRow}>
                    <View style={{ flex: 1 }}>
                      <GlassInput
                        keyboardType="numeric"
                        label="Дистанция (км)"
                        onChangeText={setActualDistanceKm}
                        theme={theme}
                        value={actualDistanceKm}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <GlassInput
                        keyboardType="numeric"
                        label="Время (мин)"
                        onChangeText={setActualDurationMinutes}
                        theme={theme}
                        value={actualDurationMinutes}
                      />
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <View style={{ flex: 1 }}>
                      <GlassInput
                        keyboardType="numeric"
                        label="Пульс (опционально)"
                        onChangeText={setHeartRate}
                        placeholder="145"
                        theme={theme}
                        value={heartRate}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <GlassInput
                        keyboardType="numeric"
                        label="RPE 1-10"
                        onChangeText={setRpe}
                        placeholder="6"
                        theme={theme}
                        value={rpe}
                      />
                    </View>
                  </View>

                  <GlassInput
                    label="Заметки"
                    multiline
                    onChangeText={setNotes}
                    placeholder="Как прошла тренировка?"
                    theme={theme}
                    value={notes}
                  />
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            {!isCompleted && !isCompleting && (
              <Pressable
                accessibilityRole="button"
                onPress={handleStartCompleting}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: theme.color.primary },
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    {
                      color: theme.color.primaryForeground,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {locale.completeButton || "Завершить тренировку"}
                </Text>
                <ChevronRight color={theme.color.primaryForeground} size={18} />
              </Pressable>
            )}

            {isCompleting && (
              <Pressable
                accessibilityRole="button"
                disabled={completeWorkoutMutation.isPending}
                onPress={handleSaveCompletion}
                style={({ pressed }) => [
                  styles.actionButton,
                  { backgroundColor: theme.color.primary },
                  pressed && styles.actionButtonPressed,
                  completeWorkoutMutation.isPending && { opacity: 0.7 },
                ]}
              >
                {completeWorkoutMutation.isPending ? (
                  <ActivityIndicator color={theme.color.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.actionButtonText,
                      {
                        color: theme.color.primaryForeground,
                        fontFamily: theme.typography.fontFamily.sans.semibold,
                      },
                    ]}
                  >
                    {locale.saveResultButton || "Сохранить результат"}
                  </Text>
                )}
              </Pressable>
            )}
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeRow: {
    flexDirection: "row",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.5,
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
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
  },
  analysisCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  analysisTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  analysisBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  completingForm: {
    gap: 12,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionButton: {
    height: 52,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 8,
  },
  actionButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  actionButtonText: {
    fontSize: 16,
    lineHeight: 22,
  },
});
