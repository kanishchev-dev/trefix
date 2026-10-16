import { type ExperienceLevel } from "@trefix/api-client";

/** Same rules as the backend: two workouts a day only for advanced athletes. */
export function canDoubleUp(level: ExperienceLevel | string): boolean {
  return level === "advanced";
}

/** One workout per available day, or two per day (capped at 7) with doubles. */
export function maxSessionsPerWeek(
  days: number,
  allowDoubles: boolean,
): number {
  return Math.max(1, Math.min(7, allowDoubles ? days * 2 : days));
}
