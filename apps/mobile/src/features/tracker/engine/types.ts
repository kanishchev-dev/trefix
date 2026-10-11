import type { RecordingEnvironment } from "@workspace/api-client";

import type { PaceStatus, PlanState, StepProgress } from "./plan-progress";

/** How distance is measured: satellites (with a pedometer fallback) or the pedometer only. */
export type DistanceMode = "gps" | "time";
export type GpsStatus = "off" | "searching" | "good" | "lost";
export type RecordingStatus = "recording" | "paused" | "finished";

export type EngineConfig = {
  environment: RecordingEnvironment;
  distanceMode: DistanceMode;
  /** Metres per step, calibrated on earlier GPS runs. */
  strideM: number;
  autoPause: boolean;
};

export type LocationSample = {
  /** Epoch ms. */
  t: number;
  lat: number;
  lng: number;
  alt: number | null;
  /** Horizontal accuracy, metres. */
  acc: number | null;
  /** Speed reported by the device, m/s; null when unknown. */
  speed: number | null;
};

export type PauseRecord = {
  startedAt: number;
  endedAt: number | null;
  auto: boolean;
};

/** [moving ms, distance m, elevation gain m] — enough to rebuild splits for any final distance. */
export type TimelineSample = [number, number, number];

/** Everything the engine needs to continue after the app was killed; plain JSON. */
export type EngineState = {
  version: 1;
  config: EngineConfig;
  status: RecordingStatus;
  autoPaused: boolean;
  startedAt: number;
  endedAt: number | null;
  /** Time of the last processed event, epoch ms. */
  clock: number;
  movingMs: number;
  distanceM: number;
  gpsDistanceM: number;
  pedometerDistanceM: number;
  gps: GpsStatus;
  lastFix: LocationSample | null;
  badSince: number | null;
  lastLocationAt: number | null;
  slowSince: number | null;
  steps: number;
  lastStepTotal: number | null;
  lastStepAt: number | null;
  /** Recent step deltas for cadence: [epoch ms, steps]. */
  stepWindow: Array<[number, number]>;
  pauses: PauseRecord[];
  /** `source` is absent until the barometer reports (GPS altitude meanwhile). */
  elevation: {
    gainM: number;
    lossM: number;
    refM: number | null;
    source?: "gps" | "baro";
  };
  timeline: TimelineSample[];
  /** Steps and GPS metres over the same stretches, to learn the stride. */
  calibration: { steps: number; meters: number };
  resumedAt: number;
  /** Steps of the planned workout being run; null for a free run. */
  plan: PlanState | null;
};

export type EngineView = {
  status: RecordingStatus;
  autoPaused: boolean;
  elapsedMs: number;
  movingMs: number;
  distanceM: number;
  currentPaceSecPerKm: number | null;
  avgPaceSecPerKm: number | null;
  gps: GpsStatus;
  /** Distance currently counted by the pedometer (no GPS or treadmill). */
  onPedometer: boolean;
  elevationGainM: number;
  cadence: number | null;
  /** Whole kilometres passed. */
  km: number;
  /** Running step of the plan; null for a free run or after the last step. */
  step: StepProgress | null;
  planDone: boolean;
  paceStatus: PaceStatus | null;
};
