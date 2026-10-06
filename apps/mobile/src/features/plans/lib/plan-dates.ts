const DAY_MS = 24 * 60 * 60 * 1000;

/** IANA timezone of the device; plan dates are computed by the server in it. */
export function getDeviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayIso(): string {
  return toIsoDate(new Date());
}

export function addDaysIso(iso: string, days: number): string {
  const date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

/** Whole days from `from` to `to` (both "YYYY-MM-DD"). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

/** Display-only end date of a plan started on `startDate`. */
export function planEndDate(startDate: string, totalWeeks: number): string {
  return addDaysIso(startDate, totalWeeks * 7 - 1);
}

/** Calendar date of a workout timestamp in the device timezone. */
export function workoutLocalDate(scheduledAt: string | Date): string {
  const value = typeof scheduledAt === "string" ? scheduledAt : scheduledAt.toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toIsoDate(new Date(value));
}

/** Monday-based weekday index (0 = Monday) of a calendar date. */
export function mondayBasedWeekday(iso: string): number {
  return (parseIsoDate(iso).getDay() + 6) % 7;
}

export function clampIso(iso: string, min: string, max?: string | null): string {
  if (iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}
