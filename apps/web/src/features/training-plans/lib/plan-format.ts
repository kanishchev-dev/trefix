import type { PlanLifecycleStatus } from "@workspace/api-client";

const pad = (value: number): string => String(value).padStart(2, "0");

/** Pace or short duration in seconds as m:ss. */
export function formatPace(seconds: number): string {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${pad(rounded % 60)}`;
}

/** Parses m:ss into seconds; `null` for anything else. */
export function parsePace(value: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : null;
}

/** Duration in seconds as h:mm:ss, or m:ss below an hour. */
export function formatDuration(seconds: number): string {
  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const rest = rounded % 60;
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${minutes}:${pad(rest)}`;
}

/** Parses h:mm:ss or m:ss into seconds; `null` for anything else. */
export function parseDuration(value: string): number | null {
  const parts = value.trim().split(":");
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !/^\d+$/.test(part))
  ) {
    return null;
  }

  const numbers = parts.map(Number);
  const [first, second, third] = numbers;
  // Minutes and seconds past the leading unit are clock positions, not free numbers.
  if (numbers.slice(1).some((part) => part > 59)) {
    return null;
  }

  const seconds =
    parts.length === 3
      ? first * 3600 + second * 60 + third
      : first * 60 + second;
  return seconds > 0 ? seconds : null;
}

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
