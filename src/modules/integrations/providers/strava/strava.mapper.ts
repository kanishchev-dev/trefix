import { RunningActivity, RunningActivityType } from '../../interfaces/running-activity.interface';
import { StravaActivitySummary } from '../../interfaces/strava-api.interface';

const RUNNING_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun']);

export class StravaMapper {
  /** Checks if the Strava activity is a supported running activity type. */
  static isRunningActivity(stravaActivity: StravaActivitySummary): boolean {
    const type = stravaActivity.sport_type || stravaActivity.type;
    return RUNNING_TYPES.has(type);
  }

  /** Maps Strava activity summary payload to domain RunningActivity DTO. */
  static toRunningActivity(athleteId: string, stravaActivity: StravaActivitySummary): RunningActivity {
    const startedAt = new Date(stravaActivity.start_date);
    const durationSec = stravaActivity.elapsed_time || stravaActivity.moving_time || 0;
    const endedAt = new Date(startedAt.getTime() + durationSec * 1000);

    const distanceMeters = stravaActivity.distance || 0;
    const movingTimeSec = stravaActivity.moving_time || durationSec;
    const elapsedTimeSec = stravaActivity.elapsed_time || durationSec;

    const averagePaceSecPerKm = distanceMeters > 0 ? Math.round((movingTimeSec / distanceMeters) * 1000) : undefined;

    const rawType = stravaActivity.sport_type || stravaActivity.type;
    let activityType: RunningActivityType = 'run';
    if (rawType === 'TrailRun') {
      activityType = 'trail_run';
    } else if (rawType === 'VirtualRun') {
      activityType = 'virtual_run';
    }

    return {
      id: `strava:${stravaActivity.id}`,
      athleteId,
      source: 'strava',
      sourceActivityId: String(stravaActivity.id),
      type: activityType,
      startedAt,
      endedAt,
      durationSec,
      distanceMeters,
      elevationGainMeters: stravaActivity.total_elevation_gain ?? undefined,
      averagePaceSecPerKm,
      averageSpeedMps: stravaActivity.average_speed ?? undefined,
      averageHeartRate: stravaActivity.average_heartrate ?? undefined,
      maxHeartRate: stravaActivity.max_heartrate ?? undefined,
      calories: stravaActivity.calories ?? undefined,
      cadence: stravaActivity.average_cadence ?? undefined,
      movingTimeSec,
      elapsedTimeSec,
      gearExternalId: stravaActivity.gear_id ?? undefined,
      importedAt: new Date(),
      updatedAt: new Date(),
      status: 'imported',
    };
  }
}
