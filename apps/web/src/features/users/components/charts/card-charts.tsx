"use client";

import type { ReactElement, ReactNode } from "react";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@trefix/ui/components/chart";
import { cn } from "@trefix/ui/lib/utils";
import { formatHoursMinutesSeconds, formatMinutesSeconds } from "@trefix/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import { formatShortDate } from "@/features/users/lib/card-format";
import { useI18n } from "@/shared/i18n";

/*
 * Charts of a user's card. The admin theme is black and white, so a single
 * series is drawn in the foreground color and ordered magnitudes (heart rate
 * zones) use the grey chart ramp from light to dark.
 */

const SERIES = "var(--foreground)";
const MUTED_SERIES = "var(--chart-1)";
const ZONE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

/** Tooltip row: series name on the left, formatted value on the right. */
function TooltipRow({
  name,
  value,
}: {
  name: string;
  value: ReactNode;
}): ReactElement {
  return (
    <div className="flex w-full items-center justify-between gap-4 leading-none">
      <span className="text-muted-foreground">{name}</span>
      <span className="font-mono font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const;

/** Kilometres per week; the running week is drawn lighter because it is not over. */
export function WeeklyKmChart({
  weeks,
  className,
}: {
  weeks: readonly { weekStart: string; km: number; partial: boolean }[];
  className?: string;
}): ReactElement {
  const { t, locale } = useI18n();
  const config = {
    km: { label: t("userCard.charts.weeklyKm"), color: SERIES },
  } satisfies ChartConfig;
  const data = weeks.map((week) => ({
    ...week,
    label: formatShortDate(week.weekStart, locale),
  }));

  return (
    <ChartContainer
      config={config}
      className={cn("aspect-auto h-48 w-full", className)}
    >
      <BarChart accessibilityLayer data={data} barCategoryGap={4}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...axisProps} minTickGap={16} />
        <YAxis {...axisProps} width={32} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value, _name, item) => (
                <TooltipRow
                  name={
                    item.payload?.partial
                      ? t("userCard.charts.currentWeek")
                      : t("userCard.charts.weeklyKm")
                  }
                  value={t("userCard.overview.km", {
                    value: Number(value).toLocaleString(locale),
                  })}
                />
              )}
            />
          }
        />
        <Bar dataKey="km" radius={4} maxBarSize={28}>
          {data.map((week) => (
            <Cell
              key={week.weekStart}
              fill={week.partial ? MUTED_SERIES : SERIES}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Distance per month as an area, oldest month on the left. */
export function MonthlyDistanceChart({
  months,
}: {
  months: readonly {
    year: number;
    month: number;
    distanceKm: number;
    count: number;
  }[];
}): ReactElement {
  const { t, locale } = useI18n();
  const config = {
    distanceKm: { label: t("userCard.charts.monthlyKm"), color: SERIES },
  } satisfies ChartConfig;
  const monthFormat = new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "2-digit",
  });
  const data = [...months]
    .sort((a, b) => a.year - b.year || a.month - b.month)
    .map((item) => ({
      ...item,
      label: monthFormat.format(new Date(item.year, item.month - 1, 1)),
    }));

  return (
    <ChartContainer config={config} className="aspect-auto h-48 w-full">
      <AreaChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...axisProps} minTickGap={16} />
        <YAxis {...axisProps} width={32} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value, _name, item) => (
                <div className="grid w-full gap-1.5">
                  <TooltipRow
                    name={t("userCard.charts.monthlyKm")}
                    value={t("userCard.overview.km", {
                      value: Number(value).toLocaleString(locale),
                    })}
                  />
                  <TooltipRow
                    name={t("userCard.charts.workouts")}
                    value={item.payload?.count ?? 0}
                  />
                </div>
              )}
            />
          }
        />
        <Area
          dataKey="distanceKm"
          type="monotone"
          stroke="var(--color-distanceKm)"
          strokeWidth={2}
          fill="var(--color-distanceKm)"
          fillOpacity={0.08}
        />
      </AreaChart>
    </ChartContainer>
  );
}

/** Average easy pace by month; faster pace sits higher. */
export function PaceTrendChart({
  points,
}: {
  points: readonly { month: number; secPerKm: number }[];
}): ReactElement {
  const { t, locale } = useI18n();
  const config = {
    secPerKm: { label: t("userCard.charts.easyPace"), color: SERIES },
  } satisfies ChartConfig;
  const monthFormat = new Intl.DateTimeFormat(locale, { month: "short" });
  const data = points.map((point) => ({
    ...point,
    label: monthFormat.format(new Date(2000, point.month - 1, 1)),
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-48 w-full">
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis
          {...axisProps}
          width={40}
          reversed
          domain={["dataMin - 10", "dataMax + 10"]}
          tickFormatter={(value: number) => formatMinutesSeconds(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value) => (
                <TooltipRow
                  name={t("userCard.charts.easyPace")}
                  value={`${formatMinutesSeconds(Number(value))} /${t("userCard.units.km")}`}
                />
              )}
            />
          }
        />
        <Line
          dataKey="secPerKm"
          type="monotone"
          stroke="var(--color-secPerKm)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--background)", strokeWidth: 2 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

/** Share of time in each heart rate zone, from easy (light) to hard (dark). */
export function HeartRateZonesChart({
  zones,
}: {
  zones: readonly number[];
}): ReactElement {
  const { t } = useI18n();
  const config = {
    share: { label: t("userCard.charts.zoneShare"), color: SERIES },
  } satisfies ChartConfig;
  const data = zones.map((share, index) => ({
    zone: t("userCard.athlete.zone", { zone: index + 1 }),
    share,
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-48 w-full">
      <BarChart
        accessibilityLayer
        data={data}
        layout="vertical"
        barCategoryGap={4}
      >
        <XAxis type="number" hide domain={[0, 100]} />
        <YAxis type="category" dataKey="zone" {...axisProps} width={64} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value) => (
                <TooltipRow
                  name={t("userCard.charts.zoneShare")}
                  value={`${value}%`}
                />
              )}
            />
          }
        />
        <Bar
          dataKey="share"
          radius={4}
          label={{
            position: "right",
            className: "fill-muted-foreground text-xs",
            formatter: (value: unknown) => `${String(value)}%`,
          }}
        >
          {data.map((item, index) => (
            <Cell key={item.zone} fill={ZONE_COLORS[index] ?? SERIES} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Times on one distance over the dates they were run; faster sits higher. */
export function RecordHistoryChart({
  attempts,
}: {
  attempts: readonly { id: string; date: string; seconds: number }[];
}): ReactElement {
  const { t, locale } = useI18n();
  const config = {
    seconds: { label: t("userCard.progress.columns.time"), color: SERIES },
  } satisfies ChartConfig;
  const data = [...attempts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((attempt) => ({
      ...attempt,
      label: formatShortDate(attempt.date, locale),
    }));

  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" {...axisProps} minTickGap={16} />
        <YAxis
          {...axisProps}
          width={56}
          reversed
          domain={["dataMin - 15", "dataMax + 15"]}
          tickFormatter={(value: number) => formatHoursMinutesSeconds(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={(value) => (
                <TooltipRow
                  name={t("userCard.progress.columns.time")}
                  value={formatHoursMinutesSeconds(Number(value))}
                />
              )}
            />
          }
        />
        <Line
          dataKey="seconds"
          type="linear"
          stroke="var(--color-seconds)"
          strokeWidth={2}
          dot={{ r: 4, fill: "var(--background)", strokeWidth: 2 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

/** Pace of every kilometre of a recorded run; the unfinished last one is lighter. */
export function SplitsChart({
  splits,
}: {
  splits: readonly {
    km: number;
    paceSecPerKm: number;
    avgHeartRate?: number | null;
    partial?: boolean;
  }[];
}): ReactElement {
  const { t } = useI18n();
  const config = {
    paceSecPerKm: { label: t("userCard.charts.splitPace"), color: SERIES },
  } satisfies ChartConfig;
  const slowest = Math.max(...splits.map((split) => split.paceSecPerKm));
  // Bars grow with speed: the gap to the slowest split plus a floor keeps the shortest visible.
  const data = splits.map((split) => ({
    ...split,
    label: String(split.km),
    speed: slowest - split.paceSecPerKm + 15,
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-40 w-full">
      <BarChart accessibilityLayer data={data} barCategoryGap={2}>
        <XAxis dataKey="label" {...axisProps} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_label, payload) =>
                t("userCard.charts.kilometre", {
                  km: String(payload?.[0]?.payload?.km ?? ""),
                })
              }
              formatter={(_value, _name, item) => (
                <div className="grid w-full gap-1.5">
                  <TooltipRow
                    name={t("userCard.charts.splitPace")}
                    value={formatMinutesSeconds(
                      item.payload?.paceSecPerKm ?? 0,
                    )}
                  />
                  {item.payload?.avgHeartRate ? (
                    <TooltipRow
                      name={t("userCard.workout.result.heartRate")}
                      value={item.payload.avgHeartRate}
                    />
                  ) : null}
                </div>
              )}
            />
          }
        />
        <Bar dataKey="speed" radius={4} maxBarSize={24}>
          {data.map((split) => (
            <Cell key={split.km} fill={split.partial ? MUTED_SERIES : SERIES} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

/** Week rows of days: a run, a rest day, a missed workout or a day still ahead. */
export function RegularityGrid({
  weeks,
}: {
  weeks: readonly {
    weekStart: string;
    days: readonly ("run" | "rest" | "missed" | "future")[];
  }[];
}): ReactElement {
  const { t, locale } = useI18n();
  const dayClass: Record<string, string> = {
    run: "bg-foreground",
    rest: "bg-muted",
    missed: "border border-foreground/40 bg-transparent",
    future: "bg-transparent border border-dashed border-border",
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {weeks.map((week) => (
          <div key={week.weekStart} className="flex items-center gap-3">
            <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
              {formatShortDate(week.weekStart, locale)}
            </span>
            <div className="grid flex-1 grid-cols-7 gap-1.5">
              {week.days.map((day, index) => (
                <span
                  key={index}
                  title={t(`userCard.charts.regularity.${day}`)}
                  className={cn("h-4 rounded-[4px]", dayClass[day])}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(["run", "rest", "missed"] as const).map((day) => (
          <span key={day} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded-[3px]", dayClass[day])} />
            {t(`userCard.charts.regularity.${day}`)}
          </span>
        ))}
      </div>
    </div>
  );
}
