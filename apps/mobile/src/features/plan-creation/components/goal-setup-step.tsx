import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";

import {
  GOAL_CHALLENGE_METRICS,
  GOAL_CHALLENGE_PERIODS,
  GOAL_TYPE_CONFIG,
  LEGACY_RACE_DISTANCE_METERS,
  type AthleteGoalPayloadInput,
  type AthleteGoalType,
  type GoalChallengeMetric,
  type GoalChallengePeriod,
} from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../../locales";
import {
  CounterRow,
  DistanceGoalWidget,
  FormInputRow,
  MultilineInputRow,
  OptionChip,
  SectionBlock,
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

  // Target Date Preset Selector
  const renderTargetDateSection = () => (
    <SectionBlock title={fieldsCopy.targetDate} theme={theme}>
      <View style={styles.chipRow}>
        {[7, 14, 30, 60, 90].map((daysAhead) => {
          const date = new Date();
          date.setDate(date.getDate() + daysAhead);
          const iso = date.toISOString().slice(0, 10);
          const label = date.toLocaleDateString(
            language === "ru" ? "ru-RU" : "en-US",
            { day: "numeric", month: "short" },
          );

          return (
            <OptionChip
              key={daysAhead}
              label={label}
              selected={draft.targetDate === iso}
              theme={theme}
              onPress={() => setTargetDate(draft.targetDate === iso ? undefined : iso)}
            />
          );
        })}
      </View>
    </SectionBlock>
  );

  // Render per-type goal configuration forms
  switch (goalType) {
    case "prepare_for_race":
    case "improve_race_result":
    case "run_new_distance": {
      return (
        <View style={styles.formContainer}>
          <DistanceGoalWidget
            options={RACE_OPTIONS.map((opt) => ({
              value: opt.value,
              label: opt.label,
            }))}
            value={activeRaceDistancePreset}
            unit={creationCopy.common.distanceUnit}
            theme={theme}
            onChange={(preset) => {
              const meters = LEGACY_RACE_DISTANCE_METERS[preset] ?? 10000;
              setTargetValue("distanceMeters", meters);
            }}
          />

          {goalType !== "run_new_distance" ? (
            <SectionBlock title={fieldsCopy.targetSection} theme={theme}>
              <FormInputRow
                label={fieldsCopy.targetTime}
                value={(target.finishTimeText as string) ?? ""}
                placeholder="45:00"
                keyboardType="numbers-and-punctuation"
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
            <FormInputRow
              label={fieldsCopy.currentResult}
              value={(current.finishTimeText as string) ?? ""}
              placeholder="48:30"
              keyboardType="numbers-and-punctuation"
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
            <FormInputRow
              label={fieldsCopy.distance}
              value={target.distanceKm ? String(target.distanceKm) : ""}
              placeholder="30"
              unit="km"
              keyboardType="numeric"
              badge={fieldsCopy.requiredLabel}
              theme={theme}
              onChangeText={(text) => setTargetValue("distanceKm", text ? Number(text) : undefined)}
            />
            <FormInputRow
              label={fieldsCopy.elevationGain}
              value={target.elevationGainMeters ? String(target.elevationGainMeters) : ""}
              placeholder="1500"
              unit="m"
              keyboardType="numeric"
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) =>
                setTargetValue("elevationGainMeters", text ? Number(text) : undefined)
              }
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <FormInputRow
              label={fieldsCopy.continuousDistance}
              value={current.continuousDistanceKm ? String(current.continuousDistanceKm) : ""}
              placeholder="15"
              unit="km"
              keyboardType="numeric"
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) =>
                setCurrentValue("continuousDistanceKm", text ? Number(text) : undefined)
              }
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
            <FormInputRow
              label={fieldsCopy.timeOnFeet}
              value={target.timeOnFeetMinutes ? String(target.timeOnFeetMinutes) : ""}
              placeholder="720"
              unit="min"
              keyboardType="numeric"
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) =>
                setTargetValue("timeOnFeetMinutes", text ? Number(text) : undefined)
              }
            />
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
            <FormInputRow
              label={fieldsCopy.targetPace}
              value={(target.paceText as string) ?? ""}
              placeholder="5:30"
              keyboardType="numbers-and-punctuation"
              badge={
                goalType === "improve_pace"
                  ? fieldsCopy.requiredLabel
                  : fieldsCopy.optionalLabel
              }
              theme={theme}
              onChangeText={(text) => setTargetValue("paceText", text)}
            />
            <FormInputRow
              label={fieldsCopy.distance}
              value={target.distanceKm ? String(target.distanceKm) : ""}
              placeholder="10"
              unit="km"
              keyboardType="numeric"
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) => setTargetValue("distanceKm", text ? Number(text) : undefined)}
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <FormInputRow
              label={fieldsCopy.currentPace}
              value={(current.paceText as string) ?? ""}
              placeholder="6:00"
              keyboardType="numbers-and-punctuation"
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
            <FormInputRow
              label={fieldsCopy.continuousDuration}
              value={target.continuousDurationMinutes ? String(target.continuousDurationMinutes) : ""}
              placeholder="30"
              unit="min"
              keyboardType="numeric"
              badge={fieldsCopy.requiredLabel}
              theme={theme}
              onChangeText={(text) =>
                setTargetValue("continuousDurationMinutes", text ? Number(text) : undefined)
              }
            />
            <FormInputRow
              label={fieldsCopy.continuousDistance}
              value={target.continuousDistanceKm ? String(target.continuousDistanceKm) : ""}
              placeholder="5"
              unit="km"
              keyboardType="numeric"
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) =>
                setTargetValue("continuousDistanceKm", text ? Number(text) : undefined)
              }
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <FormInputRow
              label={fieldsCopy.continuousDuration}
              value={current.continuousDurationMinutes ? String(current.continuousDurationMinutes) : ""}
              placeholder="15"
              unit="min"
              keyboardType="numeric"
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) =>
                setCurrentValue("continuousDurationMinutes", text ? Number(text) : undefined)
              }
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
            <CounterRow
              label={fieldsCopy.targetRunsPerWeek}
              value={(target.runsPerWeek as number) ?? 3}
              min={1}
              max={7}
              theme={theme}
              onChange={(value) => setTargetValue("runsPerWeek", value)}
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <CounterRow
              label={fieldsCopy.currentRunsPerWeek}
              value={(current.runsPerWeek as number) ?? 2}
              min={1}
              max={7}
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
            <FormInputRow
              label={fieldsCopy.weeklyVolumeDistance}
              value={target.weeklyDistanceKm ? String(target.weeklyDistanceKm) : ""}
              placeholder="40"
              unit="km"
              keyboardType="numeric"
              badge={fieldsCopy.requiredLabel}
              theme={theme}
              onChangeText={(text) =>
                setTargetValue("weeklyDistanceKm", text ? Number(text) : undefined)
              }
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <FormInputRow
              label={fieldsCopy.weeklyVolumeDistance}
              value={current.weeklyDistanceKm ? String(current.weeklyDistanceKm) : ""}
              placeholder="25"
              unit="km"
              keyboardType="numeric"
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) =>
                setCurrentValue("weeklyDistanceKm", text ? Number(text) : undefined)
              }
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
            <FormInputRow
              label={fieldsCopy.targetWeight}
              value={target.weightKg ? String(target.weightKg) : ""}
              placeholder="75"
              unit="kg"
              keyboardType="decimal-pad"
              badge={fieldsCopy.requiredLabel}
              theme={theme}
              onChangeText={(text) => setTargetValue("weightKg", text ? Number(text) : undefined)}
            />
          </SectionBlock>

          <SectionBlock title={fieldsCopy.currentSection} theme={theme}>
            <FormInputRow
              label={fieldsCopy.currentWeight}
              value={current.weightKg ? String(current.weightKg) : ""}
              placeholder="82"
              unit="kg"
              keyboardType="decimal-pad"
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) => setCurrentValue("weightKg", text ? Number(text) : undefined)}
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
            <CounterRow
              label={fieldsCopy.targetRunsPerWeek}
              value={(target.runsPerWeek as number) ?? 3}
              min={1}
              max={7}
              theme={theme}
              onChange={(value) => setTargetValue("runsPerWeek", value)}
            />
            <FormInputRow
              label={fieldsCopy.weeklyVolumeDistance}
              value={target.weeklyDistanceKm ? String(target.weeklyDistanceKm) : ""}
              placeholder="20"
              unit="km"
              keyboardType="numeric"
              badge={fieldsCopy.optionalLabel}
              theme={theme}
              onChangeText={(text) =>
                setTargetValue("weeklyDistanceKm", text ? Number(text) : undefined)
              }
            />
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
            <FormInputRow
              label={fieldsCopy.challengeTarget}
              value={target.challengeTargetValue ? String(target.challengeTargetValue) : ""}
              placeholder="100"
              keyboardType="numeric"
              badge={fieldsCopy.requiredLabel}
              theme={theme}
              onChangeText={(text) =>
                setTargetValue("challengeTargetValue", text ? Number(text) : undefined)
              }
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
