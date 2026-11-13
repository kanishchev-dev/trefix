/*
 * Number formatting of the analytics dashboard. Every value stays on one
 * line: large numbers are compacted, missing values become a dash.
 */

const DASH = "—";

export function formatNumber(
  value: number | null | undefined,
  locale: string,
  maximumFractionDigits = 1,
): string {
  if (value === null || value === undefined) return DASH;
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value);
}

/** 18 420 → 18,4 тыс. above ten thousand; exact below. */
export function formatCompact(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined) return DASH;
  if (Math.abs(value) < 10_000) return formatNumber(value, locale);
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(
  value: number | null | undefined,
  locale: string,
): string {
  if (value === null || value === undefined) return DASH;
  return `${formatNumber(value, locale)}%`;
}

/** Signed change, with a real minus sign. */
export function formatSigned(
  value: number | null | undefined,
  locale: string,
  suffix = "",
): string {
  if (value === null || value === undefined) return DASH;
  const body = formatNumber(Math.abs(value), locale);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${body}${suffix}`;
}

export function formatUsd(
  value: number | null | undefined,
  locale: string,
  maximumFractionDigits = 2,
): string {
  if (value === null || value === undefined) return DASH;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

export type Trend = "up" | "down" | "flat";

/** Direction of a change; within ±0.5% it is flat. */
export function trendOf(deltaPct: number | null | undefined): Trend {
  if (deltaPct === null || deltaPct === undefined || Math.abs(deltaPct) < 0.5)
    return "flat";
  return deltaPct > 0 ? "up" : "down";
}

/** Day and month of a date key, e.g. "12 окт." / "Oct 12". */
export function formatDay(dateKey: string, locale: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return DASH;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(date);
}

/** Relative age of a timestamp: "4 мин. назад", "5 ч назад", "3 дн. назад". */
export function formatSince(
  value: string | null | undefined,
  locale: string,
  now = Date.now(),
): string {
  if (!value) return DASH;
  const diffMs = new Date(value).getTime() - now;
  if (Number.isNaN(diffMs)) return DASH;
  const rtf = new Intl.RelativeTimeFormat(locale, {
    numeric: "auto",
    style: "short",
  });
  const minutes = Math.round(diffMs / 60_000);
  if (Math.abs(minutes) < 60) return rtf.format(minutes, "minute");
  const hours = Math.round(diffMs / 3_600_000);
  if (Math.abs(hours) < 48) return rtf.format(hours, "hour");
  return rtf.format(Math.round(hours / 24), "day");
}

export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
