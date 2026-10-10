/**
 * Facts of a run reported by an external source (Strava, Apple Health, …),
 * already merged across sources by the integrations module.
 */
export interface ImportedWorkoutFacts {
  sourceProvider: string;
  sourceActivityId: string;
  startedAt: Date;
  endedAt: Date;
  durationMinutes: number;
  distanceKm: number;
  averagePaceSecondsPerKm: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  cadence: number | null;
  calories: number | null;
  elevationGainMeters: number | null;
  indoor: boolean;
}
