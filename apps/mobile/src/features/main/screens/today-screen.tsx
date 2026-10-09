import { useState, useMemo, useCallback, useRef } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";
import { type TrainingWorkout } from "@workspace/api-client";

import {
  HeaderLogo,
  HeaderPlusButton,
  HeaderBellButton,
} from "../components/header";
import { HeaderContext, useHeaderOptions } from "../context/header-context";
import { SectionLayout } from "../components/section-layout";
import { type MainCopy, getAppLanguage } from "../../../locales";
import { TodayCalendarHeader } from "../components/today/today-calendar-header";
import { TodayTimeline, type TodayTimelineRef } from "../components/today/today-timeline";
import { AddWorkoutSection } from "../components/today/add-workout-section";
import { AddWorkoutSheet } from "../components/today/add-workout-sheet";
import { WorkoutDetailSheet } from "../components/today/workout-detail-sheet";
import { WorkoutGoalSheet, type ManualWorkoutType } from "../components/today/workout-goal-sheet";
import { useWorkouts } from "../hooks/use-workouts";
import { type Day, type DayEvent, type CalendarMode } from "../today-types";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { toIsoDate, workoutLocalDate } from "../../plans/lib/plan-dates";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

export function TodayScreen({ theme, themeMode, copy }: Props) {
  const language = getAppLanguage();
  const format = useUnitFormat(copy, language);
  const insets = useSafeAreaInsets();
  const timelineRef = useRef<TodayTimelineRef>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visibleDate, setVisibleDate] = useState(toIsoDate(new Date()));
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");

  // Sheet states
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [goalSheetVisible, setGoalSheetVisible] = useState(false);
  const [selectedWorkoutType, setSelectedWorkoutType] = useState<ManualWorkoutType>("easy");
  const [selectedWorkout, setSelectedWorkout] = useState<TrainingWorkout | null>(null);
  const [detailSheetVisible, setDetailSheetVisible] = useState(false);

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
        status: workout.status as any,
        title:
          ((workout.target as any)?.title as string) ||
          `${workout.type.toUpperCase()} Run`,
        duration: `${Math.round(workout.durationMinutes)} min`,
        distance: format.distance(workout.distanceKm),
        description: ((workout.target as any)?.description as string) || "",
      });

      map.set(dateStr, existing);
    }

    return { daysMap: map, workoutById: byId };
  }, [workoutsData, format]);

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
        setSelectedWorkout(workout);
        setDetailSheetVisible(true);
      }
    },
    [workoutById],
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
    [theme, themeMode, language, selectedDate, handleSelectDate, calendarMode, setCalendarMode, eventDates, logoSource],
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
          onEventAction={handleEventPress}
          onSelectWorkoutType={handleSelectWorkoutType}
        />

        {/* Back to Today Floating Button */}
        {!isShowingToday && (
          <Pressable
            onPress={handleBackToToday}
            style={[
              styles.todayButton,
              {
                backgroundColor: theme.color.primary,
                bottom: 84 + insets.bottom,
                shadowColor: "#000",
              },
            ]}
          >
            <Text
              style={[
                styles.todayButtonText,
                {
                  color: theme.color.primaryForeground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {copy.today.backToToday.toUpperCase()}
            </Text>
          </Pressable>
        )}
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

      {/* Workout Details Modal Sheet */}
      <WorkoutDetailSheet
        copy={copy}
        language={language}
        onClose={() => setDetailSheetVisible(false)}
        theme={theme}
        themeMode={themeMode}
        visible={detailSheetVisible}
        workout={selectedWorkout}
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
  todayButton: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  todayButtonText: {
    fontSize: 12,
    letterSpacing: 1,
  },
});
