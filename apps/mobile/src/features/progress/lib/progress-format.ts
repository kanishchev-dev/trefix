import { type RecordDistance } from "@workspace/api-client";

import { type MainCopy } from "../../../locales";

/** 1:42:35 or 22:41. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

export function distanceLabel(copy: MainCopy, distance: RecordDistance): string {
  return copy.progress.records.distances[distance];
}

export const RECORD_DISTANCE_METERS: Record<RecordDistance, number> = {
  "1k": 1000,
  "5k": 5000,
  "10k": 10000,
  half_marathon: 21097.5,
  marathon: 42195,
};

/** Short month name for an ISO date. */
export function monthShort(iso: string, language: "ru" | "en"): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", { month: "short", timeZone: "UTC" })
    .format(date)
    .replace(".", "");
}

/** "3 авг" / "Aug 3". */
export function dayMonth(iso: string, language: "ru" | "en", withYear = false): string {
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", {
    day: "numeric",
    month: "short",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  })
    .format(date)
    .replace(".", "");
}

/** Pace difference in the user's distance unit, e.g. "0:12". */
export function formatPaceDelta(secondsPerKm: number, units: "metric" | "imperial"): string {
  return formatDuration(Math.abs(units === "imperial" ? secondsPerKm * 1.609344 : secondsPerKm));
}
