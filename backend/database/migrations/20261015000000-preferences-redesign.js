'use strict';

/**
 * Splits `units` into per-quantity units, adds the language choice that can follow the device,
 * coach tone, per-topic proactive coach messages, notification settings and what Strava syncs
 * (`strava_profile_sync` now covers weight and sex only).
 */
const COACH_PROACTIVE_DEFAULT = {
  preWorkout: true,
  workoutReview: true,
  wellbeingCheck: true,
  weeklySummary: true,
  missedSupport: true,
};
const NOTIFICATIONS_DEFAULT = {
  workoutReminder: true,
  workoutReminderTime: 'morning',
  missedWorkout: true,
  planChanged: true,
  achievements: true,
  workoutSynced: false,
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const add = (name, definition) => queryInterface.addColumn('user_preferences', name, definition, { transaction });
      await add('distance_unit', { type: Sequelize.STRING(4), allowNull: false, defaultValue: 'km' });
      await add('weight_unit', { type: Sequelize.STRING(4), allowNull: false, defaultValue: 'kg' });
      await add('height_unit', { type: Sequelize.STRING(4), allowNull: false, defaultValue: 'cm' });
      await add('temperature_unit', { type: Sequelize.STRING(4), allowNull: false, defaultValue: 'c' });
      await queryInterface.sequelize.query(
        `UPDATE user_preferences
            SET distance_unit = 'mi', weight_unit = 'lb', height_unit = 'ft', temperature_unit = 'f'
          WHERE units = 'imperial'`,
        { transaction },
      );
      await queryInterface.removeColumn('user_preferences', 'units', { transaction });

      await add('language_mode', { type: Sequelize.STRING(8), allowNull: false, defaultValue: 'system' });
      await queryInterface.sequelize.query(
        `UPDATE user_preferences SET language_mode = language WHERE language IN ('ru', 'en')`,
        { transaction },
      );

      await add('coach_tone', { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'neutral' });
      await add('coach_proactive', {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: COACH_PROACTIVE_DEFAULT,
      });
      await add('notifications', { type: Sequelize.JSONB, allowNull: false, defaultValue: NOTIFICATIONS_DEFAULT });
      await add('strava_activities_sync', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
      await add('strava_gear_sync', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true });
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.addColumn(
        'user_preferences',
        'units',
        { type: Sequelize.STRING(16), allowNull: false, defaultValue: 'metric' },
        { transaction },
      );
      await queryInterface.sequelize.query(
        `UPDATE user_preferences SET units = 'imperial' WHERE distance_unit = 'mi'`,
        { transaction },
      );
      for (const column of [
        'distance_unit',
        'weight_unit',
        'height_unit',
        'temperature_unit',
        'language_mode',
        'coach_tone',
        'coach_proactive',
        'notifications',
        'strava_activities_sync',
        'strava_gear_sync',
      ]) {
        await queryInterface.removeColumn('user_preferences', column, { transaction });
      }
    });
  },
};
