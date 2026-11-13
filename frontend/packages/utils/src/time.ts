const pad = (value: number): string => String(value).padStart(2, "0");

/** Seconds as m:ss — pace or a short duration ("5:07"). */
export function formatMinutesSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;
}

/** Seconds as h:mm:ss, or m:ss below an hour ("1:42:35", "22:41"). */
export function formatHoursMinutesSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(rest)}`
    : `${minutes}:${pad(rest)}`;
}

/** Parses m:ss into seconds; `null` for anything else or zero. */
export function parseMinutesSeconds(value: string): number | null {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  return seconds > 0 ? seconds : null;
}

/** Parses h:mm:ss or m:ss into seconds; `null` for anything else or zero. */
export function parseHoursMinutesSeconds(value: string): number | null {
  const parts = value.trim().split(":");
  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !/^\d+$/.test(part))
  ) {
    return null;
  }
  const numbers = parts.map(Number);
  // Positions after the leading unit are clock positions, not free numbers.
  if (numbers.slice(1).some((part) => part > 59)) {
    return null;
  }
  const total = numbers.reduce((sum, part) => sum * 60 + part, 0);
  return total > 0 ? total : null;
}
