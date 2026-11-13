import { useEffect, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { type WorkoutType } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Ruler } from "@trefix/ui-native";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { SheetBlock, SheetButton } from "../../../shared/ui/bottom-sheet";
import { PLAN_WORKOUT_TYPE_KEYS } from "../plan-creation-types";
import {
  DayPicker,
  FieldError,
  OptionChip,
  SectionBlock,
} from "./plan-creation-ui";

export type WorkoutChanges = {
  type?: WorkoutType;
  dayOfWeek?: number;
  distanceKm?: number;
  durationMinutes?: number;
};

/** Distance is shown and compared with 0.1 km precision. */
export const roundKm = (value: number) => Math.round(value * 10) / 10;

/** Mirrors backend engine rules; returns an errors-copy key or null. */
export function validateWorkoutChanges(changes: WorkoutChanges): string | null {
  if (
    changes.distanceKm !== undefined &&
    (!Number.isFinite(changes.distanceKm) ||
      changes.distanceKm <= 0 ||
      changes.distanceKm > 100)
  ) {
    return "invalidDistance";
  }
  if (
    changes.durationMinutes !== undefined &&
    (!Number.isFinite(changes.durationMinutes) ||
      changes.durationMinutes < 10 ||
      changes.durationMinutes > 300)
  ) {
    return "invalidDuration";
  }
  return null;
}

export const SHORT_DAY_NAMES_EN = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
] as const;
export const SHORT_DAY_NAMES_RU = [
  "Пн",
  "Вт",
  "Ср",
  "Чт",
  "Пт",
  "Сб",
  "Вс",
] as const;

/** Monday-based short weekday names. */
export function shortDayNamesFor(language: AppLanguage): readonly string[] {
  return language === "ru" ? SHORT_DAY_NAMES_RU : SHORT_DAY_NAMES_EN;
}

/** Minimal workout shape the editor works with (preview, draft or dated workout). */
export type EditableWorkout = {
  id: string;
  type: WorkoutType;
  dayOfWeek: number;
  distanceKm: number;
  durationMinutes: number;
};

type WorkoutEditFormProps = {
  workout: EditableWorkout | null;
  defaultDayOfWeek?: number;
  /** Weekday row; hidden where the day is changed by moving the workout to a date. */
  showDay?: boolean;
  /** Extra block above the type slider (e.g. a date picker for a new dated workout). */
  header?: ReactNode;
  /** Lets Save appear without field changes (e.g. only the header value changed). */
  forceDirty?: boolean;
  pending?: boolean;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  error: string | null;
  onSave: (changes: WorkoutChanges) => void;
  onRemove?: () => void;
  onClose: () => void;
  /**
   * Closes the whole flow (the back button only steps back). When set, the
   * actions are Back | Cancel | Save instead of Back | Delete | Save.
   */
  onCancel?: () => void;
  cancelLabel?: string;
};

/**
 * Workout editor in the creation-flow style: type slider, weekday row and
 * rulers for distance and duration. Actions mirror the creation steps:
 * back icon (closes) | Delete | Save (only once something changed).
 * Only changed fields are sent as overrides; a new workout sends everything.
 */
export function WorkoutEditForm({
  workout,
  defaultDayOfWeek,
  showDay = true,
  header,
  forceDirty = false,
  pending = false,
  theme,
  themeMode,
  copy,
  language,
  error,
  onSave,
  onRemove,
  onClose,
  onCancel,
  cancelLabel,
}: WorkoutEditFormProps) {
  const creationCopy = copy.plan.creation;
  const editorCopy = creationCopy.workoutEditor;
  const shortDayNames =
    language === "ru" ? SHORT_DAY_NAMES_RU : SHORT_DAY_NAMES_EN;

  const initial = {
    type: workout?.type ?? ("easy" as WorkoutType),
    dayOfWeek: workout?.dayOfWeek ?? defaultDayOfWeek ?? 0,
    distanceKm: workout ? roundKm(workout.distanceKm) : 5,
    durationMinutes: workout?.durationMinutes ?? 30,
  };
  const [type, setType] = useState(initial.type);
  const [dayOfWeek, setDayOfWeek] = useState(initial.dayOfWeek);
  const [distanceKm, setDistanceKm] = useState(initial.distanceKm);
  const [durationMinutes, setDurationMinutes] = useState(
    initial.durationMinutes,
  );

  const changes: WorkoutChanges = workout
    ? {
        type: type !== initial.type ? type : undefined,
        dayOfWeek: dayOfWeek !== initial.dayOfWeek ? dayOfWeek : undefined,
        distanceKm:
          Math.abs(distanceKm - initial.distanceKm) > 1e-6
            ? distanceKm
            : undefined,
        durationMinutes:
          durationMinutes !== initial.durationMinutes
            ? durationMinutes
            : undefined,
      }
    : { type, dayOfWeek, distanceKm, durationMinutes };
  const hasChanges =
    !workout ||
    forceDirty ||
    Object.values(changes).some((value) => value !== undefined);

  return (
    <>
      {/* Same structure as WorkoutGoalSheet: plain ScrollView sized by content
          (the sheet caps it at 85%), actions pinned to the sheet bottom. */}
      <ScrollView
        style={styles.editScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.editContent}
      >
        {header}
        {/* Title only: the slider below runs edge to edge, outside the padded block. */}
        <SectionBlock title={editorCopy.typeLabel} theme={theme}>
          {null}
        </SectionBlock>
        {/* Type slider: one horizontal row edge to edge, like the presets in the workout sheet. */}
        <SheetBlock theme={theme} edgeToEdge>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typeSlider}
            style={styles.typeSliderView}
          >
            {PLAN_WORKOUT_TYPE_KEYS.map((typeKey) => (
              <OptionChip
                key={typeKey}
                label={
                  creationCopy.workoutTypes[
                    typeKey as keyof typeof creationCopy.workoutTypes
                  ] ?? typeKey
                }
                selected={type === typeKey}
                theme={theme}
                themeMode={themeMode}
                onPress={() => setType(typeKey)}
              />
            ))}
          </ScrollView>
        </SheetBlock>

        {showDay ? (
          <SectionBlock title={editorCopy.dayLabel} theme={theme}>
            <DayPicker
              selectedDays={[dayOfWeek]}
              shortDayNames={shortDayNames}
              onToggleDay={setDayOfWeek}
              theme={theme}
              themeMode={themeMode}
            />
          </SectionBlock>
        ) : null}

        <SectionBlock title={editorCopy.distanceLabel} theme={theme}>
          <Ruler
            value={distanceKm}
            onChange={setDistanceKm}
            min={0.5}
            max={100}
            step={0.1}
            majorEvery={1}
            labelEvery={1}
            tickSpacing={10}
            unit={creationCopy.units.km}
            accessibilityLabel={editorCopy.distanceLabel}
            theme={theme}
            themeMode={themeMode}
          />
        </SectionBlock>

        <SectionBlock title={editorCopy.durationLabel} theme={theme}>
          <Ruler
            value={durationMinutes}
            onChange={setDurationMinutes}
            min={10}
            max={300}
            step={5}
            majorEvery={15}
            labelEvery={30}
            unit={creationCopy.units.min}
            accessibilityLabel={editorCopy.durationLabel}
            theme={theme}
            themeMode={themeMode}
          />
        </SectionBlock>

        {error ? (
          <SheetBlock theme={theme}>
            <FieldError
              message={
                creationCopy.errors[
                  error as keyof typeof creationCopy.errors
                ] ?? error
              }
              theme={theme}
            />
          </SheetBlock>
        ) : null}
      </ScrollView>

      {/* Actions: same layout and offsets as the creation-step sheets. */}
      <SheetBlock theme={theme}>
        <View style={styles.editActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={creationCopy.common.back}
            onPress={onClose}
            style={({ pressed }) => [
              styles.editIconButton,
              { backgroundColor: theme.color.controlSecondary },
              pressed && styles.rowPressed,
            ]}
          >
            <ChevronLeft color={theme.color.foreground} size={22} />
          </Pressable>
          {onCancel ? (
            <>
              <SheetButton
                label={cancelLabel ?? creationCopy.common.cancel}
                onPress={onCancel}
                variant="secondary"
                disabled={pending}
                theme={theme}
                themeMode={themeMode}
              />
              <SheetButton
                label={editorCopy.save}
                onPress={() => onSave(changes)}
                disabled={!hasChanges}
                pending={pending}
                theme={theme}
                themeMode={themeMode}
              />
            </>
          ) : workout && onRemove ? (
            <SplitActions
              showSecond={hasChanges}
              first={{ label: editorCopy.removeButton, onPress: onRemove }}
              second={{
                label: editorCopy.save,
                onPress: () => onSave(changes),
              }}
              pending={pending}
              theme={theme}
              themeMode={themeMode}
            />
          ) : (
            <SheetButton
              label={editorCopy.addShort}
              onPress={() => onSave(changes)}
              pending={pending}
              theme={theme}
              themeMode={themeMode}
            />
          )}
        </View>
      </SheetBlock>
    </>
  );
}

const SPLIT_GAP = 12;
/** Slightly under-damped so the new button "pours out" with a small overshoot. */
const SPLIT_SPRING = { damping: 14, stiffness: 170, mass: 0.9 } as const;

/**
 * Two actions that grow out of one: the destructive button first fills the
 * row; when `showSecond` turns on, a drop of the same colour buds off its
 * right edge, swells to half the row while changing to the primary colour,
 * and its label fades in. Turning it off pours it back.
 */
function SplitActions({
  showSecond,
  first,
  second,
  pending = false,
  theme,
  themeMode,
}: {
  showSecond: boolean;
  pending?: boolean;
  first: { label: string; onPress: () => void };
  second: { label: string; onPress: () => void };
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  const progress = useSharedValue(showSecond ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(showSecond ? 1 : 0, SPLIT_SPRING);
  }, [progress, showSecond]);

  const secondSlotStyle = useAnimatedStyle(() => {
    const p = Math.max(0, progress.value);
    return {
      flexGrow: p,
      marginLeft: Math.min(1, p) * SPLIT_GAP,
      // a round droplet first, then a pill
      transform: [
        {
          scaleY: interpolate(
            p,
            [0, 0.25, 1],
            [0.55, 0.9, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
      backgroundColor: interpolateColor(
        Math.min(1, p),
        [0, 0.55, 1],
        [
          theme.color.dangerSurface,
          theme.color.dangerSurface,
          theme.color.primary,
        ],
      ),
    };
  });

  const secondLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.55, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          progress.value,
          [0.55, 1],
          [0.9, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return (
    <View style={styles.splitRow}>
      <SheetButton
        label={first.label}
        onPress={first.onPress}
        variant="destructive"
        theme={theme}
        themeMode={themeMode}
        style={styles.splitFirst}
      />
      <Animated.View
        style={[styles.splitSecond, secondSlotStyle]}
        pointerEvents={showSecond ? "auto" : "none"}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityElementsHidden={!showSecond}
          importantForAccessibility={
            showSecond ? "auto" : "no-hide-descendants"
          }
          disabled={pending}
          onPress={second.onPress}
          style={({ pressed }) => [
            styles.splitPressable,
            pressed && styles.rowPressed,
          ]}
        >
          {pending ? (
            <ActivityIndicator color={theme.color.primaryForeground} />
          ) : (
            <Animated.Text
              numberOfLines={1}
              style={[
                styles.splitLabel,
                {
                  color: theme.color.primaryForeground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
                secondLabelStyle,
              ]}
            >
              {second.label}
            </Animated.Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  editScroll: {
    width: "100%",
  },
  editContent: {
    gap: 28,
    paddingTop: 72,
    // room for the pinned action row (same as WorkoutGoalSheet)
    paddingBottom: 84,
  },
  typeSliderView: {
    width: "100%",
    maxHeight: 50,
    marginTop: -16,
  },
  typeSlider: {
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  editActions: {
    // Pinned to the sheet bottom like WorkoutGoalSheet's action row.
    flexDirection: "row",
    gap: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  splitRow: {
    flex: 1,
    flexDirection: "row",
  },
  splitFirst: {
    flex: 1,
  },
  splitSecond: {
    flexBasis: 0,
    minWidth: 0,
    height: 52,
    borderRadius: 9999,
    overflow: "hidden",
  },
  splitPressable: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  splitLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  editIconButton: {
    width: 52,
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  rowPressed: {
    opacity: 0.6,
  },
});
