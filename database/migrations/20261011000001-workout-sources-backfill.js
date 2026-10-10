'use strict';

/**
 * Links every already imported workout to its provider record so dedup sees
 * history. Facts are restored from `workouts.actual`; the end time is
 * approximated by the start plus the actual duration.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO workout_sources (
        id, workout_id, athlete_id, provider, source_activity_id, is_primary,
        started_at, ended_at, duration_sec, distance_meters, facts, created_at, updated_at
      )
      SELECT
        gen_random_uuid(),
        w.id,
        w.athlete_id,
        w.source_provider,
        w.source_activity_id,
        true,
        w.scheduled_at,
        w.scheduled_at + make_interval(secs => durations.duration_sec),
        durations.duration_sec,
        GREATEST(0, ROUND(COALESCE((w.actual->>'actualDistanceKm')::numeric, w.distance_km::numeric, 0) * 1000))::int,
        jsonb_build_object(
          'type', 'run',
          'movingTimeSec', durations.duration_sec,
          'elapsedTimeSec', NULL,
          'elevationGainMeters', w.actual->'elevationGainMeters',
          'averageHeartRate', w.actual->'actualAverageHeartRate',
          'maxHeartRate', NULL,
          'cadence', w.actual->'cadence',
          'calories', w.actual->'calories',
          'gearExternalId', NULL,
          'backfilled', true
        ),
        now(),
        now()
      FROM workouts w
      CROSS JOIN LATERAL (
        SELECT GREATEST(
          60,
          ROUND(COALESCE((w.actual->>'actualDurationMinutes')::numeric, w.duration_minutes::numeric, 0) * 60)
        )::int AS duration_sec
      ) durations
      WHERE w.deleted_at IS NULL
        AND w.status = 'completed'
        AND w.source_provider IN ('strava', 'garmin', 'apple_health', 'health_connect')
        AND w.source_activity_id IS NOT NULL
      ON CONFLICT (athlete_id, provider, source_activity_id) DO NOTHING;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DELETE FROM workout_sources WHERE facts->>'backfilled' = 'true';`);
  },
};
