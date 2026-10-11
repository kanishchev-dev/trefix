import React, { useState, useEffect } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  CheckCircle2,
  Activity,
  Clock,
  ChevronRight,
  Play,
} from "lucide-react-native";

import { type TrainingWorkout } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import {
  BottomSheet,
  SheetButton,
  SheetSectionLabel,
} from "../../../../shared/ui/bottom-sheet";
import { useWorkoutCompletion } from "../../hooks/use-workout-completion";
import { getWorkoutActions } from "../../lib/workout-detail-rules";
import { type AppLanguage, type MainCopy } from "../../../../locales";
import { useActivePlan } from "../../../plans/hooks/use-active-plan";
import { todayIso, workoutLocalDate } from "../../../plans/lib/plan-dates";
import {
  PlanWorkoutEditPanel,
  type PlanWorkoutEditMode,
} from "../../../plans/components/plan-workout-edit-panel";
import { useUnitFormat } from "../../../profile/hooks/use-unit-format";
import { recorder } from "../../../tracker/recorder";
import { pushSubScreen } from "../../main-routes";
import { workoutTargetText } from "../../../../shared/lib/workout-target";
import { styles } from "./workout-detail-sheet.styles";
import {
  WorkoutCompletionForm,
  WorkoutResultSection,
} from "./workout-detail-sections";

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
  const activePlanQuery = useActivePlan({
    enabled: visible && Boolean(workout?.planId),
  });
  const [editMode, setEditMode] = useState<PlanWorkoutEditMode | null>(null);
  const locale = copy.today.detailSheet;
  const format = useUnitFormat(copy);
  const statuses = copy.today.workout.statuses;
  const completion = useWorkoutCompletion(copy, onClose);
  const { reset: resetCompletion } = completion;

  useEffect(() => {
    if (visible) {
      resetCompletion();
      setEditMode(null);
    }
  }, [visible, resetCompletion]);

  if (!workout) {
    return (
      <BottomSheet
        visible={false}
        onClose={onClose}
        theme={theme}
        themeMode={themeMode}
      />
    );
  }

  const workoutDate = workoutLocalDate(workout.scheduledAt);
  const activePlanId = activePlanQuery.data?.plan?.id ?? null;
  const {
    isCompleted,
    isCancelled,
    isEditable,
    isLocked,
    canComplete,
    canRecord,
  } = getWorkoutActions(
    workout,
    workoutDate,
    todayIso(),
    activePlanId,
    Boolean(recorder.active),
  );
  const isCompleting = completion.isCompleting;
  const errorMessage = completion.errorMessage;
  const planCopy = copy.plans.edit;
  const actualData = (workout.actual as Record<string, unknown>) || {};
  const analysisData = workout.analysis;

  const getStatusLabel = () => {
    switch (workout.status) {
      case "completed":
        return statuses.completed;
      case "missed":
      case "skipped":
        return statuses.missed;
      case "modified":
        return statuses.modified;
      default:
        return statuses.planned;
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
            {workoutTargetText(workout.target, "title") ||
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
            scheduledAt:
              typeof workout.scheduledAt === "string"
                ? workout.scheduledAt
                : workout.scheduledAt.toISOString(),
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
                  { backgroundColor: theme.color.dangerSurface },
                ]}
              >
                <Text style={[styles.errorText, { color: theme.color.danger }]}>
                  {errorMessage}
                </Text>
              </View>
            ) : null}

            {/* Target / Plan Stats */}
            <View style={styles.section}>
              <SheetSectionLabel text={locale.workoutPlan} theme={theme} />

              <View style={styles.statsGrid}>
                <View
                  style={[
                    styles.statBox,
                    {
                      backgroundColor: theme.color.control,
                      borderColor: theme.color.controlBorder,
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
                          fontFamily:
                            theme.typography.fontFamily.sans.extrabold,
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
                      {locale.distance}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statBox,
                    {
                      backgroundColor: theme.color.control,
                      borderColor: theme.color.controlBorder,
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
                          fontFamily:
                            theme.typography.fontFamily.sans.extrabold,
                        },
                      ]}
                    >
                      {workout.durationMinutes}{" "}
                      {copy.today.goalSheet.durationUnit}
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
                      {locale.duration}
                    </Text>
                  </View>
                </View>
              </View>

              {workoutTargetText(workout.target, "description") ? (
                <Text
                  style={[
                    styles.descriptionText,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {workoutTargetText(workout.target, "description")}
                </Text>
              ) : null}
            </View>

            {isEditable && !isCompleting ? (
              <View style={styles.planActionsRow}>
                {(["edit", "move", "remove"] as const).map((action) => (
                  <SheetButton
                    key={action}
                    label={
                      action === "edit"
                        ? planCopy.edit
                        : action === "move"
                          ? planCopy.move
                          : planCopy.remove
                    }
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
                style={[
                  styles.infoText,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {planCopy.locked}
              </Text>
            ) : null}

            {isCancelled ? (
              <Text
                style={[
                  styles.infoText,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {planCopy.cancelledWorkout}
              </Text>
            ) : null}

            {isCompleted && (
              <WorkoutResultSection
                workout={workout}
                actualData={actualData}
                analysisData={analysisData}
                theme={theme}
                copy={copy}
                format={format}
              />
            )}

            {isCompleting && (
              <WorkoutCompletionForm
                completion={completion}
                theme={theme}
                copy={copy}
              />
            )}
          </ScrollView>

          {canRecord && !isCompleting ? (
            <SheetButton
              label={copy.tracker.startPlanned}
              onPress={() => {
                onClose();
                pushSubScreen({
                  kind: "tracker-setup",
                  plannedWorkoutId: workout.id,
                });
              }}
              theme={theme}
              themeMode={themeMode}
              trailing={
                <Play color={theme.color.primaryForeground} size={16} />
              }
            />
          ) : null}

          {/* Actions Row */}
          <View style={styles.actionsRow}>
            <SheetButton
              label={copy.today.goalSheet.cancel}
              onPress={onClose}
              variant="secondary"
              theme={theme}
              themeMode={themeMode}
            />

            {canComplete && !isCompleting && (
              <SheetButton
                label={locale.completeButton}
                onPress={() => completion.start(workout)}
                theme={theme}
                themeMode={themeMode}
                trailing={
                  <ChevronRight
                    color={theme.color.primaryForeground}
                    size={18}
                  />
                }
              />
            )}

            {isCompleting && (
              <SheetButton
                label={locale.saveResultButton}
                onPress={() => void completion.save(workout.id)}
                pending={completion.isSaving}
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
