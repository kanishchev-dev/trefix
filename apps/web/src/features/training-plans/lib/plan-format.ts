import type { PlanLifecycleStatus } from "@workspace/api-client";

export {
  formatHoursMinutesSeconds as formatDuration,
  formatMinutesSeconds as formatPace,
  parseHoursMinutesSeconds as parseDuration,
  parseMinutesSeconds as parsePace,
} from "@workspace/utils";

/** Calendar date (YYYY-MM-DD, interpreted as a local day) in the given locale. */
export function formatPlanDate(
  value: string | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  },
): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatNumber(
  value: number,
  locale: string,
  maximumFractionDigits = 1,
): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

export const PLAN_STATUS_VARIANTS: Record<
  PlanLifecycleStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  active: "default",
  completed: "secondary",
  cancelled: "destructive",
  paused: "secondary",
};

/** Monday-first weekday index (0 = Monday) of a local date. */
export function mondayFirstWeekday(date: Date): number {
  return (date.getDay() + 6) % 7;
}
