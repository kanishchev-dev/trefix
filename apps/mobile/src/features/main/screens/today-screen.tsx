import { useState, useMemo, useCallback, useRef } from "react";
import { StyleSheet, Text, View, Pressable, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";

import {
  HeaderLogo,
  HeaderMenuButton,
  HeaderSearchButton,
} from "../components/header";
import { SectionLayout } from "../components/section-layout";
import { type MainCopy, getAppLanguage } from "../../../locales";
import { TodayCalendarHeader } from "../components/today/today-calendar-header";
import { TodayTimeline, type TodayTimelineRef } from "../components/today/today-timeline";
import { type Day, type CalendarMode } from "../today-types";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

const GENERATE_DAYS_COUNT = 60; // 30 past, 30 future

const generateMockData = (count: number): Day[] => {
  const days: Day[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = -count / 2; i < count / 2; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];

    const events = [];
    // Add workout every 2 days
    if (i % 2 === 0) {
      const status = i < 0 ? "completed" : i === 0 ? "planned" : "planned";
      events.push({
        id: `workout-${dateStr}`,
        type: "workout" as const,
        status: (i === -2 ? "missed" : i === 4 ? "modified" : status) as any,
        title: i % 4 === 0 ? "Long Run" : "Tempo",
        duration: "52 min",
        distance: "8.4 km",
        description: i === 4 ? "Modified due to high fatigue" : "3 × 8 min at 4:35–4:45 / km",
      });
    } else if (i % 5 === 0) {
      events.push({
        id: `recovery-${dateStr}`,
        type: "recovery" as const,
        status: "planned" as const,
        title: "Recovery",
      });
    }

    days.push({ date: dateStr, events });
  }
  return days;
};

export function TodayScreen({ theme, themeMode, copy }: Props) {
  const language = getAppLanguage();
  const insets = useSafeAreaInsets();
  const timelineRef = useRef<TodayTimelineRef>(null);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visibleDate, setVisibleDate] = useState(new Date().toISOString().split("T")[0]);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");

  const days = useMemo(() => generateMockData(GENERATE_DAYS_COUNT), []);
  const eventDates = useMemo(() => days.filter(d => d.events.length > 0).map(d => d.date), [days]);

  const selectedDay = useMemo(() => {
    const dateStr = selectedDate.toISOString().split("T")[0];
    return days.find(d => d.date === dateStr) || { date: dateStr, events: [] };
  }, [selectedDate, days]);

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setVisibleDate(date.toISOString().split("T")[0]);
  }, []);

  const handleBackToToday = () => {
    handleSelectDate(new Date());
  };

  const isShowingToday = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return visibleDate === todayStr;
  }, [visibleDate]);

  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  return (
    <SectionLayout
      theme={theme}
      themeMode={themeMode}
      leftAction={
        <HeaderMenuButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => undefined}
        />
      }
      headerCenter={<HeaderLogo source={logoSource} />}
      rightAction={
        <HeaderSearchButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => undefined}
        />
      }
      headerVariant="calendar"
      headerBottomContent={
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
      }
      scrollable={false}
      contentStyle={{
        paddingHorizontal: 0,
        alignItems: "stretch",
        justifyContent: "flex-start"
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
          onEventPress={(ev) => console.log("Press", ev.id)}
          onEventAction={(ev) => console.log("Action", ev.id)}
        />

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
