import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, Medal, Plus, Route, Target, Trophy } from "lucide-react-native";

import {
  type CapabilityType,
  type ProgressOverview,
  type RecordDistance,
} from "@workspace/api-client";
import { type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, pluralize, type AppLanguage, type MainCopy } from "../../../locales";
import { formatPace } from "../../../shared/lib/units";
import { Chip, ChipScroller } from "../../../shared/ui/chip-scroller";
import { IconCircle, ListCard, ListRow, Pill, SectionTitle } from "../../../shared/ui/list-card";
import { type Formatter } from "../../profile/lib/profile-format";
import { dayMonth, distanceLabel, formatDuration, formatPaceDelta, monthShort } from "../lib/progress-format";
import { BarChart } from "./bar-chart";
import { LineChart } from "./line-chart";

type Common = { copy: MainCopy; language: AppLanguage; theme: ThemeTokens; format: Formatter };

const fontOf = (theme: ThemeTokens, weight: "regular" | "medium" | "semibold") => theme.typography.fontFamily.sans[weight];

/** Group title with an optional link on the right. */
export function SectionHeader({ title, link, onLink, theme }: { title: string; link?: string; onLink?: () => void; theme: ThemeTokens }) {
  return (
    <View style={styles.sectionHeader}>
      <SectionTitle text={title} theme={theme} />
      {link && onLink ? (
        <Pressable accessibilityRole="link" hitSlop={8} onPress={onLink}>
          <Text style={[styles.sectionLink, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>{link}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Card({ theme, children, gap = 14 }: { theme: ThemeTokens; children: ReactNode; gap?: number }) {
  return <View style={[styles.card, { backgroundColor: theme.color.card, gap }]}>{children}</View>;
}

function Muted({ theme, children, numberOfLines = 1 }: { theme: ThemeTokens; children: ReactNode; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[styles.muted, { color: theme.color.mutedForeground, fontFamily: fontOf(theme, "regular") }]}>
      {children}
    </Text>
  );
}

function BigValue({ theme, children, size = 26 }: { theme: ThemeTokens; children: ReactNode; size?: number }) {
  return (
    <Text style={{ color: theme.color.foreground, fontFamily: fontOf(theme, "semibold"), fontSize: size, lineHeight: size + 6, letterSpacing: -0.4, fontVariant: ["tabular-nums"] }}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------- goal

export function GoalCard({ overview, onOpenPlan, ...common }: Common & { overview: ProgressOverview; onOpenPlan: () => void }) {
  const { copy, language, theme } = common;
  const goal = overview.goal!;
  const g = copy.progress.goal;
  const recordDistance = (Object.entries({ "5k": 5, "10k": 10, half_marathon: 21.1, marathon: 42.2 }) as Array<[RecordDistance, number]>).find(
    ([, km]) => goal.distanceKm !== null && Math.abs(km - goal.distanceKm) < 0.15,
  )?.[0];
  const distanceText = goal.distanceKm !== null ? (recordDistance ? distanceLabel(copy, recordDistance) : common.format.distance(goal.distanceKm, 1)) : null;
  const title =
    distanceText && goal.targetSeconds
      ? fillTemplate(g.title, { distance: distanceText, time: formatDuration(goal.targetSeconds) })
      : goal.planName ?? distanceText ?? "";
  const subtitle = [
    goal.date ? fillTemplate(g.start, { date: dayMonth(goal.date, language) }) : null,
    goal.weeksLeft !== null && goal.weeksLeft > 0 ? pluralize(g.weeksLeft, goal.weeksLeft, language) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const delta = goal.forecastSeconds !== null && goal.targetSeconds !== null ? goal.forecastSeconds - goal.targetSeconds : null;

  const start = new Date(`${overview.period.from}T00:00:00Z`).getTime();
  const end = new Date(`${goal.date ?? overview.period.to}T00:00:00Z`).getTime();
  const xOf = (iso: string) => Math.min(1, Math.max(0, (new Date(`${iso}T00:00:00Z`).getTime() - start) / Math.max(1, end - start)));

  return (
    <View style={styles.section}>
      <SectionHeader title={copy.progress.sections.goal} link={copy.progress.sections.plan} onLink={onOpenPlan} theme={theme} />
      <Card theme={theme}>
        <View style={styles.rowBetween}>
          <View style={styles.flexText}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>
              {title}
            </Text>
            {subtitle ? <Muted theme={theme}>{subtitle}</Muted> : null}
          </View>
          <Pill theme={theme} text={g.status[goal.status]} tone={goal.status === "behind" ? "warning" : "neutral"} />
        </View>
        {goal.forecastSeconds !== null ? (
          <>
            <View style={styles.grid2}>
              <View style={styles.flexText}>
                <Muted theme={theme}>{g.forecastNow}</Muted>
                <BigValue theme={theme}>{formatDuration(goal.forecastSeconds)}</BigValue>
              </View>
              {delta !== null ? (
                <View style={styles.flexText}>
                  <Muted theme={theme}>{delta > 0 ? g.remaining : g.ahead}</Muted>
                  <BigValue theme={theme}>{formatDuration(Math.abs(delta))}</BigValue>
                </View>
              ) : null}
            </View>
            {goal.series.length > 1 ? (
              <>
                <LineChart
                  points={goal.series.map((point) => ({ x: xOf(point.date), y: point.seconds }))}
                  dashed={goal.projection.map((point) => ({ x: xOf(point.date), y: point.seconds }))}
                  reference={goal.targetSeconds ? { y: goal.targetSeconds, label: fillTemplate(g.targetLine, { time: formatDuration(goal.targetSeconds) }) } : undefined}
                  invert
                  height={72}
                  theme={theme}
                  accessibilityLabel={`${g.forecastNow} ${formatDuration(goal.forecastSeconds)}`}
                />
                {goal.projection.length > 0 ? <Muted theme={theme}>{g.projectionNote}</Muted> : null}
              </>
            ) : null}
          </>
        ) : (
          <Muted theme={theme} numberOfLines={2}>
            {g.noDataHint}
          </Muted>
        )}
      </Card>
    </View>
  );
}

export function ForecastCard({ overview, onSetGoal, ...common }: Common & { overview: ProgressOverview; onSetGoal: () => void }) {
  const { copy, language, theme } = common;
  const f = copy.progress.forecastCard;
  return (
    <View style={styles.section}>
      <SectionHeader title={copy.progress.sections.forecast} theme={theme} />
      <Card theme={theme}>
        {overview.predictions.length > 0 ? (
          <>
            <View style={styles.grid3}>
              {overview.predictions.map((prediction) => (
                <View key={prediction.distance} style={styles.flexText}>
                  <Muted theme={theme}>{distanceLabel(copy, prediction.distance)}</Muted>
                  <BigValue theme={theme} size={20}>~{formatDuration(prediction.seconds)}</BigValue>
                </View>
              ))}
            </View>
            <Muted theme={theme}>{pluralize(f.basis, overview.predictionBasis, language)}</Muted>
          </>
        ) : (
          <Muted theme={theme} numberOfLines={2}>
            {f.empty}
          </Muted>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onSetGoal}
          style={({ pressed }) => [styles.innerAction, { backgroundColor: theme.color.surface }, pressed && styles.pressed]}
        >
          <IconCircle theme={theme} size={36}>
            <Target color={theme.color.foreground} size={18} />
          </IconCircle>
          <View style={styles.flexText}>
            <Text style={[styles.body, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>{f.setGoal}</Text>
            <Muted theme={theme}>{f.setGoalDescription}</Muted>
          </View>
        </Pressable>
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------- form & metrics

export function FormSection({
  overview,
  onOpenMetric,
  onOpenHeart,
  ...common
}: Common & { overview: ProgressOverview; onOpenMetric: (metric: "threshold_pace" | "vo2max") => void; onOpenHeart: () => void }) {
  const { copy, language, theme, format } = common;
  const f = copy.progress.form;
  const unlock = overview.metricsUnlock;

  if (!overview.form) {
    const left = Math.max(0, unlock.required - unlock.completed);
    return (
      <View style={styles.section}>
        <SectionHeader title={copy.progress.sections.formMetrics} theme={theme} />
        <Card theme={theme} gap={12}>
          <Text style={[styles.body, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>
            {pluralize(f.locked, left, language)}
          </Text>
          <View style={styles.segments}>
            {Array.from({ length: unlock.required }, (_, index) => (
              <View
                key={index}
                style={[styles.segment, { backgroundColor: index < unlock.completed ? theme.color.foreground : theme.color.iconSurface }]}
              />
            ))}
          </View>
          <Muted theme={theme}>{f.lockedDescription}</Muted>
        </Card>
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
      <Card theme={theme}>
        <View style={styles.rowBetween}>
          <Text style={[styles.title, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>{f.title}</Text>
          <Muted theme={theme}>
            {change > 0 ? "↑ +" : change < 0 ? "↓ " : ""}
            {change !== 0 ? `${change} ` : ""}
            {fillTemplate(f.change, { weeks: form.changeWeeks })}
          </Muted>
        </View>
        <View style={styles.grid3}>
          {([
            [f.fitness, form.fitness],
            [f.fatigue, form.fatigue],
            [f.form, form.form],
          ] as const).map(([label, value]) => (
            <View key={label} style={styles.flexText}>
              <Muted theme={theme}>{label}</Muted>
              <BigValue theme={theme} size={20}>{value < 0 ? `−${Math.abs(value)}` : value}</BigValue>
            </View>
          ))}
        </View>
        <View style={styles.grid3}>
          <MetricTile
            theme={theme}
            label={f.thresholdPace}
            value={metric.thresholdPace ? formatPace(metric.thresholdPace.value, format.units, format.labels).split(" ")[0] : "—"}
            hint={paceChange !== null && paceChange !== 0 ? `${paceChange < 0 ? "↑" : "↓"} ${formatPaceDelta(paceChange, format.units)}` : undefined}
            onPress={() => onOpenMetric("threshold_pace")}
          />
          <MetricTile
            theme={theme}
            label={f.vo2max}
            value={metric.vo2max ? String(metric.vo2max.value) : "—"}
            hint={metric.vo2max?.change ? `${metric.vo2max.change > 0 ? "↑ +" : "↓ "}${metric.vo2max.change}` : undefined}
            onPress={() => onOpenMetric("vo2max")}
          />
          <MetricTile
            theme={theme}
            label={f.thresholdHr}
            value={metric.thresholdHeartRate ? `${metric.thresholdHeartRate.estimated ? "~" : ""}${metric.thresholdHeartRate.value}` : "—"}
            hint={metric.thresholdHeartRate?.estimated ? f.estimate : f.fromProfile}
            onPress={onOpenHeart}
          />
        </View>
      </Card>
    </View>
  );
}

function MetricTile({ theme, label, value, hint, onPress }: { theme: ThemeTokens; label: string; value: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${value} ${hint ?? ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, { backgroundColor: theme.color.surface }, pressed && styles.pressed]}
    >
      <Muted theme={theme}>{label}</Muted>
      <Text style={{ color: theme.color.foreground, fontFamily: fontOf(theme, "semibold"), fontSize: 17, lineHeight: 22, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      {hint ? <Muted theme={theme}>{hint}</Muted> : null}
    </Pressable>
  );
}

// ---------------------------------------------------------------- capabilities

export function CapabilitiesSection({ overview, ...common }: Common & { overview: ProgressOverview }) {
  const { copy, theme } = common;
  if (!overview.capabilities) return null;
  const arrow = { up: "↑", down: "↓", stable: "→" } as const;
  return (
    <View style={styles.section}>
      <SectionHeader title={copy.progress.sections.capabilities} theme={theme} />
      <View style={[styles.card, styles.capCard, { backgroundColor: theme.color.card }]}>
        {overview.capabilities.map((capability) => (
          <View
            key={capability.type}
            accessible
            accessibilityLabel={`${copy.progress.capabilities[capability.type as CapabilityType]} ${capability.value ?? "—"}`}
            style={styles.capRow}
          >
            <Text numberOfLines={1} style={[styles.capName, { color: theme.color.foreground, fontFamily: fontOf(theme, "regular") }]}>
              {copy.progress.capabilities[capability.type as CapabilityType]}
            </Text>
            <View style={[styles.capTrack, { backgroundColor: theme.color.iconSurface }]}>
              <View style={[styles.capFill, { width: `${capability.value ?? 0}%`, backgroundColor: theme.color.foreground }]} />
            </View>
            <Text style={[styles.capValue, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>
              {capability.value ?? "—"}
            </Text>
            <Text style={[styles.capArrow, { color: capability.trend === "down" ? theme.color.warning : theme.color.mutedForeground }]}>
              {arrow[capability.trend]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------- records

export function RecordsSection({
  overview,
  onOpenRecords,
  onAddResult,
  ...common
}: Common & { overview: ProgressOverview; onOpenRecords: () => void; onAddResult: (distance: RecordDistance) => void }) {
  const { copy, language, theme } = common;
  const r = copy.progress.records;
  const hasAny = overview.records.some((record) => record.best);

  return (
    <View style={styles.section}>
      <SectionHeader title={copy.progress.sections.records} link={hasAny ? copy.progress.sections.all : undefined} onLink={onOpenRecords} theme={theme} />
      {hasAny ? (
        <ListCard theme={theme}>
          {overview.records.map((record) =>
            record.best ? (
              <ListRow
                key={record.distance}
                theme={theme}
                title={distanceLabel(copy, record.distance)}
                description={[dayMonth(record.best.date, language), record.best.name ?? sourceLabel(copy, record.best.provider, record.best.kind, record.best.source)].join(" · ")}
                value={formatDuration(record.best.seconds)}
                trailing={record.best.isNew ? <Pill theme={theme} text={r.new} /> : undefined}
                chevron={false}
                onPress={onOpenRecords}
              />
            ) : (
              <ListRow
                key={record.distance}
                theme={theme}
                title={distanceLabel(copy, record.distance)}
                description={r.noResult}
                trailing={
                  <View style={styles.addInline}>
                    <Plus color={theme.color.foreground} size={16} />
                    <Text style={[styles.body, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>{r.add}</Text>
                  </View>
                }
                chevron={false}
                onPress={() => onAddResult(record.distance)}
              />
            ),
          )}
        </ListCard>
      ) : (
        <Card theme={theme} gap={10}>
          <Text style={[styles.body, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>{r.emptyTitle}</Text>
          <Muted theme={theme}>{r.emptyDescription}</Muted>
          <Pressable
            accessibilityRole="button"
            onPress={() => onAddResult("10k")}
            style={({ pressed }) => [styles.pillButton, { backgroundColor: theme.color.surface }, pressed && styles.pressed]}
          >
            <Plus color={theme.color.foreground} size={16} />
            <Text style={[styles.body, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>{r.addResult}</Text>
          </Pressable>
        </Card>
      )}
    </View>
  );
}

export function sourceLabel(copy: MainCopy, provider: string | null, kind: string, source: string): string {
  const s = copy.progress.records.sources;
  if (provider === "strava") return s.strava;
  if (source === "result") return kind === "race" ? s.race : kind === "test" ? s.test : s.manual;
  return kind === "race" ? s.race : s.workout;
}

// ---------------------------------------------------------------- dynamics

type DynamicsKey = keyof ProgressOverview["dynamics"]["metrics"];

export function DynamicsSection({ overview, onOpenSchedule, ...common }: Common & { overview: ProgressOverview; onOpenSchedule: () => void }) {
  const { copy, language, theme, format } = common;
  const d = copy.progress.dynamics;
  const [metric, setMetric] = useState<DynamicsKey>("distance");
  const series = overview.dynamics.metrics[metric];
  const bucket = overview.dynamics.bucket;

  const valueText = (() => {
    if (series.average === null) return "—";
    if (metric === "distance") return format.distance(series.average, 0);
    if (metric === "pace") return formatPace(series.average, format.units, format.labels);
    if (metric === "heartRate") return `${series.average} ${d.bpm}`;
    return String(Math.round(series.average));
  })();
  const caption =
    metric === "distance" ? d.captions.distance[bucket] : metric === "load" ? d.captions.load[bucket] : d.captions[metric];
  // Faster pace is an improvement although the number goes down.
  const better = series.changePercent !== null ? (metric === "pace" ? series.changePercent < 0 : series.changePercent > 0) : null;
  const points = series.points;
  const labelIndexes = points.length > 3 ? [0, Math.floor(points.length / 3), Math.floor((points.length * 2) / 3), points.length - 1] : points.map((_, index) => index);
  const hasData = points.some((point) => point.value !== null && point.value > 0);

  return (
    <View style={styles.section}>
      <SectionHeader title={copy.progress.sections.dynamics} theme={theme} />
      <Card theme={theme}>
        <ChipScroller>
          {(["distance", "pace", "heartRate", "load"] as const).map((key) => (
            <Chip key={key} theme={theme} label={d.metrics[key]} selected={metric === key} onPress={() => setMetric(key)} />
          ))}
        </ChipScroller>
        {hasData ? (
          <>
            <View style={styles.rowBetween}>
              <Text numberOfLines={1} style={styles.flexText}>
                <Text style={{ color: theme.color.foreground, fontFamily: fontOf(theme, "semibold"), fontSize: 22 }}>{valueText}</Text>
                <Text style={[styles.muted, { color: theme.color.mutedForeground }]}> {caption}</Text>
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
          <View style={[styles.hintRow, { borderTopColor: theme.color.separator }]}>
            <Muted theme={theme}>{fillTemplate(d.profileHint, { value: format.distance(overview.dynamics.profileVolumeHint.profileKm, 0) })}</Muted>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={onOpenSchedule}>
              <Text style={[styles.muted, { color: theme.color.foreground, fontFamily: fontOf(theme, "medium") }]}>{d.update}</Text>
            </Pressable>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

// ---------------------------------------------------------------- achievements

export function AchievementsSection({ overview, ...common }: Common & { overview: ProgressOverview }) {
  const { copy, language, theme, format } = common;
  const a = copy.progress.achievements;
  if (overview.achievements.length === 0) return null;
  const iconColor = theme.color.foreground;
  return (
    <View style={styles.section}>
      <SectionHeader title={copy.progress.sections.achievements} theme={theme} />
      <ListCard theme={theme}>
        {overview.achievements.map((achievement, index) => {
          const date = achievement.date ? dayMonth(achievement.date, language) : null;
          switch (achievement.kind) {
            case "longest_run":
              return (
                <ListRow key={index} theme={theme} icon={<Route color={iconColor} size={20} />} title={a.longest_run} description={[format.distance(achievement.value), date].filter(Boolean).join(" · ")} />
              );
            case "streak":
              return (
                <ListRow
                  key={index}
                  theme={theme}
                  icon={<Calendar color={iconColor} size={20} />}
                  title={pluralize(a.streak, achievement.value, language)}
                  description={date ? fillTemplate(a.since, { date }) : undefined}
                />
              );
            case "new_record":
              return (
                <ListRow
                  key={index}
                  theme={theme}
                  icon={<Trophy color={iconColor} size={20} />}
                  title={fillTemplate(a.new_record, { distance: achievement.distance ? distanceLabel(copy, achievement.distance) : "" })}
                  description={[formatDuration(achievement.value), date].filter(Boolean).join(" · ")}
                />
              );
            default:
              return (
                <ListRow
                  key={index}
                  theme={theme}
                  icon={<Medal color={iconColor} size={20} />}
                  title={fillTemplate(a.total_distance, { value: format.distance(achievement.value, 0) })}
                  description={date ?? undefined}
                />
              );
          }
        })}
      </ListCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingRight: 8 },
  sectionLink: { fontSize: 12, lineHeight: 16, opacity: 0.7 },
  card: { borderRadius: 24, padding: 18 },
  capCard: { paddingVertical: 6, paddingHorizontal: 0, gap: 0 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  flexText: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 17, lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 20 },
  muted: { fontSize: 13, lineHeight: 18 },
  grid2: { flexDirection: "row", gap: 8 },
  grid3: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, minWidth: 0, borderRadius: 16, padding: 12, gap: 2 },
  innerAction: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18 },
  pressed: { opacity: 0.82 },
  segments: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  capRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 16 },
  capName: { width: 120, fontSize: 14, lineHeight: 18 },
  capTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  capFill: { height: 6, borderRadius: 3 },
  capValue: { width: 28, textAlign: "right", fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  capArrow: { width: 14, fontSize: 14, lineHeight: 18 },
  addInline: { flexDirection: "row", alignItems: "center", gap: 4 },
  pillButton: { alignSelf: "flex-start", height: 40, paddingHorizontal: 16, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6 },
  hintRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
});
