/**
 * Calendar-day arithmetic in an IANA timezone.
 *
 * Workouts are stored as UTC instants, while the admin picks a local calendar
 * day. These helpers translate between the two without a date library;
 * `Intl.DateTimeFormat` does the zone lookup, including DST.
 */

/** Local calendar date (YYYY-MM-DD) of an instant in the given zone. */
export function toLocalDateKey(instant: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Number of calendar days from `from` to `to` inclusive (0 or negative when reversed). */
export function countDaysInclusive(from: string, to: string): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / msPerDay) + 1;
}

/**
 * UTC instants bounding local days `[from, to]`: `start` is the local midnight
 * of `from`, `endExclusive` the local midnight after `to`.
 */
export function resolveLocalRange(from: string, to: string, timezone: string): { start: Date; endExclusive: Date } {
  return {
    start: startOfLocalDay(from, timezone),
    endExclusive: startOfLocalDay(addDaysToDateKey(to, 1), timezone),
  };
}

/**
 * UTC instant of the local midnight of `dateKey` in `timezone`. Two passes
 * absorb DST shifts: the first guess lands within the right day, the second
 * removes the residual offset.
 */
export function startOfLocalDay(dateKey: string, timezone: string): Date {
  const [year, month, day] = dateKey.slice(0, 10).split('-').map(Number);
  const utcOfDay = Date.UTC(year, month - 1, day);

  let guess = utcOfDay;
  for (let pass = 0; pass < 2; pass += 1) {
    guess = utcOfDay - zoneOffsetMs(new Date(guess), timezone);
  }
  return new Date(guess);
}

/** Offset (ms) to add to a UTC instant to get the zone's wall clock. */
function zoneOffsetMs(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);

  const value = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  const wallClockAsUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return wallClockAsUtc - (instant.getTime() - instant.getUTCMilliseconds());
}
