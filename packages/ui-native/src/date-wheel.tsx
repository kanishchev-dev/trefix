import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;
const SIDE_PADDING = ((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT;
const SNAP_SPRING = { damping: 26, stiffness: 160, mass: 1 } as const;
/** How far a fling carries: projected distance = velocity × momentum (s). */
const MOMENTUM = 0.12;

type ColumnAlign = "left" | "center" | "right";

const ALIGN_TO_FLEX = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
} as const;

function ColumnItem({
  label,
  row,
  offset,
  align,
  color,
  fontFamily,
}: {
  label: string;
  row: number;
  offset: SharedValue<number>;
  align: ColumnAlign;
  color: string;
  fontFamily: string;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const distance = Math.abs(offset.value - row * ITEM_HEIGHT) / ITEM_HEIGHT;
    return {
      opacity: Math.max(0.12, 1 - distance * 0.38),
      transform: [{ scale: Math.max(0.82, 1 - distance * 0.07) }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.item,
        { top: row * ITEM_HEIGHT, alignItems: ALIGN_TO_FLEX[align], transformOrigin: align },
        animatedStyle,
      ]}
    >
      <Text style={[styles.itemText, { color, fontFamily }]}>{label}</Text>
    </Animated.View>
  );
}

/** Rows rendered on each side of the centre; covers the visible rows plus a fling. */
const RENDER_BUFFER = 24;

/**
 * One vertical wheel over an integer axis [minIndex, maxIndex]. Rows are
 * virtualized around the centre, so the axis can be huge (every day for
 * centuries). Drag, fling with momentum, snap, haptic per step, tap a row
 * to scroll to it. No background — the parent draws guides.
 */
function WheelColumn({
  minIndex,
  maxIndex,
  index,
  getLabel,
  onIndexChange,
  align,
  flex,
  disabled,
  color,
  fontFamily,
  revision,
}: {
  minIndex: number;
  maxIndex: number;
  index: number;
  getLabel: (index: number) => string;
  onIndexChange: (index: number) => void;
  align: ColumnAlign;
  flex: number;
  disabled: boolean;
  color: string;
  fontFamily: string;
  /** Bumped by the parent when it rejects a pick, forcing a resync. */
  revision: number;
}) {
  const lastRow = maxIndex - minIndex;
  const offset = useSharedValue((index - minIndex) * ITEM_HEIGHT);
  const isInteracting = useSharedValue(false);
  const lastIndex = useSharedValue(index);
  /** Index this column itself last asked for; lets an in-flight fling keep its velocity. */
  const requestedIndex = useRef(index);
  const [centerIndex, setCenterIndex] = useState(index);

  // Follow the controlled index. Skip only when it is the echo of our own
  // fling; parent corrections (carry, day clamp, min date) must always win.
  useEffect(() => {
    if (isInteracting.value && index === requestedIndex.current) return;
    requestedIndex.current = index;
    lastIndex.value = index;
    setCenterIndex(index);
    offset.value = withSpring((index - minIndex) * ITEM_HEIGHT, SNAP_SPRING);
  }, [index, minIndex, revision, offset, isInteracting, lastIndex]);

  const handleCross = useCallback((next: number) => {
    setCenterIndex(next);
    try {
      Haptics.selectionAsync();
    } catch {}
  }, []);

  const commit = useCallback(
    (row: number) => {
      const next = minIndex + row;
      requestedIndex.current = next;
      if (next !== index) onIndexChange(next);
    },
    [index, minIndex, onIndexChange],
  );

  useAnimatedReaction(
    () => minIndex + Math.max(0, Math.min(lastRow, Math.round(offset.value / ITEM_HEIGHT))),
    (current, previous) => {
      if (previous === null || current === previous || current === lastIndex.value) return;
      lastIndex.value = current;
      runOnJS(handleCross)(current);
    },
    [minIndex, lastRow, handleCross],
  );

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .activeOffsetY([-6, 6])
    .onBegin(() => {
      "worklet";
      isInteracting.value = true;
      cancelAnimation(offset);
    })
    .onChange((event) => {
      "worklet";
      const maxOffset = lastRow * ITEM_HEIGHT;
      const next = offset.value - event.changeY;
      // Rubber-band past the ends.
      offset.value = next < 0 || next > maxOffset ? offset.value - event.changeY * 0.3 : next;
    })
    .onEnd((event) => {
      "worklet";
      const projected = offset.value - event.velocityY * MOMENTUM;
      const row = Math.max(0, Math.min(lastRow, Math.round(projected / ITEM_HEIGHT)));
      offset.value = withSpring(
        row * ITEM_HEIGHT,
        { ...SNAP_SPRING, velocity: -event.velocityY },
        (finished) => {
          if (finished) isInteracting.value = false;
        },
      );
      runOnJS(commit)(row);
    })
    .onFinalize((_event, success) => {
      "worklet";
      if (success) return;
      isInteracting.value = false;
      // A touch that stopped a fling mid-way: settle on the nearest row.
      const row = Math.max(0, Math.min(lastRow, Math.round(offset.value / ITEM_HEIGHT)));
      if (Math.abs(offset.value - row * ITEM_HEIGHT) > 0.5) {
        offset.value = withSpring(row * ITEM_HEIGHT, SNAP_SPRING);
        runOnJS(commit)(row);
      }
    });

  const tap = Gesture.Tap()
    .enabled(!disabled)
    .onEnd((event) => {
      "worklet";
      const row = Math.max(
        0,
        Math.min(
          lastRow,
          Math.round((offset.value + event.y - SIDE_PADDING - ITEM_HEIGHT / 2) / ITEM_HEIGHT),
        ),
      );
      offset.value = withSpring(row * ITEM_HEIGHT, SNAP_SPRING);
      runOnJS(commit)(row);
    });

  const listStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: SIDE_PADDING - offset.value }],
  }));

  const rows: number[] = [];
  const from = Math.max(minIndex, centerIndex - RENDER_BUFFER);
  const to = Math.min(maxIndex, centerIndex + RENDER_BUFFER);
  for (let i = from; i <= to; i += 1) rows.push(i);

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <View style={[styles.column, { flex }]}>
        <Animated.View style={[styles.list, listStyle]}>
          {rows.map((rowIndex) => (
            <ColumnItem
              key={rowIndex}
              label={getLabel(rowIndex)}
              row={rowIndex - minIndex}
              offset={offset}
              align={align}
              color={color}
              fontFamily={fontFamily}
            />
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

type DateParts = { year: number; month: number; day: number };

function parseIsoDate(value: string | undefined): DateParts | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) - 1, day: Number(match[3]) };
}

function toIsoDate({ year, month, day }: DateParts) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function compareParts(a: DateParts, b: DateParts) {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

function todayParts(): DateParts {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

/** How far the axes reach past the lower bound. Wide enough to feel unbounded. */
const SPAN_YEARS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Day number on a UTC axis: DST-safe, consecutive for consecutive dates. */
function toDayNumber({ year, month, day }: DateParts) {
  return Math.round(Date.UTC(year, month, day) / DAY_MS);
}

function fromDayNumber(dayNumber: number): DateParts {
  const date = new Date(dayNumber * DAY_MS);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth(), day: date.getUTCDate() };
}

function toMonthNumber({ year, month }: DateParts) {
  return year * 12 + month;
}

export type DateWheelProps = {
  /** Selected date as "YYYY-MM-DD". */
  value: string;
  onChange: (isoDate: string) => void;
  /** Earliest selectable date ("YYYY-MM-DD"); earlier picks snap back to it. */
  minDate?: string;
  /** 12 localized month names, in the form that reads after a day number ("14 сентября"). */
  monthNames: string[];
  /** Hairlines above and below the centre row. */
  showGuides?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  theme?: ThemeTokens;
  themeMode?: ThemeMode;
};

/**
 * Day | Month | Year wheels in the Ruler style: no background or selection
 * card, centre row at full strength, neighbours fade and shrink.
 *
 * The day and month wheels run over continuous axes, so scrolling past the
 * 31st carries into the next month and past December into the next year.
 * No year cap beyond minDate.
 */
export function DateWheel({
  value,
  onChange,
  minDate,
  monthNames,
  showGuides = true,
  disabled = false,
  accessibilityLabel,
  theme,
  themeMode,
}: DateWheelProps) {
  const isDark =
    themeMode === "dark" ||
    theme?.color.background === "#09090b" ||
    theme?.color.surface === "#111111";
  const color = theme?.color.foreground || (isDark ? "#f8fafc" : "#09090b");
  const guideColor = theme?.color.border || (isDark ? "#3f3f46" : "#d4d4d8");
  const fontFamily = theme?.typography.fontFamily.sans.medium || "System";

  const min = useMemo(() => parseIsoDate(minDate), [minDate]);
  const selected = useMemo(() => parseIsoDate(value) ?? min ?? todayParts(), [value, min]);

  // Without minDate the axes start far in the past; fixed once so they never shift.
  const [fallbackLower] = useState<DateParts>(() => ({
    year: selected.year - SPAN_YEARS / 2,
    month: 0,
    day: 1,
  }));
  const lower = min ?? fallbackLower;

  const dayAxis = useMemo(() => {
    const minIndex = toDayNumber(lower);
    return { minIndex, maxIndex: toDayNumber({ ...lower, year: lower.year + SPAN_YEARS }) };
  }, [lower]);
  const monthAxis = useMemo(() => {
    const minIndex = toMonthNumber(lower);
    return { minIndex, maxIndex: minIndex + SPAN_YEARS * 12 };
  }, [lower]);

  const [revision, setRevision] = useState(0);

  const emit = useCallback(
    (next: DateParts) => {
      const clamped = { ...next, day: Math.min(next.day, daysInMonth(next.year, next.month)) };
      const result = min && compareParts(clamped, min) < 0 ? min : clamped;
      if (compareParts(result, selected) !== 0) {
        onChange(toIsoDate(result));
      } else {
        // Pick rejected (e.g. before minDate while already at it): spin columns back.
        setRevision((current) => current + 1);
      }
    },
    [min, onChange, selected],
  );

  const dayLabel = useCallback((index: number) => String(fromDayNumber(index).day), []);
  const monthLabel = useCallback((index: number) => monthNames[index % 12] ?? "", [monthNames]);
  const yearLabel = useCallback((index: number) => String(index), []);

  return (
    <View accessibilityLabel={accessibilityLabel} style={[styles.container, disabled && styles.disabled]}>
      <WheelColumn
        minIndex={dayAxis.minIndex}
        maxIndex={dayAxis.maxIndex}
        index={toDayNumber(selected)}
        getLabel={dayLabel}
        onIndexChange={(index) => emit(fromDayNumber(index))}
        align="right"
        flex={1}
        disabled={disabled}
        color={color}
        fontFamily={fontFamily}
        revision={revision}
      />
      <WheelColumn
        minIndex={monthAxis.minIndex}
        maxIndex={monthAxis.maxIndex}
        index={toMonthNumber(selected)}
        getLabel={monthLabel}
        onIndexChange={(index) =>
          emit({ year: Math.floor(index / 12), month: index % 12, day: selected.day })
        }
        align="center"
        flex={1.7}
        disabled={disabled}
        color={color}
        fontFamily={fontFamily}
        revision={revision}
      />
      <WheelColumn
        minIndex={lower.year}
        maxIndex={lower.year + SPAN_YEARS}
        index={selected.year}
        getLabel={yearLabel}
        onIndexChange={(index) => emit({ ...selected, year: index })}
        align="left"
        flex={1.1}
        disabled={disabled}
        color={color}
        fontFamily={fontFamily}
        revision={revision}
      />

      {showGuides ? (
        <View pointerEvents="none" style={[styles.guides, { borderColor: guideColor }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 4,
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
  },
  disabled: {
    opacity: 0.5,
  },
  column: {
    height: ITEM_HEIGHT * VISIBLE_ITEMS,
    overflow: "hidden",
  },
  list: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  item: {
    position: "absolute",
    left: 0,
    right: 0,
    height: ITEM_HEIGHT,
    justifyContent: "center",
  },
  itemText: {
    fontSize: 22,
    lineHeight: 28,
  },
  guides: {
    position: "absolute",
    left: 0,
    right: 0,
    top: SIDE_PADDING,
    height: ITEM_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
