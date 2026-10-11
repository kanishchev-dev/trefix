import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CheckCircle2,
  Activity,
  Clock,
  Heart,
  Award,
  Sparkles,
  ChevronRight,
  Play,
} from "lucide-react-native";

import { type TrainingWorkout } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { GlassInput } from "../../../../shared/ui/glass-input";
import {
  BottomSheet,
  SheetButton,
  SheetSectionLabel,
} from "../../../../shared/ui/bottom-sheet";
import { useCompleteWorkout } from "../../hooks/use-workouts";
import { type AppLanguage, type MainCopy } from "../../../../locales";
import { useActivePlan } from "../../../plans/hooks/use-active-plan";
import { todayIso, workoutLocalDate } from "../../../plans/lib/plan-dates";
import {
  PlanWorkoutEditPanel,
  type PlanWorkoutEditMode,
} from "../../../plans/components/plan-workout-edit-panel";
import { useUnitFormat } from "../../../profile/hooks/use-unit-format";
import { WorkoutSourceRow } from "../../../health-sync/components/workout-source-row";
import { RecordingMap } from "../../../tracker/map/recording-map";
import { recorder } from "../../../tracker/recorder";
import { pushSubScreen } from "../../main-routes";

type Props = {
  workout: TrainingWorkout | null;
  visible: boolean;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language?: AppLanguage;
};

export function WorkoutDetailSheet({
  workout,
  visible,
  onClose,
  theme,
  themeMode,
  copy,
  language = "ru",
}: Props) {
  const completeWorkoutMutation = useCompleteWorkout();
  const activePlanQuery = useActivePlan({ enabled: visible && Boolean(workout?.planId) });
  const [editMode, setEditMode] = useState<PlanWorkoutEditMode | null>(null);
  const locale = copy?.today?.detailSheet || {};
  const format = useUnitFormat(copy);
  const statuses = copy?.today?.workout?.statuses || {};

  const [isCompleting, setIsCompleting] = useState(false);
  const [actualDistanceKm, setActualDistanceKm] = useState("");
  const [actualDurationMinutes, setActualDurationMinutes] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (visible) {
      setIsCompleting(false);
      setErrorMessage("");
      setEditMode(null);
    }
  }, [visible]);

  if (!workout) {
    return (
      <BottomSheet visible={false} onClose={onClose} theme={theme} themeMode={themeMode} />
    );
  }

  const isCompleted = workout.status === "completed";
  const isCancelled = workout.status === "cancelled";
  const workoutDate = workoutLocalDate(workout.scheduledAt);
  const today = todayIso();
  const activePlanId = activePlanQuery.data?.plan?.id ?? null;
  const isActivePlanWorkout = Boolean(workout.planId) && workout.planId === activePlanId;
  // Future workouts of the plan in progress are editable; the past is history.
  const isPending = workout.status === "planned" || workout.status === "modified";
  const isEditable = isActivePlanWorkout && isPending && workoutDate >= today;
  const isLocked = isActivePlanWorkout && !isEditable && !isCancelled;
  // Manual completion stays available whatever the plan status: Strava may be missing.
  const canComplete = (isPending || workout.status === "missed") && workoutDate <= today;
  const planCopy = copy.plans.edit;
  // Today's run can be recorded with the tracker, step by step.
  const canRecord = isPending && workoutDate === today && workout.type !== "rest" && !recorder.active;
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
      onClose();
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
    <BottomSheet
      visible={visible}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
      renderHeader={() => (
        <View style={styles.titleRow}>
          {isCompleted ? (
            <CheckCircle2 color={theme.color.primary} size={22} />
          ) : (
            <Activity color={theme.color.primary} size={22} />
          )}
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {((workout.target as any)?.title as string) ||
              `${workout.type.toUpperCase()} Run`}
          </Text>
        </View>
      )}
    >
      {editMode && activePlanId ? (
        <PlanWorkoutEditPanel
          planId={activePlanId}
          mode={editMode}
          workout={{
            id: workout.id,
            type: workout.type,
            distanceKm: workout.distanceKm,
            durationMinutes: workout.durationMinutes,
            scheduledAt: typeof workout.scheduledAt === "string" ? workout.scheduledAt : workout.scheduledAt.toISOString(),
          }}
          onDone={onClose}
          onCancel={() => setEditMode(null)}
          theme={theme}
          themeMode={themeMode}
          copy={copy}
          language={language}
        />
      ) : (
      <>
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
                color: isCompleted ? theme.color.primary : theme.color.foreground,
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
            style={[styles.errorBanner, { backgroundColor: theme.color.dangerSurface }]}
          >
            <Text style={[styles.errorText, { color: theme.color.danger }]}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Target / Plan Stats */}
        <View style={styles.section}>
          <SheetSectionLabel text={locale.workoutPlan || "ПЛАН ТРЕНИРОВКИ"} theme={theme} />

          <View style={styles.statsGrid}>
            <View
              style={[
                styles.statBox,
                {
                  backgroundColor: theme.color.control,
                  borderColor:
                    theme.color.controlBorder,
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
                  {format.distance(workout.distanceKm)}
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
                  backgroundColor: theme.color.control,
                  borderColor:
                    theme.color.controlBorder,
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

        {isEditable && !isCompleting ? (
          <View style={styles.planActionsRow}>
            {(["edit", "move", "remove"] as const).map((action) => (
              <SheetButton
                key={action}
                label={action === "edit" ? planCopy.edit : action === "move" ? planCopy.move : planCopy.remove}
                variant={action === "remove" ? "destructive" : "secondary"}
                onPress={() => setEditMode(action)}
                theme={theme}
                themeMode={themeMode}
              />
            ))}
          </View>
        ) : null}

        {isLocked ? (
          <Text
            accessibilityHint={planCopy.locked}
            style={[styles.infoText, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}
          >
            {planCopy.locked}
          </Text>
        ) : null}

        {isCancelled ? (
          <Text style={[styles.infoText, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
            {planCopy.cancelledWorkout}
          </Text>
        ) : null}

        {/* Actual Results (if completed) */}
        {isCompleted && (
          <View style={styles.section}>
            <SheetSectionLabel text={locale.result || "РЕЗУЛЬТАТ"} theme={theme} />
            <RecordingMap workoutId={workout.id} theme={theme} units={format.units} />

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
                  {locale.avgHeartRate || "Средний пульс"}:{" "}
                  {String(actualData.actualAverageHeartRate)} уд/мин
                </Text>
              </View>
            ) : null}

            <WorkoutSourceRow workoutId={workout.id} copy={copy} theme={theme} />

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
                <Sparkles color={theme.color.ai} size={18} />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.analysisTitle,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.medium,
                      },
                    ]}
                  >
                    {locale.analysisTitle || "Анализ выполнения"}:{" "}
                    {Math.round(analysisData.completion * 100)}%
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
                    {locale.loadLabel || "Нагрузка"}: {Math.round(analysisData.load)} TRIMP (
                    {locale.plannedLoad || "план"}: {Math.round(analysisData.expectedLoad)})
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        )}

        {/* Completion Form (if completing now) */}
        {isCompleting && (
          <View style={styles.completingForm}>
            <SheetSectionLabel
              text={locale.completingHeader || "ВВЕДИТЕ ФАКТИЧЕСКИЕ ДАННЫЕ"}
              theme={theme}
            />

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

      {canRecord && !isCompleting ? (
        <SheetButton
          label={copy.tracker.startPlanned}
          onPress={() => {
            onClose();
            pushSubScreen({ kind: "tracker-setup", plannedWorkoutId: workout.id });
          }}
          theme={theme}
          themeMode={themeMode}
          trailing={<Play color={theme.color.primaryForeground} size={16} />}
        />
      ) : null}

      {/* Actions Row */}
      <View style={styles.actionsRow}>
        <SheetButton
          label={copy?.today?.goalSheet?.cancel || "Отменить"}
          onPress={onClose}
          variant="secondary"
          theme={theme}
          themeMode={themeMode}
        />

        {canComplete && !isCompleting && (
          <SheetButton
            label={locale.completeButton || "Завершить"}
            onPress={handleStartCompleting}
            theme={theme}
            themeMode={themeMode}
            trailing={
              <ChevronRight color={theme.color.primaryForeground} size={18} />
            }
          />
        )}

        {isCompleting && (
          <SheetButton
            label={locale.saveResultButton || "Сохранить"}
            onPress={handleSaveCompletion}
            pending={completeWorkoutMutation.isPending}
            theme={theme}
            themeMode={themeMode}
          />
        )}
      </View>
      </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: -8,
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
    paddingTop: 56,
    paddingBottom: 84,
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
  planActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "transparent",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});
