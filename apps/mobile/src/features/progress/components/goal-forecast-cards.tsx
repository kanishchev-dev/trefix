import { Pressable, Text, View } from "react-native";
import { ChevronRight, Target } from "lucide-react-native";
import {
  type ProgressOverview,
  type RecordDistance,
} from "@trefix/api-client";
import { fillTemplate, pluralize } from "../../../locales";
import { IconCircle, Pill } from "../../../shared/ui/list-card";
import {
  dayMonth,
  distanceLabel,
  formatDuration,
} from "../lib/progress-format";
import { LineChart } from "./line-chart";
import { styles } from "./progress-sections.styles";
import {
  fontOf,
  SectionHeader,
  Block,
  Muted,
  BigValue,
  type Common,
} from "./progress-primitives";

export function GoalCard({
  overview,
  onOpenPlan,
  ...common
}: Common & { overview: ProgressOverview; onOpenPlan: () => void }) {
  const { copy, language, theme } = common;
  const goal = overview.goal!;
  const g = copy.progress.goal;
  const recordDistance = (
    Object.entries({
      "5k": 5,
      "10k": 10,
      half_marathon: 21.1,
      marathon: 42.2,
    }) as Array<[RecordDistance, number]>
  ).find(
    ([, km]) =>
      goal.distanceKm !== null && Math.abs(km - goal.distanceKm) < 0.15,
  )?.[0];
  const distanceText =
    goal.distanceKm !== null
      ? recordDistance
        ? distanceLabel(copy, recordDistance)
        : common.format.distance(goal.distanceKm, 1)
      : null;
  const title =
    distanceText && goal.targetSeconds
      ? fillTemplate(g.title, {
          distance: distanceText,
          time: formatDuration(goal.targetSeconds),
        })
      : (goal.planName ?? distanceText ?? "");
  const subtitle = [
    goal.date
      ? fillTemplate(g.start, { date: dayMonth(goal.date, language) })
      : null,
    goal.weeksLeft !== null && goal.weeksLeft > 0
      ? pluralize(g.weeksLeft, goal.weeksLeft, language)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const delta =
    goal.forecastSeconds !== null && goal.targetSeconds !== null
      ? goal.forecastSeconds - goal.targetSeconds
      : null;

  const start = new Date(`${overview.period.from}T00:00:00Z`).getTime();
  const end = new Date(
    `${goal.date ?? overview.period.to}T00:00:00Z`,
  ).getTime();
  const xOf = (iso: string) =>
    Math.min(
      1,
      Math.max(
        0,
        (new Date(`${iso}T00:00:00Z`).getTime() - start) /
          Math.max(1, end - start),
      ),
    );

  return (
    <View style={styles.section}>
      <SectionHeader
        title={copy.progress.sections.goal}
        link={copy.progress.sections.plan}
        onLink={onOpenPlan}
        theme={theme}
      />
      <Block>
        <View style={styles.rowBetween}>
          <View style={styles.flexText}>
            <Text
              numberOfLines={1}
              style={[
                styles.title,
                {
                  color: theme.color.foreground,
                  fontFamily: fontOf(theme, "medium"),
                },
              ]}
            >
              {title}
            </Text>
            {subtitle ? <Muted theme={theme}>{subtitle}</Muted> : null}
          </View>
          <Pill
            theme={theme}
            text={g.status[goal.status]}
            tone={goal.status === "behind" ? "warning" : "neutral"}
          />
        </View>
        {goal.forecastSeconds !== null ? (
          <>
            <View style={styles.grid2}>
              <View style={styles.flexText}>
                <Muted theme={theme}>{g.forecastNow}</Muted>
                <BigValue theme={theme}>
                  {formatDuration(goal.forecastSeconds)}
                </BigValue>
              </View>
              {delta !== null ? (
                <View style={styles.flexText}>
                  <Muted theme={theme}>
                    {delta > 0 ? g.remaining : g.ahead}
                  </Muted>
                  <BigValue theme={theme}>
                    {formatDuration(Math.abs(delta))}
                  </BigValue>
                </View>
              ) : null}
            </View>
            {goal.series.length > 1 ? (
              <>
                <LineChart
                  points={goal.series.map((point) => ({
                    x: xOf(point.date),
                    y: point.seconds,
                  }))}
                  dashed={goal.projection.map((point) => ({
                    x: xOf(point.date),
                    y: point.seconds,
                  }))}
                  reference={
                    goal.targetSeconds
                      ? {
                          y: goal.targetSeconds,
                          label: fillTemplate(g.targetLine, {
                            time: formatDuration(goal.targetSeconds),
                          }),
                        }
                      : undefined
                  }
                  invert
                  height={72}
                  theme={theme}
                  accessibilityLabel={`${g.forecastNow} ${formatDuration(goal.forecastSeconds)}`}
                />
                {goal.projection.length > 0 ? (
                  <Muted theme={theme}>{g.projectionNote}</Muted>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <Muted theme={theme} numberOfLines={2}>
            {g.noDataHint}
          </Muted>
        )}
      </Block>
    </View>
  );
}

export function ForecastCard({
  overview,
  onSetGoal,
  ...common
}: Common & { overview: ProgressOverview; onSetGoal: () => void }) {
  const { copy, language, theme } = common;
  const f = copy.progress.forecastCard;
  return (
    <View style={styles.section}>
      <SectionHeader title={copy.progress.sections.forecast} theme={theme} />
      <Block>
        {overview.predictions.length > 0 ? (
          <>
            <View style={styles.grid3}>
              {overview.predictions.map((prediction) => (
                <View key={prediction.distance} style={styles.flexText}>
                  <Muted theme={theme}>
                    {distanceLabel(copy, prediction.distance)}
                  </Muted>
                  <BigValue theme={theme} size={20}>
                    ~{formatDuration(prediction.seconds)}
                  </BigValue>
                </View>
              ))}
            </View>
            <Muted theme={theme}>
              {pluralize(f.basis, overview.predictionBasis, language)}
            </Muted>
          </>
        ) : (
          <Muted theme={theme} numberOfLines={2}>
            {f.empty}
          </Muted>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onSetGoal}
          style={({ pressed }) => [
            styles.innerAction,
            { borderTopColor: theme.color.separator },
            pressed && styles.pressed,
          ]}
        >
          <IconCircle theme={theme} size={36}>
            <Target color={theme.color.foreground} size={18} />
          </IconCircle>
          <View style={styles.flexText}>
            <Text
              style={[
                styles.body,
                {
                  color: theme.color.foreground,
                  fontFamily: fontOf(theme, "medium"),
                },
              ]}
            >
              {f.setGoal}
            </Text>
            <Muted theme={theme}>{f.setGoalDescription}</Muted>
          </View>
          <ChevronRight
            color={theme.color.mutedForeground}
            size={18}
            strokeWidth={2.2}
          />
        </Pressable>
      </Block>
    </View>
  );
}

// ---------------------------------------------------------------- form & metrics
