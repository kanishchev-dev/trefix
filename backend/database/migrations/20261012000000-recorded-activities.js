'use strict';

/**
 * Runs recorded by the in-app tracker: summary, splits, plan steps, simplified
 * route; the full track is a private file in storage.
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
    try {
      await run(`
        CREATE TABLE recorded_activities (
          id UUID PRIMARY KEY,
          athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE ON UPDATE CASCADE,
          workout_id UUID NULL REFERENCES workouts(id) ON DELETE CASCADE ON UPDATE CASCADE,
          outcome VARCHAR(32) NULL,
          client_session_id UUID NOT NULL,
          environment VARCHAR(16) NOT NULL CHECK (environment IN ('outdoor', 'trail', 'treadmill')),
          distance_source VARCHAR(16) NOT NULL CHECK (distance_source IN ('gps', 'pedometer', 'manual', 'mixed')),
          planned_workout_id UUID NULL,
          started_at TIMESTAMPTZ NOT NULL,
          ended_at TIMESTAMPTZ NOT NULL,
          utc_offset_minutes SMALLINT NULL,
          elapsed_sec INTEGER NOT NULL CHECK (elapsed_sec >= 0),
          moving_sec INTEGER NOT NULL CHECK (moving_sec >= 0),
          distance_m INTEGER NOT NULL CHECK (distance_m >= 0),
          measured_distance_m INTEGER NULL,
          elevation_gain_m INTEGER NULL,
          elevation_loss_m INTEGER NULL,
          avg_pace_sec_per_km INTEGER NULL,
          best_pace_sec_per_km INTEGER NULL,
          avg_heart_rate SMALLINT NULL,
          max_heart_rate SMALLINT NULL,
          avg_cadence SMALLINT NULL,
          splits JSONB NOT NULL DEFAULT '[]'::jsonb,
          laps JSONB NOT NULL DEFAULT '[]'::jsonb,
          pauses JSONB NOT NULL DEFAULT '[]'::jsonb,
          route_line TEXT NULL,
          route_bounds JSONB NULL,
          start_point JSONB NULL,
          track_file_id UUID NULL,
          device JSONB NOT NULL DEFAULT '{}'::jsonb,
          feeling SMALLINT NULL CHECK (feeling BETWEEN 1 AND 5),
          rpe SMALLINT NULL CHECK (rpe BETWEEN 1 AND 10),
          notes TEXT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await run(
        `CREATE UNIQUE INDEX recorded_activities_athlete_session_unique ON recorded_activities (athlete_id, client_session_id);`,
      );
      await run(`CREATE INDEX recorded_activities_workout_idx ON recorded_activities (workout_id);`);
      await run(`CREATE INDEX recorded_activities_athlete_started_idx ON recorded_activities (athlete_id, started_at DESC);`);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS recorded_activities;');
  },
};
