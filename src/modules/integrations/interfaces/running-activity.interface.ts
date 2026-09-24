export type ActivitySource = 'strava' | 'garmin' | 'apple_health' | 'health_connect';

export type RunningActivityType = 'run' | 'trail_run' | 'virtual_run';

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
  importedAt: Date;
  updatedAt: Date;
  status: RunningActivityStatus;
}
