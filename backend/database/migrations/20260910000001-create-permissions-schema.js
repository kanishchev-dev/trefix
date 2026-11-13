'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Permissions table
    await queryInterface.createTable('permissions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Permission Groups table
    await queryInterface.createTable('permission_groups', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // M:N Group <-> Permission
    await queryInterface.createTable('permission_group_permissions', {
      permission_group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'permission_groups', key: 'id' },
        onDelete: 'CASCADE',
      },
      permission_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'permissions', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addConstraint('permission_group_permissions', {
      fields: ['permission_group_id', 'permission_id'],
      type: 'primary key',
      name: 'pk_permission_group_permissions'
    });

    // M:N User <-> Permission (Individual permissions)
    await queryInterface.createTable('user_permissions', {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      permission_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'permissions', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addConstraint('user_permissions', {
      fields: ['user_id', 'permission_id'],
      type: 'primary key',
      name: 'pk_user_permissions'
    });

    // M:N User <-> Permission Group
    await queryInterface.createTable('user_permission_groups', {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
      },
      permission_group_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'permission_groups', key: 'id' },
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
    await queryInterface.addConstraint('user_permission_groups', {
      fields: ['user_id', 'permission_group_id'],
      type: 'primary key',
      name: 'pk_user_permission_groups'
    });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('user_permission_groups');
    await queryInterface.dropTable('user_permissions');
    await queryInterface.dropTable('permission_group_permissions');
    await queryInterface.dropTable('permission_groups');
    await queryInterface.dropTable('permissions');
  },
};
