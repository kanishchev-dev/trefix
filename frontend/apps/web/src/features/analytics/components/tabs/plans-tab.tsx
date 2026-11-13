"use client";

import type { ReactElement } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";

import type { AnalyticsFilters } from "@/entities/analytics/api";
import { useI18n } from "@/shared/i18n";
import { ErrorState } from "@/widgets/data-state";

import { useAnalyticsPlans } from "../../hooks/use-analytics";
import { formatDay, formatNumber, formatPercent, sum } from "../../lib/format";
import {
  planDropInsight,
  planOutcomesInsight,
  type Insight,
} from "../../lib/insights";
import { ChartCard, StatRow } from "../chart-card";
import { SeriesBarChart, SeriesLineChart } from "../charts";

/** How plans are created, followed and finished. */
export function PlansTab({
  filters,
}: {
  filters: AnalyticsFilters;
}): ReactElement {
  const { t, locale } = useI18n();
  const query = useAnalyticsPlans(filters, true);
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const data = query.data;
  const loading = query.isPending;
  const num = (value: number | null | undefined): string =>
    formatNumber(value, locale);
  const text = (insight: Insight | null): string | undefined =>
    insight
      ? t(`analytics.insights.${insight.key}`, insight.params)
      : undefined;
  const created = data?.created ?? [];
  const createdTotal = sum(
    created.map((row) => row.ai + row.manual + row.rebuild),
  );

  return (
    <div className="grid gap-4 @3xl/main:grid-cols-2">
      <ChartCard
        title={t("analytics.plans.created")}
        description={
          data
            ? t("analytics.plans.createdCaption", {
                active: num(data.active),
                created: num(createdTotal),
              })
            : undefined
        }
        loading={loading}
        empty={createdTotal === 0}
      >
        <SeriesBarChart
          stacked
          data={created.map((row) => ({
            label: formatDay(row.week, locale),
            ai: row.ai,
            manual: row.manual,
            rebuild: row.rebuild,
          }))}
          series={[
            { key: "ai", label: t("analytics.plans.sources.ai") },
            { key: "manual", label: t("analytics.plans.sources.manual") },
            { key: "rebuild", label: t("analytics.plans.sources.rebuild") },
          ]}
          formatValue={num}
        />
      </ChartCard>

      <ChartCard
        title={t("analytics.plans.outcomes")}
        description={
          data ? text(planOutcomesInsight(data.outcomes)) : undefined
        }
        loading={loading}
      >
        {data ? (
          <div className="flex flex-col gap-5">
            <StatRow
              items={[
                {
                  label: t("analytics.plans.completed"),
                  value: num(data.outcomes.completed),
                },
                {
                  label: t("analytics.plans.cancelled"),
                  value: num(data.outcomes.cancelled),
                },
                {
                  label: t("analytics.plans.replaced"),
                  value: num(data.outcomes.replaced),
                },
              ]}
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {t("analytics.plans.whereQuit")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("analytics.plans.whereQuitCaption")}
              </span>
            </div>
            {data.outcomes.cancelled > 0 ? (
              <SeriesBarChart
                height={150}
                data={data.cancellationByProgress.map((row) => ({
                  label: t(`analytics.plans.progressBuckets.${row.bucket}`),
                  plans: row.plans,
                }))}
                series={[
                  { key: "plans", label: t("analytics.plans.cancelled") },
                ]}
                formatValue={num}
              />
            ) : (
              <span className="text-sm text-muted-foreground">
                {t("analytics.plans.noCancelled")}
              </span>
            )}
            {data.cancelReasons.length ? (
              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium">
                  {t("analytics.plans.cancelReasons")}
                </span>
                {data.cancelReasons.map((row) => (
                  <div
                    key={row.reason}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="truncate text-muted-foreground">
                      {t(`analytics.plans.reasons.${row.reason}`)}
                    </span>
                    <span className="tabular-nums">{num(row.plans)}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.plans.adherenceByWeek")}
        description={
          data
            ? (text(planDropInsight(data.adherenceByPlanWeek)) ??
              t("analytics.plans.adherenceCaption"))
            : undefined
        }
        loading={loading}
        empty={!data?.adherenceByPlanWeek.length}
      >
        {data ? (
          <SeriesLineChart
            data={data.adherenceByPlanWeek.map((row) => ({
              label: t("analytics.plans.weekShort", { week: row.planWeek }),
              adherence: row.adherencePct,
            }))}
            series={[
              { key: "adherence", label: t("analytics.plans.adherence") },
            ]}
            domain={[0, 100]}
            formatValue={(value) => formatPercent(value, locale)}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.plans.goalTypes")}
        description={t("analytics.plans.goalTypesCaption")}
        loading={loading}
        empty={!data?.goalTypes.length}
      >
        {data ? (
          <SeriesBarChart
            layout="horizontal"
            height={Math.max(data.goalTypes.length * 30 + 24, 120)}
            data={data.goalTypes.map((row) => ({
              label: t(`analytics.goalTypes.${row.goalType}`),
              goals: row.goals,
            }))}
            series={[{ key: "goals", label: t("analytics.plans.goals") }]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.plans.upcomingRaces")}
        description={
          data
            ? t("analytics.plans.upcomingCaption", {
                total: num(data.upcomingRaces.total),
              })
            : undefined
        }
        loading={loading}
        empty={!data?.upcomingRaces.total}
      >
        {data ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("analytics.plans.distance")}</TableHead>
                <TableHead className="text-right">
                  {t("analytics.plans.races")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.upcomingRaces.byDistance
                .filter((row) => row.races > 0)
                .map((row) => (
                  <TableRow key={row.distance}>
                    <TableCell>
                      {t(`analytics.distances.${row.distance}`)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.races)}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.plans.adaptations")}
        description={
          data?.adaptations.acceptanceRate !== null && data
            ? t("analytics.plans.acceptance", {
                value: formatPercent(data.adaptations.acceptanceRate, locale),
              })
            : undefined
        }
        loading={loading}
        empty={!data?.adaptations.proposed}
      >
        {data ? (
          <StatRow
            items={[
              {
                label: t("analytics.plans.proposed"),
                value: num(data.adaptations.proposed),
              },
              {
                label: t("analytics.plans.applied"),
                value: num(data.adaptations.applied),
              },
              {
                label: t("analytics.plans.dismissed"),
                value: num(data.adaptations.dismissed),
              },
            ]}
          />
        ) : null}
      </ChartCard>
    </div>
  );
}
