'use strict';

/**
 * Athlete profile: heart rate, zones, schedule preferences and field provenance
 * on `athletes`; running gear with a link from workouts; per-user preferences;
 * a status for adaptation events so changes can wait for the user's confirmation.
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
    try {
      await run(`
        ALTER TABLE athletes
          ADD COLUMN birth_date DATE NULL,
          ADD COLUMN resting_heart_rate SMALLINT NULL,
          ADD COLUMN max_heart_rate SMALLINT NULL,
          ADD COLUMN threshold_heart_rate SMALLINT NULL,
          ADD COLUMN hr_zones_method VARCHAR(16) NOT NULL DEFAULT 'max_hr',
          ADD COLUMN hr_zones_custom JSONB NULL,
          ADD COLUMN running_since_year SMALLINT NULL,
          ADD COLUMN limitations VARCHAR(500) NULL,
          ADD COLUMN preferred_time_of_day VARCHAR(16) NOT NULL DEFAULT 'any',
          ADD COLUMN long_run_day VARCHAR(16) NULL,
          ADD COLUMN long_run_max_duration_minutes INTEGER NULL,
          ADD COLUMN field_sources JSONB NOT NULL DEFAULT '{}'::jsonb,
          ALTER COLUMN weight_kg TYPE NUMERIC(5,1) USING round(weight_kg::numeric, 1),
          ADD CONSTRAINT athletes_hr_zones_method_check
            CHECK (hr_zones_method IN ('threshold', 'max_hr', 'custom')),
          ADD CONSTRAINT athletes_preferred_time_of_day_check
            CHECK (preferred_time_of_day IN ('morning', 'day', 'evening', 'any')),
          ADD CONSTRAINT athletes_long_run_day_check
            CHECK (long_run_day IS NULL OR long_run_day IN
              ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));
      `);

      await run(`
        CREATE TABLE gear (
          id UUID PRIMARY KEY,
          athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE ON UPDATE CASCADE,
          type VARCHAR(16) NOT NULL DEFAULT 'shoes' CHECK (type IN ('shoes')),
          brand VARCHAR(60) NOT NULL,
          model VARCHAR(80) NOT NULL,
          nickname VARCHAR(60) NULL,
          initial_distance_km NUMERIC(7,1) NOT NULL DEFAULT 0 CHECK (initial_distance_km >= 0),
          limit_km INTEGER NOT NULL DEFAULT 700 CHECK (limit_km BETWEEN 100 AND 2000),
          started_at DATE NULL,
          retired_at TIMESTAMPTZ NULL,
          default_workout_types VARCHAR(32)[] NOT NULL DEFAULT '{}',
          replace_reminder BOOLEAN NOT NULL DEFAULT true,
          replace_notified_at TIMESTAMPTZ NULL,
          source VARCHAR(16) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'strava')),
          external_id VARCHAR(64) NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          deleted_at TIMESTAMPTZ NULL
        );
      `);
      await run(`CREATE INDEX gear_athlete_id_idx ON gear (athlete_id) WHERE deleted_at IS NULL;`);
      await run(`
        CREATE UNIQUE INDEX gear_athlete_source_external_id_uq
          ON gear (athlete_id, source, external_id)
          WHERE external_id IS NOT NULL AND deleted_at IS NULL;
      `);

      await run(`
        ALTER TABLE workouts
          ADD COLUMN gear_id UUID NULL REFERENCES gear(id) ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      await run(`CREATE INDEX workouts_gear_id_idx ON workouts (gear_id) WHERE gear_id IS NOT NULL;`);

      await run(`
        CREATE TABLE user_preferences (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          units VARCHAR(16) NOT NULL DEFAULT 'metric' CHECK (units IN ('metric', 'imperial')),
          week_start VARCHAR(8) NOT NULL DEFAULT 'mon' CHECK (week_start IN ('mon', 'sun')),
          time_format VARCHAR(8) NOT NULL DEFAULT '24h' CHECK (time_format IN ('24h', '12h')),
          coach_enabled BOOLEAN NOT NULL DEFAULT true,
          coach_adaptation_mode VARCHAR(16) NOT NULL DEFAULT 'confirm'
            CHECK (coach_adaptation_mode IN ('auto', 'confirm', 'suggest')),
          coach_quiet_hours JSONB NULL,
          strava_profile_sync BOOLEAN NOT NULL DEFAULT true,
          timezone VARCHAR(64) NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);

      await run(`ALTER TABLE integrations ADD COLUMN last_profile_sync_at TIMESTAMPTZ NULL;`);

      await run(`
        ALTER TABLE adaptation_events
          ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'applied',
          ADD COLUMN resolved_at TIMESTAMPTZ NULL,
          ADD CONSTRAINT adaptation_events_status_check
            CHECK (status IN ('applied', 'proposed', 'suggested', 'dismissed'));
      `);
      await run(`
        CREATE INDEX adaptation_events_plan_status_idx
          ON adaptation_events (plan_id, status) WHERE status = 'proposed';
      `);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
    try {
      await run(`DROP INDEX IF EXISTS adaptation_events_plan_status_idx;`);
      await run(`
        ALTER TABLE adaptation_events
          DROP CONSTRAINT adaptation_events_status_check,
          DROP COLUMN resolved_at,
          DROP COLUMN status;
      `);
      await run(`ALTER TABLE integrations DROP COLUMN last_profile_sync_at;`);
      await run(`DROP TABLE user_preferences;`);
      await run(`DROP INDEX IF EXISTS workouts_gear_id_idx;`);
      await run(`ALTER TABLE workouts DROP COLUMN gear_id;`);
      await run(`DROP TABLE gear;`);
      await run(`
        ALTER TABLE athletes
          DROP CONSTRAINT athletes_long_run_day_check,
          DROP CONSTRAINT athletes_preferred_time_of_day_check,
          DROP CONSTRAINT athletes_hr_zones_method_check,
          ALTER COLUMN weight_kg TYPE DOUBLE PRECISION USING weight_kg::double precision,
          DROP COLUMN field_sources,
          DROP COLUMN long_run_max_duration_minutes,
          DROP COLUMN long_run_day,
          DROP COLUMN preferred_time_of_day,
          DROP COLUMN limitations,
          DROP COLUMN running_since_year,
          DROP COLUMN hr_zones_custom,
          DROP COLUMN hr_zones_method,
          DROP COLUMN threshold_heart_rate,
          DROP COLUMN max_heart_rate,
          DROP COLUMN resting_heart_rate,
          DROP COLUMN birth_date;
      `);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
