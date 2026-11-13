"use client";

import type { ReactElement } from "react";

import { Progress } from "@trefix/ui/components/progress";

import type { AnalyticsFilters } from "@/entities/analytics/api";
import { useI18n } from "@/shared/i18n";
import { ErrorState } from "@/widgets/data-state";

import { useAnalyticsEngagement } from "../../hooks/use-analytics";
import { formatDay, formatNumber, formatPercent, sum } from "../../lib/format";
import {
  regularityInsight,
  whenTheyRunInsight,
  type Insight,
} from "../../lib/insights";
import { ChartCard, StatRow } from "../chart-card";
import { HeatGrid, SeriesBarChart, SeriesLineChart } from "../charts";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour));

/** Weekday names starting from Monday in the interface language. */
function weekdayNames(
  locale: string,
  width: "short" | "long" = "short",
): string[] {
  const format = new Intl.DateTimeFormat(locale, { weekday: width });
  // 1 January 2024 is a Monday.
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(2024, 0, 1 + index)),
  );
}

/** Regularity, habit formation, retention and when people run. */
export function EngagementTab({
  filters,
}: {
  filters: AnalyticsFilters;
}): ReactElement {
  const { t, locale } = useI18n();
  const query = useAnalyticsEngagement(filters, true);
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const data = query.data;
  const loading = query.isPending;
  const num = (value: number | null | undefined): string =>
    formatNumber(value, locale);
  const text = (
    insight: Insight | null,
    params?: Record<string, string | number>,
  ): string | undefined =>
    insight
      ? t(`analytics.insights.${insight.key}`, { ...insight.params, ...params })
      : undefined;
  const weekdays = weekdayNames(locale);
  const weekdaysLong = weekdayNames(locale, "long");

  const peak = data ? whenTheyRunInsight(data.whenTheyRun) : null;
  const cellOf = (weekday: number, hour: number): number | null =>
    data?.whenTheyRun.find(
      (cell) => cell.weekday === weekday && cell.hour === hour,
    )?.workouts ?? 0;
  const cohorts = data?.cohorts ?? [];
  const cohortDepth = Math.max(
    0,
    ...cohorts.map((cohort) => cohort.retention.length),
  );
  const habit = data?.habit;
  const sources = data?.sources ?? [];

  return (
    <div className="grid gap-4 @3xl/main:grid-cols-2">
      <ChartCard
        title={t("analytics.engagement.regularity")}
        description={
          data ? text(regularityInsight(data.regularity)) : undefined
        }
        loading={loading}
        empty={!data || sum(data.regularity.map((row) => row.users)) === 0}
        footer={
          <span className="text-muted-foreground">
            {t("analytics.engagement.regularityAxis")}
          </span>
        }
      >
        {data ? (
          <SeriesBarChart
            data={data.regularity.map((row) => ({
              label: String(row.weeks),
              users: row.users,
            }))}
            series={[
              { key: "users", label: t("analytics.engagement.runners") },
            ]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.engagement.habit")}
        description={t("analytics.engagement.habitCaption")}
        loading={loading}
      >
        {habit && data ? (
          <div className="flex flex-col gap-5">
            <StatRow
              items={[
                {
                  label: t("analytics.engagement.started"),
                  value: num(habit.startedRunning),
                },
                {
                  label: t("analytics.engagement.formed"),
                  value: num(habit.formedHabit),
                },
                {
                  label: t("analytics.engagement.conversion"),
                  value: formatPercent(habit.rate, locale),
                },
              ]}
            />
            <Progress
              value={habit.rate ?? 0}
              aria-label={t("analytics.engagement.conversion")}
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {t("analytics.engagement.firstWorkout")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("analytics.engagement.firstWorkoutMedian", {
                  hours: num(data.timeToFirstWorkout.medianHours),
                })}
              </span>
            </div>
            <SeriesBarChart
              height={150}
              data={data.timeToFirstWorkout.buckets.map((row) => ({
                label: t(`analytics.firstWorkoutBuckets.${row.bucket}`),
                users: row.users,
              }))}
              series={[
                { key: "users", label: t("analytics.engagement.users") },
              ]}
              formatValue={num}
            />
          </div>
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.engagement.activeDays")}
        description={t("analytics.engagement.activeDaysCaption")}
        loading={loading}
        empty={!data || sum(data.activeDays.map((row) => row.users)) === 0}
      >
        {data ? (
          <SeriesBarChart
            data={data.activeDays.map((row) => ({
              label: String(row.days),
              users: row.users,
            }))}
            series={[
              { key: "users", label: t("analytics.engagement.runners") },
            ]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.engagement.sources")}
        description={t("analytics.engagement.sourcesCaption")}
        loading={loading}
        empty={sources.every(
          (row) =>
            row.trefix +
              row.strava +
              row.garmin +
              row.appleHealth +
              row.healthConnect +
              row.manual ===
            0,
        )}
      >
        <SeriesBarChart
          stacked
          height={220}
          data={sources.map((row) => ({
            label: formatDay(row.week, locale),
            trefix: row.trefix,
            appleHealth: row.appleHealth,
            strava: row.strava,
            other: row.garmin + row.healthConnect,
            manual: row.manual,
          }))}
          series={[
            { key: "trefix", label: t("analytics.sources.trefix") },
            { key: "appleHealth", label: t("analytics.sources.apple_health") },
            { key: "strava", label: t("analytics.sources.strava") },
            { key: "other", label: t("analytics.sources.other") },
            { key: "manual", label: t("analytics.sources.manual") },
          ]}
          formatValue={num}
        />
      </ChartCard>

      <ChartCard
        title={t("analytics.engagement.cohorts")}
        description={t("analytics.engagement.cohortsCaption")}
        loading={loading}
        empty={cohorts.length === 0}
        className="@3xl/main:col-span-2"
      >
        <HeatGrid
          rows={cohorts.map((cohort) => cohort.week)}
          columns={Array.from({ length: cohortDepth }, (_, index) =>
            String(index),
          )}
          value={(row, column) => cohorts[row].retention[column] ?? null}
          formatCell={(value) => `${Math.round(value)}`}
          label={(column) => String(column)}
          rowHeader={(row) => (
            <span className="tabular-nums">
              {formatDay(cohorts[row].week, locale)} · {num(cohorts[row].size)}
            </span>
          )}
          cellTitle={(row, column) =>
            t("analytics.engagement.cohortCell", {
              week: column,
              share: formatPercent(cohorts[row].retention[column], locale),
            })
          }
        />
      </ChartCard>

      <ChartCard
        title={t("analytics.engagement.whenTheyRun")}
        description={
          peak
            ? t("analytics.insights.peakHour", {
                weekday: weekdaysLong[(peak.params?.weekday ?? 1) - 1],
                hour: peak.params?.hour ?? 0,
              })
            : undefined
        }
        loading={loading}
        empty={!data?.whenTheyRun.length}
      >
        <HeatGrid
          rows={weekdays}
          columns={HOURS}
          value={(row, column) => cellOf(row + 1, column)}
          label={(column) => (column % 6 === 0 ? String(column) : null)}
          rowHeader={(row) => weekdays[row]}
          cellTitle={(row, column) =>
            t("analytics.engagement.heatCell", {
              weekday: weekdaysLong[row],
              hour: column,
              workouts: num(cellOf(row + 1, column)),
            })
          }
        />
      </ChartCard>

      <ChartCard
        title={t("analytics.engagement.stickiness")}
        description={
          data?.stickinessSeries.length
            ? t("analytics.engagement.stickinessNow", {
                value: formatPercent(
                  data.stickinessSeries[data.stickinessSeries.length - 1]
                    .stickiness,
                  locale,
                ),
              })
            : undefined
        }
        loading={loading}
        empty={!data || data.stickinessSeries.every((point) => point.mau === 0)}
      >
        {data ? (
          <SeriesLineChart
            data={data.stickinessSeries.map((point) => ({
              label: formatDay(point.date, locale),
              dau: point.dau,
              wau: point.wau,
              mau: point.mau,
            }))}
            series={[
              { key: "dau", label: "DAU" },
              { key: "wau", label: "WAU" },
              { key: "mau", label: "MAU" },
            ]}
            domain={[0, "auto"]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>
    </div>
  );
}
