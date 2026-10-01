import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { AlertCircle, Pencil, X } from "lucide-react-native";

import {
  type ManualPlanNewWorkout,
  type ManualPlanPreview,
  type ManualPlanPreviewWorkout,
  type ManualPlanWorkoutOverride,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../locales";
import { BottomSheet } from "../../shared/ui/bottom-sheet";
import {
  PLAN_WORKOUT_TYPE_KEYS,
  formatGoalSummary,
  type PlanCreationDraft,
} from "./plan-creation-types";
import { useCreateManualPlan } from "./hooks/use-manual-plan";
import { FieldError, OptionChip } from "./components/plan-creation-ui";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  preview: ManualPlanPreview;
  draft: PlanCreationDraft;
  onEditSettings: () => void;
  onDiscard: () => void;
  onCreated: () => void;
};

type EditingTarget = {
  weekNumber: number; 
  workout: ManualPlanPreviewWorkout | null;
};

const SHORT_DAY_NAMES_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const SHORT_DAY_NAMES_RU = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export function PlanPreviewScreen({
  theme,
  themeMode,
  copy,
  language,
  preview,
  draft,
  onCreated,
  onEditSettings,
  onDiscard,
}: Props) {
  const creationCopy = copy.plan.creation;
  const planCopy = copy.plan;

  const [overrides, setOverrides] = useState<Record<string, ManualPlanWorkoutOverride>>({});
  const [removals, setRemovals] = useState<Array<{ weekNumber: number; orderInWeek: number }>>([]);
  const [additions, setAdditions] = useState<Array<ManualPlanNewWorkout & { weekNumber: number }>>([]);
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [showCreatedError, setShowCreatedError] = useState(false);

  const createMutation = useCreateManualPlan();

  const shortDayNames = language === "ru" ? SHORT_DAY_NAMES_RU : SHORT_DAY_NAMES_EN;

  const formattedStartDate = useMemo(() => {
    return new Date(preview.startDate).toLocaleDateString(language === "ru" ? "ru-RU" : "en-US", {
      day: "numeric",
      month: "long",
    });
  }, [preview.startDate, language]);

  const goalSummary = useMemo(() => {
    return formatGoalSummary(draft.goal, copy);
  }, [draft.goal, copy]);

  const totalDistance = useMemo(
    () => preview.weeks.reduce((sum, week) => sum + week.plannedDistance, 0),
    [preview.weeks],
  );

  const buildCreatePayload = () => {
    const weekOverrideMap = new Map<
      number,
      {
        weekNumber: number;
        workoutOverrides: ManualPlanWorkoutOverride[];
        removedWorkoutIds: string[];
        newWorkouts: ManualPlanNewWorkout[];
      }
    >();
    const weekFor = (weekNumber: number) => {
      let entry = weekOverrideMap.get(weekNumber);
      if (!entry) {
        entry = { weekNumber, workoutOverrides: [], removedWorkoutIds: [], newWorkouts: [] };
        weekOverrideMap.set(weekNumber, entry);
      }
      return entry;
    };

    for (const override of Object.values(overrides)) {
      weekFor(Number(override.id.split("-")[0])).workoutOverrides.push(override);
    }
    for (const removal of removals) {
      weekFor(removal.weekNumber).removedWorkoutIds.push(`${removal.weekNumber}-${removal.orderInWeek}`);
    }
    for (const addition of additions) {
      weekFor(addition.weekNumber).newWorkouts.push({
        type: addition.type,
        dayOfWeek: addition.dayOfWeek,
        distanceKm: addition.distanceKm,
        durationMinutes: addition.durationMinutes,
      });
    }

    return {
      goal: {
        type: draft.goal.type,
        target: draft.goal.target,
        current: draft.goal.current,
        description: draft.goal.description,
        targetDate: draft.goal.targetDate,
        priority: draft.goal.priority,
        raceDistance: draft.goal.raceDistance,
        targetTimeSeconds: draft.goal.targetTimeSeconds,
      },
      schedule: draft.schedule,
      structure: {
        ...draft.structure,
        focus: draft.structure.focus,
      },
      startDate: preview.startDate,
      weekOverrides: weekOverrideMap.size ? Array.from(weekOverrideMap.values()) : undefined,
    };
  };

  const handleCreate = async () => {
    try {
      await createMutation.mutateAsync(buildCreatePayload());
      // PRD section 16: navigate the user back to the existing Plan screen.
      onCreated();
    } catch {
      setShowCreatedError(true);
    }
  };

  const applyEdit = (
    target: EditingTarget & { workout: ManualPlanPreviewWorkout },
    changes: {
      type?: string;
      dayOfWeek?: number;
      distanceKm?: number;
      durationMinutes?: number;
    },
  ) => {
    // Client-side mirror of the backend engine rules. The server re-validates
    // everything on creation, so a stale edit cannot produce an invalid plan.
    if (
      (changes.distanceKm !== undefined && changes.distanceKm <= 0) ||
      (changes.distanceKm !== undefined && changes.distanceKm > 100)
    ) {
      setEditError("invalidDistance");
      return;
    }
    if (
      (changes.durationMinutes !== undefined && changes.durationMinutes < 10) ||
      (changes.durationMinutes !== undefined && changes.durationMinutes > 300)
    ) {
      setEditError("invalidDuration");
      return;
    }
    setEditError(null);
    setOverrides((current) => ({
      ...current,
      [target.workout.id]: {
        ...current[target.workout.id],
        id: target.workout.id,
        ...changes,
      },
    }));
    setEditing(null);
  };

  const removeWorkout = (workout: ManualPlanPreviewWorkout) => {
    setRemovals((current) => {
      const key = `${workout.weekNumber}-${workout.orderInWeek}`;
      return current.some((item) => item.weekNumber === workout.weekNumber && item.orderInWeek === workout.orderInWeek)
        ? current
        : [...current, { weekNumber: workout.weekNumber, orderInWeek: workout.orderInWeek }];
    });
    setOverrides((current) => {
      const next = { ...current };
      delete next[workout.id];
      return next;
    });
    setEditing(null);
  };

  const addWorkout = (
    input: { type: string; dayOfWeek: number; distanceKm?: number; durationMinutes: number; weekNumber: number },
  ): boolean => {
    if (
      input.distanceKm !== undefined &&
      (input.distanceKm <= 0 || input.distanceKm > 100)
    ) {
      setEditError("invalidDistance");
      return false;
    }
    if (input.durationMinutes < 10 || input.durationMinutes > 300) {
      setEditError("invalidDuration");
      return false;
    }
    setEditError(null);
    setAdditions((current) => [...current, input]);
    return true;
  };

  const resolvedWorkouts = new Map<string, ManualPlanPreviewWorkout>();
  for (const week of preview.weeks) {
    for (const workout of week.workouts) {
      const isRemoved = removals.some(
        (item) => item.weekNumber === workout.weekNumber && item.orderInWeek === workout.orderInWeek,
      );
      if (isRemoved) {
        continue;
      }
      const override = overrides[workout.id];
      resolvedWorkouts.set(workout.id, override ? { ...workout, ...override } : workout);
    }
  }

  const additionsByWeek = new Map<number, ManualPlanPreviewWorkout[]>();
  additions.forEach((addition, index) => {
    const list = additionsByWeek.get(addition.weekNumber) ?? [];
    list.push({
      id: `new-${addition.weekNumber}-${index}`,
      type: addition.type,
      phase: "",
      weekNumber: addition.weekNumber,
      dayOfWeek: addition.dayOfWeek,
      scheduledAt: "",
      orderInWeek: 1000 + index,
      durationMinutes: addition.durationMinutes ?? 30,
      distanceKm: addition.distanceKm ?? 0,
      target: {},
      steps: [],
    });
    additionsByWeek.set(addition.weekNumber, list);
  });

  const editingWorkout = editing?.workout
    ? resolvedWorkouts.get(editing.workout.id) ?? editing.workout
    : null;

  const renderWorkout = (workout: ManualPlanPreviewWorkout) => {
    const typeLabel =
      creationCopy.workoutTypes[workout.type as keyof typeof creationCopy.workoutTypes] ??
      workout.type;
    const isEdited = overrides[workout.id] !== undefined;

    return (
      <Pressable
        key={workout.id}
        accessibilityRole="button"
        accessibilityLabel={`${typeLabel} ${Math.round(workout.distanceKm)} km`}
        onPress={() => {
          setEditError(null);
          setEditing({
            weekNumber: workout.weekNumber,
            workout: resolvedWorkouts.get(workout.id) ?? workout,
          });
        }}
        style={({ pressed }) => [
          styles.workoutRow,
          {
            backgroundColor: theme.color.surface,
            borderColor: theme.color.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.workoutDot, { backgroundColor: theme.color.primary }]} />
        <View style={styles.workoutTextGroup}>
          <Text
            style={[
              styles.workoutType,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {typeLabel}
            {isEdited ? " ✎" : ""}
          </Text>
          <Text
            style={[
              styles.workoutMeta,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {shortDayNames[workout.dayOfWeek]} · {Math.round(workout.distanceKm)} km ·{" "}
            {workout.durationMinutes} min
          </Text>
        </View>
        <Pencil color={theme.color.mutedForeground} size={16} />
      </Pressable>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.color.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={planCopy.creation.common.back}
          hitSlop={8}
          onPress={onEditSettings}
          style={styles.backButton}
        >
          <Text
            style={[
              styles.backButtonText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            ‹
          </Text>
        </Pressable>

        <Text
          style={[
            styles.stepTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
            },
          ]}
        >
          {creationCopy.preview.title}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={creationCopy.common.close}
          hitSlop={8}
          onPress={onDiscard}
          style={styles.closeButton}
        >
          <X color={theme.color.mutedForeground} size={20} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Goal summary */}
        <View
          style={[
            styles.goalCard,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: theme.color.border,
            },
          ]}
        >
          <Text
            style={[
              styles.goalTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.extrabold,
              },
            ]}
          >
            {goalSummary}
          </Text>
          <Text
            style={[
              styles.goalMeta,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {preview.totalWeeks} {creationCopy.preview.weeksUnit} ·{" "}
            {creationCopy.preview.runsPerWeek.replace("{{count}}", String(preview.trainingFrequency))}{" "}
            · {creationCopy.preview.startsOn.replace("{{date}}", formattedStartDate)}
          </Text>
          <Text
            style={[
              styles.goalMeta,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {creationCopy.preview.totalDistance.replace(
              "{{distance}}",
              String(Math.round(totalDistance)),
            )}
          </Text>
        </View>

        {/* Weeks */}
        {preview.weeks.map((week) => {
          const phaseLabel = planCopy.phases[week.phase as keyof typeof planCopy.phases] ?? week.phase;
          const baseWeekWorkouts = week.workouts
            .map((workout) => resolvedWorkouts.get(workout.id))
            .filter((workout): workout is ManualPlanPreviewWorkout => workout !== undefined)
          const weekWorkouts = [...baseWeekWorkouts, ...(additionsByWeek.get(week.weekNumber) ?? [])].sort(
            (left, right) => left.dayOfWeek - right.dayOfWeek,
          );
          const weekDistance = weekWorkouts.reduce((sum, workout) => sum + workout.distanceKm, 0);

          return (
            <View
              key={week.weekNumber}
              style={[
                styles.weekCard,
                {
                  backgroundColor: theme.color.surfaceElevated,
                  borderColor: theme.color.border,
                },
              ]}
            >
              <View style={styles.weekHeader}>
                <View style={styles.weekTitleGroup}>
                  <Text
                    style={[
                      styles.weekLabel,
                      {
                        color: theme.color.mutedForeground,
                        fontFamily: theme.typography.fontFamily.sans.bold,
                      },
                    ]}
                  >
                    {planCopy.timeline.weekLabel.replace("{{number}}", String(week.weekNumber))}
                  </Text>
                  <Text
                    style={[
                      styles.weekTitle,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.extrabold,
                      },
                    ]}
                  >
                    {week.title}
                  </Text>
                </View>
                <View
                  style={[
                    styles.phaseBadge,
                    {
                      backgroundColor: theme.color.surface,
                      borderColor: theme.color.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.phaseBadgeText,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.bold,
                      },
                    ]}
                  >
                    {phaseLabel}
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.weekMeta,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {creationCopy.preview.weekSummary
                  .replace("{{workouts}}", String(weekWorkouts.length))
                  .replace("{{distance}}", String(Math.round(weekDistance)))}
              </Text>

              <View style={styles.workoutList}>{weekWorkouts.map(renderWorkout)}</View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={creationCopy.workoutEditor.addButton}
                onPress={() => {
                  setEditError(null);
                  setEditing({ weekNumber: week.weekNumber, workout: null });
                }}
                style={({ pressed }) => [
                  styles.addWorkoutButton,
                  {
                    borderColor: theme.color.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.addWorkoutText,
                    {
                      color: theme.color.primary,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  + {creationCopy.workoutEditor.addButton}
                  </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: theme.color.border }]}>
        {showCreatedError ? (
          <View style={styles.inlineErrorRow}>
            <AlertCircle color="#dc2626" size={14} />
            <Text
              style={[
                styles.inlineErrorText,
                { fontFamily: theme.typography.fontFamily.sans.regular },
              ]}
            >
              {creationCopy.errors.creationFailed}
            </Text>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void handleCreate()}>
              <Text
                style={[
                  styles.inlineErrorRetry,
                  { fontFamily: theme.typography.fontFamily.sans.bold },
                ]}
              >
                {creationCopy.errors.tryAgain}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={createMutation.isPending}
          onPress={() => void handleCreate()}
          style={({ pressed }) => [
            styles.createButton,
            { backgroundColor: theme.color.primary },
            pressed && styles.pressed,
          ]}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color={theme.color.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.createButtonText,
                {
                  color: theme.color.primaryForeground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              {creationCopy.preview.createButton}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Workout edit sheet */}
      <BottomSheet
        visible={editing !== null}
        onClose={() => setEditing(null)}
        theme={theme}
        themeMode={themeMode}
        title={creationCopy.workoutEditor.title}
      >

        {editing && editing.workout ? (
          <WorkoutEditForm
            key={editing.workout.id}
            workout={editing.workout}
            theme={theme}
            copy={copy}
            language={language}
            error={editError}
            onSave={(changes) => {
              const current = editing;
              if (!current?.workout) return;
              applyEdit({ weekNumber: current.weekNumber, workout: current.workout }, changes);
            }}
            onRemove={() => {
              const current = editing;
              if (current?.workout) removeWorkout(current.workout);
            }}
            onClose={() => setEditing(null)}
          />
        ) : null}

        {editing && !editing.workout ? (
          <WorkoutEditForm
            workout={null}
            defaultWeekNumber={editing.weekNumber}
            theme={theme}
            copy={copy}
            language={language}
            error={editError}
            onSave={(changes) => {
              if (!editing) return;
              addWorkout({
                type: changes.type ?? "easy",
                dayOfWeek: changes.dayOfWeek ?? 0,
                distanceKm: changes.distanceKm,
                durationMinutes: changes.durationMinutes ?? 30,
                weekNumber: editing.weekNumber,
              });
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </BottomSheet>
    </View>
  );
}

type WorkoutEditFormProps = {
  workout: ManualPlanPreviewWorkout | null;
  defaultWeekNumber?: number;
  theme: ThemeTokens;
  copy: MainCopy;
  language: AppLanguage;
  error: string | null;
  onSave: (changes: {
    type?: string;
    dayOfWeek?: number;
    distanceKm?: number;
    durationMinutes?: number;
  }) => void;
  onRemove?: () => void;
  onClose: () => void;
};

function WorkoutEditForm({
  workout,
  theme,
  copy,
  language,
  error,
  onSave,
  onRemove,
  onClose,
}: WorkoutEditFormProps) {
  const creationCopy = copy.plan.creation;
  const shortDayNames = language === "ru" ? SHORT_DAY_NAMES_RU : SHORT_DAY_NAMES_EN;

  const [type, setType] = useState(workout?.type ?? "easy");
  const [dayOfWeek, setDayOfWeek] = useState(workout?.dayOfWeek ?? 0);
  const [distanceText, setDistanceText] = useState(
    workout ? String(Math.round(workout.distanceKm)) : "5",
  );
  const [durationText, setDurationText] = useState(workout ? String(workout.durationMinutes) : "30");

  const distance = Number(distanceText);
  const duration = Number(durationText);

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.editGroup}>
          <Text
            style={[
              styles.editLabel,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {creationCopy.workoutEditor.typeLabel.toUpperCase()}
          </Text>
          <View style={styles.chipWrap}>
            {PLAN_WORKOUT_TYPE_KEYS.map((typeKey) => (
              <OptionChip
                key={typeKey}
                label={
                  creationCopy.workoutTypes[typeKey as keyof typeof creationCopy.workoutTypes] ??
                  typeKey
                }
                selected={type === typeKey}
                theme={theme}
                onPress={() => setType(typeKey)}
              />
            ))}
          </View>
        </View>

        <View style={styles.editGroup}>
          <Text
            style={[
              styles.editLabel,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {creationCopy.workoutEditor.dayLabel.toUpperCase()}
          </Text>
          <View style={styles.chipWrap}>
            {shortDayNames.map((dayName, dayIndex) => (
              <OptionChip
                key={dayIndex}
                label={dayName}
                selected={dayOfWeek === dayIndex}
                theme={theme}
                onPress={() => setDayOfWeek(dayIndex)}
              />
            ))}
          </View>
        </View>

        <View style={styles.editRow}>
          <View style={styles.editField}>
            <Text
              style={[
                styles.editLabel,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {creationCopy.workoutEditor.distanceLabel.toUpperCase()}
            </Text>
            <TextInput
              accessibilityLabel={creationCopy.workoutEditor.distanceLabel}
              keyboardType="decimal-pad"
              value={distanceText}
              onChangeText={setDistanceText}
              style={[
                styles.editInput,
                {
                  backgroundColor: theme.color.surface,
                  borderColor: theme.color.border,
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            />
          </View>
          <View style={styles.editField}>
            <Text
              style={[
                styles.editLabel,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {creationCopy.workoutEditor.durationLabel.toUpperCase()}
            </Text>
            <TextInput
              accessibilityLabel={creationCopy.workoutEditor.durationLabel}
              keyboardType="number-pad"
              value={durationText}
              onChangeText={setDurationText}
              style={[
                styles.editInput,
                {
                  backgroundColor: theme.color.surface,
                  borderColor: theme.color.border,
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            />
          </View>
        </View>

        {error ? (
          <FieldError message={creationCopy.errors[error as keyof typeof creationCopy.errors] ?? error} theme={theme} />
        ) : null}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={() =>
          onSave({
            type: !workout || type !== workout.type ? type : undefined,
            dayOfWeek: !workout || dayOfWeek !== workout.dayOfWeek ? dayOfWeek : undefined,
            distanceKm:
              !workout || (!Number.isNaN(distance) && distance !== Math.round(workout.distanceKm))
                ? distance
                : undefined,
            durationMinutes:
              !workout || (!Number.isNaN(duration) && duration !== workout.durationMinutes)
                ? duration
                : undefined,
          })
        }
        style={({ pressed }) => [
          styles.sheetSaveButton,
          { backgroundColor: theme.color.primary },
          pressed && styles.pressed,
        ]}
      >
        <Text
          style={[
            styles.sheetSaveButtonText,
            {
              color: theme.color.primaryForeground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {workout ? creationCopy.workoutEditor.save : creationCopy.workoutEditor.addButton}
        </Text>
      </Pressable>

      {workout && onRemove ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={creationCopy.workoutEditor.removeButton}
          onPress={onRemove}
          style={({ pressed }) => [
            styles.sheetRemoveButton,
            { borderColor: "#dc2626" },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[
              styles.sheetRemoveButtonText,
              {
                color: "#dc2626",
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {creationCopy.workoutEditor.removeButton}
          </Text>
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    // Full-screen page mounted as a flex sibling of the tab content in
    // MainTabsScreen; it must overlay the whole screen instead of sharing
    // the remaining space with it.
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  backButtonText: {
    fontSize: 28,
    lineHeight: 34,
  },
  stepTitle: {
    fontSize: 18,
    lineHeight: 24,
    textAlign: "center",
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 14,
  },
  goalCard: {
    padding: 18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  goalTitle: {
    fontSize: 20,
    lineHeight: 26,
    textTransform: "capitalize",
  },
  goalMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  weekCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  weekTitleGroup: {
    flex: 1,
    gap: 2,
  },
  weekLabel: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1,
  },
  weekTitle: {
    fontSize: 16,
    lineHeight: 21,
  },
  phaseBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  phaseBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.6,
  },
  weekMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  workoutList: {
    gap: 8,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  workoutDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  workoutTextGroup: {
    flex: 1,
    gap: 1,
  },
  workoutType: {
    fontSize: 14,
    lineHeight: 18,
  },
  workoutMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  inlineErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineErrorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 16,
  },
  inlineErrorRetry: {
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 16,
  },
  createButton: {
    height: 54,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    fontSize: 16,
    lineHeight: 22,
  },
  editGroup: {
    gap: 10,
    marginTop: 8,
  },
  editLabel: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
  },
  editRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  editField: {
    flex: 1,
    gap: 8,
  },
  editInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  sheetSaveButton: {
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  sheetSaveButtonText: {
    fontSize: 16,
    lineHeight: 22,
  },
  sheetRemoveButton: {
    height: 48,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 10,
  },
  sheetRemoveButtonText: {
    fontSize: 15,
    lineHeight: 20,
  },
  addWorkoutButton: {
    minHeight: 44,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  addWorkoutText: {
    fontSize: 14,
    lineHeight: 18,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
