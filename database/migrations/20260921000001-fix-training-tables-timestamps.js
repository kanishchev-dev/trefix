'use strict';

const TABLES = [
  'athletes',
  'athlete_goals',
  'training_plans',
  'workouts',
  'training_loads',
  'adaptation_events',
];

module.exports = {
  up: async (queryInterface, Sequelize) => {
    for (const tableName of TABLES) {
      await queryInterface.changeColumn(tableName, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });

      await queryInterface.changeColumn(tableName, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    for (const tableName of TABLES) {
      await queryInterface.changeColumn(tableName, 'created_at', {
        type: Sequelize.DATE,
        allowNull: false,
      });

      await queryInterface.changeColumn(tableName, 'updated_at', {
        type: Sequelize.DATE,
        allowNull: false,
      });
    }
  },
};
