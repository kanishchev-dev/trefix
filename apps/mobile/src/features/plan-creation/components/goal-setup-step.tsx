import { useCallback, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import {
  GOAL_CHALLENGE_METRICS,
  GOAL_CHALLENGE_PERIODS,
  type AthleteGoalPayloadInput,
  type AthleteGoalType,
  type GoalChallengeMetric,
  type GoalChallengePeriod,
} from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";
import { Ruler, Segmented } from "@workspace/ui-native";

import { type MainCopy } from "../../../locales";
import {
  GOAL_FIELD_DEFAULTS as D,
  RACE_DISTANCE_PRESETS_METERS,
  fitTimeToRange,
  raceTimeRange,
} from "../plan-creation-types";
import { SheetBlock } from "../../../shared/ui/bottom-sheet";
import { TargetDatePicker } from "./target-date-picker";
import {
  CirclePicker,
  FieldBlock,
  MultilineInputRow,
  OptionalField,
  OptionalSection,
  OptionChip,
  PACE_RANGE,
  TimeRuler,
} from "./plan-creation-ui";

type Props = {
  goalType: AthleteGoalType;
  draft: AthleteGoalPayloadInput;
  theme: ThemeTokens;
  copy: MainCopy;
  onChangeDraft: (
    updater: (prev: AthleteGoalPayloadInput) => AthleteGoalPayloadInput,
  ) => void;
};

type Metrics = Record<string, unknown>;

/** A block plus whether it is a collapsed "+ Add …" link (gets a tight gap). */
type Item = ReactNode | { node: ReactNode; compact: boolean };

const isTagged = (item: Item): item is { node: ReactNode; compact: boolean } =>
  typeof item === "object" && item !== null && "compact" in (item as object) && "node" in (item as object);

/**
 * Vertical stack with two rhythms: `gap` between full blocks and `compactGap`
 * in front of collapsed links, so a row of "+ Add …" links stays together.
 */
function Stack({ items, gap, compactGap }: { items: Item[]; gap: number; compactGap: number }) {
  const visible = items.filter((item) => item !== null && item !== undefined && item !== false);
  return (
    <View>
      {visible.map((item, index) => {
        const compact = isTagged(item) && item.compact;
        const node = isTagged(item) ? item.node : item;
        return (
          <View key={index} style={index === 0 ? undefined : { marginTop: compact ? compactGap : gap }}>
            {node}
          </View>
        );
      })}
    </View>
  );
}

const SECTION_GAP = 56;
const FIELD_GAP = 44;
const COMPACT_GAP = 8;
type Kind = "target" | "current";


const RUNS_PER_WEEK_SEGMENTS = [1, 2, 3, 4, 5, 6, 7].map((num) => ({
  label: String(num),
  value: num,
}));

/** Ruler scale per challenge metric (values in the metric's own unit). */
const CHALLENGE_SCALES: Record<GoalChallengeMetric, { min: number; max: number; step: number; fallback: number }> = {
  total_distance: { min: 10, max: 5000, step: 10, fallback: 100 },
  total_duration: { min: 1, max: 1000, step: 1, fallback: 20 },
  runs_count: { min: 1, max: 365, step: 1, fallback: 20 },
  active_days: { min: 1, max: 365, step: 1, fallback: 20 },
};

/** Default plan target date: a typical 12-week plan from today. */
function defaultTargetDate() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 12 * 7);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type DurationUnits = { h: string; min: string };

/** Formats minutes as "1 ч 30 мин" / "1 h 30 min" using localized units. */
function formatDuration(minutes: number, units: DurationUnits): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours} ${units.h} ${mins} ${units.min}`;
  if (hours > 0) return `${hours} ${units.h}`;
  return `${mins} ${units.min}`;
}

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

/**
 * Goal setup step.
 * - "Goal": what the plan is built for. Required fields are pre-filled on
 *   type selection (withRequiredGoalDefaults); optional ones sit behind
 *   "+ Add …" links.
 * - "Current level" and "Target date" are optional sections revealed by a
 *   link; opening one stores its defaults, removing it clears them.
 * - Only metric keys allowed for the goal type are written, in canonical
 *   units (metres, seconds, minutes) — the backend rejects anything else.
 */
export function GoalSetupStep({ goalType, draft, theme, copy, onChangeDraft }: Props) {
  const creationCopy = copy.plan.creation;
  const f = creationCopy.goalForm;
  const units = creationCopy.units;
  const challengeMetricsCopy = creationCopy.challengeMetrics;
  const challengePeriodsCopy = creationCopy.challengePeriods;
  const paceUnit = `${units.min}/${units.km}`;
  const durationLabel = (minutes: number) => formatDuration(minutes, units);

  const target: Metrics = draft.target ?? {};
  const current: Metrics = draft.current ?? {};

  const update = useCallback(
    (kind: Kind, changes: Metrics) => {
      onChangeDraft((prev) => {
        const next: Metrics = { ...(prev[kind] ?? {}) };
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === null || value === "") delete next[key];
          else next[key] = value;
        }
        return { ...prev, type: goalType, [kind]: Object.keys(next).length > 0 ? next : undefined };
      });
    },
    [goalType, onChangeDraft],
  );
  const setter = (kind: Kind, key: string) => (value: unknown) => update(kind, { [key]: value });
  const read = (kind: Kind, key: string, fallback: number) =>
    asNumber((kind === "target" ? target : current)[key]) ?? fallback;

  // ---------- controls ----------

  /** Ruler in km over a metres field. */
  const kmRuler = (
    meters: number,
    onChange: (meters: number) => void,
    { min, max, step = 1 }: { min: number; max: number; step?: number },
    label: string,
  ) => (
    <Ruler
      value={meters / 1000}
      onChange={(km) => onChange(Math.round(km * 1000))}
      min={min}
      max={max}
      step={step}
      unit={units.km}
      accessibilityLabel={label}
      theme={theme}
    />
  );

  const plainRuler = (
    value: number,
    onChange: (value: number) => void,
    opts: {
      min: number;
      max: number;
      step?: number;
      unit?: string;
      majorEvery?: number;
      labelEvery?: number;
      formatValue?: (v: number) => string;
      formatLabel?: (v: number) => string;
    },
    label: string,
  ) => (
    <Ruler
      value={value}
      onChange={onChange}
      min={opts.min}
      max={opts.max}
      step={opts.step ?? 1}
      unit={opts.unit}
      majorEvery={opts.majorEvery}
      labelEvery={opts.labelEvery}
      formatValue={opts.formatValue}
      formatLabel={opts.formatLabel}
      accessibilityLabel={label}
      theme={theme}
    />
  );

  const minutesRuler = (value: number, onChange: (v: number) => void, max: number, label: string) =>
    plainRuler(value, onChange, { min: 5, max, step: 5, majorEvery: 15, labelEvery: 30, formatValue: durationLabel }, label);

  const weeklyKmRuler = (value: number, onChange: (v: number) => void) =>
    plainRuler(value, onChange, { min: 1, max: 400, unit: units.km }, f.weeklyDistance);

  // Same round-button picker as weekdays / workouts per week on later steps.
  const runsSegmented = (value: number, onChange: (v: number) => void) => (
    <CirclePicker options={RUNS_PER_WEEK_SEGMENTS} selected={[value]} onPress={onChange} theme={theme} />
  );

  /** Field that is part of a section as soon as the section exists. */
  const field = (label: string, control: ReactNode, info?: string) => (
    <FieldBlock key={label} label={label} info={info} theme={theme}>
      {control}
    </FieldBlock>
  );

  /** Optional field inside the goal section, hidden behind "+ Add …". */
  const optionalTarget = (
    key: string,
    fallback: number,
    label: string,
    addLabel: string,
    render: (value: number, onChange: (v: number) => void) => ReactNode,
    info?: string,
  ) => {
    const value = asNumber(target[key]);
    const set = setter("target", key);
    const node = (
      <OptionalField
        key={`target-${key}`}
        label={label}
        info={info}
        addLabel={addLabel}
        removeLabel={f.remove}
        isSet={value !== undefined}
        onSet={() => set(fallback)}
        onRemove={() => set(undefined)}
        theme={theme}
      >
        {value !== undefined ? render(value, set) : null}
      </OptionalField>
    );
    return { node, compact: value === undefined };
  };

  // ---------- sections ----------

  // The goal fields come first and need no heading: the step title already says it.
  const goalSection = (...children: Item[]) => (
    <SheetBlock theme={theme}>
      <Stack items={children} gap={FIELD_GAP} compactGap={COMPACT_GAP} />
    </SheetBlock>
  );

  /** Optional "Current level" section; `defaults` are stored when it is opened. */
  const currentSection = (defaults: Metrics, ...children: ReactNode[]): Item => ({
    compact: Object.keys(current).length === 0,
    node: (
    <OptionalSection
      title={f.currentSection}
      description={f.currentHint}
      addLabel={f.addCurrent}
      removeLabel={f.removeCurrent}
      isOpen={Object.keys(current).length > 0}
      onOpen={() => update("current", defaults)}
      onRemove={() => onChangeDraft((prev) => ({ ...prev, current: undefined }))}
      theme={theme}
    >
      <View style={styles.fields}>{children}</View>
    </OptionalSection>
    ),
  });

  const targetDate = draft.targetDate;
  const dateSection: Item = {
    compact: !targetDate,
    node: (
    <OptionalSection
      title={f.dateSection}
      description={f.dateHint}
      addLabel={f.addDate}
      removeLabel={f.removeDate}
      isOpen={Boolean(targetDate)}
      onOpen={() => onChangeDraft((prev) => ({ ...prev, targetDate: defaultTargetDate() }))}
      onRemove={() => onChangeDraft((prev) => ({ ...prev, targetDate: undefined }))}
      theme={theme}
    >
      {targetDate ? (
        <TargetDatePicker
          value={targetDate}
          onChange={(iso) => onChangeDraft((prev) => ({ ...prev, targetDate: iso }))}
          theme={theme}
          copy={copy}
        />
      ) : null}
    </OptionalSection>
    ),
  };

  const screen = (...sections: Item[]) => (
    <Stack items={sections} gap={SECTION_GAP} compactGap={COMPACT_GAP} />
  );

  // ---------- per goal type ----------

  switch (goalType) {
    case "prepare_for_race":
    case "improve_race_result":
    case "run_new_distance": {
      const distanceMeters = read("target", "distanceMeters", 10_000);
      const range = raceTimeRange(distanceMeters);
      const timeRuler = (label: string) => (value: number, onChange: (v: number) => void) => (
        <TimeRuler seconds={value} onChange={onChange} range={range} accessibilityLabel={label} theme={theme} />
      );

      /** New distance: keep entered times if they still fit the new scale, else use its defaults. */
      const setDistance = (meters: number) => {
        const nextRange = raceTimeRange(meters);
        const targetTime = asNumber(target.finishTimeSec);
        update("target", {
          distanceMeters: meters,
          finishTimeSec:
            targetTime === undefined ? undefined : fitTimeToRange(targetTime, nextRange, nextRange.defaultTarget),
        });
        const currentTime = asNumber(current.finishTimeSec);
        if (currentTime !== undefined) {
          update("current", { finishTimeSec: fitTimeToRange(currentTime, nextRange, nextRange.defaultCurrent) });
        }
      };

      const distanceField = field(
        f.raceDistance,
        <View style={styles.fields}>
          {/* 0.1 km steps so 21.1 / 42.2 are reachable; up to 300 km (backend bound). */}
          <Ruler
            value={distanceMeters / 1000}
            onChange={(km) => setDistance(Math.round(km * 1000))}
            min={1}
            max={300}
            step={0.1}
            majorEvery={1}
            labelEvery={1}
            tickSpacing={10}
            unit={units.km}
            accessibilityLabel={f.raceDistance}
            theme={theme}
          />
          <View style={styles.chipWrap}>
            {RACE_DISTANCE_PRESETS_METERS.map((meters) => (
              <OptionChip
                key={meters}
                label={`${Number((meters / 1000).toFixed(1))} ${units.km}`}
                selected={Math.abs(distanceMeters - meters) < 50}
                theme={theme}
                onPress={() => setDistance(meters)}
              />
            ))}
          </View>
        </View>,
        f.raceDistanceInfo,
      );

      const timeField =
        goalType === "improve_race_result"
          ? field(f.finishTime, timeRuler(f.finishTime)(read("target", "finishTimeSec", range.defaultTarget), setter("target", "finishTimeSec")))
          : goalType === "prepare_for_race"
            ? optionalTarget("finishTimeSec", range.defaultTarget, f.finishTime, f.addFinishTime, timeRuler(f.finishTime), f.finishTimeInfo)
            : null;

      const currentBlock =
        goalType === "run_new_distance"
          ? currentSection(
              { distanceMeters: D.longestRunMeters },
              field(
                f.longestRun,
                kmRuler(read("current", "distanceMeters", D.longestRunMeters), setter("current", "distanceMeters"), { min: 1, max: 100, step: 0.5 }, f.longestRun),
                f.longestRunInfo,
              ),
            )
          : currentSection(
              { finishTimeSec: range.defaultCurrent },
              field(
                f.bestTime,
                timeRuler(f.bestTime)(read("current", "finishTimeSec", range.defaultCurrent), setter("current", "finishTimeSec")),
                f.bestTimeInfo,
              ),
            );

      return screen(goalSection(distanceField, timeField), currentBlock, dateSection);
    }

    case "trail_preparation":
    case "ultra_preparation": {
      const isUltra = goalType === "ultra_preparation";
      return screen(
        goalSection(
          field(
            f.distance,
            kmRuler(
              read("target", "distanceMeters", isUltra ? D.ultraDistanceMeters : D.trailDistanceMeters),
              setter("target", "distanceMeters"),
              { min: 5, max: 300 },
              f.distance,
            ),
            f.trailDistanceInfo,
          ),
          optionalTarget(
            "elevationGainMeters",
            isUltra ? D.ultraElevationMeters : D.trailElevationMeters,
            f.elevation,
            f.addElevation,
            (value, onChange) => plainRuler(value, onChange, { min: 0, max: 10_000, step: 100, unit: units.m }, f.elevation),
            f.trailElevationInfo,
          ),
        ),
        currentSection(
          { distanceMeters: D.longestRunMeters, weeklyDistanceKm: D.currentWeeklyDistanceKm },
          field(
            f.longestRun,
            kmRuler(read("current", "distanceMeters", D.longestRunMeters), setter("current", "distanceMeters"), { min: 1, max: 300, step: 0.5 }, f.longestRun),
            f.longestRunInfo,
          ),
          field(f.weeklyDistance, weeklyKmRuler(read("current", "weeklyDistanceKm", D.currentWeeklyDistanceKm), setter("current", "weeklyDistanceKm"))),
        ),
        dateSection,
      );
    }

    case "backyard_preparation": {
      return screen(
        goalSection(
          field(
            f.loops,
            plainRuler(read("target", "loopsCount", D.loopsCount), setter("target", "loopsCount"), { min: 1, max: 100, majorEvery: 5, labelEvery: 5 }, f.loops),
            f.loopsInfo,
          ),
        ),
        currentSection(
          { timeOnFeetMinutes: D.timeOnFeetMinutes },
          field(
            f.timeOnFeet,
            plainRuler(
              read("current", "timeOnFeetMinutes", D.timeOnFeetMinutes),
              setter("current", "timeOnFeetMinutes"),
              {
                min: 30,
                max: 4320,
                step: 30,
                majorEvery: 60,
                labelEvery: 240,
                formatValue: durationLabel,
                formatLabel: (minutes) => `${minutes / 60} ${units.h}`,
              },
              f.timeOnFeet,
            ),
            f.timeOnFeetInfo,
          ),
        ),
        dateSection,
      );
    }

    case "improve_speed":
    case "improve_pace": {
      const paceRuler = (value: number, onChange: (v: number) => void) => (
        <TimeRuler seconds={value} onChange={onChange} range={PACE_RANGE} unit={paceUnit} accessibilityLabel={f.pace} theme={theme} />
      );
      return screen(
        goalSection(
          field(f.pace, paceRuler(read("target", "paceSecondsPerKm", D.targetPace), setter("target", "paceSecondsPerKm"))),
          goalType === "improve_pace"
            ? optionalTarget(
                "distanceMeters",
                D.paceDistanceMeters,
                f.paceDistance,
                f.addPaceDistance,
                (value, onChange) => kmRuler(value, onChange, { min: 1, max: 50 }, f.paceDistance),
                f.paceDistanceInfo,
              )
            : null,
        ),
        currentSection(
          { paceSecondsPerKm: D.currentPace },
          field(f.pace, paceRuler(read("current", "paceSecondsPerKm", D.currentPace), setter("current", "paceSecondsPerKm"))),
        ),
        dateSection,
      );
    }

    case "build_endurance":
    case "run_continuously": {
      const isEndurance = goalType === "build_endurance";
      const byDistance = asNumber(target.continuousDistanceKm) !== undefined;
      const switchMeasure = (toDistance: boolean) => {
        if (toDistance === byDistance) return;
        update("target", {
          continuousDistanceKm: toDistance ? (isEndurance ? D.enduranceDistanceKm : D.continuousDistanceKm) : undefined,
          continuousDurationMinutes: toDistance ? undefined : isEndurance ? D.enduranceMinutes : D.continuousMinutes,
        });
        // Keep the current level in the same measure as the goal.
        if (Object.keys(current).length > 0) {
          update("current", {
            continuousDistanceKm: toDistance ? D.currentContinuousDistanceKm : undefined,
            continuousDurationMinutes: toDistance ? undefined : D.currentContinuousMinutes,
          });
        }
      };
      const distanceRuler = (value: number, onChange: (v: number) => void) =>
        plainRuler(value, onChange, { min: 0.5, max: 300, step: 0.5, unit: units.km }, f.continuous);

      return screen(
        goalSection(
          field(
            f.continuous,
            <View style={styles.fields}>
              <Segmented
                segments={[
                  { label: f.measureTime, value: "time" },
                  { label: f.measureDistance, value: "distance" },
                ]}
                value={byDistance ? "distance" : "time"}
                onChange={(measure) => switchMeasure(measure === "distance")}
                theme={theme}
              />
              {byDistance
                ? distanceRuler(read("target", "continuousDistanceKm", D.continuousDistanceKm), setter("target", "continuousDistanceKm"))
                : minutesRuler(read("target", "continuousDurationMinutes", D.continuousMinutes), setter("target", "continuousDurationMinutes"), 1440, f.continuous)}
            </View>,
            f.continuousInfo,
          ),
        ),
        byDistance
          ? currentSection(
              { continuousDistanceKm: D.currentContinuousDistanceKm },
              field(f.continuous, distanceRuler(read("current", "continuousDistanceKm", D.currentContinuousDistanceKm), setter("current", "continuousDistanceKm"))),
            )
          : currentSection(
              { continuousDurationMinutes: D.currentContinuousMinutes },
              field(f.continuous, minutesRuler(read("current", "continuousDurationMinutes", D.currentContinuousMinutes), setter("current", "continuousDurationMinutes"), 1440, f.continuous)),
            ),
        dateSection,
      );
    }

    case "build_consistency": {
      return screen(
        goalSection(field(f.runsPerWeek, runsSegmented(read("target", "runsPerWeek", D.runsPerWeek), setter("target", "runsPerWeek")))),
        currentSection(
          { runsPerWeek: D.currentRunsPerWeek },
          field(f.runsPerWeek, runsSegmented(read("current", "runsPerWeek", D.currentRunsPerWeek), setter("current", "runsPerWeek"))),
        ),
        dateSection,
      );
    }

    case "increase_running_volume": {
      return screen(
        goalSection(field(f.weeklyDistance, weeklyKmRuler(read("target", "weeklyDistanceKm", D.weeklyDistanceKm), setter("target", "weeklyDistanceKm")))),
        currentSection(
          { weeklyDistanceKm: D.currentWeeklyDistanceKm },
          field(f.weeklyDistance, weeklyKmRuler(read("current", "weeklyDistanceKm", D.currentWeeklyDistanceKm), setter("current", "weeklyDistanceKm"))),
        ),
        dateSection,
      );
    }

    case "lose_weight": {
      const weightRuler = (value: number, onChange: (v: number) => void) =>
        plainRuler(value, onChange, { min: 30, max: 250, step: 0.5, labelEvery: 5, unit: units.kg }, f.weight);
      return screen(
        goalSection(field(f.weight, weightRuler(read("target", "weightKg", D.targetWeightKg), setter("target", "weightKg")))),
        currentSection(
          { weightKg: D.currentWeightKg },
          field(f.weight, weightRuler(read("current", "weightKg", D.currentWeightKg), setter("current", "weightKg"))),
        ),
        dateSection,
      );
    }

    case "start_running": {
      return screen(
        goalSection(
          optionalTarget(
            "continuousDurationMinutes",
            D.startRunningTargetMinutes,
            f.continuous,
            f.addContinuous,
            (value, onChange) => minutesRuler(value, onChange, 180, f.continuous),
          ),
        ),
        currentSection(
          { continuousDurationMinutes: D.startRunningCurrentMinutes },
          field(f.continuous, minutesRuler(read("current", "continuousDurationMinutes", D.startRunningCurrentMinutes), setter("current", "continuousDurationMinutes"), 180, f.continuous)),
        ),
        dateSection,
      );
    }

    case "return_to_running": {
      return screen(
        goalSection(
          optionalTarget("weeklyDistanceKm", D.weeklyDistanceKm, f.weeklyDistance, f.addWeeklyDistance, weeklyKmRuler),
        ),
        currentSection(
          { continuousDurationMinutes: D.currentContinuousMinutes },
          field(f.continuous, minutesRuler(read("current", "continuousDurationMinutes", D.currentContinuousMinutes), setter("current", "continuousDurationMinutes"), 1440, f.continuous)),
        ),
        dateSection,
      );
    }

    case "maintain_fitness":
    case "general_health": {
      const isHealth = goalType === "general_health";
      return screen(
        goalSection(
          optionalTarget("runsPerWeek", D.runsPerWeek, f.runsPerWeek, f.addRunsPerWeek, runsSegmented),
          isHealth
            ? optionalTarget("weeklyDurationMinutes", D.weeklyDurationMinutes, f.weeklyDuration, f.addWeeklyDuration, (value, onChange) =>
                plainRuler(value, onChange, { min: 20, max: 1200, step: 10, majorEvery: 30, labelEvery: 60, unit: units.min }, f.weeklyDuration),
              )
            : optionalTarget("weeklyDistanceKm", D.weeklyDistanceKm, f.weeklyDistance, f.addWeeklyDistance, weeklyKmRuler),
        ),
        currentSection(
          { runsPerWeek: D.currentRunsPerWeek },
          field(f.runsPerWeek, runsSegmented(read("current", "runsPerWeek", D.currentRunsPerWeek), setter("current", "runsPerWeek"))),
        ),
        dateSection,
      );
    }

    case "improve_hills": {
      const elevationRuler = (value: number, onChange: (v: number) => void) =>
        plainRuler(value, onChange, { min: 0, max: 3000, step: 50, majorEvery: 250, labelEvery: 500, unit: units.m }, f.elevation);
      return screen(
        goalSection(
          optionalTarget("elevationGainMeters", D.hillsElevationMeters, f.elevation, f.addElevation, elevationRuler, f.hillsElevationInfo),
        ),
        currentSection(
          { elevationGainMeters: D.hillsElevationMeters / 2 },
          field(f.elevation, elevationRuler(read("current", "elevationGainMeters", D.hillsElevationMeters / 2), setter("current", "elevationGainMeters")), f.hillsElevationInfo),
        ),
        dateSection,
      );
    }

    case "improve_aerobic_fitness": {
      return screen(
        goalSection(
          <Text key="note" style={[styles.note, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
            {f.aerobicNote}
          </Text>,
        ),
        dateSection,
      );
    }

    case "complete_challenge": {
      const metric = (target.challengeMetric as GoalChallengeMetric) || "total_distance";
      const period = (target.challengePeriod as GoalChallengePeriod) || "this_month";
      const scale = CHALLENGE_SCALES[metric];
      const challengeUnit =
        metric === "total_distance"
          ? units.km
          : metric === "total_duration"
            ? units.h
            : metric === "runs_count"
              ? f.runsUnit
              : f.daysUnit;

      return screen(
        goalSection(
          field(
            f.challengeMetric,
            <View style={styles.chipWrap}>
              {GOAL_CHALLENGE_METRICS.map((item) => (
                <OptionChip
                  key={item}
                  label={challengeMetricsCopy[item as keyof typeof challengeMetricsCopy] ?? item}
                  selected={metric === item}
                  theme={theme}
                  onPress={() =>
                    update("target", {
                      challengeMetric: item,
                      // Units differ per metric, so the old number would be nonsense.
                      challengeTargetValue: CHALLENGE_SCALES[item].fallback,
                    })
                  }
                />
              ))}
            </View>,
          ),
          field(
            f.challengeTarget,
            plainRuler(read("target", "challengeTargetValue", scale.fallback), setter("target", "challengeTargetValue"), {
              min: scale.min,
              max: scale.max,
              step: scale.step,
              unit: challengeUnit,
            }, f.challengeTarget),
          ),
          field(
            f.challengePeriod,
            <View style={styles.chipWrap}>
              {GOAL_CHALLENGE_PERIODS.map((item) => (
                <OptionChip
                  key={item}
                  label={challengePeriodsCopy[item as keyof typeof challengePeriodsCopy] ?? item}
                  selected={period === item}
                  theme={theme}
                  onPress={() => update("target", { challengePeriod: item })}
                />
              ))}
            </View>,
          ),
        ),
        dateSection,
      );
    }

    case "custom":
    default: {
      return screen(
        goalSection(
          <MultilineInputRow
            key="description"
            label={f.description}
            value={draft.description ?? ""}
            placeholder={f.descriptionPlaceholder}
            theme={theme}
            onChangeText={(description) => onChangeDraft((prev) => ({ ...prev, description }))}
          />,
        ),
        dateSection,
      );
    }
  }
}

const styles = StyleSheet.create({
  fields: {
    gap: 44,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
