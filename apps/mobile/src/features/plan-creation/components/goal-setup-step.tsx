import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import {
  GOAL_CHALLENGE_METRICS,
  GOAL_CHALLENGE_PERIODS,
  LEGACY_RACE_DISTANCE_METERS,
  type AthleteGoalPayloadInput,
  type AthleteGoalType,
  type GoalChallengeMetric,
  type GoalChallengePeriod,
} from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { CalendarDatePicker } from "./calendar-date-picker";
import {
  CompoundPaceInputRow,
  CompoundTimerInputRow,
  CounterRow,
  MultilineInputRow,
  OptionChip,
  RaceDistanceSelector,
  SectionBlock,
  SegmentedRow,
  WheelInputRow,
} from "./plan-creation-ui";

type Props = {
  goalType: AthleteGoalType;
  draft: AthleteGoalPayloadInput;
  theme: ThemeTokens;
  copy: MainCopy;
  language: AppLanguage;
  onChangeDraft: (
    updater: (prev: AthleteGoalPayloadInput) => AthleteGoalPayloadInput,
  ) => void;
  targetTimeError?: string | null;
};

const RACE_OPTIONS = [
  { value: "5k", label: "5K" },
  { value: "10k", label: "10K" },
  { value: "half_marathon", label: "21.1 km" },
  { value: "marathon", label: "42.2 km" },
] as const;

const RUNS_PER_WEEK_SEGMENTS = [1, 2, 3, 4, 5, 6, 7].map((num) => ({
  label: String(num),
  value: num,
}));

function formatTimeOnFeet(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours} ч ${mins} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${mins} мин`;
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `${hours} ч ${mins} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${mins} мин`;
}

export function GoalSetupStep({
  goalType,
  draft,
  theme,
  copy,
  language,
  onChangeDraft,
  targetTimeError,
}: Props) {
  const creationCopy = copy.plan.creation;
  const fieldsCopy = creationCopy.fields;
  const challengeMetricsCopy = creationCopy.challengeMetrics;
  const challengePeriodsCopy = creationCopy.challengePeriods;

  const target = draft.target ?? {};
  const current = draft.current ?? {};

  const setTargetValue = useCallback(
    (key: string, value: unknown) => {
      onChangeDraft((prev) => {
        const nextTarget = { ...(prev.target ?? {}) };
        if (value === undefined || value === null || value === "") {
          delete nextTarget[key];
        } else {
          nextTarget[key] = value;
        }
        return { ...prev, type: goalType, target: nextTarget };
      });
    },
    [goalType, onChangeDraft],
  );

  const setCurrentValue = useCallback(
    (key: string, value: unknown) => {
      onChangeDraft((prev) => {
        const nextCurrent = { ...(prev.current ?? {}) };
        if (value === undefined || value === null || value === "") {
          delete nextCurrent[key];
        } else {
          nextCurrent[key] = value;
        }
        return { ...prev, type: goalType, current: nextCurrent };
      });
    },
    [goalType, onChangeDraft],
  );

  const setTargetDate = useCallback(
    (targetDate?: string) => {
      onChangeDraft((prev) => ({ ...prev, targetDate }));
    },
    [onChangeDraft],
  );

  const setDescription = useCallback(
    (description: string) => {
      onChangeDraft((prev) => ({ ...prev, description }));
    },
    [onChangeDraft],
  );

  // Helper for distance preset selection in race goals
  const activeRaceDistancePreset = useMemo(() => {
    const distMeters = target.distanceMeters as number | undefined;
    if (!distMeters) return "10k";
    if (Math.abs(distMeters - 5000) < 10) return "5k";
    if (Math.abs(distMeters - 10000) < 10) return "10k";
    if (Math.abs(distMeters - 21097) < 100) return "half_marathon";
    if (Math.abs(distMeters - 42195) < 100) return "marathon";
    return "10k";
  }, [target.distanceMeters]);

  // Target Date Calendar Selector
  const renderTargetDateSection = () => (
    <SectionBlock title={fieldsCopy.targetDate} theme={theme}>
      <CalendarDatePicker
        value={draft.targetDate}
        onChange={setTargetDate}
        theme={theme}
        language={language}
      />
    </SectionBlock>
  );

  // Render per-type goal configuration forms
  switch (goalType) {
    case "prepare_for_race":
    case "improve_race_result":
    case "run_new_distance": {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.distance} theme={theme}>
            <RaceDistanceSelector
              options={RACE_OPTIONS.map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
              value={activeRaceDistancePreset}
              theme={theme}
              onChange={(preset) => {
                const meters = LEGACY_RACE_DISTANCE_METERS[preset] ?? 10000;
                setTargetValue("distanceMeters", meters);
              }}
            />
          </SectionBlock>

          {goalType !== "run_new_distance" ? (
            <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
              <CompoundTimerInputRow
                label={fieldsCopy.targetTime}
                value={(target.finishTimeText as string) ?? "45:00"}
                error={targetTimeError}
                badge={
                  goalType === "improve_race_result"
                    ? fieldsCopy.requiredLabel
                    : fieldsCopy.optionalLabel
                }
                theme={theme}
                onChangeText={(text) => setTargetValue("finishTimeText", text)}
              />
            </SectionBlock>
          ) : null}

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <CompoundTimerInputRow
              label={fieldsCopy.currentResult}
              value={(current.finishTimeText as string) ?? "48:30"}
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) => setCurrentValue("finishTimeText", text)}
            />
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "trail_preparation":
    case "ultra_preparation": {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <WheelInputRow
              label={fieldsCopy.distance}
              value={(target.distanceKm as number) ?? 30}
              onChange={(val) => setTargetValue("distanceKm", val)}
              min={5}
              max={100}
              step={1}
              unit="км"
              theme={theme}
            />
            <View style={{ marginTop: 12 }}>
              <WheelInputRow
                label={fieldsCopy.elevationGain}
                value={(target.elevationGainMeters as number) ?? 1500}
                onChange={(val) => setTargetValue("elevationGainMeters", val)}
                min={0}
                max={5000}
                step={100}
                unit="м"
                theme={theme}
              />
            </View>
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <WheelInputRow
              label={fieldsCopy.continuousDistance}
              value={(current.continuousDistanceKm as number) ?? 15}
              onChange={(val) => setCurrentValue("continuousDistanceKm", val)}
              min={1}
              max={50}
              step={1}
              unit="км"
              theme={theme}
            />
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "backyard_preparation": {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <CounterRow
              label={fieldsCopy.loopsCount}
              value={(target.loopsCount as number) ?? 12}
              min={1}
              max={100}
              theme={theme}
              onChange={(value) => setTargetValue("loopsCount", value)}
            />
            <View style={{ marginTop: 12 }}>
              <WheelInputRow
                label={fieldsCopy.timeOnFeet}
                value={(target.timeOnFeetMinutes as number) ?? 720}
                onChange={(val) => setTargetValue("timeOnFeetMinutes", val)}
                min={60}
                max={2880}
                step={30}
                formatValue={formatTimeOnFeet}
                theme={theme}
              />
            </View>
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "improve_speed":
    case "improve_pace": {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <CompoundPaceInputRow
              label={fieldsCopy.targetPace}
              value={(target.paceText as string) ?? "5:30"}
              badge={
                goalType === "improve_pace"
                  ? fieldsCopy.requiredLabel
                  : fieldsCopy.optionalLabel
              }
              theme={theme}
              onChangeText={(text) => setTargetValue("paceText", text)}
            />
            <View style={{ marginTop: 12 }}>
              <WheelInputRow
                label={fieldsCopy.distance}
                value={(target.distanceKm as number) ?? 10}
                onChange={(val) => setTargetValue("distanceKm", val)}
                min={1}
                max={50}
                step={1}
                unit="км"
                theme={theme}
              />
            </View>
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <CompoundPaceInputRow
              label={fieldsCopy.currentPace}
              value={(current.paceText as string) ?? "6:00"}
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) => setCurrentValue("paceText", text)}
            />
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "build_endurance":
    case "run_continuously": {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <WheelInputRow
              label={fieldsCopy.continuousDuration}
              value={(target.continuousDurationMinutes as number) ?? 30}
              onChange={(val) => setTargetValue("continuousDurationMinutes", val)}
              min={5}
              max={180}
              step={5}
              formatValue={formatDuration}
              badge={fieldsCopy.requiredLabel}
              theme={theme}
            />
            <View style={{ marginTop: 12 }}>
              <WheelInputRow
                label={fieldsCopy.continuousDistance}
                value={(target.continuousDistanceKm as number) ?? 5}
                onChange={(val) => setTargetValue("continuousDistanceKm", val)}
                min={1}
                max={50}
                step={1}
                unit="км"
                theme={theme}
              />
            </View>
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <WheelInputRow
              label={fieldsCopy.continuousDuration}
              value={(current.continuousDurationMinutes as number) ?? 15}
              onChange={(val) => setCurrentValue("continuousDurationMinutes", val)}
              min={5}
              max={180}
              step={5}
              formatValue={formatDuration}
              badge={fieldsCopy.optionalLabel}
              theme={theme}
            />
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "build_consistency": {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <SegmentedRow
              label={fieldsCopy.targetRunsPerWeek}
              segments={RUNS_PER_WEEK_SEGMENTS}
              value={(target.runsPerWeek as number) ?? 3}
              theme={theme}
              onChange={(value) => setTargetValue("runsPerWeek", value)}
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <SegmentedRow
              label={fieldsCopy.currentRunsPerWeek}
              segments={RUNS_PER_WEEK_SEGMENTS}
              value={(current.runsPerWeek as number) ?? 2}
              theme={theme}
              onChange={(value) => setCurrentValue("runsPerWeek", value)}
            />
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "increase_running_volume": {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <WheelInputRow
              label={fieldsCopy.weeklyVolumeDistance}
              value={(target.weeklyDistanceKm as number) ?? 40}
              onChange={(val) => setTargetValue("weeklyDistanceKm", val)}
              min={5}
              max={150}
              step={1}
              unit="км"
              theme={theme}
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <WheelInputRow
              label={fieldsCopy.weeklyVolumeDistance}
              value={(current.weeklyDistanceKm as number) ?? 25}
              onChange={(val) => setCurrentValue("weeklyDistanceKm", val)}
              min={5}
              max={150}
              step={1}
              unit="км"
              theme={theme}
            />
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "lose_weight": {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <WheelInputRow
              label={fieldsCopy.targetWeight}
              value={(target.weightKg as number) ?? 75}
              onChange={(val) => setTargetValue("weightKg", val)}
              min={40}
              max={180}
              step={0.5}
              unit="кг"
              theme={theme}
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <WheelInputRow
              label={fieldsCopy.currentWeight}
              value={(current.weightKg as number) ?? 82}
              onChange={(val) => setCurrentValue("weightKg", val)}
              min={40}
              max={180}
              step={0.5}
              unit="кг"
              theme={theme}
            />
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "start_running":
    case "return_to_running":
    case "maintain_fitness":
    case "general_health":
    case "improve_aerobic_fitness":
    case "improve_hills": {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <SegmentedRow
              label={fieldsCopy.targetRunsPerWeek}
              segments={RUNS_PER_WEEK_SEGMENTS}
              value={(target.runsPerWeek as number) ?? 3}
              theme={theme}
              onChange={(value) => setTargetValue("runsPerWeek", value)}
            />
            <View style={{ marginTop: 12 }}>
              <WheelInputRow
                label={fieldsCopy.weeklyVolumeDistance}
                value={(target.weeklyDistanceKm as number) ?? 20}
                onChange={(val) => setTargetValue("weeklyDistanceKm", val)}
                min={5}
                max={150}
                step={1}
                unit="км"
                theme={theme}
              />
            </View>
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "complete_challenge": {
      const selectedMetric =
        (target.challengeMetric as GoalChallengeMetric) || "total_distance";
      const selectedPeriod =
        (target.challengePeriod as GoalChallengePeriod) || "this_month";

      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.challengeMetric} theme={theme}>
            <View style={styles.chipWrap}>
              {GOAL_CHALLENGE_METRICS.map((metric) => (
                <OptionChip
                  key={metric}
                  label={
                    challengeMetricsCopy[
                      metric as keyof typeof challengeMetricsCopy
                    ] ?? metric
                  }
                  selected={selectedMetric === metric}
                  theme={theme}
                  onPress={() => setTargetValue("challengeMetric", metric)}
                />
              ))}
            </View>
          </SectionBlock>

          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <WheelInputRow
              label={fieldsCopy.challengeTarget}
              value={(target.challengeTargetValue as number) ?? 100}
              onChange={(val) => setTargetValue("challengeTargetValue", val)}
              min={10}
              max={1000}
              step={10}
              theme={theme}
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.challengePeriod} theme={theme}>
            <View style={styles.chipWrap}>
              {GOAL_CHALLENGE_PERIODS.map((period) => (
                <OptionChip
                  key={period}
                  label={
                    challengePeriodsCopy[
                      period as keyof typeof challengePeriodsCopy
                    ] ?? period
                  }
                  selected={selectedPeriod === period}
                  theme={theme}
                  onPress={() => setTargetValue("challengePeriod", period)}
                />
              ))}
            </View>
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }

    case "custom":
    default: {
      return (
        <View style={styles.formContainer}>
          <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
            <MultilineInputRow
              label={fieldsCopy.customDescriptionLabel}
              value={draft.description ?? ""}
              placeholder={fieldsCopy.customDescriptionPlaceholder}
              badge={fieldsCopy.requiredLabel}
              theme={theme}
              onChangeText={setDescription}
            />
          </SectionBlock>

          {renderTargetDateSection()}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  formContainer: {
    gap: 20,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
