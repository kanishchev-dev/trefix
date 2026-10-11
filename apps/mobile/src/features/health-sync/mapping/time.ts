/** Offset of `timeZone`'s wall clock from UTC at `instant`, minutes east of UTC. */
export function zoneOffsetMinutes(
  instant: Date,
  timeZone: string,
): number | undefined {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const value = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
    const wallClockAsUtc = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    const offset = Math.round(
      (wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60000,
    );
    return Number.isFinite(offset) ? offset : undefined;
  } catch {
    return undefined;
  }
}

/** Device offset at `instant`, minutes east of UTC. */
export function deviceOffsetMinutes(instant: Date): number {
  return -instant.getTimezoneOffset();
}

/** Local calendar date (YYYY-MM-DD) of `instant` on this device. */
export function localDateKey(instant: Date): string {
  const year = instant.getFullYear();
  const month = String(instant.getMonth() + 1).padStart(2, "0");
  const day = String(instant.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
