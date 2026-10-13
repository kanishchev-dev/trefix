import { type ReactNode } from "react";
import { Text, View } from "react-native";

import {
  type ManualPlanPreviewWorkout,
  type PlanDiff,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { Card } from "../../../shared/ui/card";
import { styles } from "../plan-preview-screen.styles";
import { type PreviewWeek, type PreviewWeekView } from "../preview-week";

type RemovedWorkout = PlanDiff["weeks"][number]["workouts"][number];

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  week: PreviewWeek;
  view: PreviewWeekView;
  /** Workouts the server dropped in a rebuild; shown as removed. */
  serverRemoved: RemovedWorkout[];
  renderWorkout: (
    workout: ManualPlanPreviewWorkout,
    index: number,
  ) => ReactNode;
  onAddWorkout: () => void;
};

/** One week of the previewed plan: phase, totals, workouts and "add workout". */
export function PreviewWeekCard({
  theme,
  themeMode,
  copy,
  week,
  view,
  serverRemoved,
  renderWorkout,
  onAddWorkout,
}: Props) {
  const creationCopy = copy.plan.creation;
  const previewCopy = creationCopy.preview;
  const { regular, medium } = theme.typography.fontFamily.sans;
  const phaseKey = String(
    week.phase,
  ).toUpperCase() as keyof typeof previewCopy.phases;
  const phaseLabel = previewCopy.phases[phaseKey] ?? week.phase;
  const weekTitle =
    previewCopy.phaseTitles[phaseKey] ?? previewCopy.phaseTitles.BASE;

  return (
    <Card size="sm" theme={theme} themeMode={themeMode} style={styles.weekCard}>
      <View style={styles.weekHeader}>
        <Text
          style={[
            styles.weekLabel,
            { color: theme.color.mutedForeground, fontFamily: medium },
          ]}
        >
          {previewCopy.weekLabel.replace("{{number}}", String(week.weekNumber))}{" "}
          · {phaseLabel}
        </Text>
        <Text
          style={[
            styles.weekTitle,
            { color: theme.color.foreground, fontFamily: medium },
          ]}
        >
          {weekTitle}
        </Text>
        <Text
          style={[
            styles.weekMeta,
            { color: theme.color.mutedForeground, fontFamily: regular },
          ]}
        >
          {previewCopy.weekSummary
            .replace("{{workouts}}", String(view.workouts.length))
            .replace("{{distance}}", String(Math.round(view.distanceKm)))}
        </Text>
      </View>

      <View
        style={[styles.workoutList, { borderTopColor: theme.color.border }]}
      >
        {view.workouts.map(renderWorkout)}
        {serverRemoved.map((workout) => (
          <Text
            key={`removed-${workout.key}`}
            accessibilityLabel={copy.plans.diff.removedBadge}
            style={[
              styles.removedRow,
              { color: theme.color.mutedForeground, fontFamily: regular },
            ]}
          >
            {`− ${copy.plans.diff.removedBadge}`}
          </Text>
        ))}
      </View>

      <SheetButton
        label={creationCopy.workoutEditor.addButton}
        variant="secondary"
        onPress={onAddWorkout}
        theme={theme}
        themeMode={themeMode}
        style={styles.addButton}
      />
    </Card>
  );
}
