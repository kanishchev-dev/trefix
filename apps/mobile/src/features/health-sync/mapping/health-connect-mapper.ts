import type { DeviceActivity } from "@workspace/api-client";

import { positiveRound } from "./units";

/** Health Connect `ExerciseType` values the app imports. */
export const HC_EXERCISE_RUNNING = 56;
export const HC_EXERCISE_RUNNING_TREADMILL = 57;
/** `ExerciseSegmentType` values that are not moving time. */
const HC_SEGMENT_PAUSE = 39;
const HC_SEGMENT_REST = 44;

/** The parts of an `ExerciseSessionRecord` the mapper reads. */
export type HealthConnectSessionInput = {
  startTime: string;
  endTime: string;
  exerciseType: number;
  startZoneOffset?: { totalSeconds: number };
  segments?: Array<{ startTime: string; endTime: string; segmentType: number }>;
  metadata?: { id?: string; dataOrigin?: string; device?: { manufacturer?: string; model?: string } };
};

/** Aggregates over the session interval, already in metric units. */
export type HealthConnectSessionStats = {
  distanceMeters?: number;
  elevationGainMeters?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  steps?: number;
  activeCaloriesKcal?: number;
};

export function isRunningSession(session: Pick<HealthConnectSessionInput, "exerciseType">): boolean {
  return session.exerciseType === HC_EXERCISE_RUNNING || session.exerciseType === HC_EXERCISE_RUNNING_TREADMILL;
}

/** Seconds of pause and rest segments, clipped to the session. */
function pausedSeconds(session: HealthConnectSessionInput, start: number, end: number): number {
  return (session.segments ?? [])
    .filter((segment) => segment.segmentType === HC_SEGMENT_PAUSE || segment.segmentType === HC_SEGMENT_REST)
    .reduce((total, segment) => {
      const from = Math.max(start, Date.parse(segment.startTime));
      const to = Math.min(end, Date.parse(segment.endTime));
      return total + Math.max(0, to - from) / 1000;
    }, 0);
}

/** ExerciseSession (running) → run in the backend's shape. Returns null without an id or distance. */
export function mapHealthConnectSession(
  session: HealthConnectSessionInput,
  stats: HealthConnectSessionStats,
): DeviceActivity | null {
  const id = session.metadata?.id;
  if (!id || !isRunningSession(session) || !stats.distanceMeters || stats.distanceMeters <= 0) {
    return null;
  }
  const start = Date.parse(session.startTime);
  const end = Date.parse(session.endTime);
  const elapsedTimeSec = Math.round((end - start) / 1000);
  const durationSec = Math.max(0, Math.round(elapsedTimeSec - pausedSeconds(session, start, end)));
  if (durationSec <= 0) {
    return null;
  }
  const device = session.metadata?.device;
  const originDevice = [device?.manufacturer, device?.model].filter(Boolean).join(" ") || undefined;
  const cadence = stats.steps ? (stats.steps / durationSec) * 60 : undefined;

  return {
    sourceActivityId: id,
    type: session.exerciseType === HC_EXERCISE_RUNNING_TREADMILL ? "treadmill" : "run",
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(end).toISOString(),
    utcOffsetMinutes:
      session.startZoneOffset !== undefined ? Math.round(session.startZoneOffset.totalSeconds / 60) : undefined,
    durationSec,
    elapsedTimeSec,
    distanceMeters: Math.round(stats.distanceMeters),
    elevationGainMeters: positiveRound(stats.elevationGainMeters),
    averageHeartRate: positiveRound(stats.averageHeartRate),
    maxHeartRate: positiveRound(stats.maxHeartRate),
    cadence: positiveRound(cadence),
    calories: positiveRound(stats.activeCaloriesKcal),
    originAppId: session.metadata?.dataOrigin,
    originDevice,
  };
}
