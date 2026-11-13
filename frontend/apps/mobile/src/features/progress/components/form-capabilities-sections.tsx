import { Text, View } from "react-native";
import { type CapabilityType, type ProgressOverview } from "@trefix/api-client";
import { fillTemplate, pluralize } from "../../../locales";
import { formatPace } from "../../../shared/lib/units";
import { formatPaceDelta } from "../lib/progress-format";
import { styles } from "./progress-sections.styles";
import {
  fontOf,
  SectionHeader,
  Block,
  Muted,
  BigValue,
  MetricTile,
  type Common,
} from "./progress-primitives";

export function FormSection({
  overview,
  onOpenMetric,
  onOpenHeart,
  ...common
}: Common & {
  overview: ProgressOverview;
  onOpenMetric: (metric: "threshold_pace" | "vo2max") => void;
  onOpenHeart: () => void;
}) {
  const { copy, language, theme, format } = common;
  const f = copy.progress.form;
  const unlock = overview.metricsUnlock;

  if (!overview.form) {
    const left = Math.max(0, unlock.required - unlock.completed);
    return (
      <View style={styles.section}>
        <SectionHeader
          title={copy.progress.sections.formMetrics}
          theme={theme}
        />
        <Block gap={12}>
          <Text
            style={[
              styles.body,
              {
                color: theme.color.foreground,
                fontFamily: fontOf(theme, "medium"),
              },
            ]}
          >
            {pluralize(f.locked, left, language)}
          </Text>
          <View style={styles.segments}>
            {Array.from({ length: unlock.required }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.segment,
                  {
                    backgroundColor:
                      index < unlock.completed
                        ? theme.color.foreground
                        : theme.color.iconSurface,
                  },
                ]}
              />
            ))}
          </View>
          <Muted theme={theme}>{f.lockedDescription}</Muted>
        </Block>
      </View>
    );
  }

  const form = overview.form;
  const change = form.fitnessChange;
  const metric = overview.metrics;
  const paceChange = metric.thresholdPace?.change ?? null;

  return (
    <View style={styles.section}>
      <SectionHeader title={copy.progress.sections.formMetrics} theme={theme} />
      <Block>
        <View style={styles.rowBetween}>
          <Text
            style={[
              styles.title,
              {
                color: theme.color.foreground,
                fontFamily: fontOf(theme, "medium"),
              },
            ]}
          >
            {f.title}
          </Text>
          <Muted theme={theme}>
            {change > 0 ? "↑ +" : change < 0 ? "↓ " : ""}
            {change !== 0 ? `${change} ` : ""}
            {fillTemplate(f.change, { weeks: form.changeWeeks })}
          </Muted>
        </View>
        <View style={styles.grid3}>
          {(
            [
              [f.fitness, form.fitness],
              [f.fatigue, form.fatigue],
              [f.form, form.form],
            ] as const
          ).map(([label, value]) => (
            <View key={label} style={styles.flexText}>
              <Muted theme={theme}>{label}</Muted>
              <BigValue theme={theme} size={20}>
                {value < 0 ? `−${Math.abs(value)}` : value}
              </BigValue>
            </View>
          ))}
        </View>
        <View style={styles.grid3}>
          <MetricTile
            theme={theme}
            label={f.thresholdPace}
            value={
              metric.thresholdPace
                ? formatPace(
                    metric.thresholdPace.value,
                    format.units,
                    format.labels,
                  ).split(" ")[0]
                : "—"
            }
            hint={
              paceChange !== null && paceChange !== 0
                ? `${paceChange < 0 ? "↑" : "↓"} ${formatPaceDelta(paceChange, format.units)}`
                : undefined
            }
            onPress={() => onOpenMetric("threshold_pace")}
          />
          <MetricTile
            theme={theme}
            label={f.vo2max}
            value={metric.vo2max ? String(metric.vo2max.value) : "—"}
            hint={
              metric.vo2max?.change
                ? `${metric.vo2max.change > 0 ? "↑ +" : "↓ "}${metric.vo2max.change}`
                : undefined
            }
            onPress={() => onOpenMetric("vo2max")}
          />
          <MetricTile
            theme={theme}
            label={f.thresholdHr}
            value={
              metric.thresholdHeartRate
                ? `${metric.thresholdHeartRate.estimated ? "~" : ""}${metric.thresholdHeartRate.value}`
                : "—"
            }
            hint={
              metric.thresholdHeartRate?.estimated ? f.estimate : f.fromProfile
            }
            onPress={onOpenHeart}
          />
        </View>
      </Block>
    </View>
  );
}

export function CapabilitiesSection({
  overview,
  ...common
}: Common & { overview: ProgressOverview }) {
  const { copy, theme } = common;
  if (!overview.capabilities) return null;
  const arrow = { up: "↑", down: "↓", stable: "→" } as const;
  return (
    <View style={styles.section}>
      <SectionHeader
        title={copy.progress.sections.capabilities}
        theme={theme}
      />
      <View>
        {overview.capabilities.map((capability) => (
          <View
            key={capability.type}
            accessible
            accessibilityLabel={`${copy.progress.capabilities[capability.type as CapabilityType]} ${capability.value ?? "—"}`}
            style={styles.capRow}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.capName,
                {
                  color: theme.color.foreground,
                  fontFamily: fontOf(theme, "regular"),
                },
              ]}
            >
              {copy.progress.capabilities[capability.type as CapabilityType]}
            </Text>
            <View
              style={[
                styles.capTrack,
                { backgroundColor: theme.color.iconSurface },
              ]}
            >
              <View
                style={[
                  styles.capFill,
                  {
                    width: `${capability.value ?? 0}%`,
                    backgroundColor: theme.color.foreground,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.capValue,
                {
                  color: theme.color.foreground,
                  fontFamily: fontOf(theme, "medium"),
                },
              ]}
            >
              {capability.value ?? "—"}
            </Text>
            <Text
              style={[
                styles.capArrow,
                {
                  color:
                    capability.trend === "down"
                      ? theme.color.warning
                      : theme.color.mutedForeground,
                },
              ]}
            >
              {arrow[capability.trend]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- records
