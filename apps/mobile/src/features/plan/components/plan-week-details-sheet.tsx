import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  Activity,
  ChevronRight,
  Dumbbell,
  Plus,
  Sparkles,
} from "lucide-react-native";

import { type PlanAdaptation, type PlanWeek } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";
import {
  BottomSheet,
  SheetSectionLabel,
} from "../../../shared/ui/bottom-sheet";
import {
  type PlanTimelineMode,
  type WeekWorkoutRow,
} from "../../plans/lib/plan-weeks";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { styles } from "./plan-week-details-sheet.styles";

type Props = {
  week: PlanWeek | null;
  adaptations?: PlanAdaptation[];
  visible: boolean;
  /** Called after the sheet has slid away. */
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  /** `active` — plan in progress, `relative` — draft weeks, `history` — finished plan. */
  mode?: PlanTimelineMode;
  /** Workouts of the week; dated ones open the workout sheet. */
  workouts?: WeekWorkoutRow[];
  /** Runs after the sheet has closed, so the workout sheet can open safely. */
  onSelectWorkout?: (workoutId: string) => void;
  /** Adds a workout to a future week of the plan in progress; runs after close. */
  onAddWorkout?: () => void;
};

/**
 * Week details rendered in the canonical app-wide bottom sheet
 * (shared BottomSheet shell extracted from the workout goal sheet).
 */
export function PlanWeekDetailsSheet({
  week,
  adaptations = [],
  visible,
  onClose,
  theme,
  themeMode,
  copy,
  mode = "active",
  workouts,
  onSelectWorkout,
  onAddWorkout,
}: Props) {
  const [open, setOpen] = useState(visible);
  const afterClose = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (visible) {
      afterClose.current = null;
      setOpen(true);
    }
  }, [visible]);

  const format = useUnitFormat(copy);

  const closeThen = (action?: () => void) => {
    afterClose.current = action ?? null;
    setOpen(false);
  };

  if (!week) {
    return (
      <BottomSheet
        visible={false}
        onClose={onClose}
        theme={theme}
        themeMode={themeMode}
      />
    );
  }

  const statuses = copy.today.workout.statuses as Record<string, string>;
  const typeLabels = copy.plan.creation.workoutTypes as Record<string, string>;
  const units = copy.plan.creation.units;

  const planCopy = copy.plan;

  const weekAdaptations = adaptations.filter(
    (a) => a.weekId === week.id || a.weekNumber === week.weekNumber,
  );

  return (
    <BottomSheet
      title={planCopy.weekDetails.title.replace(
        "{{number}}",
        String(week.weekNumber),
      )}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        const action = afterClose.current;
        afterClose.current = null;
        onClose();
        action?.();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Focus Title */}
        <View style={styles.section}>
          <SheetSectionLabel
            text={planCopy.weekDetails.weeklyFocus}
            theme={theme}
          />
          <Text
            style={[
              styles.focusText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {week.title}
          </Text>
        </View>

        {/* Training Intent */}
        {week.intent ? (
          <View style={styles.section}>
            <SheetSectionLabel
              text={planCopy.weekDetails.trainingIntent}
              theme={theme}
            />
            <Text
              style={[
                styles.bodyText,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {week.intent}
            </Text>
          </View>
        ) : null}

        {/* Planned Volume Stats */}
        {week.plannedWorkoutsCount || week.plannedDistance ? (
          <View style={styles.section}>
            <SheetSectionLabel
              text={planCopy.weekDetails.plannedVolume}
              theme={theme}
            />

            <View style={styles.statsGrid}>
              {week.plannedWorkoutsCount ? (
                <View
                  style={[
                    styles.statBox,
                    {
                      backgroundColor: theme.color.surface,
                      borderColor: theme.color.border,
                    },
                  ]}
                >
                  <Dumbbell color={theme.color.accent} size={18} />
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
                      {week.plannedWorkoutsCount}
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
                      {planCopy.weekDetails.workouts}
                    </Text>
                  </View>
                </View>
              ) : null}

              {week.plannedDistance ? (
                <View
                  style={[
                    styles.statBox,
                    {
                      backgroundColor: theme.color.surface,
                      borderColor: theme.color.border,
                    },
                  ]}
                >
                  <Activity color={theme.color.accent} size={18} />
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
                      {week.plannedDistance}
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
                      {planCopy.weekDetails.distance}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Workouts of the week */}
        {workouts && workouts.length > 0 ? (
          <View style={styles.section}>
            <SheetSectionLabel
              text={planCopy.weekDetails.workouts}
              theme={theme}
            />
            <View style={styles.sessionsList}>
              {workouts.map((workout) => {
                const status = workout.status
                  ? (statuses[workout.status] ?? workout.status)
                  : null;
                const actual =
                  workout.actualDistanceKm !== null &&
                  workout.actualDistanceKm !== undefined
                    ? ` → ${format.distance(workout.actualDistanceKm)}`
                    : "";
                const meta = `${format.distance(workout.distanceKm)}${actual} · ${workout.durationMinutes} ${units.min}`;
                const label = `${workout.dayLabel} · ${typeLabels[workout.type] ?? workout.type}`;
                const content = (
                  <>
                    <View style={styles.workoutText}>
                      <Text
                        style={[
                          styles.sessionText,
                          {
                            color: theme.color.foreground,
                            fontFamily: theme.typography.fontFamily.sans.medium,
                          },
                        ]}
                      >
                        {label}
                      </Text>
                      <Text
                        style={[
                          styles.adaptationDesc,
                          {
                            color: theme.color.mutedForeground,
                            fontFamily:
                              theme.typography.fontFamily.sans.regular,
                          },
                        ]}
                      >
                        {status && mode !== "relative"
                          ? `${meta} · ${status}`
                          : meta}
                      </Text>
                    </View>
                    {workout.selectable && onSelectWorkout ? (
                      <ChevronRight
                        color={theme.color.mutedForeground}
                        size={18}
                      />
                    ) : null}
                  </>
                );
                const cardStyle = [
                  styles.sessionCard,
                  {
                    backgroundColor: theme.color.surface,
                    borderColor: theme.color.border,
                  },
                ];
                return workout.selectable && onSelectWorkout ? (
                  <Pressable
                    key={workout.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${label}, ${meta}${status ? `, ${status}` : ""}`}
                    onPress={() => closeThen(() => onSelectWorkout(workout.id))}
                    style={({ pressed }) => [
                      ...cardStyle,
                      pressed && styles.doneButtonPressed,
                    ]}
                  >
                    {content}
                  </Pressable>
                ) : (
                  <View key={workout.id} style={cardStyle}>
                    {content}
                  </View>
                );
              })}
            </View>
            {onAddWorkout ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => closeThen(onAddWorkout)}
                style={({ pressed }) => [
                  styles.sessionCard,
                  {
                    backgroundColor: theme.color.surface,
                    borderColor: theme.color.border,
                    justifyContent: "center",
                  },
                  pressed && styles.doneButtonPressed,
                ]}
              >
                <Plus color={theme.color.foreground} size={16} />
                <Text
                  style={[
                    styles.sessionText,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {copy.plans.edit.addWorkout}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Key Sessions */}
        {!workouts && week.keySessions && week.keySessions.length > 0 ? (
          <View style={styles.section}>
            <SheetSectionLabel
              text={planCopy.weekDetails.keySessions}
              theme={theme}
            />
            <View style={styles.sessionsList}>
              {week.keySessions.map((session, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.sessionCard,
                    {
                      backgroundColor: theme.color.surface,
                      borderColor: theme.color.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.sessionDot,
                      { backgroundColor: theme.color.primary },
                    ]}
                  />
                  <Text
                    style={[
                      styles.sessionText,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.medium,
                      },
                    ]}
                  >
                    {session}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Adaptations on this week */}
        {weekAdaptations.length > 0 ? (
          <View style={styles.section}>
            <SheetSectionLabel
              text={planCopy.weekDetails.changesThisWeek}
              theme={theme}
            />
            <View style={styles.adaptationsList}>
              {weekAdaptations.map((a) => (
                <View
                  key={a.id}
                  style={[
                    styles.adaptationCard,
                    {
                      backgroundColor: theme.color.surface,
                      borderColor: theme.color.border,
                    },
                  ]}
                >
                  <Sparkles color={theme.color.accent} size={16} />
                  <View style={styles.adaptationTextWrapper}>
                    <Text
                      style={[
                        styles.adaptationTitle,
                        {
                          color: theme.color.foreground,
                          fontFamily: theme.typography.fontFamily.sans.medium,
                        },
                      ]}
                    >
                      {a.title}
                    </Text>
                    {a.description ? (
                      <Text
                        style={[
                          styles.adaptationDesc,
                          {
                            color: theme.color.mutedForeground,
                            fontFamily:
                              theme.typography.fontFamily.sans.regular,
                          },
                        ]}
                      >
                        {a.description}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        accessibilityRole="button"
        onPress={() => closeThen()}
        style={({ pressed }) => [
          styles.doneButton,
          { backgroundColor: theme.color.primary },
          pressed && styles.doneButtonPressed,
        ]}
      >
        <Text
          style={[
            styles.doneLabel,
            {
              color: theme.color.primaryForeground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {planCopy.weekDetails.close}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}
