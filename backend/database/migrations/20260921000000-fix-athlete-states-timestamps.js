'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add default values to created_at and updated_at in athlete_states
    await queryInterface.changeColumn('athlete_states', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });

    await queryInterface.changeColumn('athlete_states', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('athlete_states', 'created_at', {
      type: Sequelize.DATE,
      allowNull: false,
    });

    await queryInterface.changeColumn('athlete_states', 'updated_at', {
      type: Sequelize.DATE,
      allowNull: false,
    });
  },
};
