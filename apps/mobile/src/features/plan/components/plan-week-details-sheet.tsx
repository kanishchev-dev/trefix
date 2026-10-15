import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Plus, Sparkles } from "lucide-react-native";

import { type PlanAdaptation } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import { IntensityMeter } from "../../main/components/intensity-scale";
import { StatusBox } from "../../main/components/today/day-event-cards";
import { workoutIntensity } from "../../main/lib/workout-intensity";
import { shortDayNamesFor } from "../../plan-creation/components/workout-edit-form";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { addDaysIso, parseIsoDate, todayIso } from "../../plans/lib/plan-dates";
import {
  adaptationReason,
  adaptationTitle,
  workoutTypeLabel,
} from "../../plans/lib/plan-texts";
import {
  type PlanTimelineMode,
  type PlanWeekView,
  type WeekWorkoutRow,
} from "../../plans/lib/plan-weeks";
import { formatDateRange } from "../lib/date-range";
import { distanceNumber } from "../lib/distance-text";
import { styles } from "./plan-week-details-sheet.styles";
import { StatTiles, type StatTile } from "./stat-tiles";

const KEY_TYPES = new Set([
  "interval",
  "threshold",
  "tempo",
  "long_run",
  "race",
  "hill",
]);

type Props = {
  week: PlanWeekView | null;
  adaptations?: PlanAdaptation[];
  visible: boolean;
  /** Called after the sheet has slid away. */
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  /** `active` — plan in progress, `relative` — draft weeks, `history` — finished plan. */
  mode?: PlanTimelineMode;
  /** Workouts of the week; dated ones open the workout screen. */
  workouts?: WeekWorkoutRow[];
  /** Weeks in the plan, for "неделя 5 из 12". */
  totalWeeks?: number;
  /** First day of the week for dated plans: the sheet titles it by dates. */
  weekStart?: string | null;
  /** Runs after the sheet has closed, so the workout screen can open safely. */
  onSelectWorkout?: (workoutId: string) => void;
  /** Adds a workout to the current or a future week of the plan in progress; runs after close. */
  onAddWorkout?: () => void;
};

/** A plan week: totals, its aim and the workouts by day, like the Today cards. */
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
  totalWeeks,
  weekStart,
  onSelectWorkout,
  onAddWorkout,
}: Props) {
  const [open, setOpen] = useState(visible);
  const afterClose = useRef<(() => void) | null>(null);
  const language = copy.meta.language as AppLanguage;
  const format = useUnitFormat(copy, language);

  useEffect(() => {
    if (visible) {
      afterClose.current = null;
      setOpen(true);
    }
  }, [visible]);

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

  const t = copy.plan.screen.weekSheet;
  const phase = copy.plan.screen.phaseNames[week.phase];
  const dayNames = shortDayNamesFor(language);
  const today = todayIso();
  const medium = theme.typography.fontFamily.sans.medium;
  const regular = theme.typography.fontFamily.sans.regular;
  const muted = theme.color.mutedForeground;

  const rows = workouts ?? [];
  const dated = mode !== "relative";
  const plannedKm = rows.length
    ? rows.reduce((sum, row) => sum + row.distanceKm, 0)
    : (week.plannedDistance ?? 0);
  const actualKm = rows.reduce(
    (sum, row) => sum + (row.actualDistanceKm ?? 0),
    0,
  );
  const done = rows.filter((row) => row.status === "completed").length;
  const keyCount = rows.length
    ? rows.filter((row) => KEY_TYPES.has(row.type)).length
    : week.keySessions.length;
  const total = rows.length || (week.plannedWorkoutsCount ?? 0);

  const tiles: StatTile[] = [
    dated && rows.length
      ? {
          value: `${distanceNumber(actualKm, format)}/${distanceNumber(plannedKm, format)}`,
          unit:
            format.units === "imperial" ? format.labels.mi : format.labels.km,
          label: t.volume,
        }
      : {
          value: distanceNumber(plannedKm, format),
          unit:
            format.units === "imperial" ? format.labels.mi : format.labels.km,
          label: t.volume,
        },
    dated && rows.length
      ? { value: fillTemplate(t.doneValue, { done, total }), label: t.done }
      : { value: String(total), label: t.workouts },
    { value: String(keyCount), label: t.keySessions },
  ];

  const kicker = totalWeeks
    ? fillTemplate(t.kicker, {
        phase,
        number: week.weekNumber,
        total: totalWeeks,
      })
    : fillTemplate(t.kickerShort, { phase, number: week.weekNumber });
  const title =
    weekStart && dated
      ? formatDateRange(weekStart, addDaysIso(weekStart, 6), language)
      : fillTemplate(t.title, { number: week.weekNumber });

  const weekAdaptations = adaptations.filter(
    (item) => item.weekId === week.id || item.weekNumber === week.weekNumber,
  );

  return (
    <BottomSheet
      title={title}
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
        {/* Same 20 px side padding as the other sheets (add workout, workout goal). */}
        <SheetBlock theme={theme} style={styles.body}>
          <Text style={[styles.kicker, { color: muted, fontFamily: medium }]}>
            {kicker}
          </Text>

          <StatTiles tiles={tiles} theme={theme} />

          {week.intent ? (
            <Text
              style={[styles.intent, { color: muted, fontFamily: regular }]}
            >
              {week.intent}
            </Text>
          ) : null}

          {rows.length > 0 || onAddWorkout ? (
            <View>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.color.foreground, fontFamily: medium },
                ]}
              >
                {t.workoutsTitle}
              </Text>
              {rows.map((row) => {
                const isToday = row.date === today;
                const level = workoutIntensity(row.type);
                const isDone = row.status === "completed";
                const status: "completed" | "missed" | "planned" = isDone
                  ? "completed"
                  : row.status === "skipped"
                    ? "missed"
                    : "planned";
                const name = `${workoutTypeLabel(row.type, copy)} ${format.distance(row.distanceKm)}`;
                const meta = `${format.minutes(Math.round(row.durationMinutes))} · ${copy.today.workout.intensity[level]}`;
                const statusLabel =
                  copy.today.workout.statuses[status] ?? status;
                const content = (
                  <>
                    <View style={styles.dayColumn}>
                      <Text
                        style={[
                          styles.dayName,
                          {
                            color: isToday ? theme.color.foreground : muted,
                            fontFamily: medium,
                          },
                        ]}
                      >
                        {dayNames[row.weekday] ?? row.dayLabel}
                      </Text>
                      {row.date ? (
                        <Text
                          style={[
                            styles.dayNumber,
                            {
                              color: theme.color.foreground,
                              fontFamily: medium,
                            },
                          ]}
                        >
                          {parseIsoDate(row.date).getDate()}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.rowText}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.rowTitle,
                          { color: theme.color.foreground, fontFamily: medium },
                        ]}
                      >
                        {name}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.rowMeta,
                          { color: muted, fontFamily: regular },
                        ]}
                      >
                        {meta}
                      </Text>
                    </View>
                    {isDone && row.actualDistanceKm ? (
                      <Text
                        style={[
                          styles.rowFact,
                          { color: theme.color.foreground, fontFamily: medium },
                        ]}
                      >
                        {format.distance(row.actualDistanceKm)}
                      </Text>
                    ) : (
                      <IntensityMeter theme={theme} level={level} />
                    )}
                    {dated ? (
                      <StatusBox
                        theme={theme}
                        status={status}
                        label={statusLabel}
                      />
                    ) : null}
                  </>
                );
                const rowStyle = [
                  styles.row,
                  isToday && [
                    styles.todayRow,
                    { backgroundColor: theme.color.secondary },
                  ],
                ];
                return row.selectable && onSelectWorkout ? (
                  <Pressable
                    key={row.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${row.dayLabel}, ${name}, ${meta}, ${statusLabel}`}
                    onPress={() => closeThen(() => onSelectWorkout(row.id))}
                    style={({ pressed }) => [
                      ...rowStyle,
                      pressed && styles.pressed,
                    ]}
                  >
                    {content}
                  </Pressable>
                ) : (
                  <View key={row.id} style={rowStyle}>
                    {content}
                  </View>
                );
              })}
              {onAddWorkout ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => closeThen(onAddWorkout)}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.dayColumn}>
                    <View
                      style={[
                        styles.addCircle,
                        { borderColor: theme.color.controlBorder },
                      ]}
                    >
                      <Plus size={14} strokeWidth={2.4} color={muted} />
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.rowTitle,
                      { color: muted, fontFamily: medium },
                    ]}
                  >
                    {copy.plans.edit.addWorkout}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {weekAdaptations.length > 0 ? (
            <View style={styles.changes}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: theme.color.foreground, fontFamily: medium },
                ]}
              >
                {t.changesTitle}
              </Text>
              {weekAdaptations.map((item) => {
                const reason = adaptationReason(item.reason, copy);
                return (
                  <View key={item.id} style={styles.change}>
                    <Sparkles size={16} color={theme.color.ai} />
                    <View style={styles.rowText}>
                      <Text
                        style={[
                          styles.rowTitle,
                          { color: theme.color.foreground, fontFamily: medium },
                        ]}
                      >
                        {adaptationTitle(item.type, copy)}
                      </Text>
                      {reason ? (
                        <Text
                          style={[
                            styles.rowMeta,
                            { color: muted, fontFamily: regular },
                          ]}
                        >
                          {reason}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}
        </SheetBlock>
      </ScrollView>

      <SheetBlock theme={theme}>
        <View style={styles.actionsRow}>
          <SheetButton
            label={t.close}
            onPress={() => closeThen()}
            theme={theme}
            themeMode={themeMode}
          />
        </View>
      </SheetBlock>
    </BottomSheet>
  );
}
