'use strict';

/** Coach notes shown under a workout, one per workout and language. */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
    try {
      await run(`
        CREATE TABLE coach_workout_notes (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE ON UPDATE CASCADE,
          language VARCHAR(8) NOT NULL,
          input_hash VARCHAR(64) NOT NULL,
          content TEXT NOT NULL,
          model VARCHAR(255) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await run(
        `CREATE UNIQUE INDEX coach_workout_notes_workout_language_unique ON coach_workout_notes (workout_id, language);`,
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS coach_workout_notes;');
  },
};
