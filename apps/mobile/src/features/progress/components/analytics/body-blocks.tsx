import { StyleSheet, Text, View } from "react-native";

import { type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  formatDayMonth,
  getShortDayName,
} from "../../../../locales";
import {
  type ProgressAnalytics,
  type ProgressRegularityDay,
} from "../../data/progress-model";
import { parseYmd } from "../../lib/progress-selectors";
import { type ProgressTextContext } from "../../lib/progress-text";
import {
  Caption,
  DemoBadge,
  Kicker,
  ProgressCard,
  SectionHeader,
  Track,
  fonts,
  progressPalette,
  progressStyles,
} from "../progress-ui";

type Props = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  analytics: ProgressAnalytics;
};

/** Average heart rate and time in zones; a plain message without heart rate data. */
export function HeartRateBlock({
  theme,
  ctx,
  analytics,
  monthLabel,
}: Props & { monthLabel: string }) {
  const t = ctx.copy.progressOverview.analytics.heartRate;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const zones = analytics.heartRateZones;
  const shades = [
    palette.faint,
    palette.faint,
    palette.mid,
    palette.muted,
    palette.fg,
  ];

  return (
    <>
      <SectionHeader theme={theme} title={t.title} aside={monthLabel} />
      <ProgressCard theme={theme} style={progressStyles.cardBody}>
        {zones && analytics.avgHeartRate !== null ? (
          <>
            <View style={styles.avgRow}>
              <Text
                style={[
                  styles.big,
                  { color: palette.fg, fontFamily: font.medium },
                ]}
              >
                {Math.round(analytics.avgHeartRate)}
              </Text>
              <Text
                style={[
                  progressStyles.body,
                  { color: palette.muted, fontFamily: font.regular },
                ]}
              >
                {t.avg}
              </Text>
            </View>
            <Kicker theme={theme}>{t.zones}</Kicker>
            {zones.map((share, index) => (
              <View key={index} style={styles.zoneRow}>
                <Text
                  style={[
                    styles.zoneLabel,
                    { color: palette.fg, fontFamily: font.medium },
                  ]}
                >{`Z${index + 1}`}</Text>
                <View style={styles.flex}>
                  <Track
                    theme={theme}
                    height={10}
                    percent={(share / Math.max(...zones)) * 100}
                    color={shades[index]}
                  />
                </View>
                <Text
                  style={[
                    styles.zoneValue,
                    { color: palette.fg, fontFamily: font.regular },
                  ]}
                >{`${share}%`}</Text>
              </View>
            ))}
            <Caption theme={theme}>{t.note}</Caption>
          </>
        ) : (
          <>
            <Text
              style={[
                progressStyles.body,
                { color: palette.fg, fontFamily: font.medium },
              ]}
            >
              {t.noneTitle}
            </Text>
            <Caption theme={theme}>{t.noneText}</Caption>
          </>
        )}
      </ProgressCard>
    </>
  );
}

/** Weekly distance; the unfinished week is dashed. */
export function LoadBlock({ theme, ctx, analytics }: Props) {
  const t = ctx.copy.progressOverview.analytics;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const weeks = analytics.weeklyKm;
  const max = Math.max(1, ...weeks.map((week) => week.km));
  const full = weeks.filter((week) => !week.partial);
  const lastFull = weeks.reduce(
    (last, week, index) => (week.partial ? last : index),
    -1,
  );
  const average =
    full.length > 0
      ? full.reduce((sum, week) => sum + week.km, 0) / full.length
      : null;

  return (
    <>
      <SectionHeader
        theme={theme}
        title={t.load.title}
        aside={<DemoBadge theme={theme} label={t.demo} />}
      />
      <ProgressCard theme={theme} style={progressStyles.cardBody}>
        <View style={styles.loadBars}>
          {weeks.map((week, index) => (
            <View key={week.weekStart} style={styles.loadColumn}>
              <Text
                numberOfLines={1}
                style={[
                  styles.tiny,
                  { color: palette.muted, fontFamily: font.regular },
                ]}
              >
                {ctx.format.distance(week.km, 0).replace(/\s\S+$/, "")}
              </Text>
              <View
                style={[
                  styles.loadBar,
                  {
                    height: Math.round((week.km / max) * 80),
                    backgroundColor: week.partial
                      ? "transparent"
                      : index === lastFull
                        ? palette.fg
                        : palette.faint,
                  },
                  week.partial && {
                    borderWidth: 1.5,
                    borderStyle: "dashed",
                    borderColor: palette.mid,
                  },
                ]}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.tiny,
                  styles.weekLabel,
                  { color: palette.muted, fontFamily: font.regular },
                ]}
              >
                {formatDayMonth(week.weekStart, ctx.language)}
              </Text>
            </View>
          ))}
        </View>
        {average !== null ? (
          <Text
            style={[
              progressStyles.body,
              { color: palette.fg, fontFamily: font.medium },
            ]}
          >
            {fillTemplate(t.load.average, {
              value: ctx.format.distance(average, 0),
            })}
          </Text>
        ) : null}
        <Caption theme={theme}>{t.load.note}</Caption>
      </ProgressCard>
    </>
  );
}

function dayNumber(weekStart: string, offset: number): number {
  const { year, month, day } = parseYmd(weekStart);
  return new Date(year, month, day + offset).getDate();
}

/** Four weeks of run and rest days; rest is part of training, not a gap. */
export function RegularityBlock({
  theme,
  ctx,
  analytics,
  hasPlan,
}: Props & { hasPlan: boolean }) {
  const t = ctx.copy.progressOverview.analytics.regularity;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const weeks = analytics.regularity;
  const past = weeks
    .flatMap((week) => week.days)
    .filter((day) => day !== "future");
  const runs = past.filter((day) => day === "run").length;
  const elapsedWeeks = past.length / 7 || 1;
  const cleanWeeks = weeks.filter(
    (week) => !week.days.includes("missed"),
  ).length;

  const stats = [
    {
      label: t.perWeek,
      value: fillTemplate(t.perWeekValue, {
        value: new Intl.NumberFormat(ctx.format.locale, {
          maximumFractionDigits: 1,
        }).format(runs / elapsedWeeks),
      }),
    },
    {
      label: t.runDays,
      value: fillTemplate(t.ofValue, { a: runs, b: past.length }),
    },
  ];
  if (hasPlan)
    stats.push({
      label: t.onPlan,
      value: fillTemplate(t.weeksValue, { a: cleanWeeks, b: weeks.length }),
    });

  const cell: Record<
    ProgressRegularityDay,
    { bg: string; border: string | null; dashed: boolean; color: string }
  > = {
    run: {
      bg: palette.fg,
      border: null,
      dashed: false,
      color: theme.color.card,
    },
    rest: {
      bg: palette.chip,
      border: null,
      dashed: false,
      color: palette.muted,
    },
    missed: hasPlan
      ? {
          bg: "transparent",
          border: palette.muted,
          dashed: false,
          color: palette.muted,
        }
      : { bg: palette.chip, border: null, dashed: false, color: palette.muted },
    future: {
      bg: "transparent",
      border: palette.faint,
      dashed: true,
      color: palette.muted,
    },
  };

  return (
    <>
      <SectionHeader theme={theme} title={t.title} aside={t.hint} />
      <ProgressCard
        theme={theme}
        style={[progressStyles.cardBody, styles.regGap]}
      >
        <View style={styles.stats}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Kicker theme={theme}>{stat.label}</Kicker>
              <Text
                numberOfLines={1}
                style={[
                  progressStyles.value,
                  { color: palette.fg, fontFamily: font.medium },
                ]}
              >
                {stat.value}
              </Text>
            </View>
          ))}
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.grid}
        >
          <View style={styles.gridRow}>
            {Array.from({ length: 7 }, (_, index) => (
              <Text
                key={index}
                style={[
                  styles.head,
                  { color: palette.muted, fontFamily: font.regular },
                ]}
              >
                {getShortDayName((index + 1) % 7, ctx.language).toLowerCase()}
              </Text>
            ))}
          </View>
          {weeks.map((week) => (
            <View key={week.weekStart} style={styles.gridRow}>
              {week.days.map((day, index) => {
                const style = cell[day];
                return (
                  <View key={index} style={styles.cellBox}>
                    <View
                      style={[
                        styles.cell,
                        { backgroundColor: style.bg },
                        style.border !== null && {
                          borderWidth: 1.5,
                          borderColor: style.border,
                          borderStyle: style.dashed ? "dashed" : "solid",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.cellText,
                          { color: style.color, fontFamily: font.medium },
                        ]}
                      >
                        {dayNumber(week.weekStart, index)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        <View style={styles.legend}>
          <Legend label={t.legendRun} fill={palette.fg} theme={theme} />
          <Legend label={t.legendRest} fill={palette.chip} theme={theme} />
          {hasPlan ? (
            <Legend
              label={t.legendMissed}
              border={palette.muted}
              theme={theme}
            />
          ) : null}
        </View>
        <Caption theme={theme}>{t.note}</Caption>
      </ProgressCard>
    </>
  );
}

function Legend({
  label,
  fill,
  border,
  theme,
}: {
  label: string;
  fill?: string;
  border?: string;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.legendItem}>
      <View
        style={[
          styles.legendDot,
          fill ? { backgroundColor: fill } : null,
          border ? { borderWidth: 1.5, borderColor: border } : null,
        ]}
      />
      <Caption theme={theme}>{label}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  avgRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  big: { fontSize: 30, lineHeight: 34 },
  zoneRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  zoneLabel: { width: 28, fontSize: 13, lineHeight: 18 },
  zoneValue: { width: 40, textAlign: "right", fontSize: 13, lineHeight: 18 },
  loadBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 110,
  },
  loadColumn: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  loadBar: { width: "100%", borderRadius: 4 },
  tiny: { fontSize: 10, lineHeight: 12 },
  weekLabel: { width: 44, textAlign: "center" },
  regGap: { gap: 14 },
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, minWidth: 0, gap: 4 },
  grid: { gap: 8 },
  gridRow: { flexDirection: "row" },
  head: { flex: 1, textAlign: "center", fontSize: 11, lineHeight: 14 },
  cellBox: { flex: 1, alignItems: "center" },
  cell: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  cellText: { fontSize: 12 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
});
