import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type MetricsSnapshot } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Ruler, Segmented } from "@trefix/ui-native";

import {
  fillTemplate,
  formatPace,
  formatShortDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { SheetBlock } from "../../../shared/ui/bottom-sheet";
import {
  type MetricsErrors,
  type MetricsField,
  type MetricsForm,
  type MetricsSources,
  type ThresholdMode,
} from "../../plans/lib/plan-draft";
import { todayIso } from "../../plans/lib/plan-dates";
import {
  RACE_TIME_RANGES,
  formatTargetTime,
  type RaceDistancePreset,
} from "../plan-creation-types";
import {
  AddLink,
  FieldError,
  OptionChip,
  SectionBlock,
  TimeRuler,
  type TimeRulerRange,
} from "./plan-creation-ui";

type Props = {
  form: MetricsForm;
  onChange: (updater: (current: MetricsForm) => MetricsForm) => void;
  sources: MetricsSources;
  /** Snapshot of the source plan; shown as "Last time" when `showPrevious`. */
  previous?: MetricsSnapshot | null;
  showPrevious: boolean;
  errors: MetricsErrors;
  /** Suggests connecting Strava when no value came from it. */
  onConnectStrava?: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Threshold pace range accepted by the server (2:30 – 10:00 /km). */
const THRESHOLD_RANGE: TimeRulerRange = {
  min: 150,
  max: 600,
  step: 5,
  majorEvery: 30,
  labelEvery: 60,
};

const RESULT_DISTANCES: RaceDistancePreset[] = [
  "5k",
  "10k",
  "half_marathon",
  "marathon",
];

const DEFAULTS = {
  thresholdPaceSecondsPerKm: 5 * 60,
  weeklyMileageKm: 30,
  longestRunKm: 12,
  maxHeartRate: 185,
  restingHeartRate: 55,
} as const;

/**
 * "Current form" step: threshold pace (or a recent result), weekly volume,
 * longest run and heart rate. Values are prefilled from the server estimate;
 * a value without a source stays empty and the previous plan value is only
 * shown as a hint, never substituted.
 */
export function CurrentMetricsStep({
  form,
  onChange,
  sources,
  previous,
  showPrevious,
  errors,
  onConnectStrava,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const metricsCopy = copy.plans.metrics;
  const units = copy.plan.creation.units;

  const previousText = (field: MetricsField): string | null => {
    if (!showPrevious || !previous) return null;
    if (field === "recentResult") {
      const result = previous.recentResult;
      if (!result) return null;
      const distance =
        (metricsCopy.distances as Record<string, string>)[result.distance] ??
        result.distance;
      return `${distance} ${formatTargetTime(result.timeSeconds)}`;
    }
    const value = previous[field];
    if (value === null || value === undefined) return null;
    if (field === "thresholdPaceSecondsPerKm")
      return `${formatPace(value)} ${metricsCopy.paceUnit}`;
    if (field === "maxHeartRate" || field === "restingHeartRate")
      return `${value} ${metricsCopy.bpm}`;
    return `${value} ${units.km}`;
  };

  const caption = (field: MetricsField, isSet: boolean): string | undefined => {
    const parts: string[] = [];
    const previousValue = previousText(field);
    if (previousValue) parts.push(`${metricsCopy.previous}: ${previousValue}`);
    const source = sources[field];
    if (isSet && source && source !== "none")
      parts.push(metricsCopy.source[source]);
    return parts.length > 0 ? parts.join(" · ") : undefined;
  };

  const setField = <K extends keyof MetricsForm>(
    field: K,
    value: MetricsForm[K],
  ) => onChange((current) => ({ ...current, [field]: value }));

  const numericDefault = (
    field: Exclude<MetricsField, "recentResult">,
  ): number => {
    const value = previous?.[field];
    return typeof value === "number" ? value : DEFAULTS[field];
  };

  const errorText = (field: MetricsField): string | null => {
    const error = errors[field];
    if (error === "required") return metricsCopy.required;
    if (error === "outOfRange") {
      const range = RANGE_TEXT[field as keyof typeof RANGE_TEXT];
      return range
        ? fillTemplate(metricsCopy.outOfRange, range)
        : metricsCopy.invalid;
    }
    return null;
  };

  const showStravaHint =
    onConnectStrava &&
    !Object.values(sources).some((source) => source === "strava");

  return (
    <>
      {showStravaHint ? (
        <SheetBlock theme={theme}>
          <Pressable
            accessibilityRole="link"
            onPress={onConnectStrava}
            hitSlop={8}
          >
            <Text
              style={[
                styles.hint,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            >
              {metricsCopy.connectStrava}
            </Text>
          </Pressable>
        </SheetBlock>
      ) : null}

      <SectionBlock
        title={metricsCopy.threshold}
        description={caption(
          form.thresholdMode === "pace"
            ? "thresholdPaceSecondsPerKm"
            : "recentResult",
          true,
        )}
        theme={theme}
      >
        <Segmented<ThresholdMode>
          segments={[
            { label: metricsCopy.thresholdModePace, value: "pace" },
            { label: metricsCopy.thresholdModeResult, value: "result" },
          ]}
          value={form.thresholdMode}
          onChange={(mode) => setField("thresholdMode", mode)}
          accessibilityLabel={metricsCopy.threshold}
          theme={theme}
          themeMode={themeMode}
        />
        {form.thresholdMode === "pace" ? (
          <MetricValue
            isSet={form.thresholdPaceSecondsPerKm !== null}
            onSet={() =>
              setField(
                "thresholdPaceSecondsPerKm",
                numericDefault("thresholdPaceSecondsPerKm"),
              )
            }
            onClear={() => setField("thresholdPaceSecondsPerKm", null)}
            error={errorText("thresholdPaceSecondsPerKm")}
            copy={copy}
            theme={theme}
          >
            <TimeRuler
              seconds={
                form.thresholdPaceSecondsPerKm ??
                DEFAULTS.thresholdPaceSecondsPerKm
              }
              onChange={(seconds) =>
                setField("thresholdPaceSecondsPerKm", seconds)
              }
              range={THRESHOLD_RANGE}
              unit={metricsCopy.paceUnit}
              accessibilityLabel={metricsCopy.threshold}
              theme={theme}
              themeMode={themeMode}
            />
          </MetricValue>
        ) : (
          <MetricValue
            isSet={form.recentResult !== null}
            onSet={() =>
              setField("recentResult", {
                distance: "10k",
                timeSeconds: RACE_TIME_RANGES["10k"].defaultCurrent,
                date: todayIso(),
              })
            }
            onClear={() => setField("recentResult", null)}
            error={errorText("recentResult")}
            copy={copy}
            theme={theme}
          >
            {form.recentResult ? (
              <View style={styles.resultBlock}>
                <View style={styles.chips}>
                  {RESULT_DISTANCES.map((distance) => (
                    <OptionChip
                      key={distance}
                      label={metricsCopy.distances[distance]}
                      selected={form.recentResult?.distance === distance}
                      theme={theme}
                      themeMode={themeMode}
                      onPress={() =>
                        onChange((current) => ({
                          ...current,
                          recentResult: {
                            distance,
                            timeSeconds:
                              RACE_TIME_RANGES[distance].defaultCurrent,
                            date: current.recentResult?.date || todayIso(),
                          },
                        }))
                      }
                    />
                  ))}
                </View>
                <TimeRuler
                  seconds={form.recentResult.timeSeconds}
                  onChange={(seconds) =>
                    onChange((current) =>
                      current.recentResult
                        ? {
                            ...current,
                            recentResult: {
                              ...current.recentResult,
                              timeSeconds: seconds,
                            },
                          }
                        : current,
                    )
                  }
                  range={
                    RACE_TIME_RANGES[
                      (form.recentResult.distance as RaceDistancePreset) ??
                        "10k"
                    ] ?? RACE_TIME_RANGES["10k"]
                  }
                  accessibilityLabel={metricsCopy.resultTime}
                  theme={theme}
                  themeMode={themeMode}
                />
                {form.recentResult.date ? (
                  <Text
                    style={[
                      styles.hint,
                      {
                        color: theme.color.mutedForeground,
                        fontFamily: theme.typography.fontFamily.sans.regular,
                      },
                    ]}
                  >
                    {`${metricsCopy.resultDate}: ${formatShortDate(form.recentResult.date, language)}`}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </MetricValue>
        )}
      </SectionBlock>

      <SectionBlock
        title={metricsCopy.weeklyKm}
        description={caption("weeklyMileageKm", form.weeklyMileageKm !== null)}
        theme={theme}
      >
        <MetricValue
          isSet={form.weeklyMileageKm !== null}
          onSet={() =>
            setField("weeklyMileageKm", numericDefault("weeklyMileageKm"))
          }
          error={errorText("weeklyMileageKm")}
          copy={copy}
          theme={theme}
        >
          <Ruler
            value={form.weeklyMileageKm ?? DEFAULTS.weeklyMileageKm}
            onChange={(value) => setField("weeklyMileageKm", value)}
            min={0}
            max={200}
            step={1}
            majorEvery={5}
            labelEvery={10}
            unit={units.km}
            accessibilityLabel={metricsCopy.weeklyKm}
            theme={theme}
            themeMode={themeMode}
          />
        </MetricValue>
      </SectionBlock>

      <SectionBlock
        title={metricsCopy.longestRun}
        description={caption("longestRunKm", form.longestRunKm !== null)}
        theme={theme}
      >
        <MetricValue
          isSet={form.longestRunKm !== null}
          onSet={() => setField("longestRunKm", numericDefault("longestRunKm"))}
          error={errorText("longestRunKm")}
          copy={copy}
          theme={theme}
        >
          <Ruler
            value={form.longestRunKm ?? DEFAULTS.longestRunKm}
            onChange={(value) => setField("longestRunKm", value)}
            min={0}
            max={100}
            step={0.5}
            majorEvery={5}
            labelEvery={5}
            tickSpacing={10}
            unit={units.km}
            accessibilityLabel={metricsCopy.longestRun}
            theme={theme}
            themeMode={themeMode}
          />
        </MetricValue>
      </SectionBlock>

      <SectionBlock
        title={`${metricsCopy.hrMax} · ${metricsCopy.optional}`}
        description={caption("maxHeartRate", form.maxHeartRate !== null)}
        theme={theme}
      >
        <MetricValue
          isSet={form.maxHeartRate !== null}
          onSet={() => setField("maxHeartRate", numericDefault("maxHeartRate"))}
          onClear={() => setField("maxHeartRate", null)}
          error={errorText("maxHeartRate")}
          copy={copy}
          theme={theme}
        >
          <Ruler
            value={form.maxHeartRate ?? DEFAULTS.maxHeartRate}
            onChange={(value) => setField("maxHeartRate", value)}
            min={120}
            max={230}
            step={1}
            majorEvery={5}
            labelEvery={10}
            unit={metricsCopy.bpm}
            accessibilityLabel={metricsCopy.hrMax}
            theme={theme}
            themeMode={themeMode}
          />
        </MetricValue>
      </SectionBlock>

      <SectionBlock
        title={`${metricsCopy.hrRest} · ${metricsCopy.optional}`}
        description={caption(
          "restingHeartRate",
          form.restingHeartRate !== null,
        )}
        theme={theme}
      >
        <MetricValue
          isSet={form.restingHeartRate !== null}
          onSet={() =>
            setField("restingHeartRate", numericDefault("restingHeartRate"))
          }
          onClear={() => setField("restingHeartRate", null)}
          error={errorText("restingHeartRate")}
          copy={copy}
          theme={theme}
        >
          <Ruler
            value={form.restingHeartRate ?? DEFAULTS.restingHeartRate}
            onChange={(value) => setField("restingHeartRate", value)}
            min={30}
            max={100}
            step={1}
            majorEvery={5}
            labelEvery={10}
            unit={metricsCopy.bpm}
            accessibilityLabel={metricsCopy.hrRest}
            theme={theme}
            themeMode={themeMode}
          />
        </MetricValue>
      </SectionBlock>
    </>
  );
}

const RANGE_TEXT = {
  thresholdPaceSecondsPerKm: { min: "2:30", max: "10:00" },
  weeklyMileageKm: { min: 0, max: 300 },
  longestRunKm: { min: 0, max: 200 },
  maxHeartRate: { min: 120, max: 230 },
  restingHeartRate: { min: 30, max: 100 },
};

/** A metric control that stays collapsed ("Enter manually") until the user sets a value. */
function MetricValue({
  isSet,
  onSet,
  onClear,
  error,
  copy,
  theme,
  children,
}: {
  isSet: boolean;
  onSet: () => void;
  onClear?: () => void;
  error: string | null;
  copy: MainCopy;
  theme: ThemeTokens;
  children: ReactNode;
}) {
  const metricsCopy = copy.plans.metrics;
  return (
    <View style={styles.value}>
      {isSet ? (
        children
      ) : (
        <AddLink
          label={metricsCopy.placeholder}
          onPress={onSet}
          theme={theme}
        />
      )}
      {isSet && onClear ? (
        <Pressable
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClear}
          style={styles.clear}
        >
          <Text
            style={[
              styles.hint,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {metricsCopy.clearValue}
          </Text>
        </Pressable>
      ) : null}
      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  value: {
    gap: 8,
  },
  resultBlock: {
    gap: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  clear: {
    alignSelf: "center",
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
