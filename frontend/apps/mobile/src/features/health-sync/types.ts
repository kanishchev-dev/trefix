import type {
  DeviceActivity,
  DeviceProfileMetricsRequest,
  DeviceProvider,
  DeviceScope,
} from "@trefix/api-client";

export type HealthAvailability =
  | "available"
  | "not_installed"
  | "update_required"
  | "unsupported";

/** Opaque sync position of a source: HealthKit anchor or Health Connect changes token, serialized. */
export type SyncCursor = string;

export type WorkoutChangesPage = {
  activities: DeviceActivity[];
  deletedSourceActivityIds: string[];
  /** Cursor to store once every record of this page is accepted by the server. */
  nextCursor: SyncCursor | null;
  hasMore: boolean;
};

export type PermissionRequest = {
  /** Android: ask for records older than 30 days before the grant. */
  history: boolean;
  /** Android: ask for reading in the background. */
  background: boolean;
};

/** Whether the app may write workouts to the store. */
export type HealthWriteAccess = "granted" | "denied" | "not_asked";

/** A run recorded with the tracker, as written to the store. */
export type RecordedRunExport = {
  /** Session id of the recording; marks the record as ours. */
  id: string;
  startedAt: Date;
  endedAt: Date;
  distanceM: number;
  indoor: boolean;
  energyKcal: number | null;
  elevationGainM: number | null;
  /** Route fixes, epoch ms; empty without GPS. */
  route: Array<{
    t: number;
    lat: number;
    lng: number;
    alt: number | null;
    acc: number | null;
    speed: number | null;
  }>;
};

export type HeartRateSummary = { avg: number; max: number };

/** One platform health store, read on the device. */
export interface DeviceHealthSource {
  readonly provider: DeviceProvider;
  getAvailability(): Promise<HealthAvailability>;
  /** Shows the system dialog; returns what was granted (iOS: what was requested — read access is not disclosed). */
  requestPermissions(request: PermissionRequest): Promise<DeviceScope[]>;
  getGrantedScopes(): Promise<DeviceScope[]>;
  /** `since` bounds the first read; later reads continue from the cursor. */
  readWorkoutChanges(
    cursor: SyncCursor | null,
    since: Date,
  ): Promise<WorkoutChangesPage>;
  readProfileMetrics(now: Date): Promise<DeviceProfileMetricsRequest>;
  /**
   * Foreground only: asks for read types added after the connection was made
   * (the system dialog shows only the new ones). No-op when nothing is missing.
   */
  ensureReadAccess?(): Promise<void>;
  /** Write side, for runs recorded with the tracker. */
  getWriteAccess?(): Promise<HealthWriteAccess>;
  /** Shows the system dialog for writing workouts; true when granted. */
  requestWriteAccess?(): Promise<boolean>;
  saveRecordedRun?(run: RecordedRunExport): Promise<void>;
  /** Heart rate written by any app (a watch, a chest strap) over an interval; null without samples. */
  readHeartRate?(from: Date, to: Date): Promise<HeartRateSummary | null>;
  openSystemSettings(): Promise<void>;
  /** Android: the Play Store page of Health Connect. */
  openStorePage?(): Promise<void>;
}
