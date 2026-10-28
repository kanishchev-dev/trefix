'use strict';

/**
 * Sport of a workout and of a tracker recording: running, walking, hiking or
 * strength. Every existing row is a run.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run(`ALTER TABLE workouts ADD COLUMN sport VARCHAR(16) NOT NULL DEFAULT 'run';`);
      await run(`ALTER TABLE recorded_activities ADD COLUMN sport VARCHAR(16) NOT NULL DEFAULT 'run';`);
      await run(`CREATE INDEX workouts_athlete_sport_status_idx ON workouts (athlete_id, sport, status);`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run('DROP INDEX IF EXISTS workouts_athlete_sport_status_idx;');
      await run('ALTER TABLE recorded_activities DROP COLUMN sport;');
      await run('ALTER TABLE workouts DROP COLUMN sport;');
    });
  },
};
