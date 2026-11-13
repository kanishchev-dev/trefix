import { formatMinutesSeconds } from "@trefix/utils";

/** Distance in kilometres with at most one decimal. */
export function formatKm(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    value,
  );
}

/** Pace as m:ss per kilometre. */
export function formatPaceSeconds(value: number | null | undefined): string {
  return value ? formatMinutesSeconds(Math.round(value)) : "—";
}

/** Day and month, with the time when `withTime` is set. */
export function formatShortDate(
  value: string | null | undefined,
  locale: string,
  withTime = false,
): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(date);
}
