import { Linking, Platform } from "react-native";
import {
  aggregateRecord,
  getChanges,
  getGrantedPermissions,
  getSdkStatus,
  ExerciseType,
  initialize,
  insertRecords,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
  type HealthConnectRecord,
  type Permission,
  type RecordType,
  type WriteExerciseRoutePermission,
} from "react-native-health-connect";
import type {
  DeviceActivity,
  DeviceProfileMetricsRequest,
  DeviceScope,
} from "@trefix/api-client";

import {
  isRunningSession,
  mapHealthConnectSession,
  type HealthConnectSessionInput,
  type HealthConnectSessionStats,
} from "../mapping/health-connect-mapper";
import type {
  DeviceHealthSource,
  HealthAvailability,
  HealthWriteAccess,
  HeartRateSummary,
  PermissionRequest,
  RecordedRunExport,
  SyncCursor,
  WorkoutChangesPage,
} from "../types";

type TimeRangeFilter = Parameters<typeof readRecords>[1]["timeRangeFilter"];

const PROVIDER_PACKAGE = "com.google.android.apps.healthdata";
const PAGE_SIZE = 25;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Without the history permission Health Connect returns this much before the grant; also the token lifetime. */
const HISTORY_WITHOUT_PERMISSION_DAYS = 30;
/** Late HR / distance writes re-send sessions of this many recent days. */
const LATE_DATA_WINDOW_DAYS = 7;
const RESTING_HR_DAYS = 14;

/** Record types whose changes can alter a run. */
const TRACKED_TYPES: RecordType[] = [
  "ExerciseSession",
  "Distance",
  "HeartRate",
];

const READ_PERMISSIONS: Array<{ recordType: RecordType; scope: DeviceScope }> =
  [
    { recordType: "ExerciseSession", scope: "workouts" },
    { recordType: "Distance", scope: "distance" },
    { recordType: "HeartRate", scope: "heart_rate" },
    { recordType: "ElevationGained", scope: "elevation" },
    { recordType: "Steps", scope: "steps" },
    { recordType: "ActiveCaloriesBurned", scope: "calories" },
    { recordType: "Weight", scope: "weight" },
    { recordType: "Height", scope: "height" },
    { recordType: "RestingHeartRate", scope: "resting_heart_rate" },
  ];

/** Written for runs recorded with the tracker. */
const WRITE_PERMISSIONS: Array<Permission | WriteExerciseRoutePermission> = [
  { accessType: "write", recordType: "ExerciseSession" },
  { accessType: "write", recordType: "Distance" },
  { accessType: "write", recordType: "ActiveCaloriesBurned" },
  { accessType: "write", recordType: "ElevationGained" },
  { accessType: "write", recordType: "ExerciseRoute" },
];

/**
 * `initial` pages through sessions since `since` with a changes token taken
 * before the first page, so nothing written meanwhile is missed; `changes`
 * follows that token afterwards.
 */
type HealthConnectCursor =
  | {
      phase: "initial";
      changesToken: string;
      since: string;
      pageToken?: string;
    }
  | { phase: "changes"; changesToken: string };

let initialized: Promise<boolean> | null = null;

function ensureInitialized(): Promise<boolean> {
  initialized ??= initialize().catch((error) => {
    initialized = null;
    throw error;
  });
  return initialized;
}

function parseCursor(cursor: SyncCursor | null): HealthConnectCursor | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(cursor) as HealthConnectCursor;
    return parsed.phase === "initial" || parsed.phase === "changes"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function freshChangesToken(): Promise<string> {
  const response = await getChanges({ recordTypes: TRACKED_TYPES });
  return response.nextChangesToken;
}

async function aggregatesOf(
  session: HealthConnectSessionInput,
): Promise<HealthConnectSessionStats> {
  const timeRangeFilter: TimeRangeFilter = {
    operator: "between",
    startTime: session.startTime,
    endTime: session.endTime,
  };
  const origin = session.metadata?.dataOrigin;
  const safe = async <T>(work: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await work();
    } catch {
      return undefined;
    }
  };
  const byOrigin = origin ? [origin] : undefined;

  // The session's own app first: a phone and a watch often write distance in parallel.
  let distance = await safe(() =>
    aggregateRecord({
      recordType: "Distance",
      timeRangeFilter,
      dataOriginFilter: byOrigin,
    }),
  );
  if (!distance?.DISTANCE?.inMeters && byOrigin) {
    distance = await safe(() =>
      aggregateRecord({ recordType: "Distance", timeRangeFilter }),
    );
  }
  const [heartRate, elevation, steps, calories] = await Promise.all([
    safe(() => aggregateRecord({ recordType: "HeartRate", timeRangeFilter })),
    safe(() =>
      aggregateRecord({
        recordType: "ElevationGained",
        timeRangeFilter,
        dataOriginFilter: byOrigin,
      }),
    ),
    safe(() =>
      aggregateRecord({
        recordType: "Steps",
        timeRangeFilter,
        dataOriginFilter: byOrigin,
      }),
    ),
    safe(() =>
      aggregateRecord({
        recordType: "ActiveCaloriesBurned",
        timeRangeFilter,
        dataOriginFilter: byOrigin,
      }),
    ),
  ]);

  return {
    distanceMeters: distance?.DISTANCE?.inMeters,
    averageHeartRate: heartRate?.BPM_AVG,
    maxHeartRate: heartRate?.BPM_MAX,
    elevationGainMeters: elevation?.ELEVATION_GAINED_TOTAL?.inMeters,
    steps: steps?.COUNT_TOTAL,
    activeCaloriesKcal: calories?.ACTIVE_CALORIES_TOTAL?.inKilocalories,
  };
}

async function mapSessions(
  sessions: HealthConnectSessionInput[],
): Promise<DeviceActivity[]> {
  const activities: DeviceActivity[] = [];
  for (const session of sessions) {
    if (!isRunningSession(session)) continue;
    const activity = mapHealthConnectSession(
      session,
      await aggregatesOf(session),
    );
    if (activity) activities.push(activity);
  }
  return activities;
}

async function readSessions(
  startTime: Date,
  endTime: Date,
  pageToken?: string,
): Promise<{ sessions: HealthConnectSessionInput[]; pageToken?: string }> {
  const response = await readRecords("ExerciseSession", {
    timeRangeFilter: {
      operator: "between",
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    },
    pageSize: PAGE_SIZE,
    pageToken,
  });
  return {
    sessions: response.records as unknown as HealthConnectSessionInput[],
    pageToken: response.pageToken || undefined,
  };
}

async function readInitialPage(
  state: Extract<HealthConnectCursor, { phase: "initial" }>,
): Promise<WorkoutChangesPage> {
  const { sessions, pageToken } = await readSessions(
    new Date(state.since),
    new Date(),
    state.pageToken,
  );
  const next: HealthConnectCursor = pageToken
    ? { ...state, pageToken }
    : { phase: "changes", changesToken: state.changesToken };
  return {
    activities: await mapSessions(sessions),
    deletedSourceActivityIds: [],
    nextCursor: JSON.stringify(next),
    hasMore: !!pageToken,
  };
}

async function readChangesPage(
  state: Extract<HealthConnectCursor, { phase: "changes" }>,
): Promise<WorkoutChangesPage> {
  const response = await getChanges({ changesToken: state.changesToken });
  if (response.changesTokenExpired) {
    // No sync for 30+ days: read that window again; the backend ignores what it already has.
    const restart: HealthConnectCursor = {
      phase: "initial",
      changesToken: await freshChangesToken(),
      since: new Date(
        Date.now() - HISTORY_WITHOUT_PERMISSION_DAYS * DAY_MS,
      ).toISOString(),
    };
    return {
      activities: [],
      deletedSourceActivityIds: [],
      nextCursor: JSON.stringify(restart),
      hasMore: true,
    };
  }

  const sessions = new Map<string, HealthConnectSessionInput>();
  let lateFrom = Number.POSITIVE_INFINITY;
  let lateTo = 0;
  for (const change of response.upsertionChanges) {
    const record = change.record as unknown as HealthConnectSessionInput & {
      recordType: RecordType;
    };
    if (record.recordType === "ExerciseSession") {
      if (record.metadata?.id) sessions.set(record.metadata.id, record);
    } else if (record.startTime && record.endTime) {
      lateFrom = Math.min(lateFrom, Date.parse(record.startTime));
      lateTo = Math.max(lateTo, Date.parse(record.endTime));
    }
  }

  // HR and distance often arrive after the session: re-send recent sessions they belong to.
  const windowStart = Date.now() - LATE_DATA_WINDOW_DAYS * DAY_MS;
  if (lateTo > 0 && lateTo >= windowStart) {
    let pageToken: string | undefined;
    do {
      const page = await readSessions(
        new Date(Math.max(lateFrom, windowStart)),
        new Date(lateTo),
        pageToken,
      );
      for (const session of page.sessions) {
        if (session.metadata?.id && !sessions.has(session.metadata.id))
          sessions.set(session.metadata.id, session);
      }
      pageToken = page.pageToken;
    } while (pageToken);
  }

  return {
    activities: await mapSessions([...sessions.values()]),
    // Deletions carry no record type; ids that are not runs are ignored by the backend.
    deletedSourceActivityIds: response.deletionChanges.map(
      (change) => change.recordId,
    ),
    nextCursor: JSON.stringify({
      phase: "changes",
      changesToken: response.nextChangesToken,
    } satisfies HealthConnectCursor),
    hasMore: response.hasMore,
  };
}

function scopesFrom(granted: Array<{ recordType: string }>): DeviceScope[] {
  const names = new Set(granted.map((permission) => permission.recordType));
  const scopes = READ_PERMISSIONS.filter((entry) =>
    names.has(entry.recordType),
  ).map((entry) => entry.scope);
  if (names.has("ReadHealthDataHistory")) scopes.push("history");
  if (names.has("BackgroundAccessPermission")) scopes.push("background");
  return scopes;
}

export const healthConnectSource: DeviceHealthSource = {
  provider: "health_connect",

  async getAvailability(): Promise<HealthAvailability> {
    try {
      const status = await getSdkStatus(PROVIDER_PACKAGE);
      if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return "available";
      if (
        status ===
        SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED
      )
        return "update_required";
      // Android 14+ ships Health Connect in the system: unavailable there means unsupported.
      return Number(Platform.Version) >= 34 ? "unsupported" : "not_installed";
    } catch {
      return "unsupported";
    }
  },

  async requestPermissions(request: PermissionRequest): Promise<DeviceScope[]> {
    await ensureInitialized();
    const permissions: Parameters<typeof requestPermission>[0] =
      READ_PERMISSIONS.map(
        (entry): Permission => ({
          accessType: "read",
          recordType: entry.recordType,
        }),
      );
    if (request.history)
      permissions.push({
        accessType: "read",
        recordType: "ReadHealthDataHistory",
      });
    if (request.background)
      permissions.push({
        accessType: "read",
        recordType: "BackgroundAccessPermission",
      });
    const granted = await requestPermission(permissions);
    return scopesFrom(granted);
  },

  async getGrantedScopes(): Promise<DeviceScope[]> {
    await ensureInitialized();
    return scopesFrom(await getGrantedPermissions());
  },

  async ensureReadAccess(): Promise<void> {
    await ensureInitialized();
    const granted = new Set(
      (await getGrantedPermissions()).map(
        (permission) => permission.recordType,
      ),
    );
    // Not connected through this app yet: the connect flow asks for everything.
    if (!granted.has("ExerciseSession")) return;
    const missing = READ_PERMISSIONS.filter(
      (entry) => !granted.has(entry.recordType),
    );
    if (missing.length === 0) return;
    await requestPermission(
      missing.map(
        (entry): Permission => ({
          accessType: "read",
          recordType: entry.recordType,
        }),
      ),
    );
  },

  async readWorkoutChanges(cursor, since): Promise<WorkoutChangesPage> {
    await ensureInitialized();
    const state = parseCursor(cursor) ?? {
      phase: "initial" as const,
      changesToken: await freshChangesToken(),
      since: since.toISOString(),
    };
    return state.phase === "initial"
      ? readInitialPage(state)
      : readChangesPage(state);
  },

  async readProfileMetrics(now): Promise<DeviceProfileMetricsRequest> {
    await ensureInitialized();
    const metrics: DeviceProfileMetricsRequest = {};
    const from = new Date(
      now.getTime() - RESTING_HR_DAYS * DAY_MS,
    ).toISOString();
    try {
      const weights = await readRecords("Weight", {
        timeRangeFilter: {
          operator: "after",
          startTime: new Date(now.getTime() - 90 * DAY_MS).toISOString(),
        },
        ascendingOrder: false,
        pageSize: 1,
      });
      const latest = weights.records[0];
      if (latest) {
        metrics.weight = {
          valueKg: Math.round(latest.weight.inKilograms * 10) / 10,
          measuredAt: new Date(latest.time).toISOString(),
          originAppId: latest.metadata?.dataOrigin,
        };
      }
    } catch {
      // No access or no data: the profile keeps its value.
    }
    try {
      const heights = await readRecords("Height", {
        timeRangeFilter: {
          operator: "after",
          startTime: new Date(0).toISOString(),
        },
        ascendingOrder: false,
        pageSize: 1,
      });
      const latest = heights.records[0];
      if (latest && latest.height.inMeters > 0) {
        metrics.height = {
          valueCm: Math.round(latest.height.inMeters * 100),
          measuredAt: new Date(latest.time).toISOString(),
          originAppId: latest.metadata?.dataOrigin,
        };
      }
    } catch {
      // Same as above.
    }
    try {
      const resting = await readRecords("RestingHeartRate", {
        timeRangeFilter: { operator: "after", startTime: from },
        ascendingOrder: false,
        pageSize: RESTING_HR_DAYS * 4,
      });
      const byDay = new Map<string, number>();
      for (const record of resting.records) {
        const offsetMs =
          (record.zoneOffset?.totalSeconds ??
            -new Date(record.time).getTimezoneOffset() * 60) * 1000;
        const day = new Date(Date.parse(record.time) + offsetMs)
          .toISOString()
          .slice(0, 10);
        if (!byDay.has(day)) byDay.set(day, Math.round(record.beatsPerMinute));
      }
      if (byDay.size > 0) {
        metrics.restingHeartRate = [...byDay.entries()]
          .map(([date, bpm]) => ({ date, bpm }))
          .slice(0, RESTING_HR_DAYS);
      }
    } catch {
      // Same as above.
    }
    return metrics;
  },

  async getWriteAccess(): Promise<HealthWriteAccess> {
    await ensureInitialized();
    const granted = await getGrantedPermissions();
    // Health Connect does not tell a refusal from a question never asked.
    return granted.some(
      (permission) =>
        permission.accessType === "write" &&
        permission.recordType === "ExerciseSession",
    )
      ? "granted"
      : "not_asked";
  },

  async requestWriteAccess(): Promise<boolean> {
    await ensureInitialized();
    const granted = await requestPermission(WRITE_PERMISSIONS);
    return granted.some(
      (permission) =>
        permission.accessType === "write" &&
        permission.recordType === "ExerciseSession",
    );
  },

  async saveRecordedRun(run: RecordedRunExport): Promise<void> {
    await ensureInitialized();
    const granted = new Set(
      (await getGrantedPermissions())
        .filter((permission) => permission.accessType === "write")
        .map((p) => p.recordType),
    );
    const interval = {
      startTime: run.startedAt.toISOString(),
      endTime: run.endedAt.toISOString(),
    };
    // The client id makes a repeated write replace the record instead of adding one.
    const metadata = (suffix: string) => ({
      clientRecordId: `trefix-${run.id}-${suffix}`,
    });
    const records: HealthConnectRecord[] = [
      {
        recordType: "ExerciseSession",
        exerciseType: run.indoor
          ? ExerciseType.RUNNING_TREADMILL
          : ExerciseType.RUNNING,
        ...interval,
        metadata: metadata("session"),
        ...(run.route.length >= 2 && granted.has("ExerciseRoute")
          ? {
              exerciseRoute: {
                route: run.route.map((point) => ({
                  time: new Date(point.t).toISOString(),
                  latitude: point.lat,
                  longitude: point.lng,
                  ...(point.alt !== null
                    ? {
                        altitude: { value: point.alt, unit: "meters" as const },
                      }
                    : {}),
                  ...(point.acc !== null
                    ? {
                        horizontalAccuracy: {
                          value: point.acc,
                          unit: "meters" as const,
                        },
                      }
                    : {}),
                })),
              },
            }
          : {}),
      },
    ];
    if (granted.has("Distance") && run.distanceM > 0) {
      records.push({
        recordType: "Distance",
        ...interval,
        distance: { value: run.distanceM, unit: "meters" },
        metadata: metadata("distance"),
      });
    }
    if (granted.has("ActiveCaloriesBurned") && run.energyKcal) {
      records.push({
        recordType: "ActiveCaloriesBurned",
        ...interval,
        energy: { value: run.energyKcal, unit: "kilocalories" },
        metadata: metadata("calories"),
      });
    }
    if (granted.has("ElevationGained") && run.elevationGainM) {
      records.push({
        recordType: "ElevationGained",
        ...interval,
        elevation: { value: run.elevationGainM, unit: "meters" },
        metadata: metadata("elevation"),
      });
    }
    await insertRecords(records);
  },

  async readHeartRate(from: Date, to: Date): Promise<HeartRateSummary | null> {
    await ensureInitialized();
    const result = await aggregateRecord({
      recordType: "HeartRate",
      timeRangeFilter: {
        operator: "between",
        startTime: from.toISOString(),
        endTime: to.toISOString(),
      },
    });
    return result.BPM_AVG && result.BPM_MAX
      ? { avg: Math.round(result.BPM_AVG), max: Math.round(result.BPM_MAX) }
      : null;
  },

  async openSystemSettings(): Promise<void> {
    openHealthConnectSettings();
  },

  async openStorePage(): Promise<void> {
    const market = `market://details?id=${PROVIDER_PACKAGE}`;
    if (await Linking.canOpenURL(market).catch(() => false)) {
      await Linking.openURL(market);
      return;
    }
    await Linking.openURL(
      `https://play.google.com/store/apps/details?id=${PROVIDER_PACKAGE}`,
    );
  },
};
