/**
 * Rough pace of a workout type, only to show "≈ 8.3 km" next to a time goal
 * (and the other way round). Never stored: the goal keeps the value the
 * athlete chose and nothing else.
 */
const PACE_FACTOR: Record<string, number> = {
  recovery: 1.32,
  easy: 1.25,
  long_run: 1.22,
  hill: 1.15,
  tempo: 1.06,
  threshold: 1,
  race: 1,
  interval: 0.96,
};

/** Easy pace when the threshold pace is unknown, s/km. */
const DEFAULT_EASY_PACE_SEC = 360;

export function estimatedPaceSec(
  type: string,
  thresholdPaceSec: number | null | undefined,
): number {
  const factor = PACE_FACTOR[type] ?? PACE_FACTOR.easy!;
  if (thresholdPaceSec && thresholdPaceSec > 0)
    return Math.round(thresholdPaceSec * factor);
  return Math.round((DEFAULT_EASY_PACE_SEC * factor) / PACE_FACTOR.easy!);
}

/** Even pace of a distance in a time limit, and its corridor of ±5 s. */
export function goalPace(
  distanceKm: number,
  timeLimitMin: number,
): { pace: number; min: number; max: number } | null {
  if (!(distanceKm > 0) || !(timeLimitMin > 0)) return null;
  const pace = Math.round((timeLimitMin * 60) / distanceKm);
  return { pace, min: Math.max(1, pace - 5), max: pace + 5 };
}
