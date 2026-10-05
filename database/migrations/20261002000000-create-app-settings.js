'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('app_settings', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      value: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('app_settings', ['key'], {
      unique: true,
      name: 'app_settings_key_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('app_settings', 'app_settings_key_unique');
    await queryInterface.dropTable('app_settings');
  },
};
