import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { getShortDayName, type AppLanguage } from "../../../../locales";
import { toIsoDate } from "../../../plans/lib/plan-dates";
import { type CalendarMode } from "../../today-types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PAGE_WIDTH = SCREEN_WIDTH - 32;

/** One day cell: 32 px circle, 2 px gap, 6 px event marker. */
const DAY_HEIGHT = 40;
const ROW_PADDING = 4;
const WEEK_HEIGHT = ROW_PADDING + DAY_HEIGHT;
const MONTH_HEIGHT = ROW_PADDING + 6 * DAY_HEIGHT;
const SHUTTER_RANGE = MONTH_HEIGHT - WEEK_HEIGHT;

/** Shutter spring: quick and without bounce, but it carries the flick's velocity. */
const SHUTTER_SPRING = { damping: 26, stiffness: 300, mass: 0.8 };
const PAGE_SPRING = {
  damping: 30,
  stiffness: 280,
  mass: 0.8,
  overshootClamping: true,
};
const RETURN_SPRING = { damping: 22, stiffness: 240 };
/** A flick faster than this decides the direction regardless of how far it went. */
const FLICK_VELOCITY = 450;
const AXIS_LOCK_DISTANCE = 8;

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  language: AppLanguage;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  calendarMode: CalendarMode;
  setCalendarMode: (mode: CalendarMode) => void;
  eventDates: string[]; // YYYY-MM-DD, device calendar dates
};

type Shift = (delta: number) => void;

export function TodayCalendarHeader({
  theme,
  language,
  selectedDate,
  onSelectDate,
  calendarMode,
  setCalendarMode,
  eventDates,
}: Props) {
  const [viewDate, setViewDate] = useState(() => new Date(selectedDate));
  const isMonth = calendarMode === "month";

  useEffect(() => {
    setViewDate(new Date(selectedDate));
  }, [selectedDate]);

  const eventSet = useMemo(() => new Set(eventDates), [eventDates]);
  const todayIso = toIsoDate(new Date());
  const selectedIso = toIsoDate(selectedDate);

  // ------------------------------------------------------------------ animation state

  /** 0 = week, 1 = month; follows the finger while the shutter is dragged. */
  const progress = useSharedValue(isMonth ? 1 : 0);
  /** Where the shutter is heading after a gesture, so the mode effect does not restart it. */
  const settlingTo = useSharedValue(isMonth ? 1 : 0);
  const startProgress = useSharedValue(0);
  const translateX = useSharedValue(0);
  const axis = useSharedValue(0); // 0 undecided, 1 horizontal, 2 vertical
  const modeValue = useSharedValue(isMonth ? 1 : 0);

  useEffect(() => {
    const target = isMonth ? 1 : 0;
    modeValue.value = target;
    if (settlingTo.value === target) return;
    settlingTo.value = target;
    progress.value = withSpring(target, SHUTTER_SPRING);
  }, [isMonth, modeValue, progress, settlingTo]);

  // A page turn finishes on the UI thread; the carousel snaps back only once the new
  // page is committed, so the old content never flashes in between.
  const pendingReset = useRef(false);
  const shiftPage = useCallback<Shift>(
    (delta) => {
      pendingReset.current = true;
      setViewDate((current) => {
        const next = new Date(current);
        if (modeValue.value === 1) next.setMonth(next.getMonth() + delta, 1);
        else next.setDate(next.getDate() + delta * 7);
        return next;
      });
      void Haptics.selectionAsync();
    },
    [modeValue],
  );
  useLayoutEffect(() => {
    if (!pendingReset.current) return;
    pendingReset.current = false;
    translateX.value = 0;
  }, [viewDate, translateX]);

  const commitMode = useCallback(
    (target: number) => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCalendarMode(target === 1 ? "month" : "week");
    },
    [setCalendarMode],
  );

  const toggle = useCallback(() => {
    const target = isMonth ? 0 : 1;
    settlingTo.value = target;
    progress.value = withSpring(target, SHUTTER_SPRING);
    commitMode(target);
  }, [isMonth, settlingTo, progress, commitMode]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          axis.value = 0;
          startProgress.value = progress.value;
          cancelAnimation(progress);
        })
        .onUpdate((event) => {
          const { translationX, translationY } = event;
          if (axis.value === 0) {
            const ax = Math.abs(translationX);
            const ay = Math.abs(translationY);
            // Pages turn only while the shutter rests fully open or closed.
            const settled =
              startProgress.value < 0.01 || startProgress.value > 0.99;
            if (ax > AXIS_LOCK_DISTANCE && ax > ay && settled) axis.value = 1;
            else if (ay > AXIS_LOCK_DISTANCE && ay >= ax) axis.value = 2;
          }
          if (axis.value === 1) {
            translateX.value = translationX;
          } else if (axis.value === 2) {
            progress.value = Math.min(
              1,
              Math.max(0, startProgress.value + translationY / SHUTTER_RANGE),
            );
          }
        })
        .onEnd((event) => {
          if (axis.value === 2) {
            const velocity = event.velocityY / SHUTTER_RANGE;
            let target: number;
            if (Math.abs(event.velocityY) > FLICK_VELOCITY)
              target = event.velocityY > 0 ? 1 : 0;
            else target = progress.value + velocity * 0.15 > 0.5 ? 1 : 0;
            settlingTo.value = target;
            progress.value = withSpring(target, {
              ...SHUTTER_SPRING,
              velocity,
            });
            if (target !== modeValue.value) runOnJS(commitMode)(target);
          } else if (axis.value === 1) {
            const { translationX, velocityX } = event;
            const flick = Math.abs(velocityX) > FLICK_VELOCITY;
            const direction = flick
              ? velocityX < 0
                ? 1
                : -1
              : translationX < -PAGE_WIDTH * 0.35
                ? 1
                : translationX > PAGE_WIDTH * 0.35
                  ? -1
                  : 0;
            if (direction === 0) {
              translateX.value = withSpring(0, {
                ...RETURN_SPRING,
                velocity: velocityX,
              });
            } else {
              translateX.value = withSpring(
                -direction * PAGE_WIDTH,
                { ...PAGE_SPRING, velocity: velocityX },
                (finished) => {
                  if (finished) runOnJS(shiftPage)(direction);
                },
              );
            }
          }
        })
        .onFinalize(() => {
          // A touch that never picked an axis leaves the shutter where it rests.
          if (axis.value === 0 && progress.value !== settlingTo.value) {
            progress.value = withSpring(settlingTo.value, SHUTTER_SPRING);
          }
          axis.value = 0;
        }),
    [
      axis,
      startProgress,
      progress,
      translateX,
      settlingTo,
      modeValue,
      commitMode,
      shiftPage,
    ],
  );

  // ------------------------------------------------------------------ styles

  const shutterStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [WEEK_HEIGHT, MONTH_HEIGHT],
      Extrapolation.CLAMP,
    ),
  }));
  const carouselStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const handleStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scaleX: interpolate(
          progress.value,
          [0, 1],
          [1, 0.75],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const prevDate = useMemo(() => {
    const d = new Date(viewDate);
    if (isMonth) d.setMonth(d.getMonth() - 1, 1);
    else d.setDate(d.getDate() - 7);
    return d;
  }, [viewDate, isMonth]);

  const nextDate = useMemo(() => {
    const d = new Date(viewDate);
    if (isMonth) d.setMonth(d.getMonth() + 1, 1);
    else d.setDate(d.getDate() + 7);
    return d;
  }, [viewDate, isMonth]);

  const pageProps = {
    theme,
    progress,
    eventSet,
    todayIso,
    selectedIso,
    onSelectDate,
  };

  return (
    <View style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View style={styles.inner}>
          <View style={styles.daysOfWeekContainer}>
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <View key={d} style={styles.dayOfWeekItem}>
                <Text
                  style={[
                    styles.dayOfWeekText,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {getShortDayName(d, language)}
                </Text>
              </View>
            ))}
          </View>

          <Animated.View style={[styles.content, shutterStyle]}>
            <Animated.View style={[styles.carousel, carouselStyle]}>
              <View style={[styles.pageWrapper, styles.pagePrev]}>
                <CalendarPage date={prevDate} {...pageProps} />
              </View>
              <View style={styles.pageWrapper}>
                <CalendarPage date={viewDate} {...pageProps} />
              </View>
              <View style={[styles.pageWrapper, styles.pageNext]}>
                <CalendarPage date={nextDate} {...pageProps} />
              </View>
            </Animated.View>
          </Animated.View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isMonth ? "Collapse calendar" : "Expand calendar"
            }
            hitSlop={{ top: 6, bottom: 6, left: 40, right: 40 }}
            onPress={toggle}
          >
            <Animated.View style={[styles.footer, handleStyle]}>
              <View
                style={[styles.handle, { backgroundColor: theme.color.border }]}
              />
            </Animated.View>
          </Pressable>
        </View>
      </GestureDetector>
    </View>
  );
}

// ---------------------------------------------------------------------- page

type PageProps = {
  date: Date;
  theme: ThemeTokens;
  progress: SharedValue<number>;
  eventSet: Set<string>;
  todayIso: string;
  selectedIso: string;
  onSelectDate: (date: Date) => void;
};

type GridDay = { date: Date; iso: string; inMonth: boolean };

function monthGrid(date: Date): GridDay[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const padding = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(year, month, 1 - padding + index);
    return {
      date: day,
      iso: toIsoDate(day),
      inMonth: day.getMonth() === month,
    };
  });
}

/**
 * Week and month of one carousel page. The month grid slides so that the week of
 * `date` sits exactly where the week row is: while the shutter moves, that row stays
 * put and the rest of the month unfolds around it.
 */
function CalendarPage({
  date,
  theme,
  progress,
  eventSet,
  todayIso,
  selectedIso,
  onSelectDate,
}: PageProps) {
  const grid = useMemo(() => monthGrid(date), [date]);
  const rowIndex = Math.floor(
    grid.findIndex((day) => day.iso === toIsoDate(date)) / 7,
  );
  const week = grid.slice(rowIndex * 7, rowIndex * 7 + 7);

  const weekStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.12],
      [1, 0],
      Extrapolation.CLAMP,
    ),
    pointerEvents: progress.value > 0.5 ? "none" : "auto",
  }));
  const monthStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.12],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 1],
          [-rowIndex * DAY_HEIGHT, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
    pointerEvents: progress.value > 0.5 ? "auto" : "none",
  }));

  const cell = (day: GridDay, muted: boolean) => {
    const selected = day.iso === selectedIso;
    const isToday = day.iso === todayIso;
    return (
      <Pressable
        key={day.iso}
        onPress={() => onSelectDate(day.date)}
        style={styles.dayItem}
      >
        <View
          style={[
            styles.circle,
            selected && { backgroundColor: theme.color.primary },
          ]}
        >
          <Text
            style={[
              styles.dayText,
              {
                color: muted
                  ? theme.color.mutedForeground
                  : theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
              isToday &&
                !selected && {
                  color: theme.color.primary,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              selected && {
                color: theme.color.primaryForeground,
                fontFamily: theme.typography.fontFamily.sans.bold,
              },
            ]}
          >
            {day.date.getDate()}
          </Text>
        </View>
        <View style={styles.markerContainer}>
          {eventSet.has(day.iso) ? (
            <View
              style={[styles.marker, { backgroundColor: theme.color.primary }]}
            />
          ) : null}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.page}>
      <Animated.View style={[styles.layer, monthStyle]}>
        <View style={styles.grid}>
          {grid.map((day) => cell(day, !day.inMonth))}
        </View>
      </Animated.View>
      <Animated.View style={[styles.layer, weekStyle]}>
        <View style={styles.grid}>
          {week.map((day) => cell(day, !day.inMonth))}
        </View>
      </Animated.View>
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
  pagePrev: {
    position: "absolute",
    left: -PAGE_WIDTH,
  },
  pageNext: {
    position: "absolute",
    left: PAGE_WIDTH,
  },
  page: {
    width: "100%",
    height: MONTH_HEIGHT,
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingTop: ROW_PADDING,
  },
  grid: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayItem: {
    width: "14.28%",
    height: DAY_HEIGHT,
    alignItems: "center",
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: {
    fontSize: 15,
  },
  markerContainer: {
    height: 6,
    marginTop: 2,
    alignItems: "center",
    justifyContent: "center",
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
