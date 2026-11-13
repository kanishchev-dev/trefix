import { type ReactNode } from "react";
import { View } from "react-native";
import {
  GOAL_CHALLENGE_METRICS,
  GOAL_CHALLENGE_PERIODS,
  type GoalChallengeMetric,
  type GoalChallengePeriod,
} from "@trefix/api-client";
import { MultilineInputRow, OptionChip } from "../plan-creation-ui";
import { styles } from "../goal-setup-step.styles";
import { CHALLENGE_SCALES } from "../goal-setup-helpers";
import { type GoalFormKit } from "../use-goal-form-kit";

/** Goal forms of the "challenge" group; `null` for goal types it does not cover. */
export function renderChallengeGoalForm(
  goalType: string,
  kit: GoalFormKit,
): ReactNode {
  const {
    f,
    units,
    challengeMetricsCopy,
    challengePeriodsCopy,
    target,
    update,
    setter,
    read,
    plainRuler,
    field,
    goalSection,
    dateSection,
    screen,
    draft,
    theme,
    onChangeDraft,
  } = kit;
  switch (goalType) {
    case "complete_challenge": {
      const metric =
        (target.challengeMetric as GoalChallengeMetric) || "total_distance";
      const period =
        (target.challengePeriod as GoalChallengePeriod) || "this_month";
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
                  label={
                    challengeMetricsCopy[
                      item as keyof typeof challengeMetricsCopy
                    ] ?? item
                  }
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
            plainRuler(
              read("target", "challengeTargetValue", scale.fallback),
              setter("target", "challengeTargetValue"),
              {
                min: scale.min,
                max: scale.max,
                step: scale.step,
                unit: challengeUnit,
              },
              f.challengeTarget,
            ),
          ),
          field(
            f.challengePeriod,
            <View style={styles.chipWrap}>
              {GOAL_CHALLENGE_PERIODS.map((item) => (
                <OptionChip
                  key={item}
                  label={
                    challengePeriodsCopy[
                      item as keyof typeof challengePeriodsCopy
                    ] ?? item
                  }
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
            onChangeText={(description) =>
              onChangeDraft((prev) => ({ ...prev, description }))
            }
          />,
        ),
        dateSection,
      );
    }
  }
}
