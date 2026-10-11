import type {
  DistanceSource,
  RecordedActivityRequest,
  RecordedSplit,
  WorkoutType,
} from "@workspace/api-client";

import { boundsOf, encodePolyline, simplifyTo } from "./geo";
import type { EngineState, LocationSample, TimelineSample } from "./types";

/** Route points kept on the card map. */
export const ROUTE_LINE_MAX_POINTS = 500;
/** A trailing piece shorter than this is not shown as a split. */
const MIN_PARTIAL_SPLIT_M = 50;

export type SummaryEdits = {
  /** Distance the user entered on the finish screen (treadmill, time mode). */
  distanceM?: number | null;
  workoutType?: Exclude<WorkoutType, "rest"> | null;
  plannedWorkoutId?: string | null;
  feeling?: number | null;
  rpe?: number | null;
  notes?: string | null;
  gearId?: string | null;
  /** From the health store (a watch or a strap worn during the run). */
  heartRate?: { avg: number; max: number } | null;
};

export type TrackFile = {
  version: 1;
  points: { t: number[]; lat: number[]; lng: number[]; alt: Array<number | null>; acc: Array<number | null> };
  steps: { total: number };
};

/** Moving time at which the scaled distance reaches `targetM`, by linear interpolation. */
function movingAt(timeline: TimelineSample[], targetM: number, scale: number): { ms: number; gain: number } | null {
  for (let i = 1; i < timeline.length; i += 1) {
    const [t1, d1, g1] = timeline[i - 1]!;
    const [t2, d2, g2] = timeline[i]!;
    const a = d1 * scale;
    const b = d2 * scale;
    if (b >= targetM && b > a) {
      const k = (targetM - a) / (b - a);
      return { ms: t1 + (t2 - t1) * k, gain: g1 + (g2 - g1) * k };
    }
  }
  return null;
}

/**
 * Kilometre splits from the timeline. `finalDistanceM` differs from the
 * measured one when the user corrected it (treadmill): every sample is scaled,
 * so splits follow the corrected distance.
 */
export function buildSplits(timeline: TimelineSample[], measuredM: number, finalDistanceM: number): RecordedSplit[] {
  if (timeline.length < 2 || measuredM <= 0 || finalDistanceM <= 0) return [];
  const scale = finalDistanceM / measuredM;
  const splits: RecordedSplit[] = [];
  let prev = { ms: 0, gain: 0 };
  const fullKm = Math.floor(finalDistanceM / 1000);
  for (let km = 1; km <= fullKm; km += 1) {
    const at = movingAt(timeline, km * 1000, scale);
    if (!at) break;
    const durationSec = Math.round((at.ms - prev.ms) / 1000);
    splits.push({
      km,
      durationSec,
      paceSecPerKm: durationSec,
      elevationGainM: Math.round(at.gain - prev.gain),
      partial: false,
    });
    prev = at;
  }
  const restM = finalDistanceM - splits.length * 1000;
  const last = timeline[timeline.length - 1]!;
  if (restM >= MIN_PARTIAL_SPLIT_M && last[0] > prev.ms) {
    const durationSec = Math.round((last[0] - prev.ms) / 1000);
    splits.push({
      km: splits.length + 1,
      durationSec,
      paceSecPerKm: Math.round((durationSec / restM) * 1000),
      elevationGainM: Math.round(last[2] - prev.gain),
      partial: true,
    });
  }
  return splits;
}

export function resolveDistanceSource(state: EngineState, edited: boolean): DistanceSource {
  if (edited) return "manual";
  if (state.config.distanceMode === "time" || state.config.environment === "treadmill") return "pedometer";
  if (state.gpsDistanceM <= 0) return "pedometer";
  return state.pedometerDistanceM > 0 ? "mixed" : "gps";
}

const round = (value: number): number => Math.round(value);

/** Request body and track file of a finished session. */
export function buildRecording(
  sessionId: string,
  state: EngineState,
  points: LocationSample[],
  edits: SummaryEdits,
  device: RecordedActivityRequest["device"],
): { summary: RecordedActivityRequest; track: TrackFile | null } {
  const endedAt = state.endedAt ?? state.clock;
  const measuredM = round(state.distanceM);
  const edited = edits.distanceM != null && round(edits.distanceM) !== measuredM;
  const distanceM = edited ? round(edits.distanceM!) : measuredM;
  const movingSec = Math.max(1, round(state.movingMs / 1000));
  const elapsedSec = Math.max(movingSec, round((endedAt - state.startedAt) / 1000));
  const splits = buildSplits(state.timeline, state.distanceM, distanceM);
  const fullSplits = splits.filter((split) => !split.partial);

  const route = simplifyTo(points, ROUTE_LINE_MAX_POINTS);
  const bounds = boundsOf(route);
  const movingMinutes = state.movingMs / 60_000;
  const hasElevation = points.length > 0 || state.elevation.source === "baro";

  const summary: RecordedActivityRequest = {
    clientSessionId: sessionId,
    environment: state.config.environment,
    distanceSource: resolveDistanceSource(state, edited),
    plannedWorkoutId: edits.plannedWorkoutId ?? null,
    workoutType: edits.workoutType ?? null,
    startedAt: new Date(state.startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(),
    utcOffsetMinutes: -new Date(state.startedAt).getTimezoneOffset(),
    elapsedSec,
    movingSec,
    distanceM,
    measuredDistanceM: measuredM,
    elevationGainM: hasElevation ? round(state.elevation.gainM) : null,
    elevationLossM: hasElevation ? round(state.elevation.lossM) : null,
    avgPaceSecPerKm: distanceM > 0 ? round((movingSec / distanceM) * 1000) : null,
    bestPaceSecPerKm: fullSplits.length > 0 ? Math.min(...fullSplits.map((split) => split.paceSecPerKm)) : null,
    avgHeartRate: edits.heartRate?.avg ?? null,
    maxHeartRate: edits.heartRate?.max ?? null,
    avgCadence: state.steps > 0 && movingMinutes >= 1 ? round(state.steps / movingMinutes) : null,
    splits,
    laps: state.plan?.laps ?? [],
    pauses: state.pauses.map((pause) => ({
      startedAt: new Date(pause.startedAt).toISOString(),
      endedAt: new Date(pause.endedAt ?? endedAt).toISOString(),
      auto: pause.auto,
    })),
    routeLine: route.length >= 2 ? encodePolyline(route) : null,
    routeBounds: route.length >= 2 ? bounds : null,
    startPoint: points[0] ? { lat: points[0].lat, lng: points[0].lng } : null,
    gearId: edits.gearId ?? null,
    feeling: edits.feeling ?? null,
    rpe: edits.rpe ?? null,
    notes: edits.notes?.trim() ? edits.notes.trim() : null,
    device,
  };

  const track: TrackFile | null =
    points.length > 0
      ? {
          version: 1,
          points: {
            t: points.map((point) => round((point.t - state.startedAt) / 1000)),
            lat: points.map((point) => point.lat),
            lng: points.map((point) => point.lng),
            alt: points.map((point) => (point.alt === null ? null : Math.round(point.alt * 10) / 10)),
            acc: points.map((point) => (point.acc === null ? null : Math.round(point.acc))),
          },
          steps: { total: state.steps },
        }
      : null;

  return { summary, track };
}
