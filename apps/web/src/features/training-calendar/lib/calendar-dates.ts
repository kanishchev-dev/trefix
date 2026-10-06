/**
 * Date helpers for the admin training calendar.
 *
 * The calendar works in the admin's browser timezone: the day picker yields
 * local `Date`s, the backend receives the same zone and resolves local day
 * boundaries from it, so a workout always lands on the day it is shown on.
 */

import { ADMIN_CALENDAR_SUMMARY_MAX_DAYS } from "@workspace/api-client";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Days shown before/after a month in the picker grid (outside days). */
const GRID_PADDING_DAYS = 6;

const pad = (value: number): string => String(value).padStart(2, "0");

/** IANA timezone of the browser; UTC when the runtime cannot tell. */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Local calendar day of a `Date` as YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses YYYY-MM-DD into a local midnight `Date`; `null` for malformed or impossible dates. */
export function parseDateKey(value: string | null | undefined): Date | null {
  const match = value ? DATE_KEY_PATTERN.exec(value) : null;
  if (!match) {
    return null;
  }

  const [, year, month, day] = match.map(Number);
  const date = new Date(year, month - 1, day);

  return toDateKey(date) === value ? date : null;
}

/** Local wall-clock time of an instant as HH:mm. */
export function toTimeValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Combines a local day and HH:mm time into a UTC ISO instant; `null` when either part is invalid. */
export function toScheduledAt(dateKey: string, time: string): string | null {
  const day = parseDateKey(dateKey);
  const match = TIME_PATTERN.exec(time);
  if (!day || !match) {
    return null;
  }

  day.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return day.toISOString();
}

/** Local day range covering the month grid of `month`, including outside days. */
export function getMonthGridRange(month: Date): { from: string; to: string } {
  const first = new Date(
    month.getFullYear(),
    month.getMonth(),
    1 - GRID_PADDING_DAYS,
  );
  const last = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    GRID_PADDING_DAYS,
  );
  const range = { from: toDateKey(first), to: toDateKey(last) };

  // 31 + 2 * 6 days always fits the backend limit; guard against drift if either constant changes.
  if (countDays(range.from, range.to) > ADMIN_CALENDAR_SUMMARY_MAX_DAYS) {
    throw new RangeError("Month grid range exceeds the summary limit");
  }

  return range;
}

/** First day of the month containing `date`, at local midnight. */
export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function countDays(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return (
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        msPerDay,
    ) + 1
  );
}
