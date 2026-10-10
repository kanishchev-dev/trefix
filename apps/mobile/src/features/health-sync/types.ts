import type {
  DeviceActivity,
  DeviceProfileMetricsRequest,
  DeviceProvider,
  DeviceScope,
} from "@workspace/api-client";

export type HealthAvailability = "available" | "not_installed" | "update_required" | "unsupported";

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

/** One platform health store, read on the device. */
export interface DeviceHealthSource {
  readonly provider: DeviceProvider;
  getAvailability(): Promise<HealthAvailability>;
  /** Shows the system dialog; returns what was granted (iOS: what was requested — read access is not disclosed). */
  requestPermissions(request: PermissionRequest): Promise<DeviceScope[]>;
  getGrantedScopes(): Promise<DeviceScope[]>;
  /** `since` bounds the first read; later reads continue from the cursor. */
  readWorkoutChanges(cursor: SyncCursor | null, since: Date): Promise<WorkoutChangesPage>;
  readProfileMetrics(now: Date): Promise<DeviceProfileMetricsRequest>;
  openSystemSettings(): Promise<void>;
  /** Android: the Play Store page of Health Connect. */
  openStorePage?(): Promise<void>;
}
