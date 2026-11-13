import React from "react";
import { Text, View } from "react-native";
import { Activity, Clock, Heart, Award, Sparkles } from "lucide-react-native";

import { type TrainingWorkout } from "@trefix/api-client";
import { type ThemeTokens } from "@trefix/tokens";
import { GlassInput } from "../../../../shared/ui/glass-input";
import { SheetSectionLabel } from "../../../../shared/ui/bottom-sheet";
import { type MainCopy } from "../../../../locales";
import { WorkoutSourceRow } from "../../../health-sync/components/workout-source-row";
import { RecordingMap } from "../../../tracker/map/recording-map";
import { styles } from "./workout-detail-sheet.styles";
import { type useWorkoutCompletion } from "../../hooks/use-workout-completion";
import { type Formatter } from "../../../profile/lib/profile-format";

type ResultProps = {
  workout: TrainingWorkout;
  actualData: Record<string, unknown>;
  analysisData: TrainingWorkout["analysis"];
  theme: ThemeTokens;
  copy: MainCopy;
  format: Formatter;
};

/** What was actually run: map, distance, time, heart rate, effort and the analysis. */
export function WorkoutResultSection({
  workout,
  actualData,
  analysisData,
  theme,
  copy,
  format,
}: ResultProps) {
  const locale = copy.today.detailSheet;
  return (
    <View style={styles.section}>
      <SheetSectionLabel text={locale.result} theme={theme} />
      <RecordingMap workoutId={workout.id} theme={theme} units={format.units} />

      <View style={styles.statsGrid}>
        {actualData.actualDistanceKm ? (
          <View
            style={[
              styles.statBox,
              {
                backgroundColor: theme.color.surface,
                borderColor: theme.color.border,
              },
            ]}
          >
            <Activity color={theme.color.primary} size={18} />
            <View>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.extrabold,
                  },
                ]}
              >
                {String(actualData.actualDistanceKm)}{" "}
                {copy.today.goalSheet.distanceUnit}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {locale.actualDistance}
              </Text>
            </View>
          </View>
        ) : null}

        {actualData.actualDurationMinutes ? (
          <View
            style={[
              styles.statBox,
              {
                backgroundColor: theme.color.surface,
                borderColor: theme.color.border,
              },
            ]}
          >
            <Clock color={theme.color.primary} size={18} />
            <View>
              <Text
                style={[
                  styles.statValue,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.extrabold,
                  },
                ]}
              >
                {String(actualData.actualDurationMinutes)}{" "}
                {copy.today.goalSheet.durationUnit}
              </Text>
              <Text
                style={[
                  styles.statLabel,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {locale.actualDuration}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {actualData.actualAverageHeartRate ? (
        <View style={styles.infoRow}>
          <Heart color={theme.color.mutedForeground} size={16} />
          <Text
            style={[
              styles.infoText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {locale.avgHeartRate}: {String(actualData.actualAverageHeartRate)}{" "}
            {copy.profile.unitLabels.bpm}
          </Text>
        </View>
      ) : null}

      <WorkoutSourceRow workoutId={workout.id} copy={copy} theme={theme} />

      {actualData.rpe ? (
        <View style={styles.infoRow}>
          <Award color={theme.color.mutedForeground} size={16} />
          <Text
            style={[
              styles.infoText,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {locale.rpeRating}: {String(actualData.rpe)} / 10
          </Text>
        </View>
      ) : null}

      {analysisData ? (
        <View
          style={[
            styles.analysisCard,
            {
              backgroundColor: theme.color.surface,
              borderColor: theme.color.border,
            },
          ]}
        >
          <Sparkles color={theme.color.ai} size={18} />
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.analysisTitle,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {locale.analysisTitle}:{" "}
              {Math.round(analysisData.completion * 100)}%
            </Text>
            <Text
              style={[
                styles.analysisBody,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {locale.loadLabel}: {Math.round(analysisData.load)} TRIMP (
              {locale.plannedLoad}: {Math.round(analysisData.expectedLoad)})
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

type CompletionFormProps = {
  completion: ReturnType<typeof useWorkoutCompletion>;
  theme: ThemeTokens;
  copy: MainCopy;
};

/** Manual entry of the actual result. */
export function WorkoutCompletionForm({
  completion,
  theme,
  copy,
}: CompletionFormProps) {
  const locale = copy.today.detailSheet;
  return (
    <View style={styles.completingForm}>
      <SheetSectionLabel text={locale.completingHeader} theme={theme} />

      <View style={styles.metricsRow}>
        <View style={{ flex: 1 }}>
          <GlassInput
            keyboardType="numeric"
            label={copy.today.addSheet.actualDistance}
            onChangeText={completion.setField("distanceKm")}
            theme={theme}
            value={completion.form.distanceKm}
          />
        </View>
        <View style={{ flex: 1 }}>
          <GlassInput
            keyboardType="numeric"
            label={copy.today.addSheet.actualDuration}
            onChangeText={completion.setField("durationMinutes")}
            theme={theme}
            value={completion.form.durationMinutes}
          />
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View style={{ flex: 1 }}>
          <GlassInput
            keyboardType="numeric"
            label={copy.today.addSheet.heartRate}
            onChangeText={completion.setField("heartRate")}
            placeholder="145"
            theme={theme}
            value={completion.form.heartRate}
          />
        </View>
        <View style={{ flex: 1 }}>
          <GlassInput
            keyboardType="numeric"
            label={copy.today.addSheet.rpe}
            onChangeText={completion.setField("rpe")}
            placeholder="6"
            theme={theme}
            value={completion.form.rpe}
          />
        </View>
      </View>

      <GlassInput
        label={copy.today.addSheet.notes}
        multiline
        onChangeText={completion.setField("notes")}
        placeholder={copy.today.addSheet.notesPlaceholder}
        theme={theme}
        value={completion.form.notes}
      />
    </View>
  );
}
