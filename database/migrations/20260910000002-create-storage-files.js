'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('storage_files', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      original_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      size: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      storage_key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      uploader_user_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      scope_type: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      scope_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      folder: {
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

    await queryInterface.addIndex('storage_files', ['uploader_user_id']);
    await queryInterface.addIndex('storage_files', ['scope_type', 'scope_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('storage_files');
  },
};
