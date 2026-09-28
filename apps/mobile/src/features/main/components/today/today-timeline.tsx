import React, { forwardRef, useImperativeHandle, useRef, useMemo, useEffect } from "react";
import { ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";
import { type Day, type DayEvent, type CalendarMode } from "../../today-types";
import { DayHeader, WorkoutCard, RecoveryCard, EmptyDayCard } from "./day-event-cards";
import { AddWorkoutSection } from "./add-workout-section";
import { type ManualWorkoutType } from "./workout-goal-sheet";
import { formatDateLong, type AppLanguage, type MainCopy } from "../../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  language: AppLanguage;
  day: Day | null;
  copy: MainCopy;
  calendarMode: CalendarMode;
  onEventPress?: (event: DayEvent) => void;
  onEventAction?: (event: DayEvent) => void;
  onSelectWorkoutType?: (type: ManualWorkoutType) => void;
};

export type TodayTimelineRef = {
  scrollToTop: (animated?: boolean) => void;
};

export const TodayTimeline = forwardRef<TodayTimelineRef, Props>(
  ({ theme, themeMode, language, day, copy, calendarMode, onEventPress, onEventAction, onSelectWorkoutType }, ref) => {
    const scrollRef = useRef<ScrollView>(null);
    const { height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const minDayHeight = useMemo(() => {
      const headerOffset = 56 + 44 + 24 + 12; // listPaddingTop
      const tabBarHeight = 64;
      return windowHeight - insets.top - headerOffset - insets.bottom - tabBarHeight;
    }, [windowHeight, insets]);

    const listPaddingTop = useMemo(() => {
        return 56 + 44 + 24 + 12;
    }, []);

    useImperativeHandle(ref, () => ({
      scrollToTop: (animated = true) => {
        scrollRef.current?.scrollTo({ y: 0, animated });
      },
    }));

    // Reset scroll when day changes
    useEffect(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }, [day?.date]);

    if (!day) return null;

    const dateObj = new Date(day.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const isToday = dateObj.getTime() === today.getTime();
    const isTomorrow = dateObj.getTime() === tomorrow.getTime();
    const isFutureDay = dateObj.getTime() > today.getTime();

    return (
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + listPaddingTop, paddingBottom: insets.bottom + 40 }
        ]}
      >
        <View style={[styles.dayContainer, day.events.length === 0 && { minHeight: minDayHeight }, day.events.length === 0 && styles.emptyDayContainer]}>
            {day.events.length > 0 ? (
                day.events.map((event) => {
                if (event.type === "workout") {
                    return (
                    <WorkoutCard
                        key={event.id}
                        theme={theme}
                        themeMode={themeMode}
                        event={event}
                        copy={copy}
                        onPress={onEventPress}
                        onAction={onEventAction}
                    />
                    );
                }
                if (event.type === "recovery") {
                    return <RecoveryCard key={event.id} theme={theme} copy={copy} />;
                }
                return null;
                })
            ) : isFutureDay && onSelectWorkoutType ? (
                <View style={[styles.futureEmptyContainer, { minHeight: minDayHeight }]}>
                  <View style={styles.emptyCardWrapper}>
                    <EmptyDayCard theme={theme} copy={copy} />
                  </View>
                  <AddWorkoutSection
                    copy={copy}
                    onSelectType={onSelectWorkoutType}
                    theme={theme}
                    themeMode={themeMode}
                  />
                </View>
            ) : (
                <EmptyDayCard theme={theme} copy={copy} />
            )}
        </View>
      </ScrollView>
    );
  }
);

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 0,
  },
  dayContainer: {
    width: "100%",
  },
  emptyDayContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  futureEmptyContainer: {
    width: "100%",
    justifyContent: "space-between",
    alignItems: "stretch",
  },
  emptyCardWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
