"use client";

import { useState, type ReactElement } from "react";

import { ANALYTICS_RANGES, type AnalyticsRange } from "@trefix/api-client";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@trefix/ui/components/select";
import { Skeleton } from "@trefix/ui/components/skeleton";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@trefix/ui/components/toggle-group";

import type { AnalyticsFilters } from "@/entities/analytics/api";
import { useI18n } from "@/shared/i18n";

import { useAnalyticsActivity } from "../hooks/use-analytics";
import { formatDay, formatNumber } from "../lib/format";
import { activityInsight } from "../lib/insights";
import { SERIES_COLORS, SeriesLineChart } from "./charts";

const METRICS = ["runners", "workouts", "distanceKm"] as const;
type Metric = (typeof METRICS)[number];

/** Main chart: who opened the app and who trained, by day (dashboard-01 interactive area chart). */
export function ActivityChart({
  filters,
  range,
  onRangeChange,
}: {
  filters: AnalyticsFilters;
  range: AnalyticsRange;
  onRangeChange: (range: AnalyticsRange) => void;
}): ReactElement {
  const { t, locale } = useI18n();
  const [metric, setMetric] = useState<Metric>("runners");
  const query = useAnalyticsActivity(filters, range);
  const activity = query.data;
  const insight = activity ? activityInsight(activity) : null;

  const data = (activity?.points ?? []).map((point) => ({
    label: formatDay(point.date, locale),
    activeUsers: point.activeUsers,
    runners: point.runners,
    workouts: point.workouts,
    distanceKm: point.distanceKm,
  }));
  // Distance has its own unit, so it is drawn alone rather than on a second axis.
  const series =
    metric === "distanceKm"
      ? [
          {
            key: "distanceKm",
            label: t("analytics.activity.distanceKm"),
            color: SERIES_COLORS[0],
          },
        ]
      : [
          {
            key: "activeUsers",
            label: t("analytics.activity.activeUsers"),
            color: "var(--chart-1)",
          },
          {
            key: metric,
            label: t(`analytics.activity.${metric}`),
            color: SERIES_COLORS[0],
          },
        ];
  const rangeLabel = (value: AnalyticsRange): string =>
    t(`analytics.ranges.${value}`);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="font-medium">
          {t("analytics.activity.title")}
        </CardTitle>
        <CardDescription className="truncate">
          <span className="hidden @[540px]/card:inline">
            {insight
              ? t(`analytics.insights.${insight.key}`, {
                  runners: formatNumber(insight.params?.runners, locale),
                  share: insight.params?.share ?? 0,
                })
              : t("analytics.activity.subtitle")}
          </span>
          <span className="@[540px]/card:hidden">
            {t("analytics.activity.byDay")}
          </span>
        </CardDescription>
        <CardAction className="flex flex-wrap items-center justify-end gap-2">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[metric]}
            onValueChange={(value: string[]) => {
              const next = value[0] as Metric | undefined;
              if (next) setMetric(next);
            }}
            className="hidden @[767px]/card:flex"
          >
            {METRICS.map((item) => (
              <ToggleGroupItem key={item} value={item} className="px-3">
                {t(`analytics.activity.${item}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[range]}
            onValueChange={(value: string[]) => {
              const next = value[0] as AnalyticsRange | undefined;
              if (next) onRangeChange(next);
            }}
            className="hidden @[767px]/card:flex"
          >
            {[...ANALYTICS_RANGES].reverse().map((item) => (
              <ToggleGroupItem key={item} value={item} className="px-3">
                {rangeLabel(item)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Select
            items={METRICS.map((item) => ({
              value: item,
              label: t(`analytics.activity.${item}`),
            }))}
            value={metric}
            onValueChange={(next) => {
              if (next) setMetric(next as Metric);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-36 @[767px]/card:hidden"
              aria-label={t("analytics.activity.metric")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METRICS.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`analytics.activity.${item}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            items={[...ANALYTICS_RANGES].map((item) => ({
              value: item,
              label: rangeLabel(item),
            }))}
            value={range}
            onValueChange={(next) => {
              if (next) onRangeChange(next as AnalyticsRange);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-32 @[767px]/card:hidden"
              aria-label={t("analytics.activity.range")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...ANALYTICS_RANGES].reverse().map((item) => (
                <SelectItem key={item} value={item}>
                  {rangeLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {query.isPending ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          <SeriesLineChart
            area
            data={data}
            series={series}
            height={260}
            formatValue={(value) => formatNumber(value, locale)}
          />
        )}
      </CardContent>
    </Card>
  );
}
