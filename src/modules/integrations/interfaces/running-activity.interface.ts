export type ActivitySource = 'strava' | 'garmin' | 'apple_health' | 'health_connect' | 'trefix';

export type RunningActivityType = 'run' | 'trail_run' | 'virtual_run' | 'treadmill';

export type RunningActivityStatus = 'imported' | 'analyzed' | 'failed' | 'deleted' | 'unavailable';

export interface RunningActivity {
  id: string;
  athleteId: string;
  source: ActivitySource;
  sourceActivityId: string;
  type: RunningActivityType;
  startedAt: Date;
  endedAt: Date;
  durationSec: number;
  distanceMeters: number;
  elevationGainMeters?: number;
  averagePaceSecPerKm?: number;
  averageSpeedMps?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  calories?: number;
  cadence?: number;
  movingTimeSec?: number;
  elapsedTimeSec?: number;
  trainingLoad?: number;
  rawDataReference?: string;
  /** Provider gear id (Strava `gear_id`), used to link the workout to shoes. */
  gearExternalId?: string;
  /** Offset of the athlete's wall clock at the start, minutes east of UTC. */
  utcOffsetMinutes?: number;
  /** Bundle id / package of the app that wrote the record into Apple Health / Health Connect. */
  originAppId?: string;
  /** Recording device, e.g. "Apple Watch". */
  originDevice?: string;
  importedAt: Date;
  updatedAt: Date;
  status: RunningActivityStatus;
}
