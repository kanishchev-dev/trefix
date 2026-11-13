'use strict';

/** Manually entered results (races, tests) and the "exclude from records" flag of workouts. */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
    try {
      await run(`
        CREATE TABLE race_results (
          id UUID PRIMARY KEY,
          athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE ON UPDATE CASCADE,
          distance_m INTEGER NOT NULL CHECK (distance_m BETWEEN 400 AND 100000),
          time_seconds INTEGER NOT NULL CHECK (time_seconds > 0),
          date DATE NOT NULL,
          kind VARCHAR(16) NOT NULL CHECK (kind IN ('race', 'workout', 'test')),
          name VARCHAR(120) NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          deleted_at TIMESTAMPTZ NULL
        );
      `);
      await run(
        `CREATE INDEX race_results_athlete_date_idx ON race_results (athlete_id, date) WHERE deleted_at IS NULL;`,
      );
      await run(`ALTER TABLE workouts ADD COLUMN exclude_from_records BOOLEAN NOT NULL DEFAULT false;`);
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
      await run(`ALTER TABLE workouts DROP COLUMN exclude_from_records;`);
      await run(`DROP TABLE race_results;`);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
