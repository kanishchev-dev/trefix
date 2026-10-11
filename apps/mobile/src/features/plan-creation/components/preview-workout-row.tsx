import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";
import {
  type ManualPlanPreviewWorkout,
  type PlanDiff,
} from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import { styles } from "../plan-preview-screen.styles";
import { roundKm } from "./workout-edit-form";

type Props = {
  workout: ManualPlanPreviewWorkout;
  index: number;
  theme: ThemeTokens;
  copy: MainCopy;
  shortDayNames: readonly string[];
  /** Changed locally (override or addition). */
  isEdited: boolean;
  /** What the server changed in this workout when the plan was rebased. */
  serverChange?: PlanDiff["weeks"][number]["workouts"][number];
  onPress: () => void;
};

/** One workout row of the plan preview, with local edits and server changes marked. */
export function PreviewWorkoutRow({
  workout,
  index,
  theme,
  copy,
  shortDayNames,
  isEdited,
  serverChange,
  onPress,
}: Props) {
  const creationCopy = copy.plan.creation;
  const previewCopy = creationCopy.preview;
  const regular = theme.typography.fontFamily.sans.regular;
  const medium = theme.typography.fontFamily.sans.medium;
  const typeLabel =
    creationCopy.workoutTypes[
      workout.type as keyof typeof creationCopy.workoutTypes
    ] ?? workout.type;
  const previousDistance = serverChange?.fields?.distanceKm?.[0];
  const previousDuration = serverChange?.fields?.durationMinutes?.[0];
  const distanceLabel = `${roundKm(workout.distanceKm)} ${creationCopy.units.km}`;
  const durationLabel = `${workout.durationMinutes} ${creationCopy.units.min}`;
  const meta = [distanceLabel, durationLabel];
  if (isEdited) meta.push(previewCopy.edited);
  const spokenDiff = [
    typeof previousDistance === "number"
      ? fillTemplate(copy.plans.diff.wasNow, {
          before: `${roundKm(previousDistance)} ${creationCopy.units.km}`,
          after: distanceLabel,
        })
      : null,
    typeof previousDuration === "number"
      ? fillTemplate(copy.plans.diff.wasNow, {
          before: `${previousDuration} ${creationCopy.units.min}`,
          after: durationLabel,
        })
      : null,
    serverChange?.change === "added" ? copy.plans.diff.addedBadge : null,
  ].filter(Boolean);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[
        `${shortDayNames[workout.dayOfWeek]}, ${typeLabel}, ${meta.join(", ")}`,
        ...spokenDiff,
      ].join(". ")}
      onPress={onPress}
      style={({ pressed }) => [
        styles.workoutRow,
        index > 0 && {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.color.border,
        },
        pressed && styles.rowPressed,
      ]}
    >
      <Text
        style={[
          styles.workoutDay,
          { color: theme.color.mutedForeground, fontFamily: medium },
        ]}
      >
        {shortDayNames[workout.dayOfWeek]}
      </Text>
      <View style={styles.workoutTextGroup}>
        <Text
          style={[
            styles.workoutType,
            { color: theme.color.foreground, fontFamily: medium },
          ]}
        >
          {typeLabel}
          {serverChange?.change === "added" ? (
            <Text
              style={{
                color: theme.color.mutedForeground,
                fontFamily: regular,
              }}
            >{` · ${copy.plans.diff.addedBadge}`}</Text>
          ) : null}
        </Text>
        <Text
          style={[
            styles.workoutMeta,
            { color: theme.color.mutedForeground, fontFamily: regular },
          ]}
        >
          {typeof previousDistance === "number" && !isEdited ? (
            <Text
              style={styles.strike}
            >{`${roundKm(previousDistance)} ${creationCopy.units.km}`}</Text>
          ) : null}
          {typeof previousDistance === "number" && !isEdited ? " " : ""}
          {meta.join(" · ")}
        </Text>
      </View>
      <ChevronRight color={theme.color.mutedForeground} size={18} />
    </Pressable>
  );
}
