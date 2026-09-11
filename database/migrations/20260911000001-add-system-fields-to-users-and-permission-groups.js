'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('permission_groups', 'system_key', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('permission_groups', 'is_system', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('users', 'system_key', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'is_system', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addIndex('permission_groups', ['system_key'], {
      unique: true,
      name: 'permission_groups_system_key_unique',
    });

    await queryInterface.addIndex('users', ['system_key'], {
      unique: true,
      name: 'users_system_key_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('users', 'users_system_key_unique');
    await queryInterface.removeIndex('permission_groups', 'permission_groups_system_key_unique');
    await queryInterface.removeColumn('users', 'is_system');
    await queryInterface.removeColumn('users', 'system_key');
    await queryInterface.removeColumn('permission_groups', 'is_system');
    await queryInterface.removeColumn('permission_groups', 'system_key');
  },
};
