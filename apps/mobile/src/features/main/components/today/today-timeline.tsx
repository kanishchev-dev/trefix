import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useMemo,
  useEffect,
} from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type ThemeTokens, type ThemeMode } from "@trefix/tokens";
import { type Day, type DayEvent, type CalendarMode } from "../../today-types";
import { WorkoutCard, RecoveryCard, EmptyDayCard } from "./day-event-cards";
import { AddWorkoutSection } from "./add-workout-section";
import { type ManualWorkoutType } from "./workout-goal-sheet";
import { type AppLanguage, type MainCopy } from "../../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  language: AppLanguage;
  day: Day | null;
  copy: MainCopy;
  calendarMode: CalendarMode;
  onEventPress?: (event: DayEvent) => void;
  onSelectWorkoutType?: (type: ManualWorkoutType) => void;
};

export type TodayTimelineRef = {
  scrollToTop: (animated?: boolean) => void;
};

export const TodayTimeline = forwardRef<TodayTimelineRef, Props>(
  ({ theme, themeMode, day, copy, onEventPress, onSelectWorkoutType }, ref) => {
    const scrollRef = useRef<ScrollView>(null);
    const { height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const headerOffset = useMemo(() => {
      const baseHeader = 88; // Header content height
      const calendarHeight = 88; // Fixed week header height so month calendar sheet overlays content
      return insets.top + baseHeader + calendarHeight;
    }, [insets.top]);

    const minDayHeight = useMemo(() => {
      const tabBarHeight = 64;
      return windowHeight - headerOffset - insets.bottom - tabBarHeight;
    }, [windowHeight, insets.bottom, headerOffset]);

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

    return (
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        style={[styles.scrollView, { paddingTop: headerOffset + 16 }]}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 40 },
        ]}
      >
        <View style={[styles.dayContainer, { minHeight: minDayHeight }]}>
          <View style={styles.populatedInner}>
            <View>
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
                      />
                    );
                  }
                  if (event.type === "recovery") {
                    return (
                      <RecoveryCard
                        key={event.id}
                        theme={theme}
                        themeMode={themeMode}
                        copy={copy}
                      />
                    );
                  }
                  return null;
                })
              ) : (
                <EmptyDayCard theme={theme} copy={copy} />
              )}
            </View>

            {onSelectWorkoutType && (
              <View style={styles.additionalAddSection}>
                <AddWorkoutSection
                  copy={copy}
                  onSelectType={onSelectWorkoutType}
                  theme={theme}
                  themeMode={themeMode}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  },
);

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 0,
  },
  dayContainer: {
    width: "100%",
  },
  populatedInner: {
    flex: 1,
    justifyContent: "space-between",
  },
  additionalAddSection: {
    marginTop: 10,
    marginBottom: 0,
  },
});
