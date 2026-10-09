import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type ProgressPeriodKey } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Segmented } from "@workspace/ui-native";

import { fillTemplate, pluralize, type AppLanguage, type MainCopy } from "../../../locales";
import { formatPace } from "../../../shared/lib/units";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { Footnote, ProfileSection, ProfileSubScreen } from "../../profile/components/profile-sub-screen";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { LineChart } from "../components/line-chart";
import { useProgressMetric } from "../hooks/use-progress-v2";
import { dayMonth, formatPaceDelta } from "../lib/progress-format";

type Metric = "threshold_pace" | "vo2max";

type Props = {
  metric: Metric;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
  onOpenHeart: () => void;
};

const PERIODS: ProgressPeriodKey[] = ["3M", "6M", "1Y"];

/** One computed metric: value, history, how it is derived and what it means for training paces. */
export function MetricScreen({ metric, theme, themeMode, copy, language, onBack, onOpenHeart }: Props) {
  const m = copy.progress.metric;
  const [period, setPeriod] = useState<ProgressPeriodKey>("6M");
  const query = useProgressMetric(metric, period);
  const format = useUnitFormat(copy, language);
  const data = query.data;
  const isPace = metric === "threshold_pace";

  const paceText = (seconds: number) => formatPace(seconds, format.units, format.labels);
  const paceRange = ([fast, slow]: [number, number]) => `${paceText(fast).split(" ")[0]}–${paceText(slow)}`;

  const valueText = data?.value == null ? "—" : isPace ? paceText(data.value) : String(data.value);
  const changeText = (() => {
    if (!data || data.change === null) return null;
    if (data.change === 0) return m.unchanged;
    if (isPace) return fillTemplate(data.change < 0 ? m.faster : m.slower, { value: formatPaceDelta(data.change, format.units) });
    return fillTemplate(data.change > 0 ? m.higher : m.lower, { value: Math.abs(data.change) });
  })();
  const improved = data?.change ? (isPace ? data.change < 0 : data.change > 0) : null;

  const series = data?.series ?? [];
  const first = series.length > 0 ? new Date(`${series[0].date}T00:00:00Z`).getTime() : 0;
  const last = series.length > 0 ? new Date(`${series[series.length - 1].date}T00:00:00Z`).getTime() : 0;
  const points = series.map((point) => ({
    x: last > first ? (new Date(`${point.date}T00:00:00Z`).getTime() - first) / (last - first) : 0.5,
    y: point.value,
  }));

  const zones = data?.zones;
  const zonesText = !zones
    ? null
    : zones.thresholdHeartRate && zones.method === "threshold"
      ? fillTemplate(m.zonesByThreshold, { value: zones.thresholdHeartRate })
      : zones.maxHeartRate
        ? fillTemplate(m.zonesByMax, { value: zones.maxHeartRate })
        : m.zonesNotSet;

  const muted = { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular };

  return (
    <ProfileSubScreen title={m.titles[metric]} onBack={onBack} theme={theme} themeMode={themeMode}>
      <ProfileSection>
        <View style={[styles.card, { backgroundColor: theme.color.card }]}>
          <Text style={[styles.value, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.semibold }]}>
            {valueText}
          </Text>
          <Text style={[styles.small, muted]}>
            {[
              changeText ? `${improved === null ? "" : improved ? "↑ " : "↓ "}${changeText} ${m.forPeriod}` : null,
              data?.updatedAt ? fillTemplate(m.updated, { ago: dayMonth(data.updatedAt.slice(0, 10), language) }) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {points.length > 1 ? (
            <LineChart points={points} invert={isPace} height={120} theme={theme} accessibilityLabel={`${m.titles[metric]} ${valueText}`} />
          ) : data && data.value === null ? (
            <Text style={[styles.small, muted]}>{m.noData}</Text>
          ) : null}
          <Segmented
            segments={PERIODS.map((value) => ({ value, label: copy.progress.periods[value] }))}
            value={period}
            onChange={setPeriod}
            theme={theme}
            themeMode={themeMode}
          />
        </View>
      </ProfileSection>

      {data ? (
        <ProfileSection>
          <SectionTitle text={m.howTitle} theme={theme} />
          <ListCard theme={theme}>
            <ListRow theme={theme} title={m.source} description={m.sourceValue} />
            <ListRow
              theme={theme}
              title={m.accuracy}
              description={pluralize(m.accuracyCount, data.accuracy.efforts, language)}
              value={m.accuracyLevels[data.accuracy.level]}
            />
            {zonesText ? <ListRow theme={theme} title={m.zones} description={zonesText} onPress={onOpenHeart} /> : null}
          </ListCard>
          {zones && !zones.thresholdHeartRate ? <Footnote text={m.thresholdHint} theme={theme} /> : null}
        </ProfileSection>
      ) : null}

      {data?.paces ? (
        <ProfileSection>
          <SectionTitle text={m.planTitle} theme={theme} />
          <ListCard theme={theme}>
            <ListRow theme={theme} title={m.easy} value={paceRange(data.paces.easy)} />
            <ListRow theme={theme} title={m.tempo} value={paceRange(data.paces.tempo)} />
            <ListRow theme={theme} title={m.interval} value={paceRange(data.paces.interval)} />
          </ListCard>
        </ProfileSection>
      ) : null}

      {data?.topEfforts && data.topEfforts.length > 0 ? (
        <ProfileSection>
          <SectionTitle text={m.topTitle} theme={theme} />
          <ListCard theme={theme}>
            {data.topEfforts.map((effort) => (
              <ListRow
                key={effort.id}
                theme={theme}
                title={effort.title ?? format.distance(effort.distanceKm)}
                description={[dayMonth(effort.date, language), effort.title ? format.distance(effort.distanceKm) : null].filter(Boolean).join(" · ")}
                value={paceText(effort.paceSecondsPerKm)}
              />
            ))}
          </ListCard>
        </ProfileSection>
      ) : null}
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, gap: 12 },
  value: { fontSize: 34, lineHeight: 40, letterSpacing: -0.6, fontVariant: ["tabular-nums"] },
  small: { fontSize: 13, lineHeight: 18 },
});
