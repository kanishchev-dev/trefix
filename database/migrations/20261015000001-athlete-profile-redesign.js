'use strict';

/**
 * `bio` for the public part of the profile, `allow_doubles` for two workouts a day,
 * and sex narrowed to female/male (other values had no meaning for training calculations).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn('users', 'bio', { type: Sequelize.STRING(300), allowNull: true }, { transaction });
      await queryInterface.addColumn(
        'athletes',
        'allow_doubles',
        { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE athletes SET sex = NULL WHERE sex IS NOT NULL AND sex NOT IN ('female', 'male')`,
        { transaction },
      );
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('athletes', 'allow_doubles', { transaction });
      await queryInterface.removeColumn('users', 'bio', { transaction });
    });
  },
};
