'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create integrations table
    await queryInterface.createTable('integrations', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      athlete_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'athletes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'disconnected',
      },
      external_user_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      access_token_encrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      refresh_token_encrypted: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      access_token_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      scopes: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      connected_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      disconnected_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_sync_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_successful_sync_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      last_sync_error: {
        type: Sequelize.TEXT,
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

    await queryInterface.addIndex('integrations', ['athlete_id', 'provider'], {
      unique: true,
      name: 'integrations_athlete_provider_unique',
    });

    // 2. Create integration_sync_states table
    await queryInterface.createTable('integration_sync_states', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      integration_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'integrations',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      sync_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      cursor: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      page: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      processed_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      imported_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      skipped_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      failed_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      error: {
        type: Sequelize.TEXT,
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
    });

    await queryInterface.addIndex('integration_sync_states', ['integration_id']);

    // 3. Create strava_webhook_events table
    await queryInterface.createTable('strava_webhook_events', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      subscription_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      object_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      object_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      aspect_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      owner_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      event_time: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updates: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      fingerprint: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      received_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'pending',
      },
      attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      error: {
        type: Sequelize.TEXT,
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
    });

    await queryInterface.addIndex('strava_webhook_events', ['fingerprint'], {
      unique: true,
      name: 'strava_webhook_events_fingerprint_unique',
    });

    // 4. Add source_provider and source_activity_id to workouts table
    await queryInterface.addColumn('workouts', 'source_provider', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('workouts', 'source_activity_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addIndex(
      'workouts',
      ['athlete_id', 'source_provider', 'source_activity_id'],
      {
        unique: true,
        name: 'workouts_athlete_source_unique',
      },
    );
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('workouts', 'workouts_athlete_source_unique');
    await queryInterface.removeColumn('workouts', 'source_activity_id');
    await queryInterface.removeColumn('workouts', 'source_provider');

    await queryInterface.dropTable('strava_webhook_events');
    await queryInterface.dropTable('integration_sync_states');
    await queryInterface.dropTable('integrations');
  },
};
