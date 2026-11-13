import { formatHoursMinutesSeconds, formatMinutesSeconds } from "@trefix/utils";

import {
  fillTemplate,
  formatDateLong,
  formatDayMonth,
  getShortDayName,
  getShortMonthName,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { type Formatter } from "../../profile/lib/profile-format";
import { formatNumber, kmToDisplay } from "../../../shared/lib/units";
import {
  type ProgressMetric,
  type ProgressPeriod,
  type ProgressWorkout,
} from "../data/progress-model";
import {
  parseYmd,
  type ProgressBucket,
  type ProgressComparisonResult,
  type ProgressHighlightItem,
  type ProgressHighlightMain,
  type ProgressPlanExecutionView,
} from "./progress-selectors";

/** Display strings for the Progress section: copy + unit formatter, no React. */

export type ProgressTextContext = {
  copy: MainCopy;
  language: AppLanguage;
  format: Formatter;
};

const FEET_PER_METER = 3.28084;

function dateOf(iso: string): Date {
  const { year, month, day } = parseYmd(iso);
  return new Date(year, month, day);
}

export function elevationText(
  ctx: ProgressTextContext,
  meters: number,
): string {
  const units = ctx.copy.progressOverview.units;
  return ctx.format.units === "imperial"
    ? `${formatNumber(Math.round(meters * FEET_PER_METER), 0, ctx.format.locale)} ${units.ft}`
    : `${formatNumber(Math.round(meters), 0, ctx.format.locale)} ${units.m}`;
}

export function paceText(ctx: ProgressTextContext, secPerKm: number): string {
  const labels = ctx.format.labels;
  const imperial = ctx.format.units === "imperial";
  const value = imperial ? secPerKm / kmToDisplay(1, "imperial") : secPerKm;
  return `${formatMinutesSeconds(value)} ${imperial ? labels.perMi : labels.perKm}`;
}

/** A metric value with units; distance keeps one decimal. */
export function metricText(
  ctx: ProgressTextContext,
  metric: ProgressMetric,
  value: number,
): string {
  if (metric === "distance") return ctx.format.distance(value, 1);
  if (metric === "time") return ctx.format.minutes(Math.round(value));
  return elevationText(ctx, value);
}

/** Compact value for the metric tabs: time as h:mm. */
export function metricTabText(
  ctx: ProgressTextContext,
  metric: ProgressMetric,
  value: number | null,
): string {
  if (value === null) return "—";
  if (metric === "time") {
    const minutes = Math.round(value);
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
  }
  return metricText(ctx, metric, value);
}

/** Whole days from `from` to `to` (ISO dates). */
export function daysUntil(from: string, to: string): number {
  return Math.round(
    (dateOf(to).getTime() - dateOf(from).getTime()) / 86_400_000,
  );
}

/** "В октябре 8 тренировок". */
export function headlineText(
  ctx: ProgressTextContext,
  period: ProgressPeriod,
  count: number,
  asOf: string,
): string {
  const t = ctx.copy.progressOverview;
  const { year, month } = parseYmd(asOf);
  return pluralize(t.headline[period], count, ctx.language, {
    month: t.monthsIn[month] ?? "",
    year,
  });
}

function compareScope(
  ctx: ProgressTextContext,
  scope: ProgressComparisonResult["scope"],
  asOf: string,
): string {
  const t = ctx.copy.progressOverview.compare.scope;
  const { year, month, day } = parseYmd(asOf);
  if (scope === "week") return t.week;
  if (scope === "year") return fillTemplate(t.year, { year: year - 1 });
  const previous = new Date(year, month - 1, 1);
  const lastDay = Math.min(day, new Date(year, month, 0).getDate());
  const end = new Date(previous.getFullYear(), previous.getMonth(), lastDay);
  const range =
    ctx.language === "ru"
      ? `1–${formatDateLong(end, ctx.language)}`
      : `${formatDateLong(previous, ctx.language)}–${lastDay}`;
  return fillTemplate(t.month, { range });
}

/** "Вы пробежали на 18,5 км больше, чем за 1–15 сентября". */
export function compareText(
  ctx: ProgressTextContext,
  metric: ProgressMetric,
  period: ProgressPeriod,
  comparison: ProgressComparisonResult | null,
  asOf: string,
  firstWorkoutDate: string | null,
): string {
  const t = ctx.copy.progressOverview.compare;
  if (period === "all") {
    return firstWorkoutDate
      ? fillTemplate(t.since, {
          date:
            formatDateLong(dateOf(firstWorkoutDate), ctx.language) +
            ` ${parseYmd(firstWorkoutDate).year}`,
        })
      : t.unavailable;
  }
  if (!comparison) return t.unavailable;
  const template = comparison.diff >= 0 ? t[metric].more : t[metric].less;
  return fillTemplate(template, {
    value: metricText(ctx, metric, Math.abs(comparison.diff)),
    scope: compareScope(ctx, comparison.scope, asOf),
  });
}

/** Axis label under a bar; empty when the bar is not labelled. */
export function bucketAxisLabel(
  ctx: ProgressTextContext,
  bucket: ProgressBucket,
  index: number,
  total: number,
): string {
  if (bucket.kind === "year") return bucket.key;
  if (bucket.kind === "month") {
    const name = getShortMonthName(
      Number(bucket.key.slice(5, 7)) - 1,
      ctx.language,
    );
    return name.slice(0, 1).toUpperCase();
  }
  if (total === 7)
    return getShortDayName(dateOf(bucket.key).getDay(), ctx.language);
  const day = index + 1;
  return day === 1 || day % 7 === 1 ? String(day) : "";
}

/** "15 окт · 6,1 км", "16 окт · впереди". */
export function bucketTipText(
  ctx: ProgressTextContext,
  bucket: ProgressBucket,
  metric: ProgressMetric,
): string {
  const t = ctx.copy.progressOverview.chart;
  let when: string;
  if (bucket.kind === "day") when = formatDayMonth(bucket.key, ctx.language);
  else if (bucket.kind === "month") {
    const name = getShortMonthName(
      Number(bucket.key.slice(5, 7)) - 1,
      ctx.language,
    );
    when = `${name} ${bucket.key.slice(0, 4)}`;
  } else when = bucket.key;
  if (bucket.state === "future") return `${when} · ${t.future}`;
  if (bucket.value === null) return when;
  if (bucket.value === 0) return `${when} · ${t.noWorkouts}`;
  return `${when} · ${metricText(ctx, metric, bucket.value)}`;
}

export type HighlightMainText = { value: string; text: string };

export function highlightTitle(
  ctx: ProgressTextContext,
  period: ProgressPeriod,
  asOf: string,
): string {
  const t = ctx.copy.progressOverview.highlights.title;
  const { year, month } = parseYmd(asOf);
  return fillTemplate(t[period], {
    month: ctx.copy.progressOverview.monthsIn[month] ?? "",
    year,
  });
}

export function highlightMainText(
  ctx: ProgressTextContext,
  main: ProgressHighlightMain,
  firstWorkoutDate: string | null,
): HighlightMainText {
  const t = ctx.copy.progressOverview.highlights;
  if (main.kind === "pace") {
    const diff = Math.round(main.from - main.to);
    const from = formatMinutesSeconds(main.from);
    return {
      value: `${from} → ${paceText(ctx, main.to)}`,
      text: fillTemplate(diff >= 0 ? t.paceFaster : t.paceSlower, {
        value: pluralize(t.seconds, Math.abs(diff), ctx.language),
      }),
    };
  }
  const to = ctx.format.distance(main.to, 1);
  if (main.from === null) {
    return {
      value: to,
      text: fillTemplate(t.volumeTotal, {
        year: firstWorkoutDate ? parseYmd(firstWorkoutDate).year : "",
      }),
    };
  }
  const diff = main.to - main.from;
  return {
    value: `${formatNumber(Math.round(kmToDisplay(main.from, ctx.format.units) * 10) / 10, 1, ctx.format.locale)} → ${to}`,
    text: fillTemplate(diff >= 0 ? t.volumeMore : t.volumeLess, {
      value: ctx.format.distance(Math.abs(diff), 1),
    }),
  };
}

export type HighlightItemText = {
  label: string;
  value: string;
  note: string | null;
};

export function highlightItemText(
  ctx: ProgressTextContext,
  item: ProgressHighlightItem,
): HighlightItemText {
  const t = ctx.copy.progressOverview.highlights;
  const bpm = ctx.copy.profile.unitLabels.bpm;
  switch (item.kind) {
    case "longest":
      return {
        label: t.longest,
        value: ctx.format.distance(item.km, 1),
        note: item.previousKm
          ? fillTemplate(t.was, {
              value: ctx.format.distance(item.previousKm, 1),
            })
          : null,
      };
    case "heartRate":
      return {
        label: t.heartRate,
        value: `${Math.round(item.value)} ${bpm}`,
        note: item.previous
          ? fillTemplate(t.was, { value: String(Math.round(item.previous)) })
          : null,
      };
    case "record":
      return {
        label: fillTemplate(t.record, {
          distance: ctx.format.distance(item.distanceKm, 0),
        }),
        value: formatHoursMinutesSeconds(item.seconds),
        note: formatDayMonth(item.date, ctx.language),
      };
    case "records":
      return {
        label: t.records,
        value: String(item.count),
        note: t.recordsSub,
      };
  }
}

export function planScopeText(
  ctx: ProgressTextContext,
  view: ProgressPlanExecutionView,
  asOf: string,
  planStart: string,
): string {
  const t = ctx.copy.progressOverview.plan.scope;
  if (view.scope === "week") return t.week;
  if (view.scope === "sinceStart") {
    return fillTemplate(t.sinceStart, {
      date: formatDateLong(dateOf(planStart), ctx.language),
    });
  }
  const { year, month, day } = parseYmd(asOf);
  const end = new Date(year, month, day);
  const range =
    ctx.language === "ru"
      ? `1–${formatDateLong(end, ctx.language)}`
      : `${formatDateLong(new Date(year, month, 1), ctx.language)}–${day}`;
  return fillTemplate(t.month, { range });
}

export type WorkoutRowText = {
  day: string;
  weekday: string;
  title: string;
  meta: string;
  record: string | null;
};

export function workoutRowText(
  ctx: ProgressTextContext,
  workout: ProgressWorkout,
  hasPlan: boolean,
): WorkoutRowText {
  const t = ctx.copy.progressOverview.workouts;
  const date = dateOf(workout.date);
  const distance = ctx.format.distance(workout.distanceKm, 1);
  let meta: string;
  if (workout.status === "missed") {
    meta = fillTemplate(t.missed, { distance });
  } else {
    const parts = [distance];
    if (workout.durationMin !== null) {
      parts.push(ctx.format.minutes(Math.round(workout.durationMin)));
      if (workout.distanceKm > 0) {
        parts.push(
          paceText(ctx, (workout.durationMin * 60) / workout.distanceKm),
        );
      }
    }
    if (hasPlan && workout.status === "free") parts.unshift(t.offPlan);
    meta = parts.join(" · ");
  }
  return {
    day: String(date.getDate()),
    weekday: getShortDayName(date.getDay(), ctx.language),
    title: t.types[workout.type],
    meta,
    record: workout.recordDistanceKm
      ? fillTemplate(t.record, {
          distance: ctx.format.distance(workout.recordDistanceKm, 0),
        })
      : null,
  };
}
