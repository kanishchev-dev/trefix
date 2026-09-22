import React, { useState, useMemo, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  Platform,
  UIManager,
  Dimensions,
  LayoutAnimation,
} from "react-native";
import { ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";
import {
  getShortDayName,
  type AppLanguage,
} from "../../../../locales";
import { type CalendarMode } from "../../today-types";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 32;
const SWIPE_THRESHOLD = PAGE_WIDTH * 0.4;
const WEEK_CONTENT_HEIGHT = 44;
const MONTH_CONTENT_HEIGHT = 224;

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  language: AppLanguage;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  calendarMode: CalendarMode;
  setCalendarMode: (mode: CalendarMode) => void;
  eventDates: string[]; // YYYY-MM-DD
};

export function TodayCalendarHeader({
  theme,
  themeMode,
  language,
  selectedDate,
  onSelectDate,
  calendarMode,
  setCalendarMode,
  eventDates,
}: Props) {
  const insets = useSafeAreaInsets();
  const [viewDate, setViewDate] = useState(new Date(selectedDate));

  useEffect(() => {
    setViewDate(new Date(selectedDate));
  }, [selectedDate]);

  const isMonth = calendarMode === "month";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const changeMonth = (delta: number) => {
    const next = new Date(viewDate);
    next.setMonth(next.getMonth() + delta);
    setViewDate(next);
  };

  const changeWeek = (delta: number) => {
    const next = new Date(viewDate);
    next.setDate(next.getDate() + delta * 7);
    setViewDate(next);
  };

  const toggleMode = () => {
    runOnJS(setCalendarMode)(isMonth ? "week" : "month");
  };

  // --- Advanced Gestures & Animations ---
  const translateX = useSharedValue(0);
  const shutterProgress = useSharedValue(isMonth ? 1 : 0);
  const gestureAxis = useSharedValue(0); // 0: none, 1: horizontal, 2: vertical

  useEffect(() => {
    shutterProgress.value = withSpring(isMonth ? 1 : 0, { damping: 20, stiffness: 100 });
  }, [isMonth]);

  const carouselAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const shutterAnimatedStyle = useAnimatedStyle(() => {
    const height = interpolate(
      shutterProgress.value,
      [0, 1],
      [WEEK_CONTENT_HEIGHT, MONTH_CONTENT_HEIGHT],
      Extrapolation.CLAMP
    );
    return { height };
  });

  const weekViewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shutterProgress.value, [0, 0.4], [1, 0], Extrapolation.CLAMP),
    pointerEvents: shutterProgress.value > 0.4 ? "none" : "auto",
  }));

  const monthViewAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shutterProgress.value, [0.4, 1], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(shutterProgress.value, [0, 1], [0.95, 1], Extrapolation.CLAMP) }
    ],
    pointerEvents: shutterProgress.value < 0.6 ? "none" : "auto",
  }));

  const handleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{
      scaleX: interpolate(shutterProgress.value, [0, 1], [1, 0.75], Extrapolation.CLAMP)
    }]
  }));

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const { translationX, translationY } = event;

      // Lock gesture axis on first significant movement
      if (gestureAxis.value === 0) {
        if (Math.abs(translationX) > Math.abs(translationY) && Math.abs(translationX) > 10) {
          gestureAxis.value = 1; // Horizontal Carousel
        } else if (Math.abs(translationY) > Math.abs(translationX) && Math.abs(translationY) > 10) {
          gestureAxis.value = 2; // Vertical Shutter
        }
      }

      if (gestureAxis.value === 1) {
        // Only allow horizontal carousel if fully expanded or fully collapsed
        if (shutterProgress.value === 0 || shutterProgress.value === 1) {
          translateX.value = translationX;
        }
      } else if (gestureAxis.value === 2) {
        // Shutter logic
        const delta = translationY / (MONTH_CONTENT_HEIGHT - WEEK_CONTENT_HEIGHT);
        const startValue = isMonth ? 1 : 0;
        shutterProgress.value = Math.max(0, Math.min(1, startValue + delta));
      }
    })
    .onEnd((event) => {
      const { translationX, translationY, velocityX, velocityY } = event;
      const currentAxis = gestureAxis.value;
      gestureAxis.value = 0; // Reset for next gesture

      if (currentAxis === 2 || (currentAxis === 0 && Math.abs(translationY) > 20)) {
        const shouldExpand = shutterProgress.value > 0.5 || velocityY > 500;
        const shouldCollapse = shutterProgress.value <= 0.5 || velocityY < -500;

        if (shouldExpand && !isMonth) {
          runOnJS(setCalendarMode)("month");
        } else if (shouldCollapse && isMonth) {
          runOnJS(setCalendarMode)("week");
        } else {
          shutterProgress.value = withSpring(isMonth ? 1 : 0, { damping: 20 });
        }
        translateX.value = withSpring(0);
      } else if (currentAxis === 1) {
        const snapThreshold = SWIPE_THRESHOLD;
        const fastSwipeThreshold = 500;
        const shouldSwipeNext = translationX < -snapThreshold || velocityX < -fastSwipeThreshold;
        const shouldSwipePrev = translationX > snapThreshold || velocityX > fastSwipeThreshold;

        if (shouldSwipeNext) {
          translateX.value = withTiming(-PAGE_WIDTH, { duration: 200 }, () => {
            runOnJS(isMonth ? changeMonth : changeWeek)(1);
            translateX.value = 0;
          });
        } else if (shouldSwipePrev) {
          translateX.value = withTiming(PAGE_WIDTH, { duration: 200 }, () => {
            runOnJS(isMonth ? changeMonth : changeWeek)(-1);
            translateX.value = 0;
          });
        } else {
          translateX.value = withSpring(0, { damping: 20, stiffness: 150 });
        }
      } else {
        translateX.value = withSpring(0);
        shutterProgress.value = withSpring(isMonth ? 1 : 0);
      }
    });

  // --- Data Helpers ---

  const getMonthData = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDay = firstDay.getDay();
    if (startDay === 0) startDay = 7;
    const padding = startDay - 1;

    const days = [];
    for (let i = 0; i < padding; i++) {
      days.push({ date: new Date(year, month, 1 - (padding - i)), isCurrentMonth: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    return days;
  };

  const getWeekData = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));

    const days = [];
    for (let i = 0; i < 7; i++) {
      const next = new Date(monday);
      next.setDate(monday.getDate() + i);
      days.push(next);
    }
    return days;
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  const isToday = (date: Date) => {
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const hasEvents = (date: Date) => {
    const iso = date.toISOString().split("T")[0];
    return eventDates.includes(iso);
  };

  const renderDay = (date: Date, isCurrentMonth: boolean = true) => {
    const selected = isSelected(date);
    const todayFlag = isToday(date);
    const hasEv = hasEvents(date);

    return (
      <Pressable
        key={date.toISOString()}
        onPress={() => onSelectDate(date)}
        style={[
          styles.dayItem,
          selected && { backgroundColor: theme.color.primary, borderRadius: 12 },
        ]}
      >
        <Text
          style={[
            styles.dayText,
            {
              color: isCurrentMonth ? theme.color.foreground : theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
            selected && { color: theme.color.primaryForeground, fontFamily: theme.typography.fontFamily.sans.bold },
            todayFlag && !selected && { color: theme.color.primary, fontFamily: theme.typography.fontFamily.sans.bold },
          ]}
        >
          {date.getDate()}
        </Text>
        <View style={styles.markerContainer}>
          {hasEv && (
            <View
              style={[
                styles.marker,
                { backgroundColor: selected ? theme.color.primaryForeground : theme.color.primary },
              ]}
            />
          )}
        </View>
      </Pressable>
    );
  };

  const renderCalendarPage = (date: Date) => {
    const monthData = getMonthData(date);
    const weekData = getWeekData(date);

    return (
      <View style={styles.page}>
        {/* Layer 1: Week View */}
        <Animated.View style={[styles.weekLayer, weekViewAnimatedStyle]}>
          <View style={styles.row}>
            {weekData.map((d: any) => renderDay(d.date ?? d))}
          </View>
        </Animated.View>

        {/* Layer 2: Month View */}
        <Animated.View style={[styles.monthLayer, monthViewAnimatedStyle]}>
          <View style={styles.grid}>
            {monthData.map((d: any) => renderDay(d.date, d.isCurrentMonth))}
          </View>
        </Animated.View>
      </View>
    );
  };

  const prevDate = useMemo(() => {
    const d = new Date(viewDate);
    if (isMonth) d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    return d;
  }, [viewDate, isMonth]);

  const nextDate = useMemo(() => {
    const d = new Date(viewDate);
    if (isMonth) d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    return d;
  }, [viewDate, isMonth]);

  return (
    <View style={styles.root}>
      <GestureDetector gesture={panGesture}>
        <View style={styles.inner}>
          {/* Days of Week Row */}
          <View style={styles.daysOfWeekContainer}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <View key={d} style={styles.dayOfWeekItem}>
                <Text style={[styles.dayOfWeekText, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
                  {getShortDayName(d, language)}
                </Text>
              </View>
            ))}
          </View>

          {/* Carousel with interactive cross-fade layers */}
          <Animated.View style={[styles.content, shutterAnimatedStyle]}>
            <Animated.View style={[styles.carousel, carouselAnimatedStyle]}>
              <View style={[styles.pageWrapper, { position: "absolute", left: -PAGE_WIDTH }]}>
                {renderCalendarPage(prevDate)}
              </View>
              <View style={styles.pageWrapper}>
                {renderCalendarPage(viewDate)}
              </View>
              <View style={[styles.pageWrapper, { position: "absolute", left: PAGE_WIDTH }]}>
                {renderCalendarPage(nextDate)}
              </View>
            </Animated.View>
          </Animated.View>

          {/* Bottom handle indicator */}
          <Animated.View style={[styles.footer, handleAnimatedStyle]}>
            <View style={[styles.handle, { backgroundColor: theme.color.border }]} />
          </Animated.View>
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 100,
  },
  inner: {
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  daysOfWeekContainer: {
    flexDirection: "row",
    marginTop: 8,
    marginBottom: 4,
  },
  dayOfWeekItem: {
    width: "14.28%",
    alignItems: "center",
  },
  dayOfWeekText: {
    fontSize: 12,
    textTransform: "uppercase",
  },
  content: {
    overflow: "hidden",
  },
  carousel: {
    width: "100%",
    flexDirection: "row",
  },
  pageWrapper: {
    width: PAGE_WIDTH,
  },
  page: {
    width: "100%",
  },
  weekLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1,
  },
  monthLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  row: {
    width: "100%",
    flexDirection: "row",
    paddingVertical: 4,
  },
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 4,
  },
  dayItem: {
    width: "14.28%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  dayText: {
    fontSize: 16,
  },
  markerContainer: {
    height: 6,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  marker: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  footer: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
    height: 24,
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
});
