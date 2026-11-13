'use strict';

/**
 * Apple Health / Health Connect groundwork: device metadata on integrations,
 * workout ↔ provider record links, accepted device batches, user consents.
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
    try {
      await run(`ALTER TABLE integrations ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;`);

      await run(`
        CREATE TABLE workout_sources (
          id UUID PRIMARY KEY,
          workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE ON UPDATE CASCADE,
          athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE ON UPDATE CASCADE,
          provider VARCHAR(32) NOT NULL,
          source_activity_id VARCHAR(128) NOT NULL,
          origin_app_id VARCHAR(255) NULL,
          origin_device VARCHAR(255) NULL,
          is_primary BOOLEAN NOT NULL DEFAULT false,
          started_at TIMESTAMPTZ NOT NULL,
          ended_at TIMESTAMPTZ NOT NULL,
          utc_offset_minutes SMALLINT NULL,
          duration_sec INTEGER NOT NULL CHECK (duration_sec >= 0),
          distance_meters INTEGER NOT NULL CHECK (distance_meters >= 0),
          facts JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          deleted_at TIMESTAMPTZ NULL
        );
      `);
      // Soft-deleted links keep the key: ingestion purges them before re-importing the same record.
      await run(
        `CREATE UNIQUE INDEX workout_sources_athlete_provider_activity_unique ON workout_sources (athlete_id, provider, source_activity_id);`,
      );
      await run(
        `CREATE INDEX workout_sources_athlete_started_idx ON workout_sources (athlete_id, started_at) WHERE deleted_at IS NULL;`,
      );
      await run(`CREATE INDEX workout_sources_workout_idx ON workout_sources (workout_id) WHERE deleted_at IS NULL;`);

      await run(`
        CREATE TABLE device_sync_batches (
          id UUID PRIMARY KEY,
          integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE ON UPDATE CASCADE,
          sync_id UUID NOT NULL,
          batch_index INTEGER NOT NULL CHECK (batch_index >= 0),
          sync_type VARCHAR(32) NOT NULL,
          is_last BOOLEAN NOT NULL DEFAULT false,
          payload JSONB NOT NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'pending',
          result JSONB NULL,
          error TEXT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          processed_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await run(
        `CREATE UNIQUE INDEX device_sync_batches_sync_batch_unique ON device_sync_batches (integration_id, sync_id, batch_index);`,
      );
      await run(`CREATE INDEX device_sync_batches_status_created_idx ON device_sync_batches (status, created_at);`);

      await run(`
        CREATE TABLE user_consents (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          type VARCHAR(32) NOT NULL,
          version VARCHAR(20) NOT NULL,
          accepted_at TIMESTAMPTZ NOT NULL,
          revoked_at TIMESTAMPTZ NULL,
          client JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await run(`CREATE INDEX user_consents_user_type_idx ON user_consents (user_id, type, accepted_at DESC);`);

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
      await run(`DROP TABLE user_consents;`);
      await run(`DROP TABLE device_sync_batches;`);
      await run(`DROP TABLE workout_sources;`);
      await run(`ALTER TABLE integrations DROP COLUMN metadata;`);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
