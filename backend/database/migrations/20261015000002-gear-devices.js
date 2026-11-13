'use strict';

/**
 * Watches and sensors next to shoes: wear limit only for shoes, default shoes for new workouts,
 * the primary device (its data wins when two services report the same run) and the device
 * a workout was recorded with.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run(`ALTER TABLE gear ALTER COLUMN limit_km DROP NOT NULL;`);
      await run(`ALTER TABLE gear ALTER COLUMN limit_km DROP DEFAULT;`);
      await run(`ALTER TABLE gear ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;`);
      await run(`ALTER TABLE gear ADD COLUMN is_primary BOOLEAN NOT NULL DEFAULT FALSE;`);
      await run(`ALTER TABLE gear ADD COLUMN data_source VARCHAR(32) NULL;`);
      await run(`
        CREATE UNIQUE INDEX gear_default_shoes_uq ON gear (athlete_id)
          WHERE is_default AND deleted_at IS NULL;
      `);
      await run(`
        CREATE UNIQUE INDEX gear_primary_device_uq ON gear (athlete_id)
          WHERE is_primary AND deleted_at IS NULL;
      `);
      await run(`
        ALTER TABLE workouts
          ADD COLUMN device_id UUID NULL REFERENCES gear(id) ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      await run(`CREATE INDEX workouts_device_id_idx ON workouts (device_id) WHERE device_id IS NOT NULL;`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run(`DROP INDEX IF EXISTS workouts_device_id_idx;`);
      await run(`ALTER TABLE workouts DROP COLUMN device_id;`);
      await run(`DROP INDEX IF EXISTS gear_primary_device_uq;`);
      await run(`DROP INDEX IF EXISTS gear_default_shoes_uq;`);
      await run(`DELETE FROM gear WHERE type <> 'shoes';`);
      await run(`ALTER TABLE gear DROP COLUMN data_source;`);
      await run(`ALTER TABLE gear DROP COLUMN is_primary;`);
      await run(`ALTER TABLE gear DROP COLUMN is_default;`);
      await run(`UPDATE gear SET limit_km = 700 WHERE limit_km IS NULL;`);
      await run(`ALTER TABLE gear ALTER COLUMN limit_km SET DEFAULT 700;`);
      await run(`ALTER TABLE gear ALTER COLUMN limit_km SET NOT NULL;`);
    });
  },
};
