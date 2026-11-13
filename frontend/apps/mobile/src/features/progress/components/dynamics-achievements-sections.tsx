import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Calendar, Medal, Route, Trophy } from "lucide-react-native";
import { type ProgressOverview } from "@trefix/api-client";
import { fillTemplate, pluralize } from "../../../locales";
import { formatPace } from "../../../shared/lib/units";
import { Chip, ChipScroller } from "../../../shared/ui/chip-scroller";
import { ListCard, ListRow } from "../../../shared/ui/list-card";
import {
  dayMonth,
  distanceLabel,
  formatDuration,
  monthShort,
} from "../lib/progress-format";
import { BarChart } from "./bar-chart";
import { styles } from "./progress-sections.styles";
import {
  fontOf,
  SectionHeader,
  Block,
  Muted,
  type Common,
} from "./progress-primitives";

export type DynamicsKey = keyof ProgressOverview["dynamics"]["metrics"];

export function DynamicsSection({
  overview,
  onOpenSchedule,
  ...common
}: Common & { overview: ProgressOverview; onOpenSchedule: () => void }) {
  const { copy, language, theme, format } = common;
  const d = copy.progress.dynamics;
  const [metric, setMetric] = useState<DynamicsKey>("distance");
  const series = overview.dynamics.metrics[metric];
  const bucket = overview.dynamics.bucket;

  const valueText = (() => {
    if (series.average === null) return "—";
    if (metric === "distance") return format.distance(series.average, 0);
    if (metric === "pace")
      return formatPace(series.average, format.units, format.labels);
    if (metric === "heartRate") return `${series.average} ${d.bpm}`;
    return String(Math.round(series.average));
  })();
  const caption =
    metric === "distance"
      ? d.captions.distance[bucket]
      : metric === "load"
        ? d.captions.load[bucket]
        : d.captions[metric];
  // Faster pace is an improvement although the number goes down.
  const better =
    series.changePercent !== null
      ? metric === "pace"
        ? series.changePercent < 0
        : series.changePercent > 0
      : null;
  const points = series.points;
  const labelIndexes =
    points.length > 3
      ? [
          0,
          Math.floor(points.length / 3),
          Math.floor((points.length * 2) / 3),
          points.length - 1,
        ]
      : points.map((_, index) => index);
  const hasData = points.some(
    (point) => point.value !== null && point.value > 0,
  );

  return (
    <View style={styles.section}>
      <SectionHeader title={copy.progress.sections.dynamics} theme={theme} />
      <Block>
        <ChipScroller>
          {(["distance", "pace", "heartRate", "load"] as const).map((key) => (
            <Chip
              key={key}
              theme={theme}
              label={d.metrics[key]}
              selected={metric === key}
              onPress={() => setMetric(key)}
            />
          ))}
        </ChipScroller>
        {hasData ? (
          <>
            <View style={styles.rowBetween}>
              <Text numberOfLines={1} style={styles.flexText}>
                <Text
                  style={{
                    color: theme.color.foreground,
                    fontFamily: fontOf(theme, "semibold"),
                    fontSize: 22,
                  }}
                >
                  {valueText}
                </Text>
                <Text
                  style={[styles.muted, { color: theme.color.mutedForeground }]}
                >
                  {" "}
                  {caption}
                </Text>
              </Text>
              {series.changePercent !== null && series.changePercent !== 0 ? (
                <Muted theme={theme}>
                  {better ? "↑" : "↓"} {Math.abs(series.changePercent)}%
                </Muted>
              ) : null}
            </View>
            <BarChart
              values={points.map((point) => point.value)}
              invert={metric === "pace"}
              theme={theme}
              accessibilityLabel={`${d.metrics[metric]}: ${valueText}`}
            />
            <View style={styles.rowBetween}>
              {labelIndexes.map((index) => (
                <Muted key={index} theme={theme}>
                  {monthShort(points[index].start, language)}
                </Muted>
              ))}
            </View>
          </>
        ) : (
          <Muted theme={theme}>{d.noData}</Muted>
        )}
        {overview.dynamics.profileVolumeHint && metric === "distance" ? (
          <View
            style={[styles.hintRow, { borderTopColor: theme.color.separator }]}
          >
            <Muted theme={theme}>
              {fillTemplate(d.profileHint, {
                value: format.distance(
                  overview.dynamics.profileVolumeHint.profileKm,
                  0,
                ),
              })}
            </Muted>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onOpenSchedule}
            >
              <Text
                style={[
                  styles.muted,
                  {
                    color: theme.color.foreground,
                    fontFamily: fontOf(theme, "medium"),
                  },
                ]}
              >
                {d.update}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Block>
    </View>
  );
}

// ---------------------------------------------------------------- achievements

export function AchievementsSection({
  overview,
  ...common
}: Common & { overview: ProgressOverview }) {
  const { copy, language, theme, format } = common;
  const a = copy.progress.achievements;
  if (overview.achievements.length === 0) return null;
  const iconColor = theme.color.foreground;
  return (
    <View style={styles.section}>
      <SectionHeader
        title={copy.progress.sections.achievements}
        theme={theme}
      />
      <ListCard theme={theme} plain>
        {overview.achievements.map((achievement, index) => {
          const date = achievement.date
            ? dayMonth(achievement.date, language)
            : null;
          switch (achievement.kind) {
            case "longest_run":
              return (
                <ListRow
                  key={index}
                  theme={theme}
                  icon={<Route color={iconColor} size={20} />}
                  title={a.longest_run}
                  description={[format.distance(achievement.value), date]
                    .filter(Boolean)
                    .join(" · ")}
                />
              );
            case "streak":
              return (
                <ListRow
                  key={index}
                  theme={theme}
                  icon={<Calendar color={iconColor} size={20} />}
                  title={pluralize(a.streak, achievement.value, language)}
                  description={
                    date ? fillTemplate(a.since, { date }) : undefined
                  }
                />
              );
            case "new_record":
              return (
                <ListRow
                  key={index}
                  theme={theme}
                  icon={<Trophy color={iconColor} size={20} />}
                  title={fillTemplate(a.new_record, {
                    distance: achievement.distance
                      ? distanceLabel(copy, achievement.distance)
                      : "",
                  })}
                  description={[formatDuration(achievement.value), date]
                    .filter(Boolean)
                    .join(" · ")}
                />
              );
            default:
              return (
                <ListRow
                  key={index}
                  theme={theme}
                  icon={<Medal color={iconColor} size={20} />}
                  title={fillTemplate(a.total_distance, {
                    value: format.distance(achievement.value, 0),
                  })}
                  description={date ?? undefined}
                />
              );
          }
        })}
      </ListCard>
    </View>
  );
}
