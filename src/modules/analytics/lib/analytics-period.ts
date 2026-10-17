import { addDaysToDateKey, toLocalDateKey } from '@/modules/training/admin-calendar-day.util';

import { ANALYTICS_PERIOD_DAYS, type AnalyticsPeriod } from '../analytics.constants';

/** Resolved filters of one dashboard request; dates are local date keys in `timezone`. */
export interface AnalyticsScope {
  period: AnalyticsPeriod;
  timezone: string;
  includeStaff: boolean;
  today: string;
  days: number;
  /** Current period, inclusive: the last `days` days ending today. */
  from: string;
  to: string;
  /** The same number of days right before the current period. */
  prevFrom: string;
  prevTo: string;
  /** Series granularity: days, or weeks for the yearly period. */
  bucket: 'day' | 'week';
}

export function resolveScope(
  period: AnalyticsPeriod,
  timezone: string,
  includeStaff: boolean,
  now = new Date(),
): AnalyticsScope {
  const days = ANALYTICS_PERIOD_DAYS[period];
  const today = toLocalDateKey(now, timezone);
  const from = addDaysToDateKey(today, -(days - 1));
  return {
    period,
    timezone,
    includeStaff,
    today,
    days,
    from,
    to: today,
    prevFrom: addDaysToDateKey(from, -days),
    prevTo: addDaysToDateKey(from, -1),
    bucket: days > 90 ? 'week' : 'day',
  };
}

/** Change against the previous value in percent; null when there is nothing to compare with. */
export function deltaPct(value: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((value - previous) / previous) * 1000) / 10;
}

/** Every date key from `from` to `to` inclusive. */
export function dateRange(from: string, to: string): string[] {
  const days: string[] = [];
  for (let day = from; day <= to; day = addDaysToDateKey(day, 1)) {
    days.push(day);
  }
  return days;
}

/** Monday of the week that contains the date key. */
export function mondayOf(dateKey: string): string {
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return addDaysToDateKey(dateKey, -((weekday + 6) % 7));
}

/** Mondays of the weeks overlapping the range. */
export function weekRange(from: string, to: string): string[] {
  const weeks: string[] = [];
  for (let week = mondayOf(from); week <= to; week = addDaysToDateKey(week, 7)) {
    weeks.push(week);
  }
  return weeks;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function share(part: number, whole: number): number | null {
  return whole > 0 ? round1((part / whole) * 100) : null;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
