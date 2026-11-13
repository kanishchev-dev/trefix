'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('athletes', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      age: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      sex: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      height_cm: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      weight_kg: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      experience_level: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      weekly_mileage_km: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      sessions_per_week: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 4,
      },
      recent_race_results: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      preferred_training_days: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      available_training_days: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      preferred_workout_duration_minutes: {
        type: Sequelize.INTEGER,
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

    await queryInterface.addIndex('athletes', ['user_id'], {
      unique: true,
      name: 'athletes_user_id_unique',
    });

    await queryInterface.createTable('athlete_goals', {
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
      race_distance: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      target_time_seconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      target_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      priority: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'active',
      },
      notes: {
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
    await queryInterface.addIndex('athlete_goals', ['athlete_id']);

    await queryInterface.createTable('athlete_states', {
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
      fitness: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      fatigue: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      form: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      threshold_pace_seconds_per_km: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      threshold_heart_rate: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      vo2max: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      weekly_load: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      acute_load: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      chronic_load: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      recovery_score: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      source: {
        type: Sequelize.STRING,
        allowNull: false,
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
    await queryInterface.addIndex('athlete_states', ['athlete_id', 'created_at']);

    await queryInterface.createTable('training_plans', {
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
      goal_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'athlete_goals',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      training_frequency: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      weekly_target_km: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'draft',
      },
      algorithm_version: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      weeks: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
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
    await queryInterface.addIndex('training_plans', ['athlete_id']);
    await queryInterface.addIndex('training_plans', ['goal_id']);

    await queryInterface.createTable('workouts', {
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
      goal_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'athlete_goals',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      plan_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'training_plans',
          key: 'id',
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      week_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      phase: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'planned',
      },
      order_in_week: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      duration_minutes: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      distance_km: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      target: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      steps: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      actual: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      analysis: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      completed_at: {
        type: Sequelize.DATE,
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
    await queryInterface.addIndex('workouts', ['athlete_id', 'scheduled_at']);
    await queryInterface.addIndex('workouts', ['plan_id', 'week_number']);
    await queryInterface.addIndex('workouts', ['plan_id', 'status']);

    await queryInterface.createTable('training_loads', {
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
      workout_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'workouts',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      occurred_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      load: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      intensity_factor: {
        type: Sequelize.FLOAT,
        allowNull: false,
      },
      algorithm_version: {
        type: Sequelize.STRING,
        allowNull: false,
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
    await queryInterface.addIndex('training_loads', ['athlete_id', 'occurred_at']);
    await queryInterface.addIndex('training_loads', ['workout_id']);

    await queryInterface.createTable('adaptation_events', {
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
      plan_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'training_plans',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      workout_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'workouts',
          key: 'id',
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      input: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      decision: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      reason: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      confidence: {
        type: Sequelize.FLOAT,
        allowNull: false,
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
    await queryInterface.addIndex('adaptation_events', ['athlete_id', 'created_at']);
    await queryInterface.addIndex('adaptation_events', ['plan_id', 'created_at']);
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('adaptation_events');
    await queryInterface.dropTable('training_loads');
    await queryInterface.dropTable('workouts');
    await queryInterface.dropTable('training_plans');
    await queryInterface.dropTable('athlete_states');
    await queryInterface.dropTable('athlete_goals');
    await queryInterface.dropTable('athletes');
  },
};
