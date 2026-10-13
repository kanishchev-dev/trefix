import { useState, useMemo, useCallback, useRef } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from "react-native-reanimated";
import { type ThemeTokens, type ThemeMode } from "@trefix/tokens";
import { type TrainingWorkout } from "@trefix/api-client";
import { useQueryClient } from "@tanstack/react-query";

import {
  HeaderLogo,
  HeaderPlusButton,
  HeaderBellButton,
} from "../components/header";
import { useHeaderOptions } from "../context/header-context";
import { SectionLayout } from "../components/section-layout";
import {
  formatDayMonth,
  getAppLanguage,
  type MainCopy,
} from "../../../locales";
import { TodayCalendarHeader } from "../components/today/today-calendar-header";
import {
  TodayTimeline,
  type TodayTimelineRef,
} from "../components/today/today-timeline";
import { AddWorkoutSheet } from "../components/today/add-workout-sheet";
import {
  WorkoutGoalSheet,
  type ManualWorkoutType,
} from "../components/today/workout-goal-sheet";
import { useWorkouts } from "../hooks/use-workouts";
import { pushSubScreen } from "../main-routes";
import {
  FloatingActions,
  RecordButton,
} from "../../tracker/components/record-button";
import { queryKeys } from "../../../shared/lib/query-keys";
import {
  type DayEvent,
  type DayEventStatus,
  type CalendarMode,
} from "../today-types";
import { workoutTargetText } from "../../../shared/lib/workout-target";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { toIsoDate, workoutLocalDate } from "../../plans/lib/plan-dates";

/** Backend status → card status; a skipped workout is shown as missed. */
function toDayEventStatus(status: string): DayEventStatus {
  if (status === "completed") return "completed";
  if (status === "skipped") return "missed";
  return "planned";
}

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

export function TodayScreen({ theme, themeMode, copy }: Props) {
  const language = getAppLanguage();
  const format = useUnitFormat(copy, language);
  const timelineRef = useRef<TodayTimelineRef>(null);
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visibleDate, setVisibleDate] = useState(toIsoDate(new Date()));
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");

  // Sheet states
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [goalSheetVisible, setGoalSheetVisible] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] =
    useState<ManualWorkoutType>("easy");

  // Compute 60-day query range around selectedDate
  const { fromStr, toStr } = useMemo(() => {
    const from = new Date(selectedDate);
    from.setDate(from.getDate() - 30);
    const to = new Date(selectedDate);
    to.setDate(to.getDate() + 30);
    return {
      fromStr: toIsoDate(from),
      toStr: toIsoDate(to),
    };
  }, [selectedDate]);

  const workoutTypeLabels = copy.plan.creation.workoutTypes as Record<
    string,
    string | undefined
  >;

  // Fetch real workouts from backend
  const { data: workoutsData = [] } = useWorkouts(fromStr, toStr);

  // Map backend TrainingWorkout[] to calendar Day[]
  const { daysMap, workoutById } = useMemo(() => {
    const map = new Map<string, DayEvent[]>();
    const byId = new Map<string, TrainingWorkout>();

    for (const workout of workoutsData) {
      byId.set(workout.id, workout);
      const dateStr = workoutLocalDate(workout.scheduledAt);

      const existing = map.get(dateStr) || [];
      const isRecovery = workout.type === "recovery";

      existing.push({
        id: workout.id,
        type: isRecovery ? "recovery" : "workout",
        status: toDayEventStatus(workout.status),
        title:
          workoutTargetText(workout.target, "title") ||
          workoutTypeLabels[workout.type] ||
          workout.type,
        typeLabel: workoutTypeLabels[workout.type],
        dateLabel: formatDayMonth(dateStr, language),
        duration: format.minutes(Math.round(workout.durationMinutes)),
        distance: format.distance(workout.distanceKm),
      });

      map.set(dateStr, existing);
    }

    return { daysMap: map, workoutById: byId };
  }, [workoutsData, format, workoutTypeLabels, language]);

  const eventDates = useMemo(() => Array.from(daysMap.keys()), [daysMap]);

  const selectedDay = useMemo(() => {
    const dateStr = toIsoDate(selectedDate);
    const events = daysMap.get(dateStr) || [];
    return { date: dateStr, events };
  }, [selectedDate, daysMap]);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setVisibleDate(toIsoDate(date));
  }, []);

  const handleBackToToday = () => {
    handleSelectDate(new Date());
  };

  const handleSelectWorkoutType = useCallback((type: ManualWorkoutType) => {
    setSelectedWorkoutType(type);
    setGoalSheetVisible(true);
  }, []);

  const handleEventPress = useCallback(
    (event: DayEvent) => {
      const workout = workoutById.get(event.id);
      if (workout) {
        // The list already has it: the details screen opens without a loading state.
        queryClient.setQueryData(
          queryKeys.workouts.detail(workout.id),
          workout,
        );
        pushSubScreen({ kind: "workout-details", workoutId: workout.id });
      }
    },
    [queryClient, workoutById],
  );

  const isShowingToday = useMemo(() => {
    const todayStr = toIsoDate(new Date());
    return visibleDate === todayStr;
  }, [visibleDate]);

  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  useHeaderOptions(
    {
      leftAction: (
        <HeaderPlusButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => setAddSheetVisible(true)}
        />
      ),
      centerContent: <HeaderLogo source={logoSource} />,
      rightAction: (
        <HeaderBellButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => undefined}
        />
      ),
      variant: "calendar",
      bottomContent: (
        <TodayCalendarHeader
          theme={theme}
          themeMode={themeMode}
          language={language}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
          calendarMode={calendarMode}
          setCalendarMode={setCalendarMode}
          eventDates={eventDates}
        />
      ),
    },
    [
      theme,
      themeMode,
      language,
      selectedDate,
      handleSelectDate,
      calendarMode,
      setCalendarMode,
      eventDates,
      logoSource,
    ],
  );

  return (
    <SectionLayout
      hasHeader={false}
      theme={theme}
      themeMode={themeMode}
      scrollable={false}
      contentStyle={{
        paddingHorizontal: 0,
        alignItems: "stretch",
        justifyContent: "flex-start",
      }}
    >
      <View style={styles.timelineContainer}>
        <TodayTimeline
          ref={timelineRef}
          theme={theme}
          themeMode={themeMode}
          language={language}
          day={selectedDay}
          copy={copy}
          calendarMode={calendarMode}
          onEventPress={handleEventPress}
          onSelectWorkoutType={handleSelectWorkoutType}
        />

        <FloatingActions>
          {!isShowingToday && (
            <Animated.View
              entering={FadeIn.duration(180)}
              exiting={FadeOut.duration(120)}
              layout={LinearTransition.duration(220)}
            >
              <Pressable
                accessibilityRole="button"
                onPress={handleBackToToday}
                style={({ pressed }) => [
                  styles.todayButton,
                  {
                    backgroundColor: theme.color.control,
                    borderColor: theme.color.controlBorder,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.todayButtonText,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {copy.today.backToToday}
                </Text>
              </Pressable>
            </Animated.View>
          )}
          <RecordButton theme={theme} copy={copy} language={language} />
        </FloatingActions>
      </View>

      {/* Add Workout Modal Sheet */}
      <AddWorkoutSheet
        copy={copy}
        defaultDate={toIsoDate(selectedDate)}
        onClose={() => setAddSheetVisible(false)}
        theme={theme}
        themeMode={themeMode}
        visible={addSheetVisible}
      />

      {/* Planned Workout Goal Sheet */}
      <WorkoutGoalSheet
        copy={copy}
        date={toIsoDate(selectedDate)}
        onClose={() => setGoalSheetVisible(false)}
        theme={theme}
        themeMode={themeMode}
        visible={goalSheetVisible}
        workoutType={selectedWorkoutType}
      />
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  timelineContainer: {
    flex: 1,
  },
  // Same size as the record button next to it, secondary look.
  todayButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  todayButtonText: {
    fontSize: 15,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.85,
  },
});
