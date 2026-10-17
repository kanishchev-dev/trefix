"use client";

import { Fragment, type ReactElement, type ReactNode } from "react";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@trefix/ui/components/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@trefix/ui/components/tooltip";
import { cn } from "@trefix/ui/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

/*
 * Charts of the analytics dashboard. The admin theme is black and white:
 * the main series is drawn in the foreground colour, further series use the
 * grey ramp, and identity is always repeated in a legend and the tooltip.
 */

/** Series colours in the order they are assigned; never cycled. */
export const SERIES_COLORS = [
  "var(--foreground)",
  "var(--chart-2)",
  "var(--chart-1)",
  "var(--chart-3)",
  "var(--chart-4)",
] as const;

export type Series<TKey extends string> = {
  key: TKey;
  label: string;
  color?: string;
};

type Row = Record<string, string | number | null>;

/** Longest category label of a horizontal bar chart before it is cut. */
const CATEGORY_LABEL_MAX = 24;

/** Category label on one line; long labels are cut with an ellipsis. */
function CategoryTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
}): ReactElement {
  const value = String(payload?.value ?? "");
  const label =
    value.length > CATEGORY_LABEL_MAX
      ? `${value.slice(0, CATEGORY_LABEL_MAX - 1)}…`
      : value;
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      className="fill-muted-foreground text-xs"
    >
      <title>{value}</title>
      {label}
    </text>
  );
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const;

function chartConfig<TKey extends string>(
  series: readonly Series<TKey>[],
): ChartConfig {
  return Object.fromEntries(
    series.map((item, index) => [
      item.key,
      { label: item.label, color: item.color ?? SERIES_COLORS[index] },
    ]),
  );
}

function TooltipRow({
  name,
  value,
  color,
}: {
  name: ReactNode;
  value: ReactNode;
  color?: string;
}): ReactElement {
  return (
    <div className="flex w-full items-center justify-between gap-4 leading-none">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {color ? (
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ background: color }}
          />
        ) : null}
        {name}
      </span>
      <span className="font-mono font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}

function tooltipFormatter(format: (value: number) => string) {
  return function TooltipValue(
    value: unknown,
    name: unknown,
    item: { color?: string; name?: unknown },
  ): ReactElement {
    return (
      <TooltipRow
        name={String(item.name ?? name)}
        value={format(Number(value))}
        color={item.color}
      />
    );
  };
}

/** Vertical bars by category; stacked or side by side for several series. */
export function SeriesBarChart<TKey extends string>({
  data,
  series,
  categoryKey = "label",
  stacked = false,
  layout = "vertical",
  height = 192,
  formatValue = String,
  legend,
  className,
}: {
  data: readonly Row[];
  series: readonly Series<TKey>[];
  categoryKey?: string;
  stacked?: boolean;
  /** `horizontal` lays bars along the x axis with categories on the left. */
  layout?: "vertical" | "horizontal";
  height?: number;
  formatValue?: (value: number) => string;
  legend?: boolean;
  className?: string;
}): ReactElement {
  const horizontal = layout === "horizontal";
  const showLegend = legend ?? series.length > 1;
  return (
    <ChartContainer
      config={chartConfig(series)}
      className={cn("aspect-auto w-full", className)}
      style={{ height }}
    >
      <BarChart
        accessibilityLayer
        data={[...data]}
        layout={horizontal ? "vertical" : "horizontal"}
        barCategoryGap={horizontal ? 6 : 4}
        margin={{ left: horizontal ? 8 : 0, right: 8 }}
      >
        <CartesianGrid vertical={horizontal} horizontal={!horizontal} />
        {horizontal ? (
          <>
            <XAxis
              type="number"
              allowDecimals={false}
              {...axisProps}
              tickFormatter={(value: number) => formatValue(value)}
            />
            <YAxis
              type="category"
              dataKey={categoryKey}
              {...axisProps}
              width={168}
              interval={0}
              tick={<CategoryTick />}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={categoryKey} {...axisProps} minTickGap={12} />
            <YAxis
              {...axisProps}
              allowDecimals={false}
              width={40}
              tickFormatter={(value: number) => formatValue(value)}
            />
          </>
        )}
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              formatter={tooltipFormatter(formatValue)}
            />
          }
        />
        {showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
        {series.map((item, index) => (
          <Bar
            key={item.key}
            dataKey={item.key}
            name={item.label}
            stackId={stacked ? "stack" : undefined}
            fill={`var(--color-${item.key})`}
            stroke="var(--card)"
            strokeWidth={stacked ? 1 : 0}
            radius={
              stacked
                ? index === series.length - 1
                  ? horizontal
                    ? [0, 4, 4, 0]
                    : [4, 4, 0, 0]
                  : 0
                : 4
            }
            maxBarSize={horizontal ? 18 : 28}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/** Lines (optionally filled) over time; `reversed` puts smaller values on top. */
export function SeriesLineChart<TKey extends string>({
  data,
  series,
  categoryKey = "label",
  area = false,
  reversed = false,
  height = 192,
  formatValue = String,
  formatTick,
  domain,
  legend,
  className,
}: {
  data: readonly Row[];
  series: readonly Series<TKey>[];
  categoryKey?: string;
  area?: boolean;
  reversed?: boolean;
  height?: number;
  formatValue?: (value: number) => string;
  /** Axis labels when they need a shorter form than the tooltip. */
  formatTick?: (value: number) => string;
  domain?: [number | "auto" | "dataMin", number | "auto" | "dataMax"];
  legend?: boolean;
  className?: string;
}): ReactElement {
  const showLegend = legend ?? series.length > 1;
  const common = (
    <>
      <CartesianGrid vertical={false} />
      <XAxis dataKey={categoryKey} {...axisProps} minTickGap={24} />
      <YAxis
        {...axisProps}
        width={44}
        reversed={reversed}
        domain={domain ?? ["auto", "auto"]}
        tickFormatter={(value: number) => (formatTick ?? formatValue)(value)}
      />
      <ChartTooltip
        cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
        content={
          <ChartTooltipContent
            indicator="dot"
            formatter={tooltipFormatter(formatValue)}
          />
        }
      />
      {showLegend ? <ChartLegend content={<ChartLegendContent />} /> : null}
    </>
  );
  return (
    <ChartContainer
      config={chartConfig(series)}
      className={cn("aspect-auto w-full", className)}
      style={{ height }}
    >
      {area ? (
        <AreaChart
          accessibilityLayer
          data={[...data]}
          margin={{ left: 0, right: 8 }}
        >
          <defs>
            {series.map((item) => (
              <linearGradient
                key={item.key}
                id={`fill-${item.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="5%"
                  stopColor={`var(--color-${item.key})`}
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor={`var(--color-${item.key})`}
                  stopOpacity={0.03}
                />
              </linearGradient>
            ))}
          </defs>
          {common}
          {series.map((item) => (
            <Area
              key={item.key}
              dataKey={item.key}
              name={item.label}
              type="monotone"
              stroke={`var(--color-${item.key})`}
              strokeWidth={2}
              fill={`url(#fill-${item.key})`}
              connectNulls
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart
          accessibilityLayer
          data={[...data]}
          margin={{ left: 0, right: 8 }}
        >
          {common}
          {series.map((item) => (
            <Line
              key={item.key}
              dataKey={item.key}
              name={item.label}
              type="monotone"
              stroke={`var(--color-${item.key})`}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      )}
    </ChartContainer>
  );
}

/** Steps of a funnel as bars and shares of the first step. */
export function FunnelBars({
  steps,
  formatValue,
}: {
  steps: readonly { label: string; count: number }[];
  formatValue: (value: number) => string;
}): ReactElement {
  const first = steps[0]?.count ?? 0;
  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((step) => {
        const width = first
          ? Math.max((step.count / first) * 100, step.count ? 2 : 0)
          : 0;
        const share = first ? Math.round((step.count / first) * 100) : 0;
        return (
          <div
            key={step.label}
            className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3"
          >
            <span className="truncate text-sm">{step.label}</span>
            <div className="h-6 overflow-hidden rounded-md bg-muted">
              <div
                className="h-full rounded-md bg-foreground transition-[width]"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
              {formatValue(step.count)} · {share}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Grid of cells shaded by value (weekday × hour, cohort × week). */
export function HeatGrid({
  rows,
  columns,
  value,
  label,
  cellTitle,
  rowHeader,
  formatCell,
}: {
  rows: readonly string[];
  columns: readonly string[];
  value: (row: number, column: number) => number | null;
  label?: (column: number) => string | null;
  cellTitle: (row: number, column: number) => string;
  rowHeader: (row: number) => ReactNode;
  formatCell?: (value: number) => string;
}): ReactElement {
  let max = 0;
  rows.forEach((_, row) =>
    columns.forEach((__, column) => {
      max = Math.max(max, value(row, column) ?? 0);
    }),
  );
  return (
    <div className="overflow-x-auto">
      <div
        className="grid min-w-max gap-0.5"
        style={{
          gridTemplateColumns: `auto repeat(${columns.length}, minmax(1.25rem, 1fr))`,
        }}
      >
        {rows.map((rowKey, row) => (
          <Fragment key={rowKey}>
            <div className="pr-2 text-xs leading-6 whitespace-nowrap text-muted-foreground">
              {rowHeader(row)}
            </div>
            {columns.map((columnKey, column) => {
              const cell = value(row, column);
              const intensity = cell === null || !max ? 0 : cell / max;
              return (
                <Tooltip key={columnKey}>
                  <TooltipTrigger
                    render={<div />}
                    className={cn(
                      "flex h-6 items-center justify-center rounded-[4px] text-[10px] tabular-nums",
                      cell === null ? "bg-transparent" : "bg-muted",
                    )}
                    style={
                      cell === null
                        ? undefined
                        : {
                            background: `color-mix(in oklab, var(--foreground) ${Math.round(6 + intensity * 86)}%, var(--muted))`,
                            color:
                              intensity > 0.55
                                ? "var(--background)"
                                : "var(--foreground)",
                          }
                    }
                  >
                    {cell !== null && formatCell ? formatCell(cell) : null}
                  </TooltipTrigger>
                  {cell !== null ? (
                    <TooltipContent>{cellTitle(row, column)}</TooltipContent>
                  ) : null}
                </Tooltip>
              );
            })}
          </Fragment>
        ))}
        {label ? (
          <>
            <div />
            {columns.map((columnKey, column) => (
              <div
                key={columnKey}
                className="pt-1 text-center text-[10px] text-muted-foreground"
              >
                {label(column)}
              </div>
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}
