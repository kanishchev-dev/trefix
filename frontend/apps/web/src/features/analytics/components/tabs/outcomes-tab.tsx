"use client";

import type { ReactElement } from "react";

import type { AnalyticsFilters } from "@/entities/analytics/api";
import { useI18n } from "@/shared/i18n";
import { ErrorState } from "@/widgets/data-state";

import { useAnalyticsOutcomes } from "../../hooks/use-analytics";
import {
  formatDay,
  formatNumber,
  formatPercent,
  formatSigned,
  sum,
} from "../../lib/format";
import {
  fitnessInsight,
  goalFunnelInsight,
  goalsInsight,
  racesInsight,
  recordsInsight,
  safetyInsight,
  volumeInsight,
  type Insight,
} from "../../lib/insights";
import { ChartCard, StatRow } from "../chart-card";
import { FunnelBars, SeriesBarChart, SeriesLineChart } from "../charts";

/** Are people getting what they came for: goals, form, records, safe load. */
export function OutcomesTab({
  filters,
}: {
  filters: AnalyticsFilters;
}): ReactElement {
  const { t, locale } = useI18n();
  const query = useAnalyticsOutcomes(filters, true);
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const data = query.data;
  const loading = query.isPending;
  const num = (value: number | null | undefined): string =>
    formatNumber(value, locale);
  const text = (
    insight: Insight | null,
    extra?: Record<string, string>,
  ): string | undefined =>
    insight
      ? t(`analytics.insights.${insight.key}`, { ...insight.params, ...extra })
      : undefined;

  const goals = data?.goals;
  const categories = (goals?.byCategory ?? []).filter(
    (row) =>
      row.onTrack +
        row.atRisk +
        row.noData +
        row.achieved +
        row.missed +
        row.abandoned >
      0,
  );
  const fitness = data?.fitness;
  const fitnessStats = fitness
    ? [
        {
          label: t("analytics.outcomes.improved"),
          value: formatPercent(
            fitness.athletes
              ? (fitness.improved / fitness.athletes) * 100
              : null,
            locale,
          ),
        },
        {
          label: t("analytics.outcomes.stable"),
          value: formatPercent(
            fitness.athletes ? (fitness.stable / fitness.athletes) * 100 : null,
            locale,
          ),
        },
        {
          label: t("analytics.outcomes.declined"),
          value: formatPercent(
            fitness.athletes
              ? (fitness.declined / fitness.athletes) * 100
              : null,
            locale,
          ),
        },
        {
          label: t("analytics.outcomes.athletes"),
          value: num(fitness.athletes),
        },
      ]
    : [];

  return (
    <div className="grid gap-4 @3xl/main:grid-cols-2">
      <ChartCard
        title={t("analytics.outcomes.goals")}
        description={goals ? text(goalsInsight(goals)) : undefined}
        loading={loading}
        empty={!goals?.snapshotDate}
        emptyHint={t("analytics.empty.nightly")}
      >
        {goals ? (
          <div className="flex flex-col gap-5">
            <StatRow
              items={[
                {
                  label: t("analytics.goalStatus.achieved"),
                  value: num(goals.finished.achieved),
                },
                {
                  label: t("analytics.goalStatus.missed"),
                  value: num(goals.finished.missed),
                },
                {
                  label: t("analytics.goalStatus.abandoned"),
                  value: num(goals.finished.abandoned),
                },
                {
                  label: t("analytics.outcomes.successRate"),
                  value: formatPercent(goals.finished.rate, locale),
                },
              ]}
            />
            <SeriesBarChart
              layout="horizontal"
              stacked
              height={Math.max(categories.length * 36 + 48, 120)}
              data={categories.map((row) => ({
                label: t(`analytics.goalCategories.${row.category}`),
                onTrack: row.onTrack,
                atRisk: row.atRisk,
                noData: row.noData,
              }))}
              series={[
                { key: "onTrack", label: t("analytics.goalStatus.on_track") },
                { key: "atRisk", label: t("analytics.goalStatus.at_risk") },
                { key: "noData", label: t("analytics.goalStatus.no_data") },
              ]}
              formatValue={num}
            />
          </div>
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.outcomes.goalPath")}
        description={
          data ? text(goalFunnelInsight(data.goalFunnel)) : undefined
        }
        loading={loading}
        empty={!data?.goalFunnel[0]?.count}
      >
        {data ? (
          <FunnelBars
            steps={data.goalFunnel.map((step) => ({
              label: t(`analytics.funnel.${step.step}`),
              count: step.count,
            }))}
            formatValue={num}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.outcomes.fitness")}
        description={
          fitness
            ? text(fitnessInsight(fitness), {
                seconds: num(
                  Math.abs(fitness.thresholdPaceChangeMedianSec ?? 0),
                ),
              })
            : undefined
        }
        loading={loading}
        empty={!fitness?.athletes}
        emptyHint={t("analytics.empty.fitness")}
        footer={<StatRow items={fitnessStats} />}
      >
        {fitness &&
        fitness.series.some(
          (point) => point.thresholdPaceChangeMedianSec !== null,
        ) ? (
          <SeriesLineChart
            reversed
            data={fitness.series.map((point) => ({
              label: formatDay(point.date, locale),
              pace: point.thresholdPaceChangeMedianSec,
            }))}
            series={[
              { key: "pace", label: t("analytics.outcomes.paceChange") },
            ]}
            formatValue={(value) =>
              formatSigned(value, locale, t("analytics.units.secPerKm"))
            }
            formatTick={(value) => formatSigned(value, locale)}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.outcomes.records")}
        description={data ? text(recordsInsight(data.records)) : undefined}
        loading={loading}
        empty={!data || data.records.improvements + data.records.firsts === 0}
      >
        {data ? (
          <SeriesBarChart
            stacked
            data={data.records.weekly.map((week) => ({
              label: formatDay(week.week, locale),
              improvements: week.improvements,
              firsts: week.firsts,
            }))}
            series={[
              {
                key: "improvements",
                label: t("analytics.outcomes.improvements"),
              },
              { key: "firsts", label: t("analytics.outcomes.firsts") },
            ]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.outcomes.races")}
        description={data ? text(racesInsight(data.raceResults)) : undefined}
        loading={loading}
        empty={!data || sum(data.raceResults.map((row) => row.count)) === 0}
        emptyHint={t("analytics.empty.races")}
      >
        {data ? (
          <SeriesBarChart
            data={data.raceResults.map((row) => ({
              label: t(`analytics.raceBuckets.${row.bucket}`),
              races: row.count,
            }))}
            series={[
              { key: "races", label: t("analytics.outcomes.racesCount") },
            ]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.outcomes.safety")}
        description={
          data
            ? text(safetyInsight(data.safety), {
                share: num(data.safety.currentShare),
              })
            : undefined
        }
        loading={loading}
        empty={!data || data.safety.currentShare === null}
      >
        {data && data.safety.series.some((point) => point.share !== null) ? (
          <SeriesLineChart
            data={data.safety.series.map((point) => ({
              label: formatDay(point.date, locale),
              share: point.share,
            }))}
            series={[
              { key: "share", label: t("analytics.outcomes.overloadShare") },
            ]}
            domain={[0, "auto"]}
            formatValue={(value) => formatPercent(value, locale)}
          />
        ) : (
          <StatRow
            items={[
              {
                label: t("analytics.outcomes.overloadShare"),
                value: formatPercent(data?.safety.currentShare, locale),
              },
            ]}
          />
        )}
      </ChartCard>

      <ChartCard
        title={t("analytics.outcomes.volume")}
        description={
          data
            ? text(volumeInsight(data.volume), {
                from: num(
                  data.volume.find((week) => week.medianKm !== null)?.medianKm,
                ),
                to: num(
                  [...data.volume]
                    .reverse()
                    .find((week) => week.medianKm !== null)?.medianKm,
                ),
              })
            : undefined
        }
        loading={loading}
        empty={!data || data.volume.every((week) => week.medianKm === null)}
        className="@3xl/main:col-span-2"
      >
        {data ? (
          <SeriesLineChart
            area
            data={data.volume.map((week) => ({
              label: formatDay(week.week, locale),
              km: week.medianKm,
            }))}
            series={[{ key: "km", label: t("analytics.outcomes.medianKm") }]}
            domain={[0, "auto"]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>
    </div>
  );
}
